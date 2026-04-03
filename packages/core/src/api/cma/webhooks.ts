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

// ─── GET /webhooks ───
router.get('/', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const webhooks = await prisma.webhook.findMany({
    where: { spaceId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { deliveries: true } },
    },
  });

  const items = webhooks.map(({ _count, ...wh }) => ({
    ...wh,
    deliveryCount: _count.deliveries,
  }));

  res.json({ items, total: items.length });
});

// ─── POST /webhooks ───
router.post('/', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const { url, events, active } = req.body;

  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'url and events (non-empty array) are required' });
    return;
  }

  // Generate a signing secret for this webhook
  const signingSecret = `whsec_${nanoid(32)}`;

  const webhook = await prisma.webhook.create({
    data: {
      spaceId,
      url,
      events,
      signingSecret,
      active: active ?? true,
    },
  });

  res.status(201).json({
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    signingSecret: webhook.signingSecret, // Only shown at creation
    active: webhook.active,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
  });
});

// ─── GET /webhooks/:id ───
router.get('/:id', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const webhook = await prisma.webhook.findFirst({
    where: { id: req.params.id as string, spaceId },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { deliveries: true } },
    },
  });

  if (!webhook) {
    res.status(404).json({ error: 'not_found', message: 'Webhook not found' });
    return;
  }

  const { _count, ...rest } = webhook;

  res.json({ ...rest, deliveryCount: _count.deliveries });
});

// ─── PATCH /webhooks/:id ───
router.patch('/:id', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const existing = await prisma.webhook.findFirst({
    where: { id: req.params.id as string, spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Webhook not found' });
    return;
  }

  const { url, events, active } = req.body;

  const webhook = await prisma.webhook.update({
    where: { id: existing.id },
    data: {
      ...(url !== undefined && { url }),
      ...(events !== undefined && { events }),
      ...(active !== undefined && { active }),
    },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json(webhook);
});

// ─── DELETE /webhooks/:id ───
router.delete('/:id', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const existing = await prisma.webhook.findFirst({
    where: { id: req.params.id as string, spaceId },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Webhook not found' });
    return;
  }

  await prisma.webhook.delete({ where: { id: existing.id } });

  res.status(204).end();
});

// ─── GET /webhooks/:id/deliveries ───
router.get('/:id/deliveries', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  // Verify webhook exists and belongs to this space
  const webhook = await prisma.webhook.findFirst({
    where: { id: req.params.id as string, spaceId },
  });
  if (!webhook) {
    res.status(404).json({ error: 'not_found', message: 'Webhook not found' });
    return;
  }

  const { limit: limitParam, offset: offsetParam } = req.query as Record<string, string | undefined>;

  const limit = Math.min(parseInt(limitParam ?? '25', 10), 100);
  const offset = parseInt(offsetParam ?? '0', 10);

  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where: { webhookId: webhook.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.webhookDelivery.count({ where: { webhookId: webhook.id } }),
  ]);

  res.json({ items: deliveries, total, limit, offset });
});

export default router;
