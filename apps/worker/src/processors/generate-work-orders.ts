import type { Job } from 'bullmq';
import { and, eq, isNull, ne } from 'drizzle-orm';
import {
  db,
  pmSchedules,
  assets,
  pmTemplates,
  workOrders,
  auditLogs,
  type ChecklistItemDefinition,
} from '@cmms/db';
import { GenerateWorkOrdersPayload } from '@cmms/queue';
import { enqueueReminders } from '@cmms/queue';
import {
  computeNextDue,
  advanceNextDueOnCompletion,
  getMeterState,
} from '@cmms/core';
import { logger } from '../logger';

/**
 * Generates PM work orders for schedules that are due within (leadDays + horizonDays).
 * IDEMPOTENT: Uses DB unique constraint on (pmScheduleId, dueAt) with onConflictDoNothing().
 * Running this multiple times or concurrently will never produce duplicate work orders.
 */
export async function processGenerateWorkOrders(job: Job) {
  const payload = GenerateWorkOrdersPayload.parse(job.data ?? {});
  const now = new Date();
  const log = logger.child({ jobId: job.id, job: job.name });

  const conditions = [
    eq(pmSchedules.active, true),
    isNull(pmSchedules.deletedAt),
    ne(assets.status, 'DECOMMISSIONED'),
  ];

  if (payload.scheduleId) {
    conditions.push(eq(pmSchedules.id, payload.scheduleId));
  }

  const rows = await db
    .select({
      schedule: pmSchedules,
      asset: assets,
      template: pmTemplates,
    })
    .from(pmSchedules)
    .innerJoin(assets, eq(pmSchedules.assetId, assets.id))
    .innerJoin(pmTemplates, eq(pmSchedules.templateId, pmTemplates.id))
    .where(and(...conditions));

  let created = 0;

  for (const { schedule: s, asset, template } of rows) {
    const meter = s.meterId ? await getMeterState(db, s.meterId) : null;
    const due = computeNextDue(s, { now, meter });

    if (!due) continue;

    // Check if the due date is within the lead time window
    const leadThreshold = new Date(due.getTime() - (s.leadDays + payload.horizonDays) * 86_400_000);
    if (leadThreshold > now) continue;

    const insertedWo = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(workOrders)
        .values({
          plantId: asset.plantId,
          type: 'PM',
          status: 'OPEN',
          priority: s.priority,
          assetId: s.assetId,
          pmScheduleId: s.id,
          title: template.name,
          description: template.description,
          dueAt: due,
          assigneeId: s.defaultAssigneeId,
          // Checklist snapshot ensures later edits to the PM template do not alter history
          checklistSnapshot: template.checklist as ChecklistItemDefinition[],
        })
        .onConflictDoNothing({ target: [workOrders.pmScheduleId, workOrders.dueAt] })
        .returning({ id: workOrders.id });

      if (inserted) {
        await tx.insert(auditLogs).values({
          plantId: asset.plantId,
          actorType: 'SYSTEM',
          action: 'WO_AUTO_CREATED',
          entity: 'WorkOrder',
          entityId: inserted.id,
          at: now,
        });

        // Advance schedule nextDueAt to the next cycle
        const nextCycle = advanceNextDueOnCompletion(s, {
          completedAt: due,
          meter,
        });

        if (nextCycle.nextDueAt) {
          await tx
            .update(pmSchedules)
            .set({
              nextDueAt: nextCycle.nextDueAt,
              updatedAt: now,
            })
            .where(eq(pmSchedules.id, s.id));
        }
      }

      return inserted;
    });

    if (insertedWo) {
      created += 1;
      log.info(
        { scheduleId: s.id, workOrderId: insertedWo.id, dueAt: due.toISOString() },
        'Created work order from PM schedule',
      );

      // Enqueue reminders with deterministic jobIds
      if (s.reminderOffsetsMin && s.reminderOffsetsMin.length > 0) {
        await enqueueReminders(insertedWo.id, due, s.reminderOffsetsMin);
      }
    }
  }

  log.info({ schedulesEvaluated: rows.length, created }, 'PM generation batch finished');
  return { evaluated: rows.length, created };
}
