import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import multer from 'multer';

export const COVERS_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'covers');

function ensureUploadDir(): void {
  if (!fs.existsSync(COVERS_UPLOAD_DIR)) {
    fs.mkdirSync(COVERS_UPLOAD_DIR, { recursive: true });
  }
}

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3 MB strict limit
    files: 1,
  },
});

export function detectImageTypeFromBuffer(
  buffer: Buffer
): { ext: '.jpg' | '.png' | '.webp'; mime: string } | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }

  return null;
}

export function saveValidatedCoverImage(buffer: Buffer): string {
  const detected = detectImageTypeFromBuffer(buffer);
  if (!detected) {
    throw new Error('Invalid image file signature. Only JPEG, PNG, and WebP are accepted.');
  }

  ensureUploadDir();
  const filename = `${crypto.randomUUID()}${detected.ext}`;
  const destination = path.resolve(COVERS_UPLOAD_DIR, filename);

  if (!destination.startsWith(COVERS_UPLOAD_DIR + path.sep)) {
    throw new Error('Invalid upload destination path.');
  }

  fs.writeFileSync(destination, buffer);
  return `/api/uploads/covers/${filename}`;
}

export function servePrivateCover(req: Request, res: Response): void {
  const filename = String(req.params.filename || '');
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) {
    res.status(400).json({ error: 'Invalid cover filename.' });
    return;
  }

  const resolvedPath = path.resolve(COVERS_UPLOAD_DIR, filename);
  if (!resolvedPath.startsWith(COVERS_UPLOAD_DIR + path.sep)) {
    res.status(403).json({ error: 'Forbidden path.' });
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    res.status(404).json({ error: 'Cover image not found.' });
    return;
  }

  res.sendFile(resolvedPath);
}
