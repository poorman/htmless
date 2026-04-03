import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../../db.js';
import { requireScope } from '../../auth/middleware.js';

const router: IRouter = Router();

// ─── Helpers ───

function getSpaceId(req: import('express').Request): string | undefined {
  return (req.params as Record<string, string>).spaceId ?? (req.headers['x-space-id'] as string | undefined);
}

// ─── GET /audit ───
router.get('/', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const {
    action,
    userId,
    from,
    to,
    limit: limitParam,
    offset: offsetParam,
  } = req.query as Record<string, string | undefined>;

  const limit = Math.min(parseInt(limitParam ?? '50', 10), 200);
  const offset = parseInt(offsetParam ?? '0', 10);

  const where: Record<string, unknown> = { spaceId };

  if (action) {
    where.action = { contains: action };
  }

  if (userId) {
    where.userId = userId as string;
  }

  // Date range filter
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) {
      const d = new Date(from as string);
      if (!isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to as string);
      if (!isNaN(d.getTime())) createdAt.lte = d;
    }
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    items: items.map((log) => ({
      id: log.id,
      spaceId: log.spaceId,
      userId: log.userId,
      user: log.user
        ? { id: log.user.id, email: log.user.email, name: log.user.name }
        : null,
      action: log.action,
      resource: log.resource,
      meta: log.meta,
      createdAt: log.createdAt,
    })),
    total,
    limit,
    offset,
  });
});

export default router;
