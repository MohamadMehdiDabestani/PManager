import { z } from 'zod';
import { and, eq, isNull, desc } from 'drizzle-orm';
import {
  pmSchedules,
  pmTemplates,
  assets,
  assetMeters,
  assetMeterReadings,
  users,
  workOrders,
  type DbClient,
  type PmSchedule,
  type ChecklistItemDefinition,
} from '@cmms/db';
import { assertCan, accessibleWhere } from '../auth/index';
import type { ServiceContext } from '../context';
import { writeAuditLog } from './audit-service';
import { getPmTemplateById } from './pm-template-service';
import {
  computeNextDue,
  advanceNextDueOnCompletion,
  calculateDailyAverageUsage,
  type MeterState,
} from '../domain/pm-schedule';

export const createPmScheduleSchema = z.object({
  plantId: z.string().uuid('شناسه کارخانه الزامی است'),
  assetId: z.string().uuid('انتخاب دستگاه الزامی است'),
  templateId: z.string().uuid('انتخاب چک‌لیست الزامی است'),
  triggerType: z.enum(['CALENDAR', 'METER', 'HYBRID']).default('CALENDAR'),
  anchorMode: z.enum(['FIXED', 'FLOATING']).default('FIXED'),
  intervalDays: z.number().int().positive('فاصله روز باید عددی مثبت باشد').optional().nullable(),
  meterId: z.string().uuid().optional().nullable(),
  intervalMeter: z.number().positive('فاصله کارکرد باید عددی مثبت باشد').optional().nullable(),
  leadDays: z.number().int().min(0).default(3),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  defaultAssigneeId: z.string().uuid().optional().nullable(),
  reminderOffsetsMin: z.array(z.number().int()).default([-1440, 0, 60]),
  active: z.boolean().default(true),
  firstDueAt: z.coerce.date().optional(),
});

export type CreatePmScheduleInput = z.infer<typeof createPmScheduleSchema>;
export const updatePmScheduleSchema = createPmScheduleSchema
  .partial()
  .omit({ plantId: true, assetId: true });
export type UpdatePmScheduleInput = z.infer<typeof updatePmScheduleSchema>;

export type PmScheduleWithDetails = PmSchedule & {
  assetName: string;
  assetCode: string;
  templateName: string;
  assigneeName?: string | null;
  meterName?: string | null;
  meterUnit?: string | null;
};

export async function getMeterState(
  db: DbClient,
  meterId?: string | null,
): Promise<MeterState | null> {
  if (!meterId) return null;
  const [meter] = await db
    .select()
    .from(assetMeters)
    .where(eq(assetMeters.id, meterId))
    .limit(1);

  if (!meter) return null;

  const readings = await db
    .select({
      reading: assetMeterReadings.reading,
      recordedAt: assetMeterReadings.recordedAt,
    })
    .from(assetMeterReadings)
    .where(eq(assetMeterReadings.meterId, meterId))
    .orderBy(desc(assetMeterReadings.recordedAt))
    .limit(50);

  const dailyAverageUsage = calculateDailyAverageUsage(readings);

  return {
    currentReading: meter.currentReading,
    dailyAverageUsage,
  };
}

export async function listPmSchedules(
  ctx: ServiceContext,
  params?: { plantId?: string; assetId?: string; active?: boolean },
): Promise<PmScheduleWithDetails[]> {
  assertCan(ctx.ability, 'read', 'PmSchedule');
  const scopeCondition = accessibleWhere(ctx.ability, 'read', 'PmSchedule', pmSchedules);

  const conditions = [isNull(pmSchedules.deletedAt)];
  if (scopeCondition) conditions.push(scopeCondition);
  if (params?.plantId) conditions.push(eq(pmSchedules.plantId, params.plantId));
  if (params?.assetId) conditions.push(eq(pmSchedules.assetId, params.assetId));
  if (params?.active !== undefined) conditions.push(eq(pmSchedules.active, params.active));

  const rows = await ctx.db
    .select({
      schedule: pmSchedules,
      assetName: assets.name,
      assetCode: assets.code,
      templateName: pmTemplates.name,
      assigneeName: users.fullName,
      meterName: assetMeters.name,
      meterUnit: assetMeters.unit,
    })
    .from(pmSchedules)
    .innerJoin(assets, eq(pmSchedules.assetId, assets.id))
    .innerJoin(pmTemplates, eq(pmSchedules.templateId, pmTemplates.id))
    .leftJoin(users, eq(pmSchedules.defaultAssigneeId, users.id))
    .leftJoin(assetMeters, eq(pmSchedules.meterId, assetMeters.id))
    .where(and(...conditions))
    .orderBy(desc(pmSchedules.createdAt));

  return rows.map((r: {
    schedule: PmSchedule;
    assetName: string;
    assetCode: string;
    templateName: string;
    assigneeName: string | null;
    meterName: string | null;
    meterUnit: string | null;
  }) => ({
    ...r.schedule,
    assetName: r.assetName,
    assetCode: r.assetCode,
    templateName: r.templateName,
    assigneeName: r.assigneeName,
    meterName: r.meterName,
    meterUnit: r.meterUnit,
  }));
}

