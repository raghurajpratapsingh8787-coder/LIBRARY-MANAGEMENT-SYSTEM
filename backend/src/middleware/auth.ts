import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Session, User, type IUser, type UserRole } from '../models';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  sessionId?: string;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: '15m' });
}

export function signRefreshToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: '7d' });
}

export function setRefreshCookie(res: Response, refreshToken: string): void {
  const maxAgeMs = env.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
  res.setHeader(
    'Set-Cookie',
    `folio_refresh=${encodeURIComponent(refreshToken)}; Max-Age=${Math.floor(
      maxAgeMs / 1000
    )}; Path=/api/auth; HttpOnly; Secure; SameSite=None; Partitioned`
  );
}

export function clearRefreshCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    'folio_refresh=; Max-Age=0; Path=/api/auth; HttpOnly; Secure; SameSite=None; Partitioned'
  );
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: 'Authentication token missing.' });
      return;
    }

    const decoded = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
    const session = await Session.findById(decoded.sessionId);
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Session expired or revoked.' });
      return;
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account unavailable or deactivated.' });
      return;
    }

    req.user = user;
    req.sessionId = decoded.sessionId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions for this action.' });
      return;
    }
    next();
  };
}
