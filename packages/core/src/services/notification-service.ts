import { z } from 'zod';
import { and, eq, isNull, desc, lt } from 'drizzle-orm';
import {
  notifications,
  users,
  userPlants,
  workOrders,
  assets,
  auditLogs,
  type DbClient,
  type Notification,
  type NotificationChannel,
  type NotificationStatus,
  type Priority,
} from '@cmms/db';
import { assertCan } from '../auth/index';
import type { ServiceContext } from '../context';
import { writeAuditLog } from './audit-service';
import {
  computeQuietHoursDelayMs,
  deliverWithFallbackChain,
} from '../domain/notifications';

export type NotificationWithDetails = Notification & {
  recipientName: string;
  recipientUsername: string;
  recipientRole: string;
  workOrderTitle?: string | null;
};

export const sendTestNotificationSchema = z.object({
  userId: z.string().uuid(),
  preferredChannel: z
    .enum(['SMS', 'BALE', 'EITAA', 'EMAIL', 'IN_APP', 'WEB_PUSH'])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('HIGH'),
  title: z.string().min(2),
  body: z.string().min(2),
  link: z.string().optional(),
});

export const updateUserChannelsSchema = z.object({
  userId: z.string().uuid(),
  phone: z.string().optional().nullable(),
  baleChatId: z.string().optional().nullable(),
  eitaaChatId: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  channelPreference: z
    .array(z.enum(['SMS', 'BALE', 'EITAA', 'EMAIL', 'IN_APP', 'WEB_PUSH']))
    .min(1),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default('22:00'),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default('06:00'),
});

