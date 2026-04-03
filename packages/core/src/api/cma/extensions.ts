import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { requireScope } from '../../auth/middleware.js';
import {
  loadExtension,
  getExtensions,
  getExtension,
  removeExtension,
} from '../../extensions/manifest.js';
import type { ExtensionManifest } from '../../extensions/manifest.js';

const router: IRouter = Router();

// ─── Helpers ───

function getSpaceId(req: import('express').Request): string | undefined {
  return (req.params as Record<string, string>).spaceId ?? (req.headers['x-space-id'] as string | undefined);
}

// ─── GET /extensions ───
router.get('/', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const extensions = getExtensions();

  res.json({ items: extensions, total: extensions.length });
});

// ─── POST /extensions ───
router.post('/', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const manifest = req.body as ExtensionManifest;

  if (!manifest.key || !manifest.name || !manifest.version) {
    res.status(400).json({
      error: 'validation_error',
      message: 'key, name, and version are required',
    });
    return;
  }

  // Check for duplicate
  if (getExtension(manifest.key)) {
    res.status(409).json({
      error: 'conflict',
      message: `Extension with key "${manifest.key}" is already registered`,
    });
    return;
  }

  try {
    loadExtension(manifest);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid extension manifest';
    res.status(400).json({ error: 'validation_error', message });
    return;
  }

  res.status(201).json(getExtension(manifest.key));
});

// ─── GET /extensions/:key ───
router.get('/:key', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const key = req.params.key as string;
  const extension = getExtension(key);

  if (!extension) {
    res.status(404).json({ error: 'not_found', message: `Extension "${key}" not found` });
    return;
  }

  res.json(extension);
});

// ─── DELETE /extensions/:key ───
router.delete('/:key', requireScope('cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const key = req.params.key as string;

  if (!removeExtension(key)) {
    res.status(404).json({ error: 'not_found', message: `Extension "${key}" not found` });
    return;
  }

  res.status(204).end();
});

export default router;
