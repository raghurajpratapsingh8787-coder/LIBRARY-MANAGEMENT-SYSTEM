import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import {
  authenticate,
  clearRefreshCookie,
  hashToken,
  requireRole,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
  type AccessTokenPayload,
  type AuthenticatedRequest,
} from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { authRateLimiter, verifyCookieCsrf } from '../middleware/security';
import { LibrarySettings, Member, Session, User } from '../models';
import { recordAuditLog } from '../services/auditService';
import { seedSampleLibraryData } from '../services/seedService';
import { formatCode } from '../utils/libraryRules';
import {
  bootstrapSchema,
  createUserSchema,
  forgotPasswordSchema,
  loginSchema,
  objectIdSchema,
  registerMemberSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/schemas';

const router = express.Router();

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) {
      return decodeURIComponent(v.join('='));
    }
  }
  return null;
}

async function createSessionTokens(
  userId: string,
  role: 'SUPER_ADMIN' | 'LIBRARIAN' | 'MEMBER',
  req: express.Request,
  res: express.Response
) {
  const sessionId = new Session()._id;
  const payload: AccessTokenPayload = {
    sub: userId,
    role,
    sessionId: String(sessionId),
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await Session.create({
    _id: sessionId,
    userId,
    refreshTokenHash: hashToken(refreshToken),
    userAgent: req.header('User-Agent') || '',
    ipAddress: req.ip || '',
    isRevoked: false,
    expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
  });

  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

router.get('/status', async (req, res, next) => {
  try {
    const adminCount = await User.countDocuments({ role: 'SUPER_ADMIN' });
    const settings = await LibrarySettings.findOne();
    res.json({
      needsBootstrap: adminCount === 0 && !env.adminInitialPassword,
      allowMemberSelfRegistration: settings ? settings.allowMemberSelfRegistration : true,
      libraryName: settings ? settings.libraryName : 'Folio Ledger Central Library',
      hasSessionCookie: Boolean(parseCookie(req.headers.cookie, 'folio_refresh')),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/bootstrap', authRateLimiter, async (req, res, next) => {
  try {
    if (env.adminInitialPassword) {
      throw new HttpError(403, 'Workspace is managed by environment admin credentials.');
    }
    const existingAdmin = await User.countDocuments({ role: 'SUPER_ADMIN' });
    if (existingAdmin > 0) {
      throw new HttpError(403, 'Super Admin has already been initialized.');
    }

    const parsed = bootstrapSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password, 12);

    const admin = await User.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: 'SUPER_ADMIN',
      avatarUrl: '/src/assets/images/avatar_head_librarian_1795597158213.jpg',
      isActive: true,
      lastLoginAt: new Date(),
    });

    if (parsed.seedSampleData) {
      await seedSampleLibraryData({
        adminUserId: String(admin._id),
        demoStaffPassword: parsed.demoStaffPassword,
      });
    }

    const { accessToken } = await createSessionTokens(String(admin._id), admin.role, req, res);

    await recordAuditLog({
      actorUserId: String(admin._id),
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'ADMIN_BOOTSTRAPPED',
      entityType: 'User',
      entityId: String(admin._id),
      details: 'Initial Super Admin claimed and workspace initialized.',
      ipAddress: req.ip,
    });

    res.status(201).json({
      accessToken,
      user: {
        id: String(admin._id),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatarUrl: admin.avatarUrl,
        memberId: admin.memberId ? String(admin.memberId) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await User.findOne({ email: parsed.email }).select('+passwordHash');

    if (!user || !user.isActive) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const valid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!valid) {
      await recordAuditLog({
        actorEmail: parsed.email,
        actorRole: 'UNKNOWN',
        action: 'LOGIN_FAILED',
        entityType: 'User',
        details: 'Failed login attempt with invalid credentials.',
        ipAddress: req.ip,
      });
      throw new HttpError(401, 'Invalid email or password.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { accessToken } = await createSessionTokens(String(user._id), user.role, req, res);

    await recordAuditLog({
      actorUserId: String(user._id),
      actorEmail: user.email,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      entityType: 'Session',
      details: 'User authenticated successfully.',
      ipAddress: req.ip,
    });

    res.json({
      accessToken,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || '',
        memberId: user.memberId ? String(user.memberId) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Public registration NEVER creates admin or librarian accounts
router.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const settings = await LibrarySettings.findOne();
    if (settings && !settings.allowMemberSelfRegistration) {
      throw new HttpError(403, 'Public member self-registration is currently disabled.');
    }

    const parsed = registerMemberSchema.parse(req.body);
    const existing = await User.findOne({ email: parsed.email });
    if (existing) {
      throw new HttpError(409, 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const memberCount = await Member.countDocuments();
    const memberCode = `${formatCode('MEM', memberCount + 2001)}-${crypto.randomInt(10, 99)}`;

    const member = await Member.create({
      memberCode,
      fullName: parsed.name,
      email: parsed.email,
      phoneNumber: parsed.phoneNumber,
      address: parsed.address,
      membershipType: 'GENERAL',
      registrationDate: new Date(),
      membershipExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      maxBorrowLimit: settings?.borrowingLimits?.GENERAL || 3,
    });

    const user = await User.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: 'MEMBER', // Strictly locked to MEMBER
      memberId: member._id,
      isActive: true,
      lastLoginAt: new Date(),
    });

    member.userId = user._id;
    await member.save();

    const { accessToken } = await createSessionTokens(String(user._id), 'MEMBER', req, res);

    res.status(201).json({
      accessToken,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || '',
        memberId: String(member._id),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', verifyCookieCsrf, async (req, res, next) => {
  try {
    const refreshToken = parseCookie(req.headers.cookie, 'folio_refresh');
    if (!refreshToken) {
      throw new HttpError(401, 'Refresh token missing.');
    }

    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as AccessTokenPayload;
    const tokenHash = hashToken(refreshToken);
    const session = await Session.findById(decoded.sessionId);

    if (!session || session.isRevoked || session.refreshTokenHash !== tokenHash || session.expiresAt < new Date()) {
      clearRefreshCookie(res);
      throw new HttpError(401, 'Refresh session invalid or revoked.');
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      throw new HttpError(401, 'User account is inactive.');
    }

    // Rotate refresh token
    const nextPayload: AccessTokenPayload = {
      sub: String(user._id),
      role: user.role,
      sessionId: String(session._id),
    };
    const nextAccessToken = signAccessToken(nextPayload);
    const nextRefreshToken = signRefreshToken(nextPayload);

    session.refreshTokenHash = hashToken(nextRefreshToken);
    session.expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    await session.save();

    setRefreshCookie(res, nextRefreshToken);

    res.json({
      accessToken: nextAccessToken,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || '',
        memberId: user.memberId ? String(user.memberId) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', verifyCookieCsrf, async (req, res, next) => {
  try {
    const refreshToken = parseCookie(req.headers.cookie, 'folio_refresh');
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as AccessTokenPayload;
        await Session.findByIdAndUpdate(decoded.sessionId, { $set: { isRevoked: true } });
      } catch {
        // Ignore invalid token on logout
      }
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', authRateLimiter, async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.parse(req.body);
    const user = await User.findOne({ email: parsed.email });

    let resetTokenPreview: string | undefined;
    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      user.passwordResetTokenHash = hashToken(rawToken);
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      if (!env.isProduction) {
        resetTokenPreview = rawToken;
      }
    }

    res.json({
      message: 'If an account matches that email, password reset instructions have been generated.',
      ...(resetTokenPreview ? { devResetToken: resetTokenPreview } : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authRateLimiter, async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.parse(req.body);
    const user = await User.findOne({ email: parsed.email }).select(
      '+passwordResetTokenHash +passwordResetExpiresAt'
    );

    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date() ||
      user.passwordResetTokenHash !== hashToken(parsed.token)
    ) {
      throw new HttpError(400, 'Invalid or expired password reset token.');
    }

    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    await Session.updateMany({ userId: user._id }, { $set: { isRevoked: true } });
    res.json({ message: 'Password updated successfully. Please sign in with your new password.' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  res.json({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || '',
    memberId: user.memberId ? String(user.memberId) : null,
    lastLoginAt: user.lastLoginAt,
  });
});

router.put('/profile', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = updateProfileSchema.parse(req.body);
    const user = await User.findById(req.user!._id).select('+passwordHash');
    if (!user) throw new HttpError(404, 'User not found.');

    user.name = parsed.name;
    if (parsed.newPassword) {
      if (!parsed.currentPassword) {
        throw new HttpError(400, 'Current password is required to set a new password.');
      }
      const matches = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
      if (!matches) {
        throw new HttpError(400, 'Current password is incorrect.');
      }
      user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    }
    await user.save();

    res.json({
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || '',
      memberId: user.memberId ? String(user.memberId) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const sessions = await Session.find({
      userId: req.user!._id,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .select('-refreshTokenHash');
    res.json({
      sessions: sessions.map((s) => ({
        id: String(s._id),
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: String(s._id) === req.sessionId,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/sessions/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const session = await Session.findOneAndUpdate(
      { _id: id, userId: req.user!._id },
      { $set: { isRevoked: true } },
      { new: true }
    );
    if (!session) throw new HttpError(404, 'Session not found.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Super Admin user & staff management
router.get('/users', authenticate, requireRole('SUPER_ADMIN'), async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('-passwordHash');
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.post('/users', authenticate, requireRole('SUPER_ADMIN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const created = await User.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: parsed.role,
      isActive: true,
    });

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: String(created._id),
      details: `Created ${created.role} user ${created.email}.`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      user: {
        _id: created._id,
        name: created.name,
        email: created.email,
        role: created.role,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/toggle', authenticate, requireRole('SUPER_ADMIN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    if (id === String(req.user!._id)) {
      throw new HttpError(400, 'You cannot deactivate your own active Super Admin account.');
    }
    const target = await User.findById(id);
    if (!target) throw new HttpError(404, 'User not found.');
    target.isActive = !target.isActive;
    await target.save();
    if (!target.isActive) {
      await Session.updateMany({ userId: target._id }, { $set: { isRevoked: true } });
    }
    res.json({ user: target });
  } catch (err) {
    next(err);
  }
});

export default router;
