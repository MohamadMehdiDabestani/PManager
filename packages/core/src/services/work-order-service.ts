import { z } from 'zod';
import { and, eq, isNull, inArray, lt, desc } from 'drizzle-orm';
import {
  workOrders,
  assets,
  users,
  pmSchedules,
  pmTemplates,
  parts,
  workOrderPartUsages,
  downtimeLogs,
  type WorkOrder,
  type WorkOrderStatus,
  type ChecklistResultEntry,
  type LotoStepDefinition,
  type DowntimeLog,
} from '@cmms/db';
import { assertCan, accessibleWhere } from '../auth/index';
import type { ServiceContext } from '../context';
import { writeAuditLog } from './audit-service';
import { advanceNextDueOnCompletion } from '../domain/pm-schedule';
import { getMeterState } from './pm-schedule-service';

export type WorkOrderWithDetails = WorkOrder & {
  assetName: string;
  assetCode: string;
  requiresLoto: boolean;
  lotoProcedure: LotoStepDefinition[];
  assigneeName?: string | null;
  requiredPpe: string[];
  partUsages: Array<{
    id: string;
    partId: string;
    partCode: string;
    partName: string;
    unit: string;
    quantityUsed: number;
    createdAt: Date;
  }>;
  downtimes: DowntimeLog[];
};

export const verifyLotoSchema = z.object({
  workOrderId: z.string().uuid(),
  lotoLockId: z.string().min(2, 'وارد کردن شماره قفل فیزیکی LOTO الزامی است'),
});

export const checklistResultEntrySchema = z.object({
  itemId: z.string().min(1),
  value: z.union([z.boolean(), z.number(), z.string(), z.null()]),
  note: z.string().optional(),
  photoUrl: z.string().optional(),
  completedAt: z.string().optional(),
});

export const saveWorkOrderProgressSchema = z.object({
  workOrderId: z.string().uuid(),
  checklistResult: z.array(checklistResultEntrySchema),
  note: z.string().optional(),
});

export const recordPartUsageSchema = z.object({
  workOrderId: z.string().uuid(),
  partId: z.string().uuid(),
  quantityUsed: z.number().positive('تعداد مصرفی باید بزرگ‌تر از صفر باشد'),
  clientId: z.string().min(4).max(64).optional(),
});

export const recordDowntimeSchema = z.object({
  workOrderId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid(),
  durationMinutes: z.number().int().positive('مدت توقف باید عددی مثبت باشد'),
  reason: z.string().min(2, 'علت توقف الزامی است'),
  isPlanned: z.boolean().default(false),
});

export const completeWorkOrderSchema = z.object({
  workOrderId: z.string().uuid(),
  checklistResult: z.array(checklistResultEntrySchema),
  completionNote: z.string().optional(),
  completionMeterReading: z.number().nonnegative().optional(),
  clientId: z.string().max(64).optional(),
});

export async function listWorkOrders(
  ctx: ServiceContext,
  params?: {
    plantId?: string;
    status?: WorkOrderStatus;
    assigneeId?: string;
    assetId?: string;
  },
): Promise<
  Array<
    WorkOrder & {
      assetName: string;
      assetCode: string;
      requiresLoto: boolean;
      assigneeName?: string | null;
    }
  >