export async function listNotifications(
  ctx: ServiceContext,
  params?: {
    userId?: string;
    status?: NotificationStatus;
    channel?: NotificationChannel;
    limit?: number;
  },
): Promise<NotificationWithDetails[]> {
  const conditions = [];
  if (params?.userId) conditions.push(eq(notifications.userId, params.userId));
  if (params?.status) conditions.push(eq(notifications.status, params.status));
  if (params?.channel) conditions.push(eq(notifications.channel, params.channel));

  const rows = await ctx.db
    .select({
      notification: notifications,
      recipientName: users.fullName,
      recipientUsername: users.username,
      recipientRole: users.role,
      workOrderTitle: workOrders.title,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .leftJoin(workOrders, eq(notifications.workOrderId, workOrders.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(params?.limit ?? 50);

  return rows.map((r) => ({
    ...r.notification,
    recipientName: r.recipientName,
    recipientUsername: r.recipientUsername,
    recipientRole: r.recipientRole,
    workOrderTitle: r.workOrderTitle,
  }));
}

/**
 * Core processor function that delivers a single Notification row by ID.
 * Enforces idempotency, closed-WO cancellation, quiet hours, and the fallback chain:
 * SMS -> BALE -> EITAA -> EMAIL -> IN_APP
 */
export async function deliverNotificationById(
  db: DbClient,
  notificationId: string,
  now = new Date(),
  opts?: { forceBypassQuietHours?: boolean },
): Promise<{
  status: 'SENT' | 'SKIPPED' | 'CANCELLED' | 'DELAYED' | 'FAILED';
  deliveredChannel?: NotificationChannel;
  attemptedChannels?: NotificationChannel[];
  delayedMs?: number;
  reason?: string;
}> {
  const [row] = await db
    .select({
      notification: notifications,
      user: users,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!row) {
    return { status: 'SKIPPED', reason: 'not-found' };
  }

  const { notification: n, user } = row;
  if (n.status === 'SENT' || n.status === 'CANCELLED') {
    return { status: 'SKIPPED', reason: n.status };
  }

  // If linked to a work order, do not send reminders for work orders that are already DONE or CANCELLED
  if (n.workOrderId) {
    const [wo] = await db
      .select({ status: workOrders.status })
      .from(workOrders)
      .where(eq(workOrders.id, n.workOrderId))
      .limit(1);

    if (!wo || wo.status === 'DONE' || wo.status === 'CANCELLED') {
      await db
        .update(notifications)
        .set({ status: 'CANCELLED', error: 'دستورکار مرتبط قبلاً بسته شده است' })
        .where(eq(notifications.id, n.id));
      return { status: 'CANCELLED', reason: 'work-order-closed' };
    }
  }

  // Check quiet hours (unless URGENT or explicitly bypassed)
  if (!opts?.forceBypassQuietHours) {
    const delayMs = computeQuietHoursDelayMs(
      now,
      user.quietHoursStart ?? '22:00',
      user.quietHoursEnd ?? '06:00',
      n.priority,
    );
    if (delayMs > 0) {
      return { status: 'DELAYED', delayedMs: delayMs, reason: 'quiet-hours' };
    }
  }

  try {
    const delivery = await deliverWithFallbackChain(
      {
        to: user,
        title: n.title,
        body: n.body,
        link: n.link,
        idempotencyKey: n.idempotencyKey,
      },
      { preferredChannel: n.channel },
    );

    await db
      .update(notifications)
      .set({
        status: 'SENT',
        channel: delivery.deliveredChannel,
        sentAt: now,
        error: null,
      })
      .where(eq(notifications.id, n.id));

    return {
      status: 'SENT',
      deliveredChannel: delivery.deliveredChannel,
      attemptedChannels: delivery.attemptedChannels,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(notifications)
      .set({
        status: 'FAILED',
        error: errMsg,
      })
      .where(eq(notifications.id, n.id));

    return {
      status: 'FAILED',
      reason: errMsg,
    };
  }
}

/**
 * Inserts a notification row (Outbox) and delivers it via the fallback chain.
 */
export async function createAndSendNotification(
  ctx: ServiceContext,
  rawInput: z.infer<typeof sendTestNotificationSchema> & {
    kind?: string;
    workOrderId?: string | null;
    idempotencyKey?: string;
    bypassQuietHours?: boolean;
  },
) {
  const input = sendTestNotificationSchema.parse(rawInput);
  const idempotencyKey =
    rawInput.idempotencyKey ?? `ntf-${input.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const [inserted] = await ctx.db
    .insert(notifications)
    .values({
      userId: input.userId,
      workOrderId: rawInput.workOrderId ?? null,
      kind: rawInput.kind ?? 'MANUAL_ALERT',
      priority: input.priority,
      channel: input.preferredChannel ?? 'SMS',
      status: 'PENDING',
      title: input.title.trim(),
      body: input.body.trim(),
      link: input.link?.trim() ?? '/m/work-orders',
      idempotencyKey,
    })
    .onConflictDoNothing({ target: notifications.idempotencyKey })
    .returning();

  if (!inserted) {
    return null;
  }

  const deliveryResult = await deliverNotificationById(ctx.db, inserted.id, ctx.now(), {
    forceBypassQuietHours: rawInput.bypassQuietHours,
  });

  return {
    notificationId: inserted.id,
    ...deliveryResult,
  };
}

/**
 * Executes 3-Level Escalation for an overdue/unacknowledged Work Order:
 * Level 1 -> SUPERVISOR (سرپرست شیفت)
 * Level 2 -> MAINTENANCE_MANAGER (مدیر نت)
 * Level 3 -> PLANT_HEAD (مدیر کارخانه - URGENT, bypasses quiet hours)
 */
export async function executeWorkOrderEscalationLevel(
  db: DbClient,
  workOrderId: string,
  level: 1 | 2 | 3,
  now = new Date(),
): Promise<{
  skipped?: string;
  level: 1 | 2 | 3;
  notifiedCount: number;
  targetRole: string;
}> {
  const LEVEL_ROLES = ['SUPERVISOR', 'MAINTENANCE_MANAGER', 'PLANT_HEAD'] as const;
  const LEVEL_TITLES_FA = [
    'سطح ۱ (سرپرست شیفت)',
    'سطح ۲ (مدیر نگهداری و تعمیرات)',
    'سطح ۳ بحرانی (مدیر کارخانه)',
  ] as const;

  const [row] = await db
    .select({
      wo: workOrders,
      asset: assets,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .where(and(eq(workOrders.id, workOrderId), isNull(workOrders.deletedAt)))
    .limit(1);

  if (!row || row.wo.status === 'DONE' || row.wo.status === 'CANCELLED') {
    return { skipped: 'work-order-closed', level, notifiedCount: 0, targetRole: '' };
  }

  const { wo, asset } = row;
  const targetRole = LEVEL_ROLES[level - 1]!;
  const levelLabelFa = LEVEL_TITLES_FA[level - 1]!;
  const priority: Priority = level === 3 ? 'URGENT' : 'HIGH';

  const recipients = await db
    .select({ user: users })
    .from(users)
    .innerJoin(userPlants, eq(users.id, userPlants.userId))
    .where(
      and(
        eq(users.role, targetRole),
        eq(users.active, true),
        eq(userPlants.plantId, asset.plantId),
      ),
    );

  // Fallback to ADMIN if no PLANT_HEAD exists in seed
  const targetUsers =
    recipients.length > 0
      ? recipients.map((r) => r.user)
      : await db
          .select()
          .from(users)
          .where(eq(users.active, true))
          .limit(1);

  let notifiedCount = 0;

  for (const recipient of targetUsers) {
    const idempotencyKey = `esc-${wo.id}-L${level}-${recipient.id}`;
    const preferredChannel: NotificationChannel =
      level === 3 ? 'SMS' : (recipient.channelPreference?.[0] ?? 'BALE');

    const [inserted] = await db
      .insert(notifications)
      .values({
        userId: recipient.id,
        workOrderId: wo.id,
        kind: `WO_ESCALATION_L${level}`,
        priority,
        channel: preferredChannel,
        status: 'PENDING',
        title: `هشدار Escalation ${levelLabelFa}: ${wo.title}`,
        body: `تجهیز ${asset.name} (${asset.code}) دارای تاخیر است و نیازمند پیگیری فوری می‌باشد.`,
        link: `/work-orders/${wo.id}`,
        idempotencyKey,
      })
      .onConflictDoNothing({ target: notifications.idempotencyKey })
      .returning();

    if (inserted) {
      await deliverNotificationById(db, inserted.id, now, {
        forceBypassQuietHours: level === 3,
      });
      notifiedCount += 1;
    }
  }

  await db.insert(auditLogs).values({
    plantId: asset.plantId,
    actorType: 'SYSTEM',
    action: 'WO_ESCALATED',
    entity: 'WorkOrder',
    entityId: wo.id,
    after: { level, targetRole, notifiedCount },
    at: now,
  });

  return { level, notifiedCount, targetRole };
}

export async function markNotificationRead(ctx: ServiceContext, notificationId: string) {
  await ctx.db
    .update(notifications)
    .set({ readAt: ctx.now() })
    .where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsRead(ctx: ServiceContext, userId?: string) {
  const conditions = [isNull(notifications.readAt)];
  if (userId) conditions.push(eq(notifications.userId, userId));

  await ctx.db
    .update(notifications)
    .set({ readAt: ctx.now() })
    .where(and(...conditions));
}

export async function updateUserNotificationPreferences(
  ctx: ServiceContext,
  rawInput: z.infer<typeof updateUserChannelsSchema>,
) {
  const input = updateUserChannelsSchema.parse(rawInput);

  const [updated] = await ctx.db
    .update(users)
    .set({
      phone: input.phone?.trim() || null,
      baleChatId: input.baleChatId?.trim() || null,
      eitaaChatId: input.eitaaChatId?.trim() || null,
      email: input.email?.trim() || null,
      channelPreference: input.channelPreference,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
      updatedAt: ctx.now(),
    })
    .where(eq(users.id, input.userId))
    .returning();

  if (!updated) {
    throw new Error('کاربر یافت نشد');
  }

  await writeAuditLog(ctx, {
    action: 'USER_NOTIFICATION_PREFS_UPDATED',
    entity: 'User',
    entityId: updated.id,
    after: {
      baleChatId: updated.baleChatId,
      eitaaChatId: updated.eitaaChatId,
      channelPreference: updated.channelPreference,
      quietHoursStart: updated.quietHoursStart,
      quietHoursEnd: updated.quietHoursEnd,
    },
  });

  return updated;
}

/**
 * Finds PENDING notifications older than 2 minutes for the Outbox Sweeper worker job.
 */
export async function findStalePendingNotifications(db: DbClient, now = new Date()) {
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60_000);
  return db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.status, 'PENDING'),
        lt(notifications.createdAt, twoMinutesAgo),
      ),
    )
    .limit(100);
}
