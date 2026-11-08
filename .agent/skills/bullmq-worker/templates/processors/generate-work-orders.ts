import type { Job } from 'bullmq';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { pmSchedules, assets, pmTemplates, workOrders, auditLogs } from '@cmms/db';
import { GenerateWorkOrdersPayload } from '@cmms/queue/payloads';
import { computeNextDue } from '@cmms/core/domain/pm-schedule';
import { enqueueReminders } from '@cmms/queue/producers';

/**
 * Generates PM work orders for schedules that are due within (leadDays + horizonDays).
 * IDEMPOTENT: DB has uniqueIndex(pmScheduleId, dueAt) on work_orders and we use onConflictDoNothing().
 */
export const makeGenerateWorkOrders = (d: Deps) => async (job: Job) => {
  const payload = GenerateWorkOrdersPayload.parse(job.data);
  const now = d.clock.now();
  const log = d.logger.child({ jobId: job.id, job: job.name });

  const rows = await d.db
    .select({
      schedule: pmSchedules,
      asset: assets,
      template: pmTemplates,
    })
    .from(pmSchedules)
    .innerJoin(assets, eq(pmSchedules.assetId, assets.id))
    .innerJoin(pmTemplates, eq(pmSchedules.templateId, pmTemplates.id))
    .where(
      and(
        eq(pmSchedules.active, true),
        isNull(pmSchedules.deletedAt),
        ne(assets.status, 'DECOMMISSIONED'),
        payload.scheduleId ? eq(pmSchedules.id, payload.scheduleId) : undefined,
      ),
    );

  let created = 0;
  for (const { schedule: s, asset, template } of rows) {
    const due = computeNextDue(s, { now, meter: await d.meters.latest(s.meterId) });
    if (!due) continue;
    const lead = new Date(due.getTime() - (s.leadDays + payload.horizonDays) * 86_400_000);
    if (lead > now) continue;

    const insertedWo = await d.db.transaction(async (tx) => {
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
          dueAt: due,
          assigneeId: s.defaultAssigneeId,
          checklistSnapshot: template.checklist, // snapshot: template edits must not alter history
        })
        .onConflictDoNothing({ target: [workOrders.pmScheduleId, workOrders.dueAt] })
        .returning({ id: workOrders.id });

      if (inserted) {
        await tx.insert(auditLogs).values({
          actorType: 'SYSTEM',
          action: 'WO_AUTO_CREATED',
          entity: 'PmSchedule',
          entityId: s.id,
        });
      }
      return inserted;
    });

    if (insertedWo) {
      created += 1;
      await enqueueReminders(d, insertedWo.id, due, s.reminderOffsetsMin); // deterministic jobIds, safe to repeat
    }
  }
  log.info({ schedules: rows.length, created }, 'work orders generated');
  return { created };
};
