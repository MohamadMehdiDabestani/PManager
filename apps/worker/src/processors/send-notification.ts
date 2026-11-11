import { type Job, DelayedError, UnrecoverableError } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, notifications, workOrders, users } from '@cmms/db';
import { deliverNotificationById } from '@cmms/core';
import { logger } from '../logger';

export async function processSendNotification(job: Job, token?: string) {
  const data = (job.data ?? {}) as {
    notificationId?: string;
    workOrderId?: string;
    reminderOffsetMin?: number;
  };
  const now = new Date();
  const log = logger.child({ jobId: job.id, job: job.name });

  let targetNotificationId = data.notificationId;

  // Handle delayed reminder job produced at WO creation time
  if (!targetNotificationId && data.workOrderId !== undefined) {
    const [wo] = await db
      .select()
      .from(workOrders)
      .where(eq(workOrders.id, data.workOrderId))
      .limit(1);

    if (!wo || wo.status === 'DONE' || wo.status === 'CANCELLED') {
      return { skipped: 'work-order-closed' };
    }

    let recipientId = wo.assigneeId;
    if (!recipientId) {
      const [fallbackSup] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'SUPERVISOR'))
        .limit(1);
      recipientId = fallbackSup?.id ?? null;
    }

    if (!recipientId) {
      return { skipped: 'no-recipient' };
    }

    const [recipientUser] = await db
      .select({ channelPreference: users.channelPreference })
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);

    const preferredChannel = recipientUser?.channelPreference?.[0] ?? 'SMS';
    const offsetMin = data.reminderOffsetMin ?? 0;
    const idempotencyKey = `rem-ntf-${wo.id}-${offsetMin}`;

    const [inserted] = await db
      .insert(notifications)
      .values({
        userId: recipientId,
        workOrderId: wo.id,
        kind: 'WO_REMINDER',
        priority: offsetMin >= 0 ? 'HIGH' : 'MEDIUM',
        channel: preferredChannel,
        status: 'PENDING',
        title: `یادآوری دستورکار: ${wo.title}`,
        body:
          offsetMin < 0
            ? `موعد انجام دستورکار در ${Math.abs(Math.round(offsetMin / 60))} ساعت آینده فرا می‌رسد.`
            : 'موعد انجام این دستورکار فرا رسیده است.',
        link: `/m/work-orders/${wo.id}`,
        idempotencyKey,
      })
      .onConflictDoNothing({ target: notifications.idempotencyKey })
      .returning({ id: notifications.id });

    targetNotificationId = inserted?.id;
    if (!targetNotificationId) {
      return { skipped: 'already-created' };
    }
  }

  if (!targetNotificationId) {
    throw new UnrecoverableError('Missing notificationId in send-notification job');
  }

  const res = await deliverNotificationById(db, targetNotificationId, now);

  if (res.status === 'DELAYED' && res.delayedMs && res.delayedMs > 0) {
    log.info(
      { notificationId: targetNotificationId, delayedMs: res.delayedMs },
      'Notification falls inside user quiet hours; delaying delivery',
    );
    await job.moveToDelayed(Date.now() + res.delayedMs, token);
    throw new DelayedError();
  }

  if (res.status === 'FAILED') {
    throw new UnrecoverableError(res.reason ?? 'All notification channels failed');
  }

  log.info(
    {
      notificationId: targetNotificationId,
      status: res.status,
      channel: res.deliveredChannel,
      attempted: res.attemptedChannels,
    },
    'Notification processed (chain: SMS (SMS.ir) -> BALE -> EITAA -> EMAIL -> IN_APP)',
  );

  return res;
}
