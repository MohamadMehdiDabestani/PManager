import { Worker, QueueEvents, type Processor } from 'bullmq';
import { createRedis, QUEUE_PREFIX } from '@cmms/queue/connection';
import { QUEUES, JOBS, getQueue } from '@cmms/queue/queues';
import { registerSchedulers } from '@cmms/queue/schedulers';
import { logger } from './logger';
import { deps } from './deps'; // db, clock, services, notifier...
import { makeGenerateWorkOrders } from './processors/generate-work-orders';
import { makeSendNotification } from './processors/send-notification';
import { makeEscalation } from './processors/escalation';

type Handlers = Record<string, Processor>;

function route(handlers: Handlers): Processor {
  return async (job, token) => {
    const h = handlers[job.name];
    if (!h) throw new Error(`No handler for job ${job.name}`);
    return h(job, token);
  };
}

const workers: Worker[] = [];

function start(queue: string, handlers: Handlers, opts: { concurrency: number; limiter?: { max: number; duration: number } }) {
  const w = new Worker(queue, route(handlers), {
    connection: createRedis(),
    prefix: QUEUE_PREFIX,
    concurrency: opts.concurrency,
    limiter: opts.limiter,
    lockDuration: 60_000,
    maxStalledCount: 1,
  });
  w.on('failed', async (job, err) => {
    const final = job && job.attemptsMade >= (job.opts.attempts ?? 1);
    logger.error({ queue, jobId: job?.id, name: job?.name, attempt: job?.attemptsMade, err: err.message }, 'job failed');
    if (final) await deps.alerts.deadLetter({ queue, job, err }); // persist + notify admins
  });
  w.on('error', (err) => logger.error({ queue, err: err.message }, 'worker error'));
  workers.push(w);
  return w;
}

export async function boot() {
  start(QUEUES.PM_SCHEDULER, {
    [JOBS.GENERATE_WORK_ORDERS]: makeGenerateWorkOrders(deps),
    // [JOBS.OVERDUE_SCAN]: ..., [JOBS.PROJECT_METER_DUE]: ...
  }, { concurrency: 1 });

  start(QUEUES.NOTIFICATIONS, {
    [JOBS.SEND_NOTIFICATION]: makeSendNotification(deps),
  }, { concurrency: 10, limiter: { max: 20, duration: 1_000 } });

  start(QUEUES.ESCALATION, { [JOBS.ESCALATE]: makeEscalation(deps) }, { concurrency: 5 });
  // inventory, reports, ai, system ... same pattern

  await registerSchedulers();

  // Optional: QueueEvents for global metrics/logging
  const qe = new QueueEvents(QUEUES.NOTIFICATIONS, { connection: createRedis(), prefix: QUEUE_PREFIX });
  qe.on('stalled', ({ jobId }) => logger.warn({ jobId }, 'job stalled'));

  logger.info('worker ready');
}

export async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  await Promise.allSettled(workers.map((w) => w.close())); // waits for active jobs
  await Promise.allSettled(Object.values(QUEUES).map((q) => getQueue(q).close()));
  await deps.dbPool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (e) => logger.error({ e }, 'unhandledRejection'));
