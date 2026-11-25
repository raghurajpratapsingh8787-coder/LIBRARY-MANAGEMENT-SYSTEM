import crypto from 'crypto';
import mongoose from 'mongoose';
import { runInTransaction } from '../config/db';
import { HttpError } from '../middleware/errorHandler';
import {
  Book,
  BookCopy,
  Fine,
  FinePayment,
  IssueTransaction,
  LibrarySettings,
  Member,
  Reservation,
  ReturnTransaction,
  type IUser,
} from '../models';
import {
  calculateOverdueFine,
  computeNextAvailableCopies,
  evaluateBorrowingEligibility,
  formatCode,
} from '../utils/libraryRules';
import { recordAuditLog } from './auditService';
import { createNotification } from './notificationService';

async function getSettingsOrDefault() {
  let settings = await LibrarySettings.findOne();
  if (!settings) {
    settings = await LibrarySettings.create({});
  }
  return settings;
}

export async function issueBookAtomic(params: {
  memberId: string;
  bookId: string;
  bookCopyId?: string;
  dueDate: Date;
  notes?: string;
  actor: IUser;
  ipAddress?: string;
}) {
  const settings = await getSettingsOrDefault();

  const result = await runInTransaction(async (session) => {
    const member = await Member.findById(params.memberId).session(session);
    if (!member) {
      throw new HttpError(404, 'Member not found.');
    }

    const eligibility = evaluateBorrowingEligibility({
      memberStatus: member.status,
      membershipExpiryDate: member.membershipExpiryDate,
      activeBorrowCount: member.activeBorrowCount,
      borrowingLimit: member.maxBorrowLimit,
      outstandingFineAmount: member.outstandingFineBalance,
      maxAllowedFineBeforeBlock: settings.maxAllowedFineBeforeBlock,
    });

    if (!eligibility.eligible) {
      throw new HttpError(400, eligibility.reasons.join(' '));
    }

    const book = await Book.findById(params.bookId).session(session);
    if (!book || book.status === 'ARCHIVED') {
      throw new HttpError(404, 'Book not found or archived.');
    }

    if (book.availableCopies <= 0) {
      throw new HttpError(409, 'No available copies of this book remain for issue.');
    }

    const copyQuery: Record<string, unknown> = {
      bookId: book._id,
      status: 'AVAILABLE',
    };
    if (params.bookCopyId) {
      copyQuery._id = params.bookCopyId;
    }

    const copy = await BookCopy.findOneAndUpdate(
      copyQuery,
      { $set: { status: 'ISSUED' } },
      { returnDocument: 'after', session: session ?? undefined }
    );

    if (!copy) {
      throw new HttpError(
        409,
        params.bookCopyId
          ? 'Selected physical book copy is no longer available.'
          : 'No physical book copy is currently available.'
      );
    }

    const nextAvailable = computeNextAvailableCopies(
      book.availableCopies,
      book.totalCopies,
      -1
    );

    book.availableCopies = nextAvailable;
    book.borrowCount += 1;
    book.status = nextAvailable === 0 ? 'OUT_OF_STOCK' : 'AVAILABLE';
    await book.save({ session: session ?? undefined });

    member.activeBorrowCount += 1;
    await member.save({ session: session ?? undefined });

    // Mark any AVAILABLE reservation for this member & book as FULFILLED
    await Reservation.updateOne(
      {
        bookId: book._id,
        memberId: member._id,
        status: { $in: ['PENDING', 'AVAILABLE'] },
      },
      { $set: { status: 'FULFILLED', fulfilledAt: new Date() } },
      { session: session ?? undefined }
    );

    const txSuffix = crypto.randomInt(1000, 9999);
    const count = await IssueTransaction.countDocuments().session(session);
    const transactionCode = `${formatCode('ISS', count + 1)}-${txSuffix}`;

    const [issueTx] = await IssueTransaction.create(
      [
        {
          transactionCode,
          bookId: book._id,
          bookCopyId: copy._id,
          memberId: member._id,
          issuedByUserId: params.actor._id,
          issueDate: new Date(),
          dueDate: params.dueDate,
          status: 'ISSUED',
          notes: params.notes || '',
        },
      ],
      { session }
    );

    return { issueTx, book, copy, member };
  });

  await recordAuditLog({
    actorUserId: String(params.actor._id),
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: 'BOOK_ISSUED',
    entityType: 'IssueTransaction',
    entityId: String(result.issueTx._id),
    details: `Issued "${result.book.title}" (Copy ${result.copy.accessionNumber}) to ${result.member.fullName} (${result.member.memberCode}).`,
    ipAddress: params.ipAddress,
  });

  await createNotification({
    recipientRole: 'LIBRARIAN',
    title: 'Book Issued',
    message: `${result.book.title} issued to ${result.member.fullName} (${result.copy.accessionNumber}).`,
    type: 'BOOK_ISSUED',
    link: '/issue-books',
  });

  return result;
}

