import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { requireScope } from '../../auth/middleware.js';
import { generateTypeScript } from '../../schema/codegen.js';

const router: IRouter = Router();

// ─── Helpers ───

function getSpaceId(req: import('express').Request): string | undefined {
  return (req.params as Record<string, string>).spaceId ?? (req.headers['x-space-id'] as string | undefined);
}

// ─── GET /codegen/typescript ───
router.get('/typescript', requireScope('cma:read', 'cma:write'), async (req, res) => {
  const spaceId = getSpaceId(req);
  if (!spaceId) {
    res.status(400).json({ error: 'validation_error', message: 'spaceId is required' });
    return;
  }

  const dts = await generateTypeScript(spaceId as string);

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Content-Disposition', 'inline; filename="htmless.d.ts"');
  res.send(dts);
});

export default router;
