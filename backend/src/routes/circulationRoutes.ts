import express from 'express';
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { IssueTransaction, LibrarySettings, ReturnTransaction } from '../models';
import { issueBookAtomic, returnBookAtomic } from '../services/circulationService';
import { calculateOverdueFine } from '../utils/libraryRules';
import { issueBookSchema, returnBookSchema } from '../validators/schemas';

const router = express.Router();

router.get('/transactions', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const now = new Date();
    await IssueTransaction.updateMany(
      { status: 'ISSUED', dueDate: { $lt: now } },
      { $set: { status: 'OVERDUE' } }
    );

    const status = String(req.query.status || '').trim();
    const filter: Record<string, unknown> = {};

    if (req.user!.role === 'MEMBER') {
      if (!req.user!.memberId) {
        res.json({ issues: [], returns: [] });
        return;
      }
      filter.memberId = req.user!.memberId;
    }

    if (status && ['ISSUED', 'RETURNED', 'OVERDUE'].includes(status)) {
      filter.status = status;
    }

    const settings = (await LibrarySettings.findOne()) || {
      dailyFineRate: 1.5,
      maxFineAmount: 50,
      gracePeriodDays: 1,
    };

    const [issues, returns] = await Promise.all([
      IssueTransaction.find(filter)
        .sort({ issueDate: -1 })
        .limit(200)
        .populate('bookId', 'title isbn bookCode shelfNumber')
        .populate('bookCopyId', 'accessionNumber barcode condition')
        .populate('memberId', 'fullName memberCode email membershipType status'),
      ReturnTransaction.find(req.user!.role === 'MEMBER' && req.user!.memberId ? { memberId: req.user!.memberId } : {})
        .sort({ returnDate: -1 })
        .limit(100)
        .populate('bookId', 'title isbn bookCode')
        .populate('bookCopyId', 'accessionNumber')
        .populate('memberId', 'fullName memberCode'),
    ]);

    // Enrich active issues with live estimated overdue calculation
    const enrichedIssues = issues.map((iss) => {
      const obj = iss.toObject();
      if (iss.status !== 'RETURNED') {
        const calc = calculateOverdueFine(iss.dueDate, now, {
          dailyFineRate: settings.dailyFineRate,
          maxFineAmount: settings.maxFineAmount,
          gracePeriodDays: settings.gracePeriodDays,
        });
        return { ...obj, estimatedOverdueDays: calc.overdueDays, estimatedFine: calc.fineAmount };
      }
      return { ...obj, estimatedOverdueDays: 0, estimatedFine: 0 };
    });

    res.json({ issues: enrichedIssues, returns });
  } catch (err) {
    next(err);
  }
});

router.get('/overdue', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const now = new Date();
    await IssueTransaction.updateMany(
      { status: 'ISSUED', dueDate: { $lt: now } },
      { $set: { status: 'OVERDUE' } }
    );

    const filter: Record<string, unknown> = { status: 'OVERDUE' };
    if (req.user!.role === 'MEMBER') {
      if (!req.user!.memberId) {
        res.json({ overdue: [] });
        return;
      }
      filter.memberId = req.user!.memberId;
    }

    const settings = (await LibrarySettings.findOne()) || {
      dailyFineRate: 1.5,
      maxFineAmount: 50,
      gracePeriodDays: 1,
    };

    const overdueDocs = await IssueTransaction.find(filter)
      .sort({ dueDate: 1 })
      .populate('bookId', 'title isbn bookCode shelfNumber')
      .populate('bookCopyId', 'accessionNumber')
      .populate('memberId', 'fullName memberCode email phoneNumber');

    const overdue = overdueDocs.map((doc) => {
      const calc = calculateOverdueFine(doc.dueDate, now, {
        dailyFineRate: settings.dailyFineRate,
        maxFineAmount: settings.maxFineAmount,
        gracePeriodDays: settings.gracePeriodDays,
      });
      return {
        ...doc.toObject(),
        overdueDays: calc.overdueDays,
        accruedFine: calc.fineAmount,
      };
    });

    res.json({ overdue });
  } catch (err) {
    next(err);
  }
});

router.post('/issue', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = issueBookSchema.parse(req.body);
    const dueDate = new Date(parsed.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw new HttpError(400, 'Invalid due date.');
    }

    const result = await issueBookAtomic({
      memberId: parsed.memberId,
      bookId: parsed.bookId,
      bookCopyId: parsed.bookCopyId,
      dueDate,
      notes: parsed.notes,
      actor: req.user!,
      ipAddress: req.ip,
    });

    res.status(201).json({
      issueTransaction: result.issueTx,
      book: result.book,
      copy: result.copy,
      member: result.member,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/return', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = returnBookSchema.parse(req.body);
    const returnDate = parsed.returnDate ? new Date(parsed.returnDate) : new Date();
    if (Number.isNaN(returnDate.getTime())) {
      throw new HttpError(400, 'Invalid return date.');
    }

    const result = await returnBookAtomic({
      issueTransactionId: parsed.issueTransactionId,
      returnDate,
      conditionOnReturn: parsed.conditionOnReturn,
      notes: parsed.notes,
      actor: req.user!,
      ipAddress: req.ip,
    });

    res.status(201).json({
      returnTransaction: result.returnTx,
      issueTransaction: result.issueTx,
      fine: result.fineDoc,
      book: result.book,
      copy: result.copy,
      member: result.member,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
