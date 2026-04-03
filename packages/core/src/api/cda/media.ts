import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { LocalStorageProvider, getStorageProvider } from '../../media/storage.js';

const router: IRouter = Router();

// ─── MIME to extension fallback map ─────────────────────────────────

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

function guessMime(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return 'application/octet-stream';
  const ext = filename.slice(dot).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? 'application/octet-stream';
}

// ─── GET /media/* ───────────────────────────────────────────────────
// Serves a stored file by its storage key.
// Supports optional transform query params (w, h, fm) that are
// currently no-ops but reserved for future server-side transforms.

router.get('/*', async (req: Request, res: Response): Promise<void> => {
  // Express 5 puts the wildcard portion in req.params[0]
  const storageKey = (req.params as Record<string, string>)[0];

  if (!storageKey) {
    res.status(400).json({ error: 'validation_error', message: 'Storage key is required' });
    return;
  }

  const provider = getStorageProvider();

  // For LocalStorageProvider we can resolve the path directly
  let filePath: string;
  if (provider instanceof LocalStorageProvider) {
    filePath = provider.resolve(storageKey);
  } else {
    // Future: stream from S3 / GCS etc.
    res.status(501).json({ error: 'not_implemented', message: 'Remote storage delivery not yet implemented' });
    return;
  }

  if (!existsSync(filePath)) {
    res.status(404).json({ error: 'not_found', message: 'File not found' });
    return;
  }

  const contentType = guessMime(storageKey);
  const fileBuffer = readFileSync(filePath);

  res
    .set('Content-Type', contentType)
    .set('Content-Length', String(fileBuffer.length))
    .set('Cache-Control', 'public, max-age=31536000, immutable')
    .send(fileBuffer);
});

export default router;
