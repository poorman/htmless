import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../../db.js';
import { generateJsonSchema } from '../../schema/json-schema.js';

import type { Request, Response } from 'express';

const router: IRouter = Router();

// ── GET /schemas/types ───────────────────────────────────────────────
router.get('/types', async (req: Request, res: Response): Promise<void> => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    res.status(400).json({ error: 'missing_space', message: 'X-Space-Id header is required' });
    return;
  }

  const types = await prisma.contentType.findMany({
    where: { spaceId },
    include: {
      fields: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const items = types.map((ct) => ({
    id: ct.id,
    key: ct.key,
    name: ct.name,
    description: ct.description,
    version: ct.version,
    fields: ct.fields.map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      type: f.type,
      required: f.required,
      unique: f.unique,
      localized: f.localized,
      validations: f.validations,
      defaultValue: f.defaultValue,
      enumValues: f.enumValues,
      referenceTarget: f.referenceTarget,
      sortOrder: f.sortOrder,
    })),
    createdAt: ct.createdAt.toISOString(),
    updatedAt: ct.updatedAt.toISOString(),
  }));

  res
    .set('Cache-Control', 'public, max-age=60')
    .json({ items });
});

// ── GET /schemas/types/:typeKey ──────────────────────────────────────
router.get('/types/:typeKey', async (req: Request, res: Response): Promise<void> => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    res.status(400).json({ error: 'missing_space', message: 'X-Space-Id header is required' });
    return;
  }

  const typeKey = req.params.typeKey as string;

  const ct = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: typeKey } },
    include: {
      fields: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!ct) {
    res.status(404).json({ error: 'not_found', message: `Content type "${typeKey}" not found` });
    return;
  }

  res
    .set('Cache-Control', 'public, max-age=60')
    .json({
      id: ct.id,
      key: ct.key,
      name: ct.name,
      description: ct.description,
      version: ct.version,
      fields: ct.fields.map((f) => ({
        id: f.id,
        key: f.key,
        name: f.name,
        type: f.type,
        required: f.required,
        unique: f.unique,
        localized: f.localized,
        validations: f.validations,
        defaultValue: f.defaultValue,
        enumValues: f.enumValues,
        referenceTarget: f.referenceTarget,
        sortOrder: f.sortOrder,
      })),
      createdAt: ct.createdAt.toISOString(),
      updatedAt: ct.updatedAt.toISOString(),
    });
});

// ── GET /schemas/types/:typeKey/json-schema ─────────────────────────
router.get('/types/:typeKey/json-schema', async (req: Request, res: Response): Promise<void> => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    res.status(400).json({ error: 'missing_space', message: 'X-Space-Id header is required' });
    return;
  }

  const ct = await prisma.contentType.findUnique({
    where: { spaceId_key: { spaceId, key: req.params.typeKey as string } },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!ct) {
    res.status(404).json({ error: 'not_found', message: `Content type "${req.params.typeKey as string}" not found` });
    return;
  }

  const schema = generateJsonSchema(ct);
  res.set('Cache-Control', 'public, max-age=300').set('Content-Type', 'application/schema+json').json(schema);
});

export default router;