> {
  assertCan(ctx.ability, 'read', 'WorkOrder');
  const scopeCondition = accessibleWhere(ctx.ability, 'read', 'WorkOrder', workOrders);

  const conditions = [isNull(workOrders.deletedAt)];
  if (scopeCondition) conditions.push(scopeCondition);
  if (params?.plantId) conditions.push(eq(workOrders.plantId, params.plantId));
  if (params?.status) conditions.push(eq(workOrders.status, params.status));
  if (params?.assigneeId) conditions.push(eq(workOrders.assigneeId, params.assigneeId));
  if (params?.assetId) conditions.push(eq(workOrders.assetId, params.assetId));

  const rows = await ctx.db
    .select({
      order: workOrders,
      assetName: assets.name,
      assetCode: assets.code,
      requiresLoto: assets.requiresLoto,
      assigneeName: users.fullName,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(and(...conditions))
    .orderBy(desc(workOrders.dueAt));

  return rows.map((r) => ({
    ...r.order,
    assetName: r.assetName,
    assetCode: r.assetCode,
    requiresLoto: r.requiresLoto,
    assigneeName: r.assigneeName,
  }));
}

export async function getWorkOrderById(
  ctx: ServiceContext,
  id: string,
): Promise<WorkOrderWithDetails | null> {
  assertCan(ctx.ability, 'read', 'WorkOrder');
  const scopeCondition = accessibleWhere(ctx.ability, 'read', 'WorkOrder', workOrders);

  const conditions = [eq(workOrders.id, id), isNull(workOrders.deletedAt)];
  if (scopeCondition) conditions.push(scopeCondition);

  const [row] = await ctx.db
    .select({
      order: workOrders,
      assetName: assets.name,
      assetCode: assets.code,
      requiresLoto: assets.requiresLoto,
      lotoProcedure: assets.lotoProcedure,
      assigneeName: users.fullName,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(and(...conditions))
    .limit(1);

  if (!row) return null;

  let requiredPpe: string[] = [];
  if (row.order.pmScheduleId) {
    const [sched] = await ctx.db
      .select({ templateId: pmSchedules.templateId })
      .from(pmSchedules)
      .where(eq(pmSchedules.id, row.order.pmScheduleId))
      .limit(1);
    if (sched) {
      const [tpl] = await ctx.db
        .select({ requiredPpe: pmTemplates.requiredPpe })
        .from(pmTemplates)
        .where(eq(pmTemplates.id, sched.templateId))
        .limit(1);
      if (tpl) requiredPpe = tpl.requiredPpe;
    }
  }

  const usageRows = await ctx.db
    .select({
      id: workOrderPartUsages.id,
      partId: workOrderPartUsages.partId,
      partCode: parts.code,
      partName: parts.name,
      unit: parts.unit,
      quantityUsed: workOrderPartUsages.quantityUsed,
      createdAt: workOrderPartUsages.createdAt,
    })
    .from(workOrderPartUsages)
    .innerJoin(parts, eq(workOrderPartUsages.partId, parts.id))
    .where(eq(workOrderPartUsages.workOrderId, id))
    .orderBy(desc(workOrderPartUsages.createdAt));

  const downtimes = await ctx.db
    .select()
    .from(downtimeLogs)
    .where(eq(downtimeLogs.workOrderId, id))
    .orderBy(desc(downtimeLogs.startedAt));

  return {
    ...row.order,
    assetName: row.assetName,
    assetCode: row.assetCode,
    requiresLoto: row.requiresLoto,
    lotoProcedure: row.lotoProcedure,
    assigneeName: row.assigneeName,
    requiredPpe,
    partUsages: usageRows,
    downtimes,
  };
}

/**
 * Verifies LOTO energy isolation and records physical lock ID before work can start.
 */
export async function verifyLotoForWorkOrder(
  ctx: ServiceContext,
  rawInput: z.infer<typeof verifyLotoSchema>,
): Promise<WorkOrder> {
  const input = verifyLotoSchema.parse(rawInput);
  const existing = await getWorkOrderById(ctx, input.workOrderId);
  if (!existing) {
    throw new Error('دستورکار یافت نشد');
  }

  assertCan(ctx.ability, 'execute', 'WorkOrder', existing as unknown as Record<string, unknown>);

  const actorUserId = ctx.user.id === 'SYSTEM' ? null : ctx.user.id;
  const now = ctx.now();

  const [updated] = await ctx.db
    .update(workOrders)
    .set({
      lotoVerified: true,
      lotoLockId: input.lotoLockId.trim().toUpperCase(),
      lotoVerifiedById: actorUserId,
      acknowledgedAt: existing.acknowledgedAt ?? now,
      updatedAt: now,
    })
    .where(eq(workOrders.id, existing.id))
    .returning();

  if (!updated) {
    throw new Error('خطا در ثبت تاییدیه LOTO');
  }

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'WO_LOTO_VERIFIED',
    entity: 'WorkOrder',
    entityId: existing.id,
    before: { lotoVerified: existing.lotoVerified, lotoLockId: existing.lotoLockId },
    after: { lotoVerified: true, lotoLockId: updated.lotoLockId },
  });

  return updated;
}

/**
 * Starts execution of a work order.
 * SAFETY INVARIANT: Cannot start if the asset requires LOTO and LOTO has not been verified.
 */
export async function startWorkOrder(
  ctx: ServiceContext,
  workOrderId: string,
): Promise<WorkOrder> {
  const existing = await getWorkOrderById(ctx, workOrderId);
  if (!existing) {
    throw new Error('دستورکار یافت نشد');
  }

  assertCan(ctx.ability, 'execute', 'WorkOrder', existing as unknown as Record<string, unknown>);

  if (existing.status === 'DONE') {
    return existing;
  }

  if (existing.requiresLoto && !existing.lotoVerified) {
    throw new Error(
      'LOTO_REQUIRED: این دستگاه نیازمند ایزولاسیون انرژی (LOTO) است. ابتدا مراحل قفل ایمنی و شماره قفل فیزیکی را ثبت و تایید نمایید.',
    );
  }

  const now = ctx.now();
  const [updated] = await ctx.db
    .update(workOrders)
    .set({
      status: 'IN_PROGRESS',
      acknowledgedAt: existing.acknowledgedAt ?? now,
      startedAt: existing.startedAt ?? now,
      updatedAt: now,
    })
    .where(eq(workOrders.id, existing.id))
    .returning();

  if (!updated) {
    throw new Error('خطا در شروع دستورکار');
  }

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'WO_STARTED',
    entity: 'WorkOrder',
    entityId: existing.id,
    before: { status: existing.status },
    after: { status: updated.status, startedAt: updated.startedAt },
  });

  return updated;
}

