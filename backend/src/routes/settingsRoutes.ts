import express from 'express';
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { AuditLog, LibrarySettings } from '../models';
import { recordAuditLog } from '../services/auditService';
import { settingsSchema } from '../validators/schemas';

const router = express.Router();

router.get('/', authenticate, async (_req, res, next) => {
  try {
    let settings = await LibrarySettings.findOne();
    if (!settings) {
      settings = await LibrarySettings.create({});
    }
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/', authenticate, requireRole('SUPER_ADMIN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = settingsSchema.parse(req.body);
    let settings = await LibrarySettings.findOne();
    if (!settings) {
      settings = await LibrarySettings.create(parsed);
    } else {
      Object.assign(settings, parsed);
      await settings.save();
    }

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'SETTINGS_UPDATED',
      entityType: 'LibrarySettings',
      entityId: String(settings._id),
      details: `Updated library policy (Daily fine $${settings.dailyFineRate}, Max $${settings.maxFineAmount}, Grace ${settings.gracePeriodDays}d).`,
      ipAddress: req.ip,
    });

    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', authenticate, requireRole('SUPER_ADMIN'), async (_req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

export default router;