export async function getPmScheduleById(
  ctx: ServiceContext,
  id: string,
): Promise<PmScheduleWithDetails | null> {
  assertCan(ctx.ability, 'read', 'PmSchedule');
  const scopeCondition = accessibleWhere(ctx.ability, 'read', 'PmSchedule', pmSchedules);

  const conditions = [eq(pmSchedules.id, id), isNull(pmSchedules.deletedAt)];
  if (scopeCondition) conditions.push(scopeCondition);

  const [row] = await ctx.db
    .select({
      schedule: pmSchedules,
      assetName: assets.name,
      assetCode: assets.code,
      templateName: pmTemplates.name,
      assigneeName: users.fullName,
      meterName: assetMeters.name,
      meterUnit: assetMeters.unit,
    })
    .from(pmSchedules)
    .innerJoin(assets, eq(pmSchedules.assetId, assets.id))
    .innerJoin(pmTemplates, eq(pmSchedules.templateId, pmTemplates.id))
    .leftJoin(users, eq(pmSchedules.defaultAssigneeId, users.id))
    .leftJoin(assetMeters, eq(pmSchedules.meterId, assetMeters.id))
    .where(and(...conditions))
    .limit(1);

  if (!row) return null;

  return {
    ...row.schedule,
    assetName: row.assetName,
    assetCode: row.assetCode,
    templateName: row.templateName,
    assigneeName: row.assigneeName,
    meterName: row.meterName,
    meterUnit: row.meterUnit,
  };
}

