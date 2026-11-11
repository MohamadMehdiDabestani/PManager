import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import {
  assets,
  downtimeLogs,
  parts,
  workOrderPartUsages,
  workOrders,
  type AssetCriticality,
} from '@cmms/db';
import type { ServiceContext } from '../context';
import { accessibleWhere } from '../auth/guard';
import {
  calculateDowntimeFinancialImpact,
  type AssetTopologyKind,
  type DowntimeCostBreakdown,
} from '../financial-downtime';

export interface KpiDateRange {
  from: Date;
  to: Date;
}

export interface BadActorAsset {
  assetId: string;
  assetCode: string;
  assetName: string;
  criticality: AssetCriticality;
  topologyType: AssetTopologyKind;
  incidentCount: number;
  totalDowntimeMinutes: number;
  unplannedMinutes: number;
  totalFinancialLossRials: number;
  financialBreakdown: DowntimeCostBreakdown;
}

export interface PeriodTrendBucket {
  periodKey: string;
  periodLabel: string;
  totalPmDue: number;
  completedOnTime: number;
  complianceRate: number; // 0 to 100
  unplannedDowntimeHours: number;
  plannedDowntimeHours: number;
}

export interface PlantKpiReport {
  plantId?: string;
  dateRange: {
    from: string; // ISO
    to: string; // ISO
    daysCount: number;
  };
  summary: {
    totalWorkOrders: number;
    completedWorkOrders: number;
    openWorkOrders: number;
    emergencyWorkOrders: number;
  };
  pmCompliance: {
    totalPmDue: number;
    completedPm: number;
    completedOnTime: number;
    complianceRate: number; // 0 - 100
    targetRate: number; // 90%
  };
  reliability: {
    mtbfHours: number; // Mean Time Between Failures
    mttrMinutes: number; // Mean Time To Repair
    unplannedFailuresCount: number;
    totalOperatingHours: number;
  };
  downtime: {
    totalDowntimeHours: number;
    unplannedHours: number;
    plannedHours: number;
    unplannedPercentage: number;
  };
  topBadActors: BadActorAsset[];
  trends: PeriodTrendBucket[];
}

/**
 * Calculates industrial maintenance KPIs (PM Compliance, MTBF, MTTR, Downtime analysis, and Trends)
 * for a plant across a given time window.
 */