/**
 * Saves checklist items progress and notes (supports offline partial merges by itemId).
 */
export async function saveWorkOrderProgress(
  ctx: ServiceContext,
  rawInput: z.infer<typeof saveWorkOrderProgressSchema>,
): Promise<WorkOrder> {
  const input = saveWorkOrderProgressSchema.parse(rawInput);
  const existing = await getWorkOrderById(ctx, input.workOrderId);
  if (!existing) {
    throw new Error('دستورکار یافت نشد');
  }

  assertCan(ctx.ability, 'execute', 'WorkOrder', existing as unknown as Record<string, unknown>);

  // Merge checklist items by itemId (last-writer-wins per item)
  const mergedMap = new Map<string, ChecklistResultEntry>();
  for (const entry of existing.checklistResult) {
    mergedMap.set(entry.itemId, entry);
  }
  for (const entry of input.checklistResult) {
    mergedMap.set(entry.itemId, {
      ...entry,
      completedAt: entry.completedAt ?? ctx.now().toISOString(),
    });
  }

  const mergedChecklist = Array.from(mergedMap.values());
  const nextDescription =
    input.note !== undefined && input.note.trim().length > 0
      ? input.note.trim()
      : existing.description;

  const [updated] = await ctx.db
    .update(workOrders)
    .set({
      checklistResult: mergedChecklist,
      description: nextDescription,
      updatedAt: ctx.now(),
    })
    .where(eq(workOrders.id, existing.id))
    .returning();

  if (!updated) {
    throw new Error('خطا در ذخیره چک‌لیست دستورکار');
  }

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'WO_PROGRESS_SAVED',
    entity: 'WorkOrder',
    entityId: existing.id,
    after: { answeredCount: mergedChecklist.length },
  });

  return updated;
}

/**
 * Records spare part usage on a work order and deducts from inventory idempotently via clientId.
 */
