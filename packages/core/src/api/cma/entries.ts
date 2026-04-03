import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { nanoid } from 'nanoid';
import { prisma } from '../../db.js';
import { requireScope } from '../../auth/middleware.js';

const router: IRouter = Router();

// ─── Helpers ───

function getSpaceId(req: import('express').Request): string | undefined {
  return (req.params as Record<string, string>).spaceId ?? (req.headers['x-space-id'] as string | undefined);
}

function generateEtag(): string {
  return nanoid(16);
}

// ─── GET /entries ───
router.get('/', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const {
    contentType,
    status,
    limit: limitParam,
    offset: offsetParam,
    orderBy,
    order,
  } = req.query as Record<string, string | undefined>;

  const limit = Math.min(parseInt(limitParam ?? '25', 10), 100);
  const offset = parseInt(offsetParam ?? '0', 10);

  const where: Record<string, unknown> = { spaceId };

  if (contentType) {
    const ct = await prisma.contentType.findUnique({
      where: { spaceId_key: { spaceId, key: contentType } },
    });
    if (ct) {
      where.contentTypeId = ct.id;
    } else {
      res.json({ items: [], total: 0, limit, offset });
      return;
    }
  }

  if (status) {
    where.state = { status };
  }

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      include: {
        contentType: { select: { key: true, name: true } },
        state: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { [orderBy ?? 'updatedAt']: order ?? 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.entry.count({ where }),
  ]);

  const items = entries.map((entry) => ({
    id: entry.id,
    slug: entry.slug,
    contentType: entry.contentType,
    status: entry.state?.status ?? 'draft',
    draftVersionId: entry.state?.draftVersionId,
    publishedVersionId: entry.state?.publishedVersionId,
    latestVersion: entry.versions[0]
      ? {
          id: entry.versions[0].id,
          kind: entry.versions[0].kind,
          data: entry.versions[0].data,
          etag: entry.versions[0].etag,
          createdAt: entry.versions[0].createdAt,
        }
      : null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));

  res.json({ items, total, limit, offset });
});

