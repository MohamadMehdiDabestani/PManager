import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { workOrders, assets, auditLogs } from '@cmms/db';
import { EscalatePayload } from '@cmms/queue/payloads';
import { scheduleEscalation } from '@cmms/queue/producers';

const LEVEL_DELAY_MS = [0, 4 * 3600_000, 8 * 3600_000]; // wait before moving to L2, L3
const LEVEL_ROLE = ['SUPERVISOR', 'MAINTENANCE_MANAGER', 'PLANT_HEAD'] as const;

/** Stops automatically if WO is closed or acknowledged. Each level schedules the next. */
export const makeEscalation = (d: Deps) => async (job: Job) => {
  const { workOrderId, level } = EscalatePayload.parse(job.data);
  const [row] = await d.db
    .select({ wo: workOrders, asset: assets })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .where(eq(workOrders.id, workOrderId))
    .limit(1);

  if (!row || ['DONE', 'CANCELLED'].includes(row.wo.status)) return { skipped: 'closed' };
  const { wo, asset } = row;
  if (level > 1 && wo.acknowledgedAt) return { skipped: 'acknowledged' };

  const recipients = await d.users.byRole(LEVEL_ROLE[level - 1], asset.plantId);
  await d.notify.many(recipients, {
    kind: 'WO_ESCALATION',
    priority: level === 3 ? 'URGENT' : 'HIGH',
    workOrderId,
    title: `Overdue PM: ${wo.title}`,
    body: `Asset ${asset.code}, level ${level}`,
  });
  await d.db.insert(auditLogs).values({
    actorType: 'SYSTEM',
    action: 'WO_ESCALATED',
    entity: 'WorkOrder',
    entityId: wo.id,
    after: { level },
  });

  if (level < 3) await scheduleEscalation(workOrderId, level + 1, LEVEL_DELAY_MS[level]);
  return { level };
};
