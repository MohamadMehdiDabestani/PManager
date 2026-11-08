import { getQueue, QUEUES, JOBS } from './queues';

export const ids = {
  notification: (id: string) => `ntf-${id}`,
  reminder: (woId: string, offsetMin: number) =>
    `rem-${woId}-${offsetMin < 0 ? 'm' : 'p'}${Math.abs(offsetMin)}`,
  escalation: (woId: string, level: number) => `esc-${woId}-L${level}`,
};

export async function enqueueNotification(notificationId: string, delayMs = 0) {
  return getQueue(QUEUES.NOTIFICATIONS).add(
    JOBS.SEND_NOTIFICATION,
    { notificationId },
    { jobId: ids.notification(notificationId), delay: delayMs },
  );
}

export async function scheduleEscalation(workOrderId: string, level: 1 | 2 | 3, delayMs: number) {
  return getQueue(QUEUES.ESCALATION).add(
    JOBS.ESCALATE,
    { workOrderId, level },
    { jobId: ids.escalation(workOrderId, level), delay: delayMs },
  );
}

export async function enqueueGenerateWorkOrders(payload?: {
  scheduleId?: string;
  horizonDays?: number;
}) {
  return getQueue(QUEUES.PM_SCHEDULER).add(
    JOBS.GENERATE_WORK_ORDERS,
    payload ?? { horizonDays: 0 },
    payload?.scheduleId ? { jobId: `gen-${payload.scheduleId}-${Date.now()}` } : undefined,
  );
}

export async function enqueueProjectMeterDue(payload?: { meterId?: string }) {
  return getQueue(QUEUES.PM_SCHEDULER).add(
    JOBS.PROJECT_METER_DUE,
    payload ?? {},
    payload?.meterId ? { jobId: `proj-${payload.meterId}-${Date.now()}` } : undefined,
  );
}

export async function enqueueReminders(
  workOrderId: string,
  dueAt: Date,
  offsetsMin: number[],
) {
  const now = Date.now();
  const queue = getQueue(QUEUES.NOTIFICATIONS);
  const promises: Promise<unknown>[] = [];

  for (const offset of offsetsMin) {
    const targetTime = dueAt.getTime() + offset * 60_000;
    const delay = targetTime - now;
    if (delay > 0) {
      promises.push(
        queue.add(
          JOBS.SEND_NOTIFICATION,
          { workOrderId, reminderOffsetMin: offset },
          { jobId: ids.reminder(workOrderId, offset), delay },
        ),
      );
    }
  }

  await Promise.allSettled(promises);
}

export async function cancelWorkOrderJobs(
  workOrderId: string,
  offsets: number[],
  levels: Array<1 | 2 | 3> = [1, 2, 3],
) {
  const notif = getQueue(QUEUES.NOTIFICATIONS);
  const esc = getQueue(QUEUES.ESCALATION);
  await Promise.allSettled([
    ...offsets.map((o) => notif.remove(ids.reminder(workOrderId, o))),
    ...levels.map((l) => esc.remove(ids.escalation(workOrderId, l))),
  ]);
}