export async function recordWorkOrderPartUsage(
  ctx: ServiceContext,
  rawInput: z.infer<typeof recordPartUsageSchema>,
) {
  const input = recordPartUsageSchema.parse(rawInput);
  const existingWo = await getWorkOrderById(ctx, input.workOrderId);
  if (!existingWo) {
    throw new Error('دستورکار یافت نشد');
  }

  assertCan(ctx.ability, 'create', 'PartUsage');

  const actorUserId = ctx.user.id === 'SYSTEM' ? null : ctx.user.id;
  const clientId = input.clientId ?? `part-${input.workOrderId}-${input.partId}-${Date.now()}`;

  return ctx.db.transaction(async (tx) => {
    const [insertedUsage] = await tx
      .insert(workOrderPartUsages)
      .values({
        workOrderId: input.workOrderId,
        partId: input.partId,
        quantityUsed: input.quantityUsed,
        recordedById: actorUserId,
        clientId,
      })
      .onConflictDoNothing({ target: [workOrderPartUsages.clientId] })
      .returning();

    // Only deduct inventory if this clientId was not processed before
    if (insertedUsage) {
      const [part] = await tx
        .select()
        .from(parts)
        .where(eq(parts.id, input.partId))
        .limit(1);

      if (part) {
        const nextQty = Math.max(0, part.quantityOnHand - input.quantityUsed);
        await tx
          .update(parts)
          .set({
            quantityOnHand: nextQty,
            updatedAt: ctx.now(),
          })
          .where(eq(parts.id, part.id));
      }

      await writeAuditLog(ctx, {
        plantId: existingWo.plantId,
        action: 'WO_PART_USED',
        entity: 'WorkOrder',
        entityId: existingWo.id,
        after: {
          partId: input.partId,
          quantityUsed: input.quantityUsed,
          clientId,
        },
      });
    }

    return insertedUsage;
  });
}

/**
 * Records machine downtime associated with a work order or asset.
 */
export async function recordDowntimeLog(
  ctx: ServiceContext,
  rawInput: z.infer<typeof recordDowntimeSchema>,
): Promise<DowntimeLog> {
  const input = recordDowntimeSchema.parse(rawInput);
  const [asset] = await ctx.db
    .select()
    .from(assets)
    .where(eq(assets.id, input.assetId))
    .limit(1);

  if (!asset) {
    throw new Error('تجهیز یافت نشد');
  }

  assertCan(ctx.ability, 'read', 'Asset', { plantId: asset.plantId });

  const endedAt = ctx.now();
  const startedAt = new Date(endedAt.getTime() - input.durationMinutes * 60_000);

  const [created] = await ctx.db
    .insert(downtimeLogs)
    .values({
      plantId: asset.plantId,
      assetId: asset.id,
      workOrderId: input.workOrderId ?? null,
      startedAt,
      endedAt,
      reason: input.reason.trim(),
      isPlanned: input.isPlanned,
    })
    .returning();

  if (!created) {
    throw new Error('خطا در ثبت توقف دستگاه');
  }

  await writeAuditLog(ctx, {
    plantId: asset.plantId,
    action: 'DOWNTIME_LOGGED',
    entity: 'Asset',
    entityId: asset.id,
    after: {
      workOrderId: input.workOrderId,
      durationMinutes: input.durationMinutes,
      reason: input.reason,
      isPlanned: input.isPlanned,
    },
  });

  return created;
}

/**
 * Completes and locks a work order.
 * Enforces LOTO gate and mandatory checklist items, then advances PM schedule cycle.
 */