export async function createPmSchedule(
  ctx: ServiceContext,
  input: CreatePmScheduleInput,
): Promise<PmSchedule> {
  const data = createPmScheduleSchema.parse(input);
  assertCan(ctx.ability, 'create', 'PmSchedule', { plantId: data.plantId });

  const meter = await getMeterState(ctx.db, data.meterId);
  const now = ctx.now();

  let nextDueAt: Date | null = data.firstDueAt ?? null;
  if (!nextDueAt) {
    nextDueAt = computeNextDue(
      {
        triggerType: data.triggerType,
        anchorMode: data.anchorMode,
        intervalDays: data.intervalDays ?? null,
        intervalMeter: data.intervalMeter ?? null,
        lastDoneAt: null,
        lastDoneMeter: null,
        nextDueAt: null,
      },
      { now, meter },
    );
  }

  const [created] = await ctx.db
    .insert(pmSchedules)
    .values({
      plantId: data.plantId,
      assetId: data.assetId,
      templateId: data.templateId,
      triggerType: data.triggerType,
      anchorMode: data.anchorMode,
      intervalDays: data.intervalDays ?? null,
      meterId: data.meterId ?? null,
      intervalMeter: data.intervalMeter ?? null,
      nextDueAt,
      leadDays: data.leadDays,
      priority: data.priority,
      defaultAssigneeId: data.defaultAssigneeId ?? null,
      reminderOffsetsMin: data.reminderOffsetsMin,
      active: data.active,
    })
    .returning();

  if (!created) {
    throw new Error('خطا در ایجاد برنامه نت');
  }

  await writeAuditLog(ctx, {
    plantId: created.plantId,
    action: 'PM_SCHEDULE_CREATED',
    entity: 'PmSchedule',
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updatePmSchedule(
  ctx: ServiceContext,
  id: string,
  input: UpdatePmScheduleInput,
): Promise<PmSchedule> {
  const existing = await getPmScheduleById(ctx, id);
  if (!existing) {
    throw new Error('برنامه نت یافت نشد');
  }

  assertCan(ctx.ability, 'update', 'PmSchedule', { plantId: existing.plantId });
  const data = updatePmScheduleSchema.parse(input);

  const updatePayload: Record<string, unknown> = {
    updatedAt: ctx.now(),
  };

  if (data.templateId !== undefined) updatePayload['templateId'] = data.templateId;
  if (data.triggerType !== undefined) updatePayload['triggerType'] = data.triggerType;
  if (data.anchorMode !== undefined) updatePayload['anchorMode'] = data.anchorMode;
  if (data.intervalDays !== undefined) updatePayload['intervalDays'] = data.intervalDays;
  if (data.meterId !== undefined) updatePayload['meterId'] = data.meterId;
  if (data.intervalMeter !== undefined) updatePayload['intervalMeter'] = data.intervalMeter;
  if (data.leadDays !== undefined) updatePayload['leadDays'] = data.leadDays;
  if (data.priority !== undefined) updatePayload['priority'] = data.priority;
  if (data.defaultAssigneeId !== undefined) updatePayload['defaultAssigneeId'] = data.defaultAssigneeId;
  if (data.reminderOffsetsMin !== undefined) updatePayload['reminderOffsetsMin'] = data.reminderOffsetsMin;
  if (data.active !== undefined) updatePayload['active'] = data.active;

  if (data.firstDueAt !== undefined) {
    updatePayload['nextDueAt'] = data.firstDueAt;
  }

  const [updated] = await ctx.db
    .update(pmSchedules)
    .set(updatePayload)
    .where(eq(pmSchedules.id, id))
    .returning();

  if (!updated) {
    throw new Error('خطا در به‌روزرسانی برنامه نت');
  }

  await writeAuditLog(ctx, {
    plantId: updated.plantId,
    action: 'PM_SCHEDULE_UPDATED',
    entity: 'PmSchedule',
    entityId: updated.id,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function deletePmSchedule(
  ctx: ServiceContext,
  id: string,
): Promise<void> {
  const existing = await getPmScheduleById(ctx, id);
  if (!existing) {
    throw new Error('برنامه نت یافت نشد');
  }

  assertCan(ctx.ability, 'delete', 'PmSchedule', { plantId: existing.plantId });

  await ctx.db
    .update(pmSchedules)
    .set({ deletedAt: ctx.now(), active: false })
    .where(eq(pmSchedules.id, id));

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'PM_SCHEDULE_DELETED',
    entity: 'PmSchedule',
    entityId: existing.id,
    before: existing,
  });
}

export async function generateWorkOrderForSchedule(
  ctx: ServiceContext,
  scheduleId: string,
): Promise<{ createdId: string | null; dueAt: Date; reminderOffsetsMin: number[] }> {
  const schedule = await getPmScheduleById(ctx, scheduleId);
  if (!schedule) {
    throw new Error('برنامه نت یافت نشد');
  }

  assertCan(ctx.ability, 'update', 'PmSchedule', { plantId: schedule.plantId });

  const template = await getPmTemplateById(ctx, schedule.templateId);
  if (!template) {
    throw new Error('قالب چک‌لیست مرتبط یافت نشد');
  }

  const now = ctx.now();
  const meter = schedule.meterId ? await getMeterState(ctx.db, schedule.meterId) : null;
  const due = schedule.nextDueAt ?? computeNextDue(schedule, { now, meter }) ?? now;

  const [inserted] = await ctx.db
    .insert(workOrders)
    .values({
      plantId: schedule.plantId,
      type: 'PM',
      status: schedule.defaultAssigneeId ? 'ASSIGNED' : 'OPEN',
      priority: schedule.priority,
      assetId: schedule.assetId,
      pmScheduleId: schedule.id,
      title: template.name,
      description: template.description,
      dueAt: due,
      assigneeId: schedule.defaultAssigneeId,
      checklistSnapshot: template.checklist as ChecklistItemDefinition[],
    })
    .onConflictDoNothing({ target: [workOrders.pmScheduleId, workOrders.dueAt] })
    .returning({ id: workOrders.id });

  if (inserted) {
    await writeAuditLog(ctx, {
      plantId: schedule.plantId,
      action: 'WO_AUTO_CREATED',
      entity: 'WorkOrder',
      entityId: inserted.id,
    });

    const nextCycle = advanceNextDueOnCompletion(schedule, {
      completedAt: due,
      meter,
    });

    if (nextCycle.nextDueAt) {
      await ctx.db
        .update(pmSchedules)
        .set({
          nextDueAt: nextCycle.nextDueAt,
          updatedAt: now,
        })
        .where(eq(pmSchedules.id, schedule.id));
    }
  }

  return {
    createdId: inserted?.id ?? null,
    dueAt: due,
    reminderOffsetsMin: schedule.reminderOffsetsMin,
  };
}

