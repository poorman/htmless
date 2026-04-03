import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import express from 'express';
import { randomUUID, createHash } from 'crypto';
import { prisma } from '../../db.js';
import { requireScope } from '../../auth/middleware.js';
import { getStorageProvider } from '../../media/storage.js';
import { extractMetadata } from '../../media/metadata.js';

const router: IRouter = Router();

// ─── Constants ──────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/tiff',
  'image/bmp',
  'image/ico',
  'image/vnd.microsoft.icon',
  // PDF
  'application/pdf',
  // Documents
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  // Audio
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  // Archives
  'application/zip',
  'application/gzip',
  // Text / data
  'application/json',
  'text/plain',
  'text/csv',
  'text/html',
  'text/css',
  'application/javascript',
]);

// ─── Helpers ────────────────────────────────────────────────────────

function getSpaceId(req: Request): string | undefined {
  return (req.params as Record<string, string>).spaceId ?? (req.headers['x-space-id'] as string | undefined);
}

function generateStorageKey(spaceId: string, filename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const id = randomUUID().replace(/-/g, '').slice(0, 12);
  return `${spaceId}/${year}/${month}/${id}-${filename}`;
}

function md5(buffer: Buffer): string {
  return createHash('md5').update(buffer).digest('hex');
}

// ─── POST /uploads ──────────────────────────────────────────────────
// Accept raw binary body.
// Required headers: Content-Type (actual file MIME), X-Filename
// Optional headers: X-Alt, X-Caption

router.post(
  '/',
  requireScope('cma:write'),
  express.raw({ type: () => true, limit: '50mb' }),
  async (req: Request, res: Response): Promise<void> => {
    const spaceId = getSpaceId(req);
    if (!spaceId) {
      res.status(400).json({ error: 'validation_error', message: 'spaceId is required (set X-Space-Id header)' });
      return;
    }

    // ── Validate filename header ──
    const filename = req.headers['x-filename'] as string | undefined;
    if (!filename) {
      res.status(400).json({ error: 'validation_error', message: 'X-Filename header is required' });
      return;
    }

    // ── Validate MIME type ──
    const mimeType = req.headers['content-type'] as string | undefined;
    if (!mimeType) {
      res.status(400).json({ error: 'validation_error', message: 'Content-Type header is required' });
      return;
    }

    // Strip any parameters (e.g. charset) for the allow-list check
    const baseMime = mimeType.split(';')[0].trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(baseMime)) {
      res.status(415).json({
        error: 'unsupported_media_type',
        message: `MIME type "${baseMime}" is not allowed`,
      });
      return;
    }

    // ── Read body as Buffer ──
    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      res.status(400).json({ error: 'validation_error', message: 'Request body must be a non-empty binary payload' });
      return;
    }

    if (buffer.length > MAX_FILE_SIZE) {
      res.status(413).json({
        error: 'payload_too_large',
        message: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit`,
      });
      return;
    }

    // ── Optional metadata from headers ──
    const alt = (req.headers['x-alt'] as string | undefined) ?? null;
    const caption = (req.headers['x-caption'] as string | undefined) ?? null;

    // ── Derived values ──
    const storageKey = generateStorageKey(spaceId, filename);
    const checksum = md5(buffer);
    const bytes = buffer.length;

    // ── Extract image dimensions ──
    const { width, height } = await extractMetadata(buffer, baseMime);

    // ── Persist file ──
    const storage = getStorageProvider();
    await storage.upload(storageKey, buffer, baseMime);

    // ── Create DB record ──
    const asset = await prisma.asset.create({
      data: {
        spaceId,
        filename,
        mimeType: baseMime,
        bytes,
        width: width ?? null,
        height: height ?? null,
        alt,
        caption,
        storageKey,
        checksum,
        createdById: req.auth!.userId,
      },
    });

    // ── Build delivery URL ──
    const url = storage.getUrl(storageKey);

    res.status(201).json({
      ...asset,
      url,
    });
  },
);

export default router;
