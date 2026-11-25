import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const runtimeAccessSecret = crypto.randomBytes(32).toString('hex');
const runtimeRefreshSecret = crypto.randomBytes(32).toString('hex');

const resolvedPort = Number(
  process.env.DEFAULT_APP_PORT ||
    (process.env.PORT && process.env.PORT !== process.env.NGINX_PORT ? process.env.PORT : 3000)
);

export const env = {
  port: Number.isFinite(resolvedPort) && resolvedPort > 0 ? resolvedPort : 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  mongodbUri: (process.env.MONGODB_URI || '').trim(),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || runtimeAccessSecret,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || runtimeRefreshSecret,
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 7,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  adminInitialEmail: (process.env.ADMIN_INITIAL_EMAIL || '').trim().toLowerCase(),
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || '',
  appUrl: (process.env.APP_URL || 'http://localhost:3000').trim(),
};