export async function returnBookAtomic(params: {
  issueTransactionId: string;
  returnDate: Date;
  conditionOnReturn: 'NEW' | 'GOOD' | 'FAIR' | 'WORN' | 'DAMAGED';
  notes?: string;
  actor: IUser;
  ipAddress?: string;
}) {
  const settings = await getSettingsOrDefault();

  const result = await runInTransaction(async (session) => {
    const issueTx = await IssueTransaction.findById(params.issueTransactionId).session(session);
    if (!issueTx) {
      throw new HttpError(404, 'Issue transaction not found.');
    }
    if (issueTx.status === 'RETURNED') {
      throw new HttpError(409, 'This book issue transaction has already been returned.');
    }

    const book = await Book.findById(issueTx.bookId).session(session);
    const copy = await BookCopy.findById(issueTx.bookCopyId).session(session);
    const member = await Member.findById(issueTx.memberId).session(session);

    if (!book || !copy || !member) {
      throw new HttpError(404, 'Associated book, copy, or member record is missing.');
    }

    const fineCalc = calculateOverdueFine(issueTx.dueDate, params.returnDate, {
      dailyFineRate: settings.dailyFineRate,
      maxFineAmount: settings.maxFineAmount,
      gracePeriodDays: settings.gracePeriodDays,
    });

    issueTx.status = 'RETURNED';
    issueTx.returnedDate = params.returnDate;
    await issueTx.save({ session });

    // Check if next waiting reservation exists for this book
    const nextReservation = await Reservation.findOne({
      bookId: book._id,
      status: 'PENDING',
    })
      .sort({ queuePosition: 1, reservationDate: 1 })
      .session(session);

    const copyLostOrDamaged = params.conditionOnReturn === 'DAMAGED';

    if (copyLostOrDamaged) {
      copy.status = 'DAMAGED';
      copy.condition = 'WORN';
    } else {
      copy.status = 'AVAILABLE';
      copy.condition = params.conditionOnReturn as 'NEW' | 'GOOD' | 'FAIR' | 'WORN';
    }
    await copy.save({ session });

    if (!copyLostOrDamaged) {
      const nextAvailable = computeNextAvailableCopies(
        book.availableCopies,
        book.totalCopies,
        1
      );
      book.availableCopies = nextAvailable;
      book.status = nextAvailable > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK';
      await book.save({ session });
    }

    member.activeBorrowCount = Math.max(0, member.activeBorrowCount - 1);

    const retCount = await ReturnTransaction.countDocuments().session(session);
    const returnCode = `${formatCode('RET', retCount + 1)}-${crypto.randomInt(1000, 9999)}`;

    const [returnTx] = await ReturnTransaction.create(
      [
        {
          returnCode,
          issueTransactionId: issueTx._id,
          bookId: book._id,
          bookCopyId: copy._id,
          memberId: member._id,
          processedByUserId: params.actor._id,
          returnDate: params.returnDate,
          overdueDays: fineCalc.overdueDays,
          fineAmount: fineCalc.fineAmount,
          conditionOnReturn: params.conditionOnReturn,
          notes: params.notes || '',
        },
      ],
      { session }
    );

    let fineDoc = null;
    if (fineCalc.fineAmount > 0) {
      const fineCount = await Fine.countDocuments().session(session);
      const fineCode = `${formatCode('FIN', fineCount + 1)}-${crypto.randomInt(100, 999)}`;
      const [createdFine] = await Fine.create(
        [
          {
            fineCode,
            memberId: member._id,
            issueTransactionId: issueTx._id,
            returnTransactionId: returnTx._id,
            bookId: book._id,
            overdueDays: fineCalc.overdueDays,
            dailyRateApplied: settings.dailyFineRate,
            amount: fineCalc.fineAmount,
            paidAmount: 0,
            status: 'UNPAID',
            reason: `Returned ${fineCalc.overdueDays} day(s) after due date (${fineCalc.billableDays} billable).`,
          },
        ],
        { session }
      );
      fineDoc = createdFine;
      member.outstandingFineBalance = Number(
        (member.outstandingFineBalance + fineCalc.fineAmount).toFixed(2)
      );
    }

    await member.save({ session });

    let promotedReservation = null;
    if (!copyLostOrDamaged && nextReservation) {
      nextReservation.status = 'AVAILABLE';
      nextReservation.notifiedAt = new Date();
      nextReservation.expiryDate = new Date(
        Date.now() + settings.reservationHoldHours * 60 * 60 * 1000
      );
      await nextReservation.save({ session });
      promotedReservation = nextReservation;
    }

    return {
      returnTx,
      issueTx,
      book,
      copy,
      member,
      fineDoc,
      promotedReservation,
    };
  });

  await recordAuditLog({
    actorUserId: String(params.actor._id),
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: 'BOOK_RETURNED',
    entityType: 'ReturnTransaction',
    entityId: String(result.returnTx._id),
    details: `Returned "${result.book.title}" (${result.copy.accessionNumber}) from ${result.member.fullName}. Overdue: ${result.returnTx.overdueDays}d, Fine: $${result.returnTx.fineAmount.toFixed(2)}.`,
    ipAddress: params.ipAddress,
  });

  if (result.promotedReservation) {
    const waitingMember = await Member.findById(result.promotedReservation.memberId);
    if (waitingMember) {
      await createNotification({
        recipientUserId: waitingMember.userId ? String(waitingMember.userId) : undefined,
        recipientRole: waitingMember.userId ? undefined : 'LIBRARIAN',
        title: 'Reserved Book Available',
        message: `"${result.book.title}" is now available for ${waitingMember.fullName}. Hold expires in ${settings.reservationHoldHours} hours.`,
        type: 'RESERVATION_AVAILABLE',
        link: '/reservations',
      });
    }
  }

  return result;
}

