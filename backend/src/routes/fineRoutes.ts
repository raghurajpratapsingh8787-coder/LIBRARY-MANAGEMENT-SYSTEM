import crypto from 'crypto';
import express from 'express';
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { Fine, FinePayment, Member } from '../models';
import { recordAuditLog } from '../services/auditService';
import { recordFinePaymentAtomic } from '../services/circulationService';
import { formatCode } from '../utils/libraryRules';
import { finePaymentSchema, fineWaiveSchema, objectIdSchema } from '../validators/schemas';

const router = express.Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const status = String(req.query.status || '').trim();
    const filter: Record<string, unknown> = {};

    if (req.user!.role === 'MEMBER') {
      if (!req.user!.memberId) {
        res.json({ fines: [], payments: [] });
        return;
      }
      filter.memberId = req.user!.memberId;
    }

    if (status && ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED'].includes(status)) {
      filter.status = status;
    }

    const paymentFilter =
      req.user!.role === 'MEMBER' && req.user!.memberId
        ? { memberId: req.user!.memberId }
        : {};

    const [fines, payments] = await Promise.all([
      Fine.find(filter)
        .sort({ createdAt: -1 })
        .populate('memberId', 'fullName memberCode email')
        .populate('bookId', 'title bookCode isbn'),
      FinePayment.find(paymentFilter)
        .sort({ paymentDate: -1 })
        .limit(100)
        .populate('memberId', 'fullName memberCode')
        .populate('fineId', 'fineCode amount'),
    ]);

    res.json({ fines, payments });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pay', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const parsed = finePaymentSchema.parse(req.body);

    const result = await recordFinePaymentAtomic({
      fineId: id,
      amountPaid: parsed.amountPaid,
      paymentMethod: parsed.paymentMethod,
      notes: parsed.notes,
      actor: req.user!,
      ipAddress: req.ip,
    });

    res.status(201).json({
      fine: result.fine,
      payment: result.payment,
      member: result.member,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/waive', authenticate, requireRole('SUPER_ADMIN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const parsed = fineWaiveSchema.parse(req.body);

    const fine = await Fine.findById(id);
    if (!fine) throw new HttpError(404, 'Fine not found.');
    if (fine.status === 'PAID' || fine.status === 'WAIVED') {
      throw new HttpError(409, 'Fine is already settled.');
    }

    const waivedAmount = Number((fine.amount - fine.paidAmount).toFixed(2));
    fine.status = 'WAIVED';
    fine.waivedByUserId = req.user!._id;
    fine.waiverReason = parsed.waiverReason;
    await fine.save();

    const member = await Member.findById(fine.memberId);
    if (member) {
      member.outstandingFineBalance = Math.max(
        0,
        Number((member.outstandingFineBalance - waivedAmount).toFixed(2))
      );
      await member.save();
    }

    const payCount = await FinePayment.countDocuments();
    const payment = await FinePayment.create({
      receiptNumber: `${formatCode('WVR', payCount + 1)}-${crypto.randomInt(100, 999)}`,
      fineId: fine._id,
      memberId: fine.memberId,
      receivedByUserId: req.user!._id,
      amountPaid: waivedAmount,
      paymentMethod: 'WAIVER',
      paymentDate: new Date(),
      notes: parsed.waiverReason,
    });

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'FINE_WAIVED',
      entityType: 'Fine',
      entityId: String(fine._id),
      details: `Waived remaining $${waivedAmount.toFixed(2)} on fine ${fine.fineCode}. Reason: ${parsed.waiverReason}`,
      ipAddress: req.ip,
    });

    res.json({ fine, payment });
  } catch (err) {
    next(err);
  }
});

export default router;
