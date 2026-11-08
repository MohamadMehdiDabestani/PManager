import type { Job } from 'bullmq';
import { db } from '@cmms/db';
import { EscalatePayload, scheduleEscalation } from '@cmms/queue';
import { executeWorkOrderEscalationLevel } from '@cmms/core';
import { logger } from '../logger';

// Delay before moving from L1->L2 (4 hours) and L2->L3 (8 hours)
const LEVEL_DELAY_MS: Record<number, number> = {
  1: 4 * 3_600_000,
  2: 8 * 3_600_000,
};

export async function processEscalation(job: Job) {
  const { workOrderId, level } = EscalatePayload.parse(job.data);
  const now = new Date();
  const log = logger.child({ jobId: job.id, job: job.name, workOrderId, level });

  const res = await executeWorkOrderEscalationLevel(db, workOrderId, level, now);

  if (res.skipped) {
    log.info({ skipped: res.skipped }, 'Escalation skipped');
    return res;
  }

  if (level < 3) {
    const nextLevel = (level + 1) as 2 | 3;
    const delayMs = LEVEL_DELAY_MS[level] ?? 4 * 3_600_000;
    await scheduleEscalation(workOrderId, nextLevel, delayMs);
  }

  log.info(
    { level, targetRole: res.targetRole, notifiedCount: res.notifiedCount },
    'Escalation level executed',
  );
  return res;
}
