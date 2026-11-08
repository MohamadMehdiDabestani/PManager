import type { Job } from 'bullmq';
import { and, eq, inArray, lt, isNull } from 'drizzle-orm';
import { db, workOrders, auditLogs } from '@cmms/db';
import { OverdueScanPayload, scheduleEscalation } from '@cmms/queue';
import { logger } from '../logger';

export async function processOverdueScan(job: Job) {
  const payload = OverdueScanPayload.parse(job.data ?? {});
  const now = new Date();
  const log = logger.child({ jobId: job.id, job: job.name });

  const conditions = [
    isNull(workOrders.deletedAt),
    inArray(workOrders.status, ['OPEN', 'ASSIGNED']),
    lt(workOrders.dueAt, now),
  ];

  if (payload.plantId) {
    conditions.push(eq(workOrders.plantId, payload.plantId));
  }

  const overdueList = await db
    .select({
      id: workOrders.id,
      plantId: workOrders.plantId,
      dueAt: workOrders.dueAt,
      priority: workOrders.priority,
    })
    .from(workOrders)
    .where(and(...conditions));

  let markedOverdue = 0;

  for (const wo of overdueList) {
    await db.transaction(async (tx) => {
      await tx
        .update(workOrders)
        .set({
          status: 'OVERDUE',
          updatedAt: now,
        })
        .where(eq(workOrders.id, wo.id));

      await tx.insert(auditLogs).values({
        plantId: wo.plantId,
        actorType: 'SYSTEM',
        action: 'WO_MARKED_OVERDUE',
        entity: 'WorkOrder',
        entityId: wo.id,
        at: now,
      });
    });

    markedOverdue += 1;

    // Trigger Level 1 escalation immediately
    try {
      await scheduleEscalation(wo.id, 1, 0);
    } catch (err: unknown) {
      log.warn({ workOrderId: wo.id, err }, 'Failed to schedule escalation for overdue work order');
    }
  }

  log.info({ scanned: overdueList.length, markedOverdue }, 'Overdue scan completed');
  return { scanned: overdueList.length, markedOverdue };
}
