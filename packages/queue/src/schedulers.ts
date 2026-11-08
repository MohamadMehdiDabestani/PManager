import { getQueue, QUEUES, JOBS } from './queues.js';

const TZ = 'Asia/Tehran';

export async function registerSchedulers() {
  const pm = getQueue(QUEUES.PM_SCHEDULER);
  const inv = getQueue(QUEUES.INVENTORY);
  const sys = getQueue(QUEUES.SYSTEM_MAINTENANCE);

  await pm.upsertJobScheduler(
    'sched-nightly-pm-generation',
    { pattern: '0 2 * * *', tz: TZ },
    { name: JOBS.GENERATE_WORK_ORDERS, data: { horizonDays: 0 } },
  );

  await pm.upsertJobScheduler(
    'sched-overdue-scan',
    { pattern: '*/15 * * * *', tz: TZ },
    { name: JOBS.OVERDUE_SCAN, data: {} },
  );

  await inv.upsertJobScheduler(
    'sched-low-stock-alert',
    { pattern: '0 7 * * *', tz: TZ },
    { name: JOBS.LOW_STOCK_ALERT, data: {} },
  );

  await sys.upsertJobScheduler(
    'sched-outbox-sweeper',
    { pattern: '* * * * *', tz: TZ },
    { name: JOBS.OUTBOX_SWEEPER, data: {} },
  );
}
