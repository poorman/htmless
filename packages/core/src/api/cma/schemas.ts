import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../../db.js';
import { requireScope } from '../../auth/middleware.js';

const router: IRouter = Router();

// ─── Helpers ───

function getSpaceId(req: import('express').Request): string | undefined {
  return (req.params as Record<string, string>).spaceId ?? (req.headers['x-space-id'] as string | undefined);
}

// ─── GET /schemas/types ───
router.get('/types', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const types = await prisma.contentType.findMany({
    where: { spaceId },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ items: types, total: types.length });
});

// ─── POST /schemas/types ───
router.post('/types', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const { key, name, description } = req.body;

  if (!key || !name) {
    res.status(400).json({ error: 'validation_error', message: 'key and name are required' });
    return;
  }

  // Check for duplicate key in this space
  const existing = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key } },
  });
  if (existing) {
    res.status(409).json({ error: 'conflict', message: `Content type with key "${key}" already exists in this space` });
    return;
  }

  const contentType = await prisma.contentType.create({
    data: {
      spaceId,
      key,
      name,
      description: description ?? null,
    },
    include: { fields: true },
  });

  res.status(201).json(contentType);
});

// ─── GET /schemas/types/:typeKey ───
router.get('/types/:typeKey', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const contentType = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: req.params.typeKey as string } },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!contentType) {
    res.status(404).json({ error: 'not_found', message: 'Content type not found' });
    return;
  }

  res.json(contentType);
});

// ─── PATCH /schemas/types/:typeKey ───
router.patch('/types/:typeKey', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const existing = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: req.params.typeKey as string } },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Content type not found' });
    return;
  }

  const { name, description } = req.body;

  const contentType = await prisma.contentType.update({
    where: { id: existing.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      version: { increment: 1 },
    },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  });

  res.json(contentType);
});

// ─── DELETE /schemas/types/:typeKey ───
router.delete('/types/:typeKey', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const existing = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: req.params.typeKey as string } },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Content type not found' });
    return;
  }

  await prisma.contentType.delete({ where: { id: existing.id } });

  res.status(204).end();
});

// ─── POST /schemas/types/:typeKey/fields ───
router.post('/types/:typeKey/fields', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const contentType = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: req.params.typeKey as string } },
  });
  if (!contentType) {
    res.status(404).json({ error: 'not_found', message: 'Content type not found' });
    return;
  }

  const {
    key, name, type, required, unique, localized,
    validations, defaultValue, enumValues, referenceTarget, sortOrder,
  } = req.body;

  if (!key || !name || !type) {
    res.status(400).json({ error: 'validation_error', message: 'key, name, and type are required' });
    return;
  }

  // Check for duplicate field key
  const existingField = await prisma.field.findUnique({
    where: { contentTypeId_key: { contentTypeId: contentType.id, key } },
  });
  if (existingField) {
    res.status(409).json({ error: 'conflict', message: `Field with key "${key}" already exists on this content type` });
    return;
  }

  // Auto-compute sortOrder if not provided
  let finalSortOrder = sortOrder;
  if (finalSortOrder === undefined) {
    const maxField = await prisma.field.findFirst({
      where: { contentTypeId: contentType.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    finalSortOrder = (maxField?.sortOrder ?? -1) + 1;
  }

  const field = await prisma.field.create({
    data: {
      contentTypeId: contentType.id,
      key,
      name,
      type,
      required: required ?? false,
      unique: unique ?? false,
      localized: localized ?? false,
      validations: validations ?? undefined,
      defaultValue: defaultValue ?? undefined,
      enumValues: enumValues ?? undefined,
      referenceTarget: referenceTarget ?? undefined,
      sortOrder: finalSortOrder,
    },
  });

  // Bump content type version
  await prisma.contentType.update({
    where: { id: contentType.id },
    data: { version: { increment: 1 } },
  });

  res.status(201).json(field);
});

// ─── PATCH /schemas/types/:typeKey/fields/:fieldKey ───
router.patch('/types/:typeKey/fields/:fieldKey', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const contentType = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: req.params.typeKey as string } },
  });
  if (!contentType) {
    res.status(404).json({ error: 'not_found', message: 'Content type not found' });
    return;
  }

  const existingField = await prisma.field.findUnique({
    where: { contentTypeId_key: { contentTypeId: contentType.id, key: req.params.fieldKey as string } },
  });
  if (!existingField) {
    res.status(404).json({ error: 'not_found', message: 'Field not found' });
    return;
  }

  const {
    name, type, required, unique, localized,
    validations, defaultValue, enumValues, referenceTarget, sortOrder,
  } = req.body;

  const field = await prisma.field.update({
    where: { id: existingField.id },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(required !== undefined && { required }),
      ...(unique !== undefined && { unique }),
      ...(localized !== undefined && { localized }),
      ...(validations !== undefined && { validations }),
      ...(defaultValue !== undefined && { defaultValue }),
      ...(enumValues !== undefined && { enumValues }),
      ...(referenceTarget !== undefined && { referenceTarget }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  // Bump content type version
  await prisma.contentType.update({
    where: { id: contentType.id },
    data: { version: { increment: 1 } },
  });

  res.json(field);
});

// ─── DELETE /schemas/types/:typeKey/fields/:fieldKey ───
router.delete('/types/:typeKey/fields/:fieldKey', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const contentType = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: req.params.typeKey as string } },
  });
  if (!contentType) {
    res.status(404).json({ error: 'not_found', message: 'Content type not found' });
    return;
  }

  const existingField = await prisma.field.findUnique({
    where: { contentTypeId_key: { contentTypeId: contentType.id, key: req.params.fieldKey as string } },
  });
  if (!existingField) {
    res.status(404).json({ error: 'not_found', message: 'Field not found' });
    return;
  }

  await prisma.field.delete({ where: { id: existingField.id } });

  // Bump content type version
  await prisma.contentType.update({
    where: { id: contentType.id },
    data: { version: { increment: 1 } },
  });

  res.status(204).end();
});

export default router;
