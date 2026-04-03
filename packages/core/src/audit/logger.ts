import { prisma } from '../db.js';

export interface AuditLogParams {
  spaceId: string;
  userId?: string;
  action: string;
  resource?: string;
  meta?: object;
}

/**
 * Writes an audit log entry. Fire-and-forget — errors are caught
 * and logged to stderr so they never break the request path.
 */
export function logAudit(params: AuditLogParams): void {
  prisma.auditLog
    .create({
      data: {
        spaceId: params.spaceId,
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource ?? null,
        meta: params.meta ?? undefined,
      },
    })
    .catch((err) => {
      console.error('Failed to write audit log:', err);
    });
}