export async function completeWorkOrder(
  ctx: ServiceContext,
  rawInput: z.infer<typeof completeWorkOrderSchema>,
): Promise<WorkOrder> {
  const input = completeWorkOrderSchema.parse(rawInput);
  const existing = await getWorkOrderById(ctx, input.workOrderId);
  if (!existing) {
    throw new Error('دستورکار یافت نشد');
  }

  assertCan(ctx.ability, 'signoff', 'WorkOrder', existing as unknown as Record<string, unknown>);

  // Idempotent return if already completed
  if (existing.status === 'DONE') {
    return existing;
  }

  if (existing.requiresLoto && !existing.lotoVerified) {
    throw new Error(
      'LOTO_REQUIRED: تکمیل دستورکار بدون تایید ایزولاسیون انرژی (LOTO) مجاز نیست.',
    );
  }

  // Merge provided checklist results with existing
  const mergedMap = new Map<string, ChecklistResultEntry>();
  for (const entry of existing.checklistResult) {
    mergedMap.set(entry.itemId, entry);
  }
  for (const entry of input.checklistResult) {
    mergedMap.set(entry.itemId, {
      ...entry,
      completedAt: entry.completedAt ?? ctx.now().toISOString(),
    });
  }

  // Check required checklist items
  for (const item of existing.checklistSnapshot) {
    if (item.required) {
      const ans = mergedMap.get(item.id);
      if (!ans || ans.value === null || ans.value === undefined || ans.value === '') {
        throw new Error(`تکمیل گام الزامی چک‌لیست «${item.label}» اجباری است.`);
      }
    }
  }

  const finalChecklist = Array.from(mergedMap.values());
  const now = ctx.now();

  const [completed] = await ctx.db
    .update(workOrders)
    .set({
      status: 'DONE',
      startedAt: existing.startedAt ?? now,
      completedAt: now,
      checklistResult: finalChecklist,
      description: input.completionNote?.trim() || existing.description,
      updatedAt: now,
    })
    .where(eq(workOrders.id, existing.id))
    .returning();

  if (!completed) {
    throw new Error('خطا در ثبت تکمیل دستورکار');
  }

  // If linked to a PM schedule, update lastDoneAt / lastDoneMeter and recompute nextDueAt
  if (existing.pmScheduleId) {
    const [sched] = await ctx.db
      .select()
      .from(pmSchedules)
      .where(eq(pmSchedules.id, existing.pmScheduleId))
      .limit(1);

    if (sched) {
      const meter = sched.meterId ? await getMeterState(ctx.db, sched.meterId) : null;
      const nextCycle = advanceNextDueOnCompletion(sched, {
        completedAt: now,
        completedMeter: input.completionMeterReading ?? meter?.currentReading,
        meter,
      });

      await ctx.db
        .update(pmSchedules)
        .set({
          lastDoneAt: now,
          lastDoneMeter:
            input.completionMeterReading ?? meter?.currentReading ?? sched.lastDoneMeter,
          nextDueAt: nextCycle.nextDueAt ?? sched.nextDueAt,
          updatedAt: now,
        })
        .where(eq(pmSchedules.id, sched.id));
    }
  }

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'WO_COMPLETED',
    entity: 'WorkOrder',
    entityId: existing.id,
    before: { status: existing.status },
    after: {
      status: 'DONE',
      completedAt: now,
      lotoVerified: existing.lotoVerified,
      lotoLockId: existing.lotoLockId,
    },
  });

  return completed;
}

/**
 * Stop-Work Authority: Any user can flag an unsafe condition and place the work order ON_HOLD.
 */
export async function flagUnsafeWorkOrder(
  ctx: ServiceContext,
  workOrderId: string,
  reason: string,
): Promise<WorkOrder> {
  const existing = await getWorkOrderById(ctx, workOrderId);
  if (!existing) {
    throw new Error('دستورکار یافت نشد');
  }

  assertCan(ctx.ability, 'flagUnsafe', 'WorkOrder', { plantId: existing.plantId });

  const now = ctx.now();
  const [updated] = await ctx.db
    .update(workOrders)
    .set({
      status: 'ON_HOLD',
      description: `[توقف ایمنی - شرایط ناایمن]: ${reason.trim()}`,
      updatedAt: now,
    })
    .where(eq(workOrders.id, existing.id))
    .returning();

  if (!updated) {
    throw new Error('خطا در ثبت توقف ایمنی');
  }

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'WO_FLAGGED_UNSAFE',
    entity: 'WorkOrder',
    entityId: existing.id,
    before: { status: existing.status },
    after: { status: 'ON_HOLD' },
    reason: reason.trim(),
  });

  return updated;
}

/**
 * Finds work orders past their due date that are still OPEN or ASSIGNED.
 * Used by background worker overdue scanner.
 */
export async function findOverdueWorkOrders(
  ctx: ServiceContext,
  now = new Date(),
  plantId?: string,
) {
  const conditions = [
    isNull(workOrders.deletedAt),
    inArray(workOrders.status, ['OPEN', 'ASSIGNED']),
    lt(workOrders.dueAt, now),
  ];

  if (plantId) {
    conditions.push(eq(workOrders.plantId, plantId));
  }

  return ctx.db
    .select()
    .from(workOrders)
    .where(and(...conditions));
}
