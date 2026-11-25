import crypto from 'crypto';
import express from 'express';
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { Book, LibrarySettings, Member, Reservation } from '../models';
import { recordAuditLog } from '../services/auditService';
import { formatCode } from '../utils/libraryRules';
import { objectIdSchema, reservationSchema } from '../validators/schemas';

const router = express.Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    // Expire stale AVAILABLE holds automatically
    await Reservation.updateMany(
      { status: 'AVAILABLE', expiryDate: { $lt: new Date() } },
      { $set: { status: 'EXPIRED' } }
    );

    const status = String(req.query.status || '').trim();
    const filter: Record<string, unknown> = {};

    if (req.user!.role === 'MEMBER') {
      if (!req.user!.memberId) {
        res.json({ reservations: [] });
        return;
      }
      filter.memberId = req.user!.memberId;
    }

    if (status && ['PENDING', 'AVAILABLE', 'FULFILLED', 'CANCELLED', 'EXPIRED'].includes(status)) {
      filter.status = status;
    }

    const reservations = await Reservation.find(filter)
      .sort({ status: 1, queuePosition: 1, reservationDate: -1 })
      .populate('bookId', 'title isbn bookCode availableCopies totalCopies shelfNumber')
      .populate('memberId', 'fullName memberCode email status');

    res.json({ reservations });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = reservationSchema.parse(req.body);
    let targetMemberId = parsed.memberId;

    if (req.user!.role === 'MEMBER') {
      if (!req.user!.memberId) {
        throw new HttpError(400, 'Your account is not linked to a library member profile.');
      }
      targetMemberId = String(req.user!.memberId);
    } else if (!targetMemberId) {
      throw new HttpError(400, 'Please select a member for this reservation.');
    }

    const [book, member, settings] = await Promise.all([
      Book.findById(parsed.bookId),
      Member.findById(targetMemberId),
      LibrarySettings.findOne(),
    ]);

    if (!book || book.status === 'ARCHIVED') {
      throw new HttpError(404, 'Book not found.');
    }
    if (!member || member.status !== 'ACTIVE') {
      throw new HttpError(400, 'Only active members can place reservations.');
    }
    if (book.availableCopies > 0) {
      throw new HttpError(
        400,
        'Copies of this book are currently available on the shelf—no waitlist reservation is required.'
      );
    }

    const duplicate = await Reservation.findOne({
      bookId: book._id,
      memberId: member._id,
      status: { $in: ['PENDING', 'AVAILABLE'] },
    });
    if (duplicate) {
      throw new HttpError(409, 'This member already has an active reservation for this book.');
    }

    const activeQueueCount = await Reservation.countDocuments({
      bookId: book._id,
      status: { $in: ['PENDING', 'AVAILABLE'] },
    });

    const totalResCount = await Reservation.countDocuments();
    const reservationCode = `${formatCode('RES', totalResCount + 1)}-${crypto.randomInt(100, 999)}`;
    const holdHours = settings?.reservationHoldHours || 48;

    const reservation = await Reservation.create({
      reservationCode,
      bookId: book._id,
      memberId: member._id,
      reservationDate: new Date(),
      expiryDate: new Date(Date.now() + (holdHours + 7 * 24) * 60 * 60 * 1000),
      status: 'PENDING',
      queuePosition: activeQueueCount + 1,
    });

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'RESERVATION_CREATED',
      entityType: 'Reservation',
      entityId: String(reservation._id),
      details: `Reserved "${book.title}" for ${member.fullName} (Queue #${reservation.queuePosition}).`,
      ipAddress: req.ip,
    });

    const populated = await Reservation.findById(reservation._id)
      .populate('bookId', 'title isbn bookCode availableCopies totalCopies')
      .populate('memberId', 'fullName memberCode email');

    res.status(201).json({ reservation: populated });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/cancel', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const reservation = await Reservation.findById(id);
    if (!reservation) throw new HttpError(404, 'Reservation not found.');

    if (
      req.user!.role === 'MEMBER' &&
      String(reservation.memberId) !== String(req.user!.memberId)
    ) {
      throw new HttpError(403, 'You can only cancel your own reservations.');
    }

    if (!['PENDING', 'AVAILABLE'].includes(reservation.status)) {
      throw new HttpError(409, 'Only active reservations can be cancelled.');
    }

    reservation.status = 'CANCELLED';
    await reservation.save();

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'RESERVATION_CANCELLED',
      entityType: 'Reservation',
      entityId: id,
      details: `Cancelled reservation ${reservation.reservationCode}.`,
      ipAddress: req.ip,
    });

    res.json({ reservation });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/fulfill', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const reservation = await Reservation.findById(id);
    if (!reservation) throw new HttpError(404, 'Reservation not found.');
    if (!['PENDING', 'AVAILABLE'].includes(reservation.status)) {
      throw new HttpError(409, 'Reservation is not active.');
    }

    reservation.status = 'FULFILLED';
    reservation.fulfilledAt = new Date();
    await reservation.save();

    res.json({ reservation });
  } catch (err) {
    next(err);
  }
});

export default router;