export async function recordFinePaymentAtomic(params: {
  fineId: string;
  amountPaid: number;
  paymentMethod: 'CASH' | 'CARD_DESK' | 'BANK_TRANSFER';
  notes?: string;
  actor: IUser;
  ipAddress?: string;
}) {
  const result = await runInTransaction(async (session) => {
    const fine = await Fine.findById(params.fineId).session(session);
    if (!fine) {
      throw new HttpError(404, 'Fine record not found.');
    }
    if (fine.status === 'PAID' || fine.status === 'WAIVED') {
      throw new HttpError(409, `This fine is already ${fine.status.toLowerCase()}.`);
    }

    const remaining = Number((fine.amount - fine.paidAmount).toFixed(2));
    if (params.amountPaid > remaining + 0.001) {
      throw new HttpError(400, `Payment exceeds remaining fine balance of $${remaining.toFixed(2)}.`);
    }

    const member = await Member.findById(fine.memberId).session(session);
    if (!member) {
      throw new HttpError(404, 'Member record not found.');
    }

    fine.paidAmount = Number((fine.paidAmount + params.amountPaid).toFixed(2));
    fine.status = fine.paidAmount >= fine.amount - 0.001 ? 'PAID' : 'PARTIALLY_PAID';
    await fine.save({ session });

    member.outstandingFineBalance = Math.max(
      0,
      Number((member.outstandingFineBalance - params.amountPaid).toFixed(2))
    );
    await member.save({ session });

    const payCount = await FinePayment.countDocuments().session(session);
    const receiptNumber = `${formatCode('RCP', payCount + 1)}-${crypto.randomInt(1000, 9999)}`;

    const [payment] = await FinePayment.create(
      [
        {
          receiptNumber,
          fineId: fine._id,
          memberId: member._id,
          receivedByUserId: params.actor._id,
          amountPaid: params.amountPaid,
          paymentMethod: params.paymentMethod,
          paymentDate: new Date(),
          notes: params.notes || '',
        },
      ],
      { session }
    );

    return { fine, payment, member };
  });

  await recordAuditLog({
    actorUserId: String(params.actor._id),
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: 'FINE_PAYMENT_RECORDED',
    entityType: 'FinePayment',
    entityId: String(result.payment._id),
    details: `Recorded $${params.amountPaid.toFixed(2)} (${params.paymentMethod}) toward fine ${result.fine.fineCode} for ${result.member.fullName}. Receipt ${result.payment.receiptNumber}.`,
    ipAddress: params.ipAddress,
  });

  return result;
}
