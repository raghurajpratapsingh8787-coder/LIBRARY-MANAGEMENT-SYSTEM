import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { connectDatabase } from './config/db';
import { env } from './config/env';
import { authenticate, type AccessTokenPayload } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter, createCorsMiddleware, helmetMiddleware, sanitizeNoSql } from './middleware/security';
import { servePrivateCover } from './middleware/upload';
import authRoutes from './routes/authRoutes';
import bookRoutes from './routes/bookRoutes';
import circulationRoutes from './routes/circulationRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import fineRoutes from './routes/fineRoutes';
import memberRoutes from './routes/memberRoutes';
import notificationRoutes from './routes/notificationRoutes';
import reportRoutes from './routes/reportRoutes';
import reservationRoutes from './routes/reservationRoutes';
import settingsRoutes from './routes/settingsRoutes';
import taxonomyRoutes from './routes/taxonomyRoutes';
import { setSocketServer } from './services/notificationService';
import { ensureDefaultSettings, ensureEnvAdminIfConfigured, seedSampleLibraryData } from './services/seedService';

export async function createAppServer(options?: { skipVite?: boolean }) {
  await connectDatabase();
  await ensureDefaultSettings();
  await ensureEnvAdminIfConfigured();

  if (env.adminInitialPassword) {
    await seedSampleLibraryData();
  }

  const app = express();
  app.set('trust proxy', 1);

  app.use(helmetMiddleware);
  app.use(createCorsMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(sanitizeNoSql);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.use('/api', apiRateLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/books', bookRoutes);
  app.use('/api/taxonomy', taxonomyRoutes);
  app.use('/api/members', memberRoutes);
  app.use('/api/circulation', circulationRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/fines', fineRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/settings', settingsRoutes);

  app.get('/api/uploads/covers/:filename', authenticate, servePrivateCover);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (
          origin.startsWith('http://localhost') ||
          origin.startsWith('http://127.0.0.1') ||
          env.allowedOrigins.includes(origin) ||
          origin === env.appUrl
        ) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Unauthorized'));
    }
    try {
      const payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.userId) socket.join(`user:${socket.data.userId}`);
    if (socket.data.role) socket.join(`role:${socket.data.role}`);
  });

  setSocketServer(io);

  if (!options?.skipVite) {
    if (!env.isProduction) {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return { app, server, io };
}
