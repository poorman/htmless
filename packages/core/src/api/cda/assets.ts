import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../../db.js';

import type { Request, Response } from 'express';

const router: IRouter = Router();

// ── GET /assets ──────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    res.status(400).json({ error: 'missing_space', message: 'X-Space-Id header is required' });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
  const skip = (page - 1) * limit;

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where: { spaceId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.asset.count({ where: { spaceId } }),
  ]);

  const items = assets.map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    bytes: a.bytes,
    width: a.width,
    height: a.height,
    alt: a.alt,
    caption: a.caption,
    storageKey: a.storageKey,
    checksum: a.checksum,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  res
    .set('Cache-Control', 'public, max-age=60')
    .json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
});

// ── GET /assets/:id ──────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    res.status(400).json({ error: 'missing_space', message: 'X-Space-Id header is required' });
    return;
  }

  const id = req.params.id as string;

  const asset = await prisma.asset.findFirst({
    where: { id, spaceId },
  });

  if (!asset) {
    res.status(404).json({ error: 'not_found', message: 'Asset not found' });
    return;
  }

  res
    .set('Cache-Control', 'public, max-age=60')
    .json({
      id: asset.id,
      filename: asset.filename,
      mimeType: asset.mimeType,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      alt: asset.alt,
      caption: asset.caption,
      storageKey: asset.storageKey,
      checksum: asset.checksum,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    });
});

export default router;
