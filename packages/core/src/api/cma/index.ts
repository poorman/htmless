import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { authenticate } from '../../auth/middleware.js';
import { requirePermission } from '../../auth/rbac.js';
import authRouter from './auth.js';
import schemasRouter from './schemas.js';
import entriesRouter from './entries.js';
import assetsRouter from './assets.js';
import webhooksRouter from './webhooks.js';

const router: IRouter = Router();

// Auth routes — /login is public, token creation routes require auth
// (auth.ts applies authenticate() selectively on its own routes)
router.use('/auth', authRouter);

// Everything below requires authentication
router.use(authenticate());

router.use('/schemas', requirePermission('schema.admin', 'entry.read'), schemasRouter);
router.use('/entries', requirePermission('entry.read', 'entry.create'), entriesRouter);
router.use('/assets', requirePermission('asset.upload', 'entry.read'), assetsRouter);
router.use('/webhooks', requirePermission('webhook.manage'), webhooksRouter);

export default router;