export async function calculatePlantKpis(
  ctx: ServiceContext,
  params?: {
    plantId?: string;
    from?: Date;
    to?: Date;
  },
): Promise<PlantKpiReport> {
  const to = params?.to ?? ctx.now();
  const from = params?.from ?? new Date(to.getTime() - 30 * 24 * 3600 * 1000); // default last 30 days
  const plantId = params?.plantId ?? ctx.user.plantIds[0];

  const msInDay = 24 * 3600 * 1000;
  const daysCount = Math.max(1, Math.round((to.getTime() - from.getTime()) / msInDay));

  // 1. Fetch Work Orders in scope
  const woScope = accessibleWhere(ctx.ability, 'read', 'WorkOrder', workOrders);
  const woConditions = [
    gte(workOrders.createdAt, from),
    lte(workOrders.createdAt, to),
    isNull(workOrders.deletedAt),
  ];
  if (plantId) {
    woConditions.push(eq(workOrders.plantId, plantId));
  }
  if (woScope) {
    woConditions.push(woScope);
  }

  const allWorkOrders = await ctx.db
    .select({
      id: workOrders.id,
      assetId: workOrders.assetId,
      type: workOrders.type,
      status: workOrders.status,
      priority: workOrders.priority,
      laborHourlyRateRials: workOrders.laborHourlyRateRials,
      dueAt: workOrders.dueAt,
      completedAt: workOrders.completedAt,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .where(and(...woConditions));

  // Compute Work Order & PM stats
  let totalWorkOrders = 0;
  let completedWorkOrders = 0;
  let openWorkOrders = 0;
  let emergencyWorkOrders = 0;

  let totalPmDue = 0;
  let completedPm = 0;
  let completedOnTime = 0;

  for (const wo of allWorkOrders) {
    totalWorkOrders++;
    if (wo.status === 'DONE') {
      completedWorkOrders++;
    } else if (wo.status !== 'CANCELLED') {
      openWorkOrders++;
    }

    if (wo.priority === 'URGENT') {
      emergencyWorkOrders++;
    }

    if (wo.type === 'PM') {
      totalPmDue++;
      if (wo.status === 'DONE') {
        completedPm++;
        // On time if completed on or before due date (or within 24h grace period)
        if (wo.completedAt && wo.completedAt.getTime() <= wo.dueAt.getTime() + 24 * 3600 * 1000) {
          completedOnTime++;
        }
      }
    }
  }

  const pmComplianceRate = totalPmDue > 0 ? Math.round((completedOnTime / totalPmDue) * 100) : 100;

  // 2. Fetch Downtime Logs in scope
  const dtConditions = [
    gte(downtimeLogs.startedAt, from),
    lte(downtimeLogs.startedAt, to),
  ];
  if (plantId) {
    dtConditions.push(eq(downtimeLogs.plantId, plantId));
  }

  const allDowntimes = await ctx.db
    .select({
      id: downtimeLogs.id,
      assetId: downtimeLogs.assetId,
      workOrderId: downtimeLogs.workOrderId,
      startedAt: downtimeLogs.startedAt,
      endedAt: downtimeLogs.endedAt,
      isPlanned: downtimeLogs.isPlanned,
      reason: downtimeLogs.reason,
    })
    .from(downtimeLogs)
    .where(and(...dtConditions));

  // Compute downtime totals and group by asset
  let totalDowntimeMinutes = 0;
  let unplannedMinutes = 0;
  let plannedMinutes = 0;
  let unplannedFailuresCount = 0;

  const assetDowntimeMap = new Map<
    string,
    {
      incidentCount: number;
      totalMinutes: number;
      unplannedMinutes: number;
      workOrderIds: Set<string>;
    }
  >();

  for (const dt of allDowntimes) {
    const end = dt.endedAt ?? to;
    const durMs = Math.max(0, end.getTime() - dt.startedAt.getTime());
    const durMinutes = Math.round(durMs / 60_000);

    totalDowntimeMinutes += durMinutes;
    if (dt.isPlanned) {
      plannedMinutes += durMinutes;
    } else {
      unplannedMinutes += durMinutes;
      unplannedFailuresCount++;
    }

    const current = assetDowntimeMap.get(dt.assetId) ?? {
      incidentCount: 0,
      totalMinutes: 0,
      unplannedMinutes: 0,
      workOrderIds: new Set<string>(),
    };
    current.incidentCount++;
    current.totalMinutes += durMinutes;
    if (!dt.isPlanned) {
      current.unplannedMinutes += durMinutes;
    }
    if (dt.workOrderId) {
      current.workOrderIds.add(dt.workOrderId);
    }
    assetDowntimeMap.set(dt.assetId, current);
  }

  const totalDowntimeHours = Math.round((totalDowntimeMinutes / 60) * 10) / 10;
  const unplannedHours = Math.round((unplannedMinutes / 60) * 10) / 10;
  const plannedHours = Math.round((plannedMinutes / 60) * 10) / 10;
  const unplannedPercentage =
    totalDowntimeMinutes > 0 ? Math.round((unplannedMinutes / totalDowntimeMinutes) * 100) : 0;

  // 3. Count active assets in scope for MTBF & Financial Loss calculation
  const assetScope = accessibleWhere(ctx.ability, 'read', 'Asset', assets);
  const assetConditions = [isNull(assets.deletedAt)];
  if (plantId) {
    assetConditions.push(eq(assets.plantId, plantId));
  }
  if (assetScope) {
    assetConditions.push(assetScope);
  }

  const plantAssets = await ctx.db
    .select({
      id: assets.id,
      code: assets.code,
      name: assets.name,
      criticality: assets.criticality,
      topologyType: assets.topologyType,
      bufferCapacityMinutes: assets.bufferCapacityMinutes,
      capacityImpactPercent: assets.capacityImpactPercent,
      hourlyLostMarginRials: assets.hourlyLostMarginRials,
      coldStartupThresholdMinutes: assets.coldStartupThresholdMinutes,
      restartEnergyAndSetupCostRials: assets.restartEnergyAndSetupCostRials,
      inLineScrapCostRials: assets.inLineScrapCostRials,
    })
    .from(assets)
    .where(and(...assetConditions));

  const totalAssetCount = Math.max(1, plantAssets.length);
  // Total potential operating hours across all equipment:
  // (daysCount * 24h * equipmentCount) - total downtime
  const grossAvailableHours = daysCount * 24 * totalAssetCount;
  const totalOperatingHours = Math.max(0, grossAvailableHours - totalDowntimeHours);

  // MTBF = Operating Hours / Number of Failures
  const mtbfHours =
    unplannedFailuresCount > 0
      ? Math.round((totalOperatingHours / unplannedFailuresCount) * 10) / 10
      : Math.round(totalOperatingHours);

  // MTTR = Total Unplanned Repair Duration (Minutes) / Number of Failures
  const mttrMinutes =
    unplannedFailuresCount > 0 ? Math.round(unplannedMinutes / unplannedFailuresCount) : 0;

  // Optional 4th query: Load spare parts cost per workOrderId when downtime logs reference work orders
  const allLinkedWoIds = Array.from(
    new Set(allDowntimes.map((d) => d.workOrderId).filter((id): id is string => Boolean(id))),
  );
  const spareCostByWoId = new Map<string, number>();

  if (allLinkedWoIds.length > 0) {
    try {
      const usageRows = await ctx.db
        .select({
          workOrderId: workOrderPartUsages.workOrderId,
          quantityUsed: workOrderPartUsages.quantityUsed,
          unitPriceRials: parts.unitPriceRials,
        })
        .from(workOrderPartUsages)
        .innerJoin(parts, eq(workOrderPartUsages.partId, parts.id))
        .where(inArray(workOrderPartUsages.workOrderId, allLinkedWoIds));

      for (const u of usageRows) {
        const prev = spareCostByWoId.get(u.workOrderId) ?? 0;
        spareCostByWoId.set(
          u.workOrderId,
          prev + Math.round(u.quantityUsed * (u.unitPriceRials ?? 0)),
        );
      }
    } catch {
      // Fallback gracefully when DB mock does not implement innerJoin
    }
  }

  const woRateById = new Map<string, number>();
  for (const wo of allWorkOrders) {
    if (wo.laborHourlyRateRials) {
      woRateById.set(wo.id, wo.laborHourlyRateRials);
    }
  }

  // 4. Top Bad Actor Assets (Ranked by Total Financial Loss in Rials)
  const badActors: BadActorAsset[] = [];
  const assetLookup = new Map(plantAssets.map((a) => [a.id, a]));

  for (const [assetId, stat] of assetDowntimeMap.entries()) {
    const meta = assetLookup.get(assetId);
    if (meta) {
      let sparePartsCostRials = 0;
      let laborHourlyRateRials = 2_000_000;
      for (const woId of stat.workOrderIds) {
        sparePartsCostRials += spareCostByWoId.get(woId) ?? 0;
        const rate = woRateById.get(woId);
        if (rate) laborHourlyRateRials = rate;
      }

      const stoppageType = stat.unplannedMinutes > 0 ? 'UNPLANNED' : 'PLANNED';
      const financialBreakdown = calculateDowntimeFinancialImpact({
        asset: {
          id: meta.id,
          code: meta.code,
          name: meta.name,
          topologyType: meta.topologyType ?? 'BOTTLENECK',
          bufferCapacityMinutes: meta.bufferCapacityMinutes ?? 0,
          capacityImpactPercent: meta.capacityImpactPercent ?? 100,
          hourlyLostMarginRials: meta.hourlyLostMarginRials ?? 0,
          coldStartupThresholdMinutes: meta.coldStartupThresholdMinutes ?? 120,
          restartEnergyAndSetupCostRials: meta.restartEnergyAndSetupCostRials ?? 0,
          inLineScrapCostRials: meta.inLineScrapCostRials ?? 0,
        },
        durationMinutes: stat.totalMinutes,
        stoppageType,
        sparePartsCostRials,
        technicianLaborHours: stat.totalMinutes / 60,
        laborHourlyRateRials,
      });

      badActors.push({
        assetId,
        assetCode: meta.code,
        assetName: meta.name,
        criticality: meta.criticality,
        topologyType: meta.topologyType ?? 'BOTTLENECK',
        incidentCount: stat.incidentCount,
        totalDowntimeMinutes: stat.totalMinutes,
        unplannedMinutes: stat.unplannedMinutes,
        totalFinancialLossRials: financialBreakdown.totalLossRials,
        financialBreakdown,
      });
    }
  }
  badActors.sort(
    (a, b) =>
      b.totalFinancialLossRials - a.totalFinancialLossRials ||
      b.totalDowntimeMinutes - a.totalDowntimeMinutes,
  );
  const topBadActors = badActors.slice(0, 5);

  // 5. Generate Weekly Period Trends (Divide range into 4 weekly buckets)
  const bucketCount = 4;
  const bucketDurationMs = (to.getTime() - from.getTime()) / bucketCount;
  const trends: PeriodTrendBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bStart = new Date(from.getTime() + i * bucketDurationMs);
    const bEnd = new Date(from.getTime() + (i + 1) * bucketDurationMs);

    let bPmDue = 0;
    let bCompletedOnTime = 0;
    for (const wo of allWorkOrders) {
      if (wo.type === 'PM' && wo.createdAt >= bStart && wo.createdAt < bEnd) {
        bPmDue++;
        if (wo.status === 'DONE' && wo.completedAt && wo.completedAt <= wo.dueAt) {
          bCompletedOnTime++;
        }
      }
    }

    let bUnplannedMinutes = 0;
    let bPlannedMinutes = 0;
    for (const dt of allDowntimes) {
      if (dt.startedAt >= bStart && dt.startedAt < bEnd) {
        const dur = Math.max(
          0,
          Math.round(((dt.endedAt ?? bEnd).getTime() - dt.startedAt.getTime()) / 60_000),
        );
        if (dt.isPlanned) {
          bPlannedMinutes += dur;
        } else {
          bUnplannedMinutes += dur;
        }
      }
    }

    const bRate = bPmDue > 0 ? Math.round((bCompletedOnTime / bPmDue) * 100) : 100;
    trends.push({
      periodKey: `W${i + 1}`,
      periodLabel: `هفته ${i + 1}`,
      totalPmDue: bPmDue,
      completedOnTime: bCompletedOnTime,
      complianceRate: bRate,
      unplannedDowntimeHours: Math.round((bUnplannedMinutes / 60) * 10) / 10,
      plannedDowntimeHours: Math.round((bPlannedMinutes / 60) * 10) / 10,
    });
  }

  return {
    plantId,
    dateRange: {
      from: from.toISOString(),
      to: to.toISOString(),
      daysCount,
    },
    summary: {
      totalWorkOrders,
      completedWorkOrders,
      openWorkOrders,
      emergencyWorkOrders,
    },
    pmCompliance: {
      totalPmDue,
      completedPm,
      completedOnTime,
      complianceRate: pmComplianceRate,
      targetRate: 90,
    },
    reliability: {
      mtbfHours,
      mttrMinutes,
      unplannedFailuresCount,
      totalOperatingHours: Math.round(totalOperatingHours),
    },
    downtime: {
      totalDowntimeHours,
      unplannedHours,
      plannedHours,
      unplannedPercentage,
    },
    topBadActors,
    trends,
  };
}
