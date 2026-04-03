import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../../db.js';
import { requireScope } from '../../auth/middleware.js';

const router: IRouter = Router();

// ─── Helpers ───

function getSpaceId(req: import('express').Request): string | undefined {
  return (req.params as Record<string, string>).spaceId ?? (req.headers['x-space-id'] as string | undefined);
}

// ─── GET /assets ───
router.get('/', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const {
    mimeType,
    q,
    limit: limitParam,
    offset: offsetParam,
    orderBy,
    order,
  } = req.query as Record<string, string | undefined>;

  const limit = Math.min(parseInt(limitParam ?? '25', 10), 100);
  const offset = parseInt(offsetParam ?? '0', 10);

  const where: Record<string, unknown> = { spaceId };

  if (mimeType) {
    where.mimeType = { startsWith: mimeType };
  }

  if (q) {
    where.OR = [
      { filename: { contains: q, mode: 'insensitive' } },
      { alt: { contains: q, mode: 'insensitive' } },
      { caption: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: { [orderBy ?? 'createdAt']: order ?? 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.asset.count({ where }),
  ]);

  res.json({ items: assets, total, limit, offset });
});

// ─── POST /assets ───
router.post('/', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const { filename, mimeType, bytes, width, height, alt, caption, storageKey, checksum } = req.body;

  if (!filename || !mimeType || bytes === undefined || !storageKey) {
    res.status(400).json({
      error: 'validation_error',
      message: 'filename, mimeType, bytes, and storageKey are required',
    });
    return;
  }

  const asset = await prisma.asset.create({
    data: {
      spaceId,
      filename,
      mimeType,
      bytes,
      width: width ?? null,
      height: height ?? null,
      alt: alt ?? null,
      caption: caption ?? null,
      storageKey,
      checksum: checksum ?? null,
      createdById: req.auth!.userId,
    },
  });

  res.status(201).json(asset);
});

// ─── GET /assets/:id ───
router.get('/:id', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const asset = await prisma.asset.findFirst({
    where: { id: req.params.id as string, spaceId },
  });

  if (!asset) {
    res.status(404).json({ error: 'not_found', message: 'Asset not found' });
    return;
  }

  res.json(asset);
});

// ─── PATCH /assets/:id ───
router.patch('/:id', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const existing = await prisma.asset.findFirst({
    where: { id: req.params.id as string, spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Asset not found' });
    return;
  }

  const { filename, mimeType, bytes, width, height, alt, caption, storageKey, checksum } = req.body;

  const asset = await prisma.asset.update({
    where: { id: existing.id },
    data: {
      ...(filename !== undefined && { filename }),
      ...(mimeType !== undefined && { mimeType }),
      ...(bytes !== undefined && { bytes }),
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
      ...(alt !== undefined && { alt }),
      ...(caption !== undefined && { caption }),
      ...(storageKey !== undefined && { storageKey }),
      ...(checksum !== undefined && { checksum }),
    },
  });

  res.json(asset);
});

// ─── DELETE /assets/:id ───
router.delete('/:id', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const existing = await prisma.asset.findFirst({
    where: { id: req.params.id as string, spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Asset not found' });
    return;
  }

  await prisma.asset.delete({ where: { id: existing.id } });

  res.status(204).end();
});

export default router;
