import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

/**
 * Middleware that checks if the authenticated user has the required permission
 * in the requested space, based on their role bindings.
 *
 * Skips check for API tokens (they use scope-based auth via requireScope).
 * Skips check for preview tokens (they are read-only by design).
 */
export function requirePermission(...permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication_required' });
      return;
    }

    // API tokens use scope-based auth, not RBAC
    if (req.auth.type === 'api_token') {
      next();
      return;
    }

    // Preview tokens are read-only
    if (req.auth.type === 'preview_token') {
      next();
      return;
    }

    // For JWT users, check role bindings
    const spaceId = (req.params.spaceId || req.headers['x-space-id']) as string;
    if (!spaceId) {
      // No space context — skip RBAC (space will be validated by route)
      next();
      return;
    }

    const bindings = await prisma.roleBinding.findMany({
      where: {
        userId: req.auth.userId,
        spaceId,
      },
      include: { role: true },
    });

    if (bindings.length === 0) {
      res.status(403).json({
        error: 'forbidden',
        message: 'You do not have access to this space',
      });
      return;
    }

    // Check if any bound role has the required permission
    const hasPermission = permissions.some((perm) =>
      bindings.some((b) => {
        const perms = b.role.permissions as Record<string, boolean>;
        return perms[perm] === true;
      }),
    );

    if (!hasPermission) {
      res.status(403).json({
        error: 'insufficient_permissions',
        message: `Requires one of: ${permissions.join(', ')}`,
      });
      return;
    }

    next();
  };
}
