import type { Request, Response, NextFunction } from 'express';
import { logAudit } from './logger.js';

/**
 * Express middleware that auto-logs audit entries after the response
 * is sent for CMA write operations (POST, PATCH, DELETE).
 */
export function auditMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only audit write operations
    const method = req.method.toUpperCase();
    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
      next();
      return;
    }

    // Hook into response finish event so the audit write happens
    // after the response is sent — true fire-and-forget.
    res.on('finish', () => {
      const spaceId =
        (req.params as Record<string, string>).spaceId ??
        (req.headers['x-space-id'] as string | undefined);

      if (!spaceId) return;

      // Normalise path: strip leading slash, collapse param segments
      const pathSegment = req.route?.path ?? req.path;
      const action = `${method}.${pathSegment}`;

      const resource = (req.params as Record<string, string>).id ?? undefined;

      logAudit({
        spaceId,
        userId: req.auth?.userId,
        action,
        resource,
        meta: {
          statusCode: res.statusCode,
          path: req.originalUrl,
        },
      });
    });

    next();
  };
}
