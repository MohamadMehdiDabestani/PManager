import { Worker, type Processor } from 'bullmq';
import { closeDb } from '@cmms/db';
import {
  createRedis,
  QUEUE_PREFIX,
  QUEUES,
  JOBS,
  getQueue,
  registerSchedulers,
  type QueueName,
} from '@cmms/queue';
import { logger } from './logger.js';

type Handlers = Record<string, Processor>;

function route(handlers: Handlers): Processor {
  return async (job, token) => {
    const handler = handlers[job.name];
    if (!handler) {
      throw new Error(`No handler registered for job ${job.name}`);
    }
    return handler(job, token);
  };
}

const activeWorkers: Worker[] = [];

function startWorker(
  queue: QueueName,
  handlers: Handlers,
  opts: { concurrency: number; limiter?: { max: number; duration: number } },
) {
  const worker = new Worker(queue, route(handlers), {
    connection: createRedis(),
    prefix: QUEUE_PREFIX,
    concurrency: opts.concurrency,
    limiter: opts.limiter,
    lockDuration: 60_000,
    maxStalledCount: 1,
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { queue, jobId: job?.id, name: job?.name, attempt: job?.attemptsMade, err: err.message },
      'job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ queue, err: err.message }, 'worker error');
  });

  activeWorkers.push(worker);
  return worker;
}

export async function boot() {
  startWorker(
    QUEUES.PM_SCHEDULER,
    {
      [JOBS.GENERATE_WORK_ORDERS]: async (job) => {
        logger.info({ jobId: job.id }, 'Running generate-work-orders');
        return { ok: true };
      },
      [JOBS.OVERDUE_SCAN]: async (job) => {
        logger.info({ jobId: job.id }, 'Running overdue-scan');
        return { ok: true };
      },
    },
    { concurrency: 1 },
  );

  startWorker(
    QUEUES.NOTIFICATIONS,
    {
      [JOBS.SEND_NOTIFICATION]: async (job) => {
        logger.info({ jobId: job.id }, 'Running send-notification (chain: SMS -> EITAA -> EMAIL)');
        return { ok: true };
      },
    },
    { concurrency: 10, limiter: { max: 20, duration: 1_000 } },
  );

  startWorker(
    QUEUES.ESCALATION,
    {
      [JOBS.ESCALATE]: async (job) => {
        logger.info({ jobId: job.id }, 'Running escalation check');
        return { ok: true };
      },
    },
    { concurrency: 5 },
  );

  await registerSchedulers();
  logger.info('CMMS BullMQ worker started and schedulers registered');
}

export async function shutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown initiated');
  await Promise.allSettled(activeWorkers.map((w) => w.close()));
  await Promise.allSettled(Object.values(QUEUES).map((q) => getQueue(q).close()));
  await closeDb();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void boot();
