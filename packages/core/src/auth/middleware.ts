import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from './jwt.js';
import { prisma } from '../db.js';
import { createHash } from 'crypto';

export interface AuthContext {
  userId: string;
  email: string;
  type: 'user' | 'api_token' | 'preview_token';
  scopes?: string[];
  spaceId?: string;
  previewEntryId?: string | null;
  previewRoute?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function authenticate(options: { required?: boolean; allowPreview?: boolean } = {}) {
  const { required = true, allowPreview = false } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      if (required) {
        res.status(401).json({ error: 'authentication_required', message: 'Bearer token required' });
        return;
      }
      next();
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    // Try API token (hle_ prefix)
    if (token.startsWith('hle_')) {
      const tokenHash = hashToken(token);
      const apiToken = await prisma.apiToken.findUnique({
        where: { tokenHash },
      });

      if (!apiToken || (apiToken.expiresAt && apiToken.expiresAt < new Date())) {
        res.status(401).json({ error: 'invalid_token', message: 'Invalid or expired API token' });
        return;
      }

      await prisma.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } });

      req.auth = {
        userId: apiToken.createdById,
        email: '',
        type: 'api_token',
        scopes: apiToken.scopes as string[],
        spaceId: apiToken.spaceId,
      };
      next();
      return;
    }

    // Try preview token (hlp_ prefix)
    if (allowPreview && token.startsWith('hlp_')) {
      const tokenHash = hashToken(token);
      const previewToken = await prisma.previewToken.findUnique({
        where: { tokenHash },
      });

      if (!previewToken || previewToken.expiresAt < new Date()) {
        res.status(401).json({ error: 'invalid_token', message: 'Invalid or expired preview token' });
        return;
      }

      req.auth = {
        userId: previewToken.createdById,
        email: '',
        type: 'preview_token',
        spaceId: previewToken.spaceId,
        previewEntryId: previewToken.entryId,
        previewRoute: previewToken.route,
      };
      next();
      return;
    }

    // Try JWT (user session)
    try {
      const payload = await verifyJwt(token);
      req.auth = {
        userId: payload.sub,
        email: payload.email,
        type: 'user',
      };
      next();
    } catch {
      res.status(401).json({ error: 'invalid_token', message: 'Invalid or expired JWT' });
    }
  };
}

export function requireScope(...scopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication_required' });
      return;
    }

    if (req.auth.type === 'user') {
      next();
      return;
    }

    if (req.auth.scopes) {
      const hasScope = scopes.some(s => req.auth!.scopes!.includes(s));
      if (hasScope) {
        next();
        return;
      }
    }

    res.status(403).json({ error: 'insufficient_scope', message: `Requires one of: ${scopes.join(', ')}` });
  };
}
