import crypto from 'crypto';
import express from 'express';
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { Fine, IssueTransaction, LibrarySettings, Member } from '../models';
import { recordAuditLog } from '../services/auditService';
import { escapeRegex, formatCode } from '../utils/libraryRules';
import { memberSchema, objectIdSchema } from '../validators/schemas';

const router = express.Router();

router.get('/', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const membershipType = String(req.query.membershipType || '').trim();
    const sortBy = String(req.query.sortBy || 'newest');

    const filter: Record<string, unknown> = {};
    if (status && ['ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(status)) {
      filter.status = status;
    }
    if (membershipType && ['STUDENT', 'FACULTY', 'STAFF', 'GENERAL'].includes(membershipType)) {
      filter.membershipType = membershipType;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { fullName: regex },
        { memberCode: regex },
        { email: regex },
        { phoneNumber: regex },
      ];
    }

    let sortStage: Record<string, 1 | -1> = { createdAt: -1 };
    if (sortBy === 'name_asc') sortStage = { fullName: 1 };
    else if (sortBy === 'fines_desc') sortStage = { outstandingFineBalance: -1 };

    const members = await Member.find(filter).sort(sortStage);
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    if (req.user!.role === 'MEMBER' && String(req.user!.memberId) !== id) {
      throw new HttpError(403, 'You are only permitted to view your own member profile.');
    }

    const member = await Member.findById(id);
    if (!member) throw new HttpError(404, 'Member not found.');

    const [borrowingHistory, pendingReturns, fines] = await Promise.all([
      IssueTransaction.find({ memberId: id })
        .sort({ issueDate: -1 })
        .populate('bookId', 'title isbn bookCode')
        .populate('bookCopyId', 'accessionNumber'),
      IssueTransaction.find({ memberId: id, status: { $in: ['ISSUED', 'OVERDUE'] } })
        .sort({ dueDate: 1 })
        .populate('bookId', 'title isbn shelfNumber')
        .populate('bookCopyId', 'accessionNumber'),
      Fine.find({ memberId: id })
        .sort({ createdAt: -1 })
        .populate('bookId', 'title'),
    ]);

    res.json({ member, borrowingHistory, pendingReturns, fines });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = memberSchema.parse(req.body);
    const settings = await LibrarySettings.findOne();
    const defaultLimit =
      settings?.borrowingLimits?.[parsed.membershipType] ??
      (parsed.membershipType === 'FACULTY' ? 10 : parsed.membershipType === 'STAFF' ? 7 : parsed.membershipType === 'STUDENT' ? 5 : 3);

    const count = await Member.countDocuments();
    const memberCode = `${formatCode('MEM', 2001 + count)}-${crypto.randomInt(10, 99)}`;

    const member = await Member.create({
      memberCode,
      fullName: parsed.fullName,
      email: parsed.email,
      phoneNumber: parsed.phoneNumber,
      dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : undefined,
      gender: parsed.gender,
      address: parsed.address,
      membershipType: parsed.membershipType,
      registrationDate: new Date(),
      membershipExpiryDate: new Date(parsed.membershipExpiryDate),
      status: parsed.status,
      maxBorrowLimit: parsed.maxBorrowLimit || defaultLimit,
    });

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MEMBER_CREATED',
      entityType: 'Member',
      entityId: String(member._id),
      details: `Registered member ${member.fullName} (${member.memberCode}).`,
      ipAddress: req.ip,
    });

    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const parsed = memberSchema.parse(req.body);

    const updated = await Member.findByIdAndUpdate(
      id,
      {
        fullName: parsed.fullName,
        email: parsed.email,
        phoneNumber: parsed.phoneNumber,
        dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : undefined,
        gender: parsed.gender,
        address: parsed.address,
        membershipType: parsed.membershipType,
        membershipExpiryDate: new Date(parsed.membershipExpiryDate),
        status: parsed.status,
        ...(parsed.maxBorrowLimit ? { maxBorrowLimit: parsed.maxBorrowLimit } : {}),
      },
      { new: true, runValidators: true }
    );
    if (!updated) throw new HttpError(404, 'Member not found.');

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MEMBER_UPDATED',
      entityType: 'Member',
      entityId: id,
      details: `Updated member ${updated.fullName} (${updated.memberCode}).`,
      ipAddress: req.ip,
    });

    res.json({ member: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const activeIssues = await IssueTransaction.countDocuments({
      memberId: id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    });
    if (activeIssues > 0) {
      throw new HttpError(409, 'Cannot remove a member who still has unreturned books.');
    }

    const deleted = await Member.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, 'Member not found.');

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MEMBER_DELETED',
      entityType: 'Member',
      entityId: id,
      details: `Deleted member ${deleted.fullName} (${deleted.memberCode}).`,
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
