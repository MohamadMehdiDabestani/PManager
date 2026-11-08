'use server';

import { revalidatePath } from 'next/cache';
import {
  createPmTemplate,
  deletePmTemplate,
  createPmSchedule,
  updatePmSchedule,
  deletePmSchedule,
  generateWorkOrderForSchedule,
  normalizeDigits,
  type CreatePmTemplateInput,
} from '@cmms/core';
import { enqueueGenerateWorkOrders, enqueueReminders } from '@cmms/queue';
import { getServerContext } from '@/lib/server-context';

export async function createPmTemplateAction(input: CreatePmTemplateInput) {
  const { ctx } = await getServerContext();
  const created = await createPmTemplate(ctx, input);
  revalidatePath('/pm-templates');
  revalidatePath('/pm-schedules');
  return { ok: true, id: created.id };
}

export async function deletePmTemplateAction(id: string) {
  const { ctx } = await getServerContext();
  await deletePmTemplate(ctx, id);
  revalidatePath('/pm-templates');
}

export async function createPmScheduleAction(formData: FormData) {
  const { ctx } = await getServerContext();

  const plantId = String(formData.get('plantId') ?? '');
  const assetId = String(formData.get('assetId') ?? '');
  const templateId = String(formData.get('templateId') ?? '');
  const triggerType = String(formData.get('triggerType') ?? 'CALENDAR') as
    | 'CALENDAR'
    | 'METER'
    | 'HYBRID';
  const anchorMode = String(formData.get('anchorMode') ?? 'FIXED') as 'FIXED' | 'FLOATING';

  const intervalDaysRaw = normalizeDigits(String(formData.get('intervalDays') ?? '')).trim();
  const intervalDays = intervalDaysRaw ? Number(intervalDaysRaw) : null;

  const meterId = String(formData.get('meterId') ?? '').trim() || null;
  const intervalMeterRaw = normalizeDigits(String(formData.get('intervalMeter') ?? '')).trim();
  const intervalMeter = intervalMeterRaw ? Number(intervalMeterRaw) : null;

  const leadDaysRaw = normalizeDigits(String(formData.get('leadDays') ?? '3')).trim();
  const leadDays = Number.isNaN(Number(leadDaysRaw)) ? 3 : Number(leadDaysRaw);

  const priority = String(formData.get('priority') ?? 'MEDIUM') as
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'URGENT';
  const defaultAssigneeId = String(formData.get('defaultAssigneeId') ?? '').trim() || null;

  const created = await createPmSchedule(ctx, {
    plantId,
    assetId,
    templateId,
    triggerType,
    anchorMode,
    intervalDays: triggerType !== 'METER' ? (intervalDays ?? 30) : null,
    meterId: triggerType !== 'CALENDAR' ? meterId : null,
    intervalMeter: triggerType !== 'CALENDAR' ? (intervalMeter ?? 250) : null,
    leadDays,
    priority,
    defaultAssigneeId,
    reminderOffsetsMin: [-1440, 0, 60],
    active: true,
  });

  try {
    await enqueueGenerateWorkOrders({ scheduleId: created.id, horizonDays: 0 });
  } catch {
    // Queue might be offline
  }

  revalidatePath('/pm-schedules');
  revalidatePath('/work-orders');
  revalidatePath('/');
}

export async function togglePmScheduleActiveAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const id = String(formData.get('id') ?? '');
  const nextActive = formData.get('active') === 'true';

  await updatePmSchedule(ctx, id, { active: nextActive });
  revalidatePath('/pm-schedules');
}

export async function deletePmScheduleAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const id = String(formData.get('id') ?? '');
  await deletePmSchedule(ctx, id);
  revalidatePath('/pm-schedules');
}

export async function triggerScheduleGenerationNowAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const scheduleId = String(formData.get('scheduleId') ?? '');
  if (!scheduleId) return;

  const res = await generateWorkOrderForSchedule(ctx, scheduleId);

  if (res.createdId && res.reminderOffsetsMin.length > 0) {
    try {
      await enqueueReminders(res.createdId, res.dueAt, res.reminderOffsetsMin);
    } catch {
      // ignore if Redis unavailable
    }
  }

  try {
    await enqueueGenerateWorkOrders({ scheduleId, horizonDays: 0 });
  } catch {
    // ignore if Redis unavailable
  }

  revalidatePath('/pm-schedules');
  revalidatePath('/work-orders');
  revalidatePath('/');
}
