import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../../db.js';

import type { Request, Response } from 'express';

const router: IRouter = Router();

/**
 * Pick specific fields from a data object.
 */
function projectFields(data: Record<string, unknown>, fields?: string[]): Record<string, unknown> {
  if (!fields || fields.length === 0) return data;
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in data) {
      result[key] = data[key];
    }
  }
  return result;
}

/**
 * Resolve included references inside entry data.
 * For preview, resolves to draft versions of referenced entries.
 */
async function resolveIncludes(
  data: Record<string, unknown>,
  include: string[],
  spaceId: string,
): Promise<Record<string, unknown>> {
  if (include.length === 0) return data;

  const resolved = { ...data };

  for (const key of include) {
    const refValue = data[key];
    if (!refValue) continue;

    const refIds = Array.isArray(refValue) ? (refValue as string[]) : [refValue as string];

    const entries = await prisma.entry.findMany({
      where: {
        spaceId,
        id: { in: refIds },
        state: { isNot: null },
      },
      include: {
        state: {
          include: { draftVersion: true },
        },
        contentType: { select: { key: true } },
      },
    });

    const mapped = entries.map((entry) => ({
      id: entry.id,
      type: entry.contentType.key,
      slug: entry.slug,
      data: (entry.state!.draftVersion.data ?? {}) as Record<string, unknown>,
      status: entry.state!.status,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }));

    if (Array.isArray(refValue)) {
      resolved[key] = mapped;
    } else {
      resolved[key] = mapped[0] ?? null;
    }
  }

  return resolved;
}

// ── Preview scope helper ──
function checkPreviewScope(req: Request, res: Response, entryId?: string): boolean {
  if (req.auth?.type !== 'preview_token') return true; // JWT/API tokens are unrestricted
  // If token is scoped to a specific entry, reject access to other entries
  if (req.auth.previewEntryId && entryId && req.auth.previewEntryId !== entryId) {
    res.status(403).json({ error: 'preview_scope_denied', message: 'Preview token is scoped to a different entry' });
    return false;
  }
  // If token is scoped to a specific route, check it
  if (req.auth.previewRoute) {
    const requestPath = req.originalUrl.split('?')[0];
    if (!requestPath.includes(req.auth.previewRoute)) {
      res.status(403).json({ error: 'preview_scope_denied', message: 'Preview token is scoped to a different route' });
      return false;
    }
  }
  return true;
}

// ── GET /content/:typeKey ────────────────────────────────────────────
router.get('/:typeKey', async (req: Request, res: Response): Promise<void> => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    res.status(400).json({ error: 'missing_space', message: 'X-Space-Id header is required' });
    return;
  }

  // If preview token is scoped to a specific entry, listing is not allowed
  if (req.auth?.type === 'preview_token' && req.auth.previewEntryId) {
    res.status(403).json({ error: 'preview_scope_denied', message: 'This preview token is scoped to a specific entry — use /content/:typeKey/:id instead' });
    return;
  }

  const typeKey = req.params.typeKey as string;
  const slug = req.query.slug as string | undefined;
  const fieldsParam = req.query.fields as string | undefined;
  const includeParam = req.query.include as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
  const skip = (page - 1) * limit;

  const fields = fieldsParam ? fieldsParam.split(',').map((f) => f.trim()) : undefined;
  const include = includeParam ? includeParam.split(',').map((f) => f.trim()) : [];

  const contentType = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: typeKey } },
  });

  if (!contentType) {
    res.status(404).json({ error: 'not_found', message: `Content type "${typeKey}" not found` });
    return;
  }

  const where = {
    spaceId,
    contentTypeId: contentType.id,
    state: { isNot: null },
    ...(slug ? { slug } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      include: {
        state: {
          include: { draftVersion: true },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.entry.count({ where }),
  ]);

  const items = await Promise.all(
    entries.map(async (entry) => {
      const rawData = (entry.state!.draftVersion.data ?? {}) as Record<string, unknown>;
      let data = projectFields(rawData, fields);
      data = await resolveIncludes(data, include, spaceId);
      return {
        id: entry.id,
        type: typeKey,
        slug: entry.slug,
        data,
        status: entry.state!.status,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      };
    }),
  );

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── GET /content/:typeKey/:id ────────────────────────────────────────
router.get('/:typeKey/:id', async (req: Request, res: Response): Promise<void> => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    res.status(400).json({ error: 'missing_space', message: 'X-Space-Id header is required' });
    return;
  }

  const typeKey = req.params.typeKey as string;
  const id = req.params.id as string;
  const fieldsParam = req.query.fields as string | undefined;
  const includeParam = req.query.include as string | undefined;

  const fields = fieldsParam ? fieldsParam.split(',').map((f) => f.trim()) : undefined;
  const include = includeParam ? includeParam.split(',').map((f) => f.trim()) : [];

  // Enforce preview token scope
  if (!checkPreviewScope(req, res, id)) return;

  const contentType = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: typeKey } },
  });

  if (!contentType) {
    res.status(404).json({ error: 'not_found', message: `Content type "${typeKey}" not found` });
    return;
  }

  const entry = await prisma.entry.findFirst({
    where: {
      id,
      spaceId,
      contentTypeId: contentType.id,
      state: { isNot: null },
    },
    include: {
      state: {
        include: { draftVersion: true },
      },
    },
  });

  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found' });
    return;
  }

  const rawData = (entry.state!.draftVersion.data ?? {}) as Record<string, unknown>;
  let data = projectFields(rawData, fields);
  data = await resolveIncludes(data, include, spaceId);

  res.json({
    id: entry.id,
    type: typeKey,
    slug: entry.slug,
    data,
    status: entry.state!.status,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  });
});

export default router;