// ─── POST /entries ───
router.post('/', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const { contentTypeKey, slug, data } = req.body;

  if (!contentTypeKey || !slug) {
    res.status(400).json({ error: 'validation_error', message: 'contentTypeKey and slug are required' });
    return;
  }

  const contentType = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: contentTypeKey } },
  });
  if (!contentType) {
    res.status(404).json({ error: 'not_found', message: `Content type "${contentTypeKey}" not found` });
    return;
  }

  // Check for duplicate slug
  const existingEntry = await prisma.entry.findUnique({
    where: { spaceId_contentTypeId_slug: { spaceId, contentTypeId: contentType.id, slug } },
  });
  if (existingEntry) {
    res.status(409).json({ error: 'conflict', message: `Entry with slug "${slug}" already exists for this content type` });
    return;
  }

  const etag = generateEtag();

  const entry = await prisma.$transaction(async (tx) => {
    const newEntry = await tx.entry.create({
      data: {
        spaceId,
        contentTypeId: contentType.id,
        slug,
      },
    });

    const version = await tx.entryVersion.create({
      data: {
        entryId: newEntry.id,
        kind: 'draft',
        data: data ?? {},
        etag,
        createdById: req.auth!.userId,
      },
    });

    await tx.entryState.create({
      data: {
        entryId: newEntry.id,
        status: 'draft',
        draftVersionId: version.id,
      },
    });

    return tx.entry.findUniqueOrThrow({
      where: { id: newEntry.id },
      include: {
        contentType: { select: { key: true, name: true } },
        state: true,
        versions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  });

  res.status(201).json({
    id: entry.id,
    slug: entry.slug,
    contentType: entry.contentType,
    status: entry.state?.status ?? 'draft',
    latestVersion: entry.versions[0]
      ? {
          id: entry.versions[0].id,
          kind: entry.versions[0].kind,
          data: entry.versions[0].data,
          etag: entry.versions[0].etag,
          createdAt: entry.versions[0].createdAt,
        }
      : null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
});

// ─── GET /entries/:id ───
router.get('/:id', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const entry = await prisma.entry.findFirst({
    where: { id: req.params.id as string, spaceId },
    include: {
      contentType: { select: { key: true, name: true } },
      state: true,
      versions: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found' });
    return;
  }

  const latestVersion = entry.versions[0] ?? null;

  res.set('ETag', `"${latestVersion?.etag ?? ''}"`);

  res.json({
    id: entry.id,
    slug: entry.slug,
    contentType: entry.contentType,
    status: entry.state?.status ?? 'draft',
    draftVersionId: entry.state?.draftVersionId,
    publishedVersionId: entry.state?.publishedVersionId,
    versions: entry.versions.map((v) => ({
      id: v.id,
      kind: v.kind,
      data: v.data,
      etag: v.etag,
      createdById: v.createdById,
      createdAt: v.createdAt,
    })),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
});

// ─── PATCH /entries/:id ───
router.patch('/:id', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const entry = await prisma.entry.findFirst({
    where: { id: req.params.id as string, spaceId },
  });
  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found' });
    return;
  }

  const { slug } = req.body;

  const updated = await prisma.entry.update({
    where: { id: entry.id },
    data: {
      ...(slug !== undefined && { slug }),
    },
    include: {
      contentType: { select: { key: true, name: true } },
      state: true,
    },
  });

  res.json({
    id: updated.id,
    slug: updated.slug,
    contentType: updated.contentType,
    status: updated.state?.status ?? 'draft',
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

// ─── DELETE /entries/:id ───
router.delete('/:id', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const entry = await prisma.entry.findFirst({
    where: { id: req.params.id as string, spaceId },
  });
  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found' });
    return;
  }

  await prisma.entry.delete({ where: { id: entry.id } });

  res.status(204).end();
});

// ─── POST /entries/:id/save-draft ───
router.post('/:id/save-draft', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const entry = await prisma.entry.findFirst({
    where: { id: req.params.id as string, spaceId },
    include: { state: true },
  });
  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found' });
    return;
  }

  // Optimistic concurrency: check If-Match header against current draft etag
  const ifMatch = req.headers['if-match']?.replace(/"/g, '');
  if (ifMatch && entry.state) {
    const currentDraft = await prisma.entryVersion.findUnique({
      where: { id: entry.state.draftVersionId },
      select: { etag: true },
    });
    if (currentDraft && currentDraft.etag !== ifMatch) {
      res.status(412).json({ error: 'precondition_failed', message: 'ETag mismatch — entry was modified concurrently' });
      return;
    }
  }

  const { data } = req.body;
  if (data === undefined) {
    res.status(400).json({ error: 'validation_error', message: 'data is required' });
    return;
  }

  const etag = generateEtag();

  const version = await prisma.$transaction(async (tx) => {
    const newVersion = await tx.entryVersion.create({
      data: {
        entryId: entry.id,
        kind: 'draft',
        data,
        etag,
        createdById: req.auth!.userId,
      },
    });

    await tx.entryState.upsert({
      where: { entryId: entry.id },
      update: {
        draftVersionId: newVersion.id,
        status: entry.state?.publishedVersionId ? 'published' : 'draft',
      },
      create: {
        entryId: entry.id,
        status: 'draft',
        draftVersionId: newVersion.id,
      },
    });

    // Touch entry updatedAt
    await tx.entry.update({ where: { id: entry.id }, data: {} });

    return newVersion;
  });

  res.set('ETag', `"${version.etag}"`);

  res.json({
    id: version.id,
    entryId: entry.id,
    kind: version.kind,
    data: version.data,
    etag: version.etag,
    createdAt: version.createdAt,
  });
});

// ─── POST /entries/:id/publish ───
router.post('/:id/publish', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const entry = await prisma.entry.findFirst({
    where: { id: req.params.id as string, spaceId },
    include: { state: true },
  });
  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found' });
    return;
  }

  if (!entry.state) {
    res.status(400).json({ error: 'invalid_state', message: 'Entry has no state — cannot publish' });
    return;
  }

  // Require If-Match for optimistic concurrency
  const ifMatch = req.headers['if-match']?.replace(/"/g, '');
  if (!ifMatch) {
    res.status(428).json({ error: 'precondition_required', message: 'If-Match header is required to publish — fetch the entry first to get the current ETag' });
    return;
  }

  // Get the current draft version's data to snapshot as published
  const draftVersion = await prisma.entryVersion.findUnique({
    where: { id: entry.state.draftVersionId },
  });
  if (!draftVersion) {
    res.status(400).json({ error: 'invalid_state', message: 'Draft version not found' });
    return;
  }

  if (draftVersion.etag !== ifMatch) {
    res.status(412).json({ error: 'precondition_failed', message: 'ETag mismatch — entry was modified concurrently' });
    return;
  }

  const etag = generateEtag();

  const publishedVersion = await prisma.$transaction(async (tx) => {
    const newVersion = await tx.entryVersion.create({
      data: {
        entryId: entry.id,
        kind: 'published',
        data: draftVersion.data as object,
        etag,
        createdById: req.auth!.userId,
      },
    });

    await tx.entryState.update({
      where: { entryId: entry.id },
      data: {
        status: 'published',
        publishedVersionId: newVersion.id,
      },
    });

    // Touch entry updatedAt
    await tx.entry.update({ where: { id: entry.id }, data: {} });

    return newVersion;
  });

  res.set('ETag', `"${publishedVersion.etag}"`);

  res.json({
    id: publishedVersion.id,
    entryId: entry.id,
    kind: publishedVersion.kind,
    data: publishedVersion.data,
    etag: publishedVersion.etag,
    status: 'published',
    createdAt: publishedVersion.createdAt,
  });
});

// ─── POST /entries/:id/unpublish ───
router.post('/:id/unpublish', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const entry = await prisma.entry.findFirst({
    where: { id: req.params.id as string, spaceId },
    include: { state: true },
  });
  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found' });
    return;
  }

  if (!entry.state || entry.state.status !== 'published') {
    res.status(400).json({ error: 'invalid_state', message: 'Entry is not currently published' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.entryState.update({
      where: { entryId: entry.id },
      data: {
        status: 'draft',
        publishedVersionId: null,
      },
    });

    // Touch entry updatedAt
    await tx.entry.update({ where: { id: entry.id }, data: {} });
  });

  res.json({
    id: entry.id,
    status: 'draft',
    message: 'Entry unpublished successfully',
  });
});

// ─── POST /entries/:id/schedule ───
router.post('/:id/schedule', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const entry = await prisma.entry.findFirst({
    where: { id: req.params.id as string, spaceId },
    include: { state: true },
  });
  if (!entry) {
    res.status(404).json({ error: 'not_found', message: 'Entry not found' });
    return;
  }

  const { publishAt } = req.body;
  if (!publishAt) {
    res.status(400).json({ error: 'validation_error', message: 'publishAt (ISO date) is required' });
    return;
  }

  const scheduledAt = new Date(publishAt);
  if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    res.status(400).json({ error: 'validation_error', message: 'publishAt must be a valid future date' });
    return;
  }

  await prisma.entryState.upsert({
    where: { entryId: entry.id },
    update: { status: 'scheduled', scheduledAt },
    create: {
      entryId: entry.id,
      status: 'scheduled',
      draftVersionId: entry.state!.draftVersionId,
      scheduledAt,
    },
  });

  res.json({
    id: entry.id,
    status: 'scheduled',
    scheduledAt: scheduledAt.toISOString(),
  });
});

export default router;
