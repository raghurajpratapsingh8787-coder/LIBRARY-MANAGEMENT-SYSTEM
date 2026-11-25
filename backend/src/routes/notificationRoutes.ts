import express from 'express';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth';
import { Notification } from '../models';
import { objectIdSchema } from '../validators/schemas';

const router = express.Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user!;
    const notifications = await Notification.find({
      $or: [
        { recipientUserId: user._id },
        { recipientRole: user.role },
        { recipientRole: 'ALL' },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(40);

    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const user = req.user!;
    const updated = await Notification.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { recipientUserId: user._id },
          { recipientRole: user.role },
          { recipientRole: 'ALL' },
        ],
      },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!updated) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    res.json({ notification: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/mark-all-read', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user!;
    await Notification.updateMany(
      {
        $or: [
          { recipientUserId: user._id },
          { recipientRole: user.role },
          { recipientRole: 'ALL' },
        ],
        isRead: false,
      },
      { $set: { isRead: true } }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
