import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { prisma } from '../../db.js';
import { signJwt } from '../../auth/jwt.js';
import { verifyPassword } from '../../auth/password.js';
import { authenticate } from '../../auth/middleware.js';
import { config } from '../../config.js';

const router: IRouter = Router();

// ─── Helpers ───

function getSpaceId(req: import('express').Request): string | undefined {
  return (req.params as Record<string, string>).spaceId ?? (req.headers['x-space-id'] as string | undefined);
}

// ─── POST /login ───
// Public: no authenticate middleware
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'validation_error', message: 'email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
    return;
  }

  const token = await signJwt({ sub: user.id, email: user.email });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  });
});

// ─── POST /api-tokens ───
router.post('/api-tokens', authenticate(), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required (param or x-space-id header)' });
    return;
  }

  const { name, scopes, expiresAt } = req.body;

  if (!name || !scopes || !Array.isArray(scopes)) {
    res.status(400).json({ error: 'validation_error', message: 'name and scopes (array) are required' });
    return;
  }

  // Verify space exists
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) {
    res.status(404).json({ error: 'not_found', message: 'Space not found' });
    return;
  }

  const rawToken = `${config.apiTokenPrefix}${nanoid(40)}`;
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const apiToken = await prisma.apiToken.create({
    data: {
      name,
      tokenHash,
      scopes,
      spaceId,
      createdById: req.auth!.userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  res.status(201).json({
    id: apiToken.id,
    name: apiToken.name,
    token: rawToken, // Only returned once at creation
    scopes: apiToken.scopes,
    spaceId: apiToken.spaceId,
    expiresAt: apiToken.expiresAt,
    createdAt: apiToken.createdAt,
  });
});

// ─── POST /preview-tokens ───
router.post('/preview-tokens', authenticate(), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required (param or x-space-id header)' });
    return;
  }

  const { entryId, route, expiresInSeconds } = req.body;

  // Verify space exists
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) {
    res.status(404).json({ error: 'not_found', message: 'Space not found' });
    return;
  }

  // Default expiry: 1 hour
  const ttl = expiresInSeconds ?? 3600;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const rawToken = `${config.previewTokenPrefix}${nanoid(40)}`;
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const previewToken = await prisma.previewToken.create({
    data: {
      tokenHash,
      spaceId,
      entryId: entryId ?? null,
      route: route ?? null,
      createdById: req.auth!.userId,
      expiresAt,
    },
  });

  res.status(201).json({
    id: previewToken.id,
    token: rawToken, // Only returned once at creation
    spaceId: previewToken.spaceId,
    entryId: previewToken.entryId,
    route: previewToken.route,
    expiresAt: previewToken.expiresAt,
    createdAt: previewToken.createdAt,
  });
});

export default router;
