import { getQueue, QUEUES, JOBS, defaultJobOptions } from './queues';

const TZ = 'Asia/Tehran';

// Working days are plant-configurable; cron below runs daily and the processor
// decides (using the plant calendar) whether today is a working day.
const schedulers = [
  { queue: QUEUES.PM_SCHEDULER, id: 'sch-generate-wo-nightly', pattern: '0 2 * * *', name: JOBS.GENERATE_WORK_ORDERS, data: { horizonDays: 0 } },
  { queue: QUEUES.PM_SCHEDULER, id: 'sch-overdue-scan', pattern: '*/15 * * * *', name: JOBS.OVERDUE_SCAN, data: {} },
  { queue: QUEUES.PM_SCHEDULER, id: 'sch-meter-projection', pattern: '0 3 * * *', name: JOBS.PROJECT_METER_DUE, data: {} },
  { queue: QUEUES.INVENTORY, id: 'sch-low-stock', pattern: '0 7 * * *', name: JOBS.LOW_STOCK_ALERT, data: {} },
  { queue: QUEUES.REPORTS, id: 'sch-daily-digest', pattern: '30 7 * * *', name: JOBS.DAILY_DIGEST, data: {} },
  { queue: QUEUES.SYSTEM, id: 'sch-outbox-sweeper', pattern: '* * * * *', name: JOBS.OUTBOX_SWEEPER, data: {} },
  { queue: QUEUES.SYSTEM, id: 'sch-cleanup', pattern: '0 4 * * 0', name: JOBS.CLEANUP, data: {} },
] as const;

/** Idempotent: same scheduler id => upsert. Safe to call on every worker boot and from every replica. */
export async function registerSchedulers() {
  for (const s of schedulers) {
    await getQueue(s.queue).upsertJobScheduler(
      s.id,
      { pattern: s.pattern, tz: TZ },
      { name: s.name, data: s.data, opts: { ...defaultJobOptions } },
    );
  }
}
