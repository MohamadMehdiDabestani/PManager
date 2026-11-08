import { getQueue, QUEUES, JOBS } from './queues.js';

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
