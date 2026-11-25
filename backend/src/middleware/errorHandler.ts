import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    res.status(400).json({
      error: firstIssue ? `${firstIssue.path.join('.') || 'input'}: ${firstIssue.message}` : 'Validation failed.',
      issues: err.issues,
    });
    return;
  }

  const mongoErr = err as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  if (mongoErr && mongoErr.code === 11000) {
    const dupField = mongoErr.keyPattern ? Object.keys(mongoErr.keyPattern)[0] : 'record';
    res.status(409).json({ error: `A record with that ${dupField} already exists.` });
    return;
  }

  if (err instanceof Error && err.message.includes('File too large')) {
    res.status(413).json({ error: 'Uploaded file exceeds the 3 MB size limit.' });
    return;
  }

  console.error('Unhandled API error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
}
