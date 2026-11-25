import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false,
});

export function createCorsMiddleware() {
  return cors((req, callback) => {
    const originHeader = req.headers['origin'];
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    if (!origin) {
      return callback(null, { origin: false, credentials: true });
    }

    const fwdHost = req.headers['x-forwarded-host'];
    const rawHost = fwdHost || req.headers['host'] || '';
    const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
    const allowedSet = new Set<string>([
      ...env.allowedOrigins,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      env.appUrl,
    ]);
    if (host) {
      allowedSet.add(`https://${host}`);
      allowedSet.add(`http://${host}`);
    }

    if (allowedSet.has(origin)) {
      return callback(null, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      });
    }

    return callback(new Error('CORS origin not allowed.'), { origin: false });
  });
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

export const apiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

function stripDangerousKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDangerousKeys);
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      clean[key] = stripDangerousKeys(val);
    }
    return clean;
  }
  return value;
}

export function sanitizeNoSql(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = stripDangerousKeys(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const cleaned = stripDangerousKeys(req.query) as Record<string, unknown>;
    for (const key of Object.keys(req.query)) {
      if (!(key in cleaned)) {
        delete req.query[key];
      }
    }
  }
  if (req.params && typeof req.params === 'object') {
    const cleaned = stripDangerousKeys(req.params) as Record<string, unknown>;
    for (const key of Object.keys(req.params)) {
      if (!(key in cleaned)) {
        delete req.params[key];
      }
    }
  }
  next();
}

export function verifyCookieCsrf(req: Request, res: Response, next: NextFunction): void {
  const origin = req.header('Origin');
  const host = req.header('X-Forwarded-Host') || req.header('Host');
  const xRequestedWith = req.header('X-Requested-With');

  if (xRequestedWith === 'XMLHttpRequest') {
    return next();
  }

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        return next();
      }
    } catch {
      // Invalid Origin header
    }
  }

  res.status(403).json({ error: 'Cross-site request validation failed.' });
}
