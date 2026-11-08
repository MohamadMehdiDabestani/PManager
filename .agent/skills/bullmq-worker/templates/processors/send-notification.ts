import { type Job, UnrecoverableError, DelayedError } from 'bullmq';
import { eq } from 'drizzle-orm';
import { notifications, users, workOrders } from '@cmms/db';
import { SendNotificationPayload } from '@cmms/queue/payloads';

/**
 * Delivers ONE Notification row. Channel fallback chain comes from user preferences,
 * default priority: ['SMS', 'EITAA', 'EMAIL']. Idempotent via status check + provider idempotency key.
 */
export const makeSendNotification = (d: Deps) => async (job: Job) => {
  const { notificationId } = SendNotificationPayload.parse(job.data);
  const [row] = await d.db
    .select({ notification: notifications, user: users })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!row) throw new UnrecoverableError('notification not found');
  const { notification: n, user } = row;
  if (n.status === 'SENT' || n.status === 'CANCELLED') return { skipped: n.status };

  // Context check: do not remind about work that is already finished
  if (n.workOrderId) {
    const [wo] = await d.db
      .select({ status: workOrders.status })
      .from(workOrders)
      .where(eq(workOrders.id, n.workOrderId))
      .limit(1);
    if (!wo || ['DONE', 'CANCELLED'].includes(wo.status)) {
      await d.db.update(notifications).set({ status: 'CANCELLED' }).where(eq(notifications.id, n.id));
      return { skipped: 'work-order-closed' };
    }
  }

  // Quiet hours (non-urgent only): delay instead of sending
  const delay = d.quietHours.delayMs(n, d.clock.now());
  if (delay > 0 && n.priority !== 'URGENT') {
    await job.moveToDelayed(Date.now() + delay, job.token);
    throw new DelayedError();
  }

  const chain = (user.channelPreference ?? ['SMS', 'EITAA', 'EMAIL']) as Channel[];
  const startIdx = Math.max(0, chain.indexOf(n.channel as Channel));
  let lastErr: unknown;

  for (const ch of chain.slice(startIdx)) {
    const adapter = d.channels[ch];
    if (!adapter || !adapter.canReach(user)) continue;
    try {
      await adapter.send({ to: user, title: n.title, body: n.body, link: n.link, idempotencyKey: `ntf-${n.id}-${ch}` });
      await d.db
        .update(notifications)
        .set({ status: 'SENT', sentAt: d.clock.now(), channel: ch })
        .where(eq(notifications.id, n.id));
      return { channel: ch };
    } catch (e) {
      lastErr = e;
      if (adapter.isPermanent(e)) {
        d.logger.warn({ ch, userId: n.userId }, 'permanent channel failure, falling back');
        continue;
      }
      throw e;
    }
  }
  await d.db
    .update(notifications)
    .set({ status: 'FAILED', error: String(lastErr) })
    .where(eq(notifications.id, n.id));
  throw new UnrecoverableError('all channels failed');
};
