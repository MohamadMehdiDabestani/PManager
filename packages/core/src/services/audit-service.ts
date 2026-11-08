import { auditLogs } from '@cmms/db';
import type { ServiceContext } from '../context.js';

export interface WriteAuditInput {
  plantId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
}

export async function writeAuditLog(ctx: ServiceContext, input: WriteAuditInput): Promise<void> {
  const isSystem = ctx.user.id === 'SYSTEM';
  await ctx.db.insert(auditLogs).values({
    plantId: input.plantId ?? null,
    actorType: isSystem ? 'SYSTEM' : 'USER',
    actorId: isSystem ? null : ctx.user.id,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason,
    ip: ctx.ip,
    deviceId: ctx.deviceId,
    at: ctx.now(),
  });
}
