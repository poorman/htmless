import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { authenticate } from '../../auth/middleware.js';
import contentRoutes from './content.js';
import schemasRoutes from './schemas.js';
import assetsRoutes from './assets.js';
import mediaRoutes from './media.js';

const router: IRouter = Router();

// CDA is public or token-gated — auth not strictly required
router.use(authenticate({ required: false }));

router.use('/content', contentRoutes);
router.use('/schemas', schemasRoutes);
router.use('/assets', assetsRoutes);
router.use('/media', mediaRoutes);

export default router;
