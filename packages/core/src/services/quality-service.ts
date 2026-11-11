import { and, desc, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm';
import {
  assets,
  downtimeLogs,
  failureCodes,
  parts,
  pmSchedules,
  pmTemplates,
  users,
  workOrderPartUsages,
  workOrders,
  type ChecklistResultEntry,
  type DbClient,
  type FailureCode,
  type FailureIndustryType,
  type WorkOrder,
} from '@cmms/db';
import { accessibleWhere, assertCan } from '../auth/index';
import type { ServiceContext } from '../context';
import { calculateDowntimeFinancialImpact } from '../financial-downtime';
import {
  calculateParetoAnalysis,
  calculateTechnicianFTFR,
  detectPencilWhipping,
  type FtfrResult,
  type ParetoAnalysis,
  type ParetoFailureInput,
  type PencilWhippingResult,
  type TechnicianFtfrStat,
} from '../quality-and-pareto';
import { writeAuditLog } from './audit-service';

export interface FailureCodeSelection {
  symptomCodeId?: string | null;
  componentCodeId?: string | null;
  rootCauseCodeId?: string | null;
}

/** دستورکارهای اضطراری/اصلاحی (CM) باید ۳ لایه کدگذاری علت خرابی را داشته باشند */
export function requiresFailureCoding(workOrderType: string): boolean {
  return workOrderType === 'CM';
}

export async function listFailureCodes(
  ctx: ServiceContext,
  industry?: FailureIndustryType,
): Promise<FailureCode[]> {
  assertCan(ctx.ability, 'read', 'WorkOrder');
  const rows = await ctx.db.select().from(failureCodes).orderBy(failureCodes.code);
  return industry
    ? rows.filter((r) => r.industryType === industry || r.industryType === 'GENERAL')
    : rows;
}

/**
 * اعتبارسنجی کدهای ۳ لایه: وجود هر سه (در صورت الزام) و تطابق دسته‌بندی هر کد.
 */
export async function assertValidFailureCodes(
  db: DbClient,
  selection: FailureCodeSelection,
  required: boolean,
): Promise<void> {
  const { symptomCodeId, componentCodeId, rootCauseCodeId } = selection;

  if (required && (!symptomCodeId || !componentCodeId || !rootCauseCodeId)) {
    throw new Error(
      'FAILURE_CODES_REQUIRED: برای بستن دستورکار اضطراری/اصلاحی انتخاب نشانه خرابی، قطعه معیوب و علت ریشه‌ای الزامی است.',
    );
  }

  const checks: Array<[string | null | undefined, FailureCode['category'], string]> = [
    [symptomCodeId, 'SYMPTOM', 'نشانه ظاهری'],
    [componentCodeId, 'COMPONENT', 'قطعه معیوب'],
    [rootCauseCodeId, 'ROOT_CAUSE', 'علت ریشه‌ای'],
  ];
  const ids = checks.map((c) => c[0]).filter((v): v is string => Boolean(v));
  if (ids.length === 0) return;

  const rows = await db.select().from(failureCodes).where(inArray(failureCodes.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const [id, category, label] of checks) {
    if (!id) continue;
    const row = byId.get(id);
    if (!row || row.category !== category) {
      throw new Error(`کد انتخاب‌شده برای «${label}» نامعتبر است.`);
    }
  }
}

function extractNumericAnswers(
  snapshotItems: Array<{ id: string; type: string }>,
  results: ChecklistResultEntry[],
): Record<string, number> {
  const numericIds = new Set(snapshotItems.filter((i) => i.type === 'NUMBER').map((i) => i.id));
  const out: Record<string, number> = {};
  for (const r of results) {
    if (numericIds.has(r.itemId) && typeof r.value === 'number' && Number.isFinite(r.value)) {
      out[r.itemId] = r.value;
    }
  }
  return out;
}

/**
 * هنگام بستن دستورکار: تشخیص پر کردن صوری چک‌لیست (Pencil-Whipping).
 */
export async function evaluatePencilWhippingForCompletion(
  ctx: ServiceContext,
  existing: Pick<
    WorkOrder,
    'id' | 'assetId' | 'pmScheduleId' | 'startedAt' | 'checklistSnapshot'
  >,
  finalChecklist: ChecklistResultEntry[],
  completedAt: Date,
): Promise<PencilWhippingResult> {
  let estimatedMinutes: number | null = null;
  if (existing.pmScheduleId) {
    const [tpl] = await ctx.db
      .select({ estimatedMinutes: pmTemplates.estimatedMinutes })
      .from(pmSchedules)
      .innerJoin(pmTemplates, eq(pmSchedules.templateId, pmTemplates.id))
      .where(eq(pmSchedules.id, existing.pmScheduleId))
      .limit(1);
    estimatedMinutes = tpl?.estimatedMinutes ?? null;
  }

  const numericAnswers = extractNumericAnswers(existing.checklistSnapshot, finalChecklist);

  let previousNumericAnswers: Array<Record<string, number>> = [];
  if (Object.keys(numericAnswers).length > 0) {
    const scope = existing.pmScheduleId
      ? eq(workOrders.pmScheduleId, existing.pmScheduleId)
      : eq(workOrders.assetId, existing.assetId);
    const previous = await ctx.db
      .select({
        checklistSnapshot: workOrders.checklistSnapshot,
        checklistResult: workOrders.checklistResult,
      })
      .from(workOrders)
      .where(
        and(scope, eq(workOrders.status, 'DONE'), ne(workOrders.id, existing.id), isNull(workOrders.deletedAt)),
      )
      .orderBy(desc(workOrders.completedAt))
      .limit(3);
    previousNumericAnswers = previous.map((p) =>
      extractNumericAnswers(p.checklistSnapshot, p.checklistResult),
    );
  }

  return detectPencilWhipping({
    startedAt: existing.startedAt,
    completedAt,
    estimatedMinutes,
    numericAnswers,
    previousNumericAnswers,
  });
}

/**
 * پس از بستن یک دستورکار اضطراری با کد قطعه: اگر ظرف ۷۲ ساعت پس از اتمام دستورکار قبلیِ
 * همان تجهیز و همان قطعه ثبت شده باشد، دستورکار قبلی «تعمیر ناموفق بار اول» (isRework) می‌شود.
 * عملیات idempotent است.
 */
export async function flagReworkForCompletedWorkOrder(
  ctx: ServiceContext,
  completed: Pick<WorkOrder, 'id' | 'plantId' | 'assetId' | 'type' | 'componentCodeId' | 'createdAt'>,
): Promise<string[]> {
  if (completed.type !== 'CM' || !completed.componentCodeId) return [];

  const windowStart = new Date(completed.createdAt.getTime() - 72 * 3_600_000);
  const candidates = await ctx.db
    .select()
    .from(workOrders)
    .where(
      and(
        eq(workOrders.assetId, completed.assetId),
        eq(workOrders.componentCodeId, completed.componentCodeId),
        eq(workOrders.status, 'DONE'),
        eq(workOrders.isRework, false),
        ne(workOrders.id, completed.id),
        isNull(workOrders.deletedAt),
        gte(workOrders.completedAt, windowStart),
        lte(workOrders.completedAt, completed.createdAt),
      ),
    );

  const flagged: string[] = [];
  for (const prev of candidates) {
    await ctx.db
      .update(workOrders)
      .set({ isRework: true, updatedAt: ctx.now() })
      .where(eq(workOrders.id, prev.id));
    await writeAuditLog(ctx, {
      plantId: prev.plantId,
      action: 'WO_REWORK_FLAGGED',
      entity: 'WorkOrder',
      entityId: prev.id,
      before: { isRework: false },
      after: { isRework: true, triggeredByWorkOrderId: completed.id },
      reason: 'تکرار خرابی همان قطعه روی همان تجهیز کمتر از ۷۲ ساعت پس از تعمیر',
    });
    flagged.push(prev.id);
  }
  return flagged;
}

// ============================================================================
// Reports
// ============================================================================

export interface QualityReportParams {
  plantId?: string;
  from?: Date;
  to?: Date;
}

function resolveRange(ctx: ServiceContext, params?: QualityReportParams) {
  const to = params?.to ?? ctx.now();
  const from = params?.from ?? new Date(to.getTime() - 90 * 24 * 3600 * 1000);
  return { from, to, plantId: params?.plantId ?? ctx.user.plantIds[0] };
}

export async function getParetoReport(
  ctx: ServiceContext,
  params?: QualityReportParams,
): Promise<ParetoAnalysis> {
  assertCan(ctx.ability, 'read', 'WorkOrder');
  const { from, to, plantId } = resolveRange(ctx, params);

  const conditions = [
    isNull(workOrders.deletedAt),
    gte(workOrders.createdAt, from),
    lte(workOrders.createdAt, to),
    accessibleWhere(ctx.ability, 'read', 'WorkOrder', workOrders),
  ];
  if (plantId) conditions.push(eq(workOrders.plantId, plantId));

  const rows = await ctx.db
    .select({
      id: workOrders.id,
      type: workOrders.type,
      startedAt: workOrders.startedAt,
      completedAt: workOrders.completedAt,
      laborHourlyRateRials: workOrders.laborHourlyRateRials,
      componentCodeId: workOrders.componentCodeId,
      rootCauseCodeId: workOrders.rootCauseCodeId,
      assetId: workOrders.assetId,
      topologyType: assets.topologyType,
      bufferCapacityMinutes: assets.bufferCapacityMinutes,
      capacityImpactPercent: assets.capacityImpactPercent,
      hourlyLostMarginRials: assets.hourlyLostMarginRials,
      coldStartupThresholdMinutes: assets.coldStartupThresholdMinutes,
      restartEnergyAndSetupCostRials: assets.restartEnergyAndSetupCostRials,
      inLineScrapCostRials: assets.inLineScrapCostRials,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .where(and(...conditions));

  const coded = rows.filter((r) => r.componentCodeId || r.rootCauseCodeId);
  const woIds = coded.map((r) => r.id);

  const downtimeByWo = new Map<string, { minutes: number; hasUnplanned: boolean }>();
  const spareCostByWo = new Map<string, number>();

  if (woIds.length > 0) {
    const dts = await ctx.db
      .select()
      .from(downtimeLogs)
      .where(inArray(downtimeLogs.workOrderId, woIds));
    for (const d of dts) {
      if (!d.workOrderId) continue;
      const mins = Math.max(
        0,
        Math.round(((d.endedAt ?? to).getTime() - d.startedAt.getTime()) / 60_000),
      );
      const cur = downtimeByWo.get(d.workOrderId) ?? { minutes: 0, hasUnplanned: false };
      cur.minutes += mins;
      cur.hasUnplanned = cur.hasUnplanned || !d.isPlanned;
      downtimeByWo.set(d.workOrderId, cur);
    }

    const usages = await ctx.db
      .select({
        workOrderId: workOrderPartUsages.workOrderId,
        quantityUsed: workOrderPartUsages.quantityUsed,
        unitPriceRials: parts.unitPriceRials,
      })
      .from(workOrderPartUsages)
      .innerJoin(parts, eq(workOrderPartUsages.partId, parts.id))
      .where(inArray(workOrderPartUsages.workOrderId, woIds));
    for (const u of usages) {
      spareCostByWo.set(
        u.workOrderId,
        (spareCostByWo.get(u.workOrderId) ?? 0) + Math.round(u.quantityUsed * (u.unitPriceRials ?? 0)),
      );
    }
  }

  const failures: ParetoFailureInput[] = coded.map((r) => {
    const dt = downtimeByWo.get(r.id) ?? { minutes: 0, hasUnplanned: r.type === 'CM' };
    const laborHours =
      r.startedAt && r.completedAt
        ? Math.max(0.5, (r.completedAt.getTime() - r.startedAt.getTime()) / 3_600_000)
        : dt.minutes > 0
          ? dt.minutes / 60
          : 1;
    const impact = calculateDowntimeFinancialImpact({
      asset: {
        topologyType: r.topologyType,
        bufferCapacityMinutes: r.bufferCapacityMinutes,
        capacityImpactPercent: r.capacityImpactPercent,
        hourlyLostMarginRials: r.hourlyLostMarginRials,
        coldStartupThresholdMinutes: r.coldStartupThresholdMinutes,
        restartEnergyAndSetupCostRials: r.restartEnergyAndSetupCostRials,
        inLineScrapCostRials: r.inLineScrapCostRials,
      },
      durationMinutes: dt.minutes,
      stoppageType: dt.hasUnplanned ? 'UNPLANNED' : 'PLANNED',
      sparePartsCostRials: spareCostByWo.get(r.id) ?? 0,
      technicianLaborHours: laborHours,
      laborHourlyRateRials: r.laborHourlyRateRials,
    });
    return {
      componentCodeId: r.componentCodeId,
      rootCauseCodeId: r.rootCauseCodeId,
      downtimeMinutes: dt.minutes,
      lossRials: impact.totalLossRials,
    };
  });

  const codes = await ctx.db.select().from(failureCodes);
  const labels = {
    components: Object.fromEntries(codes.filter((c) => c.category === 'COMPONENT').map((c) => [c.id, c.titleFa])),
    rootCauses: Object.fromEntries(codes.filter((c) => c.category === 'ROOT_CAUSE').map((c) => [c.id, c.titleFa])),
  };

  return calculateParetoAnalysis(failures, labels, 'PAIR');
}

export interface SuspiciousInspectionRow {
  workOrderId: string;
  title: string;
  assetName: string;
  assetCode: string;
  technicianName: string | null;
  completedAt: Date | null;
  reasonFa: string;
}

export interface QualityScorecard {
  technicians: TechnicianFtfrStat[];
  reworkWorkOrderIds: string[];
  suspiciousInspections: SuspiciousInspectionRow[];
  overallFtfrPercent: number;
}

export async function getQualityScorecard(
  ctx: ServiceContext,
  params?: QualityReportParams,
): Promise<QualityScorecard> {
  assertCan(ctx.ability, 'export', 'Report');
  const { from, to, plantId } = resolveRange(ctx, params);

  const conditions = [
    isNull(workOrders.deletedAt),
    gte(workOrders.createdAt, new Date(from.getTime() - 72 * 3_600_000)),
    lte(workOrders.createdAt, to),
    accessibleWhere(ctx.ability, 'read', 'WorkOrder', workOrders),
  ];
  if (plantId) conditions.push(eq(workOrders.plantId, plantId));

  const rows = await ctx.db
    .select({
      order: workOrders,
      assetName: assets.name,
      assetCode: assets.code,
      assigneeName: users.fullName,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(and(...conditions));

  const ftfr: FtfrResult = calculateTechnicianFTFR(
    rows.map((r) => ({
      id: r.order.id,
      assetId: r.order.assetId,
      componentCodeId: r.order.componentCodeId,
      assigneeId: r.order.assigneeId,
      assigneeName: r.assigneeName,
      type: r.order.type,
      status: r.order.status,
      createdAt: r.order.createdAt,
      completedAt: r.order.completedAt,
    })),
  );

  const suspicious = rows
    .filter(
      (r) =>
        r.order.isSuspiciousInspection &&
        (r.order.completedAt ?? r.order.createdAt) >= from,
    )
    .sort(
      (a, b) =>
        (b.order.completedAt ?? b.order.createdAt).getTime() -
        (a.order.completedAt ?? a.order.createdAt).getTime(),
    )
    .map<SuspiciousInspectionRow>((r) => ({
      workOrderId: r.order.id,
      title: r.order.title,
      assetName: r.assetName,
      assetCode: r.assetCode,
      technicianName: r.assigneeName,
      completedAt: r.order.completedAt,
      reasonFa: r.order.suspicionReasonFa ?? 'مشکوک به تیک‌زدن صوری',
    }));

  const totalRepairs = ftfr.technicians.reduce((s, t) => s + t.totalCompletedRepairs, 0);
  const totalFirstTime = ftfr.technicians.reduce((s, t) => s + t.firstTimeFixCount, 0);

  return {
    technicians: ftfr.technicians,
    reworkWorkOrderIds: ftfr.reworkWorkOrderIds,
    suspiciousInspections: suspicious,
    overallFtfrPercent:
      totalRepairs > 0 ? Math.round((totalFirstTime / totalRepairs) * 1000) / 10 : 100,
  };
}
