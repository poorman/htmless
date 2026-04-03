import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../../db.js';

import type { Request, Response } from 'express';

const router: IRouter = Router();

/**
 * Pick specific fields from a data object.
 * Returns the full object when `fields` is undefined/empty.
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
 * Compute a weak ETag from a JSON-serialisable value.
 */
function computeEtag(value: unknown): string {
  const hash = createHash('md5').update(JSON.stringify(value)).digest('hex');
  return `W/"${hash}"`;
}

/**
 * Resolve included references inside entry data.
 * Fetches related published entries for any reference field keys listed in `include`.
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
        state: {
          status: 'published',
          publishedVersionId: { not: null },
        },
      },
      include: {
        state: {
          include: { publishedVersion: true },
        },
        contentType: { select: { key: true } },
      },
    });

    const mapped = entries.map((entry) => ({
      id: entry.id,
      type: entry.contentType.key,
      slug: entry.slug,
      data: (entry.state!.publishedVersion!.data ?? {}) as Record<string, unknown>,
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

// ── GET /content/:typeKey ────────────────────────────────────────────
router.get('/:typeKey', async (req: Request, res: Response): Promise<void> => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    res.status(400).json({ error: 'missing_space', message: 'X-Space-Id header is required' });
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

  // Verify content type exists in this space
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
    state: {
      status: 'published',
      publishedVersionId: { not: null },
    },
    ...(slug ? { slug } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      include: {
        state: {
          include: { publishedVersion: true },
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
      const rawData = (entry.state!.publishedVersion!.data ?? {}) as Record<string, unknown>;
      let data = projectFields(rawData, fields);
      data = await resolveIncludes(data, include, spaceId);
      return {
        id: entry.id,
        type: typeKey,
        slug: entry.slug,
        data,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      };
    }),
  );

  const body = {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  const etag = computeEtag(body);

  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res
    .set('Cache-Control', 'public, max-age=60')
    .set('ETag', etag)
    .json(body);
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

  // Verify content type
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
      state: {
        status: 'published',
        publishedVersionId: { not: null },
      },
    },
    include: {
      state: {
        include: { publishedVersion: true },
      },
    },
  });

  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found or not published' });
    return;
  }

  const rawData = (entry.state!.publishedVersion!.data ?? {}) as Record<string, unknown>;
  let data = projectFields(rawData, fields);
  data = await resolveIncludes(data, include, spaceId);

  const body = {
    id: entry.id,
    type: typeKey,
    slug: entry.slug,
    data,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };

  const etag = computeEtag(body);

  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res
    .set('Cache-Control', 'public, max-age=60')
    .set('ETag', etag)
    .json(body);
});

export default router;
