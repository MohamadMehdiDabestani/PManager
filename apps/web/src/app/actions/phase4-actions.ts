'use server';

import { revalidatePath } from 'next/cache';
import {
  createAndSendNotification,
  executeWorkOrderEscalationLevel,
  updateUserNotificationPreferences,
  markNotificationRead,
  markAllNotificationsRead,
} from '@cmms/core';
import type { NotificationChannel, Priority } from '@cmms/db';
import { enqueueNotification, scheduleEscalation } from '@cmms/queue';
import { getServerContext } from '@/lib/server-context';

export async function sendTestNotificationAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const userId = String(formData.get('userId') ?? '');
  const preferredChannel = String(formData.get('preferredChannel') ?? 'BALE') as NotificationChannel;
  const priority = String(formData.get('priority') ?? 'HIGH') as Priority;
  const title = String(formData.get('title') ?? 'تست ارسال اعلان هوشمند').trim();
  const body = String(
    formData.get('body') ??
      'این پیام جهت بررسی عملکرد کانال ربات بله، پیامک، ایتا و زنجیره Fallback ارسال شده است.',
  ).trim();

  const res = await createAndSendNotification(ctx, {
    userId,
    preferredChannel,
    priority,
    title,
    body,
    link: '/m/work-orders',
    bypassQuietHours: true,
  });

  if (res?.notificationId) {
    try {
      await enqueueNotification(res.notificationId, 0);
    } catch {
      // Queue might be offline
    }
  }

  revalidatePath('/notifications');
}

export async function triggerEscalationSimulationAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const workOrderId = String(formData.get('workOrderId') ?? '');
  const levelNum = Number(formData.get('level') ?? '1');
  const level = (levelNum === 2 ? 2 : levelNum === 3 ? 3 : 1) as 1 | 2 | 3;

  if (!workOrderId) return;

  await executeWorkOrderEscalationLevel(ctx.db, workOrderId, level, ctx.now());

  try {
    await scheduleEscalation(workOrderId, level, 0);
  } catch {
    // Queue might be offline
  }

  revalidatePath('/notifications');
  revalidatePath('/work-orders');
}

export async function updateUserChannelPrefsAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const userId = String(formData.get('userId') ?? '');
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const baleChatId = String(formData.get('baleChatId') ?? '').trim() || null;
  const eitaaChatId = String(formData.get('eitaaChatId') ?? '').trim() || null;
  const email = String(formData.get('email') ?? '').trim() || null;
  const quietHoursStart = String(formData.get('quietHoursStart') ?? '22:00').trim();
  const quietHoursEnd = String(formData.get('quietHoursEnd') ?? '06:00').trim();

  const chainOrderRaw = String(
    formData.get('chainOrder') ?? 'SMS,BALE,EITAA,EMAIL',
  );
  const channelPreference = chainOrderRaw
    .split(',')
    .map((c) => c.trim() as NotificationChannel)
    .filter(Boolean);

  await updateUserNotificationPreferences(ctx, {
    userId,
    phone,
    baleChatId,
    eitaaChatId,
    email,
    channelPreference:
      channelPreference.length > 0
        ? channelPreference
        : ['SMS', 'BALE', 'EITAA', 'EMAIL'],
    quietHoursStart,
    quietHoursEnd,
  });

  revalidatePath('/notifications');
  revalidatePath('/organization');
}

export async function markNotificationReadAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await markNotificationRead(ctx, id);
  revalidatePath('/notifications');
}

export async function markAllNotificationsReadAction() {
  const { ctx } = await getServerContext();
  await markAllNotificationsRead(ctx);
  revalidatePath('/notifications');
}
