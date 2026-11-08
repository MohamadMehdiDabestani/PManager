import { getQueue, QUEUES, JOBS } from './queues';

// jobId rules: deterministic, no ':' and not purely numeric.
export const ids = {
  notification: (id: string) => `ntf-${id}`,
  reminder: (woId: string, offsetMin: number) => `rem-${woId}-${offsetMin < 0 ? 'm' : 'p'}${Math.abs(offsetMin)}`,
  escalation: (woId: string, level: number) => `esc-${woId}-L${level}`,
};

export async function enqueueNotification(notificationId: string, delayMs = 0) {
  return getQueue(QUEUES.NOTIFICATIONS).add(
    JOBS.SEND_NOTIFICATION,
    { notificationId },
    { jobId: ids.notification(notificationId), delay: delayMs },
  ); // adding the same jobId again is a no-op => idempotent
}

export async function scheduleEscalation(workOrderId: string, level: number, delayMs: number) {
  return getQueue(QUEUES.ESCALATION).add(
    JOBS.ESCALATE,
    { workOrderId, level },
    { jobId: ids.escalation(workOrderId, level), delay: delayMs },
  );
}

/** Call when a WO is completed/cancelled. Active jobs cannot be removed; processors re-check status anyway. */
export async function cancelWorkOrderJobs(workOrderId: string, offsets: number[], levels = [1, 2, 3]) {
  const notif = getQueue(QUEUES.NOTIFICATIONS);
  const esc = getQueue(QUEUES.ESCALATION);
  await Promise.allSettled([
    ...offsets.map((o) => notif.remove(ids.reminder(workOrderId, o))),
    ...levels.map((l) => esc.remove(ids.escalation(workOrderId, l))),
  ]);
}

/** Fan-out of delayed reminder jobs for a WO. Deterministic ids make repeated calls harmless. */
export async function enqueueReminders(d: { notify: { createReminder(woId: string, offsetMin: number): Promise<string> } }, workOrderId: string, dueAt: Date, offsetsMin: number[]) {
  const q = getQueue(QUEUES.NOTIFICATIONS);
  for (const offset of offsetsMin) { // e.g. [-10080, -1440, 0, 60]
    const at = dueAt.getTime() + offset * 60_000;
    const delay = Math.max(0, at - Date.now());
    const notificationId = await d.notify.createReminder(workOrderId, offset); // outbox row (unique per wo+offset)
    await q.add(JOBS.SEND_NOTIFICATION, { notificationId }, { jobId: ids.reminder(workOrderId, offset), delay });
  }
}
