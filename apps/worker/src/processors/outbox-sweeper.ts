import type { Job } from 'bullmq';
import { db } from '@cmms/db';
import { enqueueNotification } from '@cmms/queue';
import { findStalePendingNotifications } from '@cmms/core';
import { logger } from '../logger';

export async function processOutboxSweeper(job: Job) {
  const now = new Date();
  const log = logger.child({ jobId: job.id, job: job.name });

  const stale = await findStalePendingNotifications(db, now);
  let reEnqueued = 0;

  for (const row of stale) {
    await enqueueNotification(row.id, 0);
    reEnqueued += 1;
  }

  if (reEnqueued > 0) {
    log.info({ reEnqueued }, 'Outbox sweeper re-enqueued pending notifications');
  }
  return { reEnqueued };
}
