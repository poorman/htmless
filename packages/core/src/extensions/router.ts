import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { getExtension } from './manifest.js';

const router: IRouter = Router();

/**
 * Dynamic extension route handler.
 *
 * Routes are namespaced as /ext/{extensionKey}/{path}.
 * Validates that the extension key matches a registered manifest
 * and that the manifest declares a matching route.
 *
 * For now, handlers are simple JSON response stubs;
 * real handler loading will be added in Phase 8.
 */
router.all('/ext/:extensionKey/*', (req: Request, res: Response): void => {
  const extensionKey = req.params.extensionKey as string;
  const extension = getExtension(extensionKey);

  if (!extension) {
    res.status(404).json({
      error: 'extension_not_found',
      message: `Extension "${extensionKey}" is not registered`,
    });
    return;
  }

  // Extract the sub-path after /ext/{extensionKey}/
  const subPath = '/' + (req.params[0] as string);
  const method = req.method as 'GET' | 'POST' | 'PATCH' | 'DELETE';

  // Check if the extension declares a matching route
  const matchedRoute = extension.routes?.find(
    (r) => r.method === method && r.path === subPath,
  );

  if (!matchedRoute) {
    res.status(404).json({
      error: 'route_not_found',
      message: `Extension "${extensionKey}" has no ${method} route at ${subPath}`,
    });
    return;
  }

  // Stub response — real handler loading in Phase 8
  res.json({
    extension: extensionKey,
    route: subPath,
    method,
    handler: matchedRoute.handler,
    message: 'Extension handler stub — real execution coming in Phase 8',
  });
});

export default router;
