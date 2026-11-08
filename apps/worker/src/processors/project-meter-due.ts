import type { Job } from 'bullmq';
import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import { db, pmSchedules } from '@cmms/db';
import { ProjectMeterDuePayload } from '@cmms/queue';
import { computeNextDue, getMeterState } from '@cmms/core';
import { logger } from '../logger';

export async function processProjectMeterDue(job: Job) {
  const payload = ProjectMeterDuePayload.parse(job.data ?? {});
  const now = new Date();
  const log = logger.child({ jobId: job.id, job: job.name });

  const conditions = [
    eq(pmSchedules.active, true),
    isNull(pmSchedules.deletedAt),
    inArray(pmSchedules.triggerType, ['METER', 'HYBRID']),
    isNotNull(pmSchedules.meterId),
  ];

  if (payload.meterId) {
    conditions.push(eq(pmSchedules.meterId, payload.meterId));
  }

  const schedules = await db
    .select()
    .from(pmSchedules)
    .where(and(...conditions));

  let updatedCount = 0;

  for (const s of schedules) {
    if (!s.meterId) continue;
    const meter = await getMeterState(db, s.meterId);
    if (!meter) continue;

    const projectedDue = computeNextDue(s, { now, meter });
    if (!projectedDue) continue;

    if (!s.nextDueAt || Math.abs(s.nextDueAt.getTime() - projectedDue.getTime()) > 3_600_000) {
      await db
        .update(pmSchedules)
        .set({
          nextDueAt: projectedDue,
          updatedAt: now,
        })
        .where(eq(pmSchedules.id, s.id));

      updatedCount += 1;
    }
  }

  log.info({ evaluated: schedules.length, updatedCount }, 'Project meter due dates completed');
  return { evaluated: schedules.length, updatedCount };
}
