import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  assets,
  assetMeters,
  assetMeterReadings,
  locations,
  plants,
  type DbClient,
} from '@cmms/db';
import { accessibleWhere, assertCan } from '../auth/index';
import { normalizeDigits, normalizePersianText } from '../i18n/persian';
import type { ServiceContext } from '../context';
import { writeAuditLog } from './audit-service';

export const LotoStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  energySource: z.string().min(2).max(100),
  isolationPoint: z.string().min(2).max(150),
  verificationMethod: z.string().min(2).max(200),
});

export const CreateAssetSchema = z.object({
  plantId: z.string().uuid(),
  locationId: z.string().uuid().nullable().optional(),
  parentAssetId: z.string().uuid().nullable().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(200),
  serialNumber: z.string().max(100).optional(),
  status: z.enum(['OPERATIONAL', 'UNDER_MAINTENANCE', 'DOWN', 'DECOMMISSIONED']).default('OPERATIONAL'),
  criticality: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  topologyType: z.enum(['BOTTLENECK', 'BUFFERED', 'PARALLEL']).default('BOTTLENECK'),
  bufferCapacityMinutes: z.number().int().min(0).default(0),
  capacityImpactPercent: z.number().int().min(0).max(100).default(100),
  hourlyLostMarginRials: z.number().min(0).default(0),
  coldStartupThresholdMinutes: z.number().int().min(0).default(120),
  restartEnergyAndSetupCostRials: z.number().min(0).default(0),
  inLineScrapCostRials: z.number().min(0).default(0),
  requiresLoto: z.boolean().default(false),
  lotoProcedure: z.array(LotoStepSchema).default([]),
  initialMeter: z
    .object({
      name: z.string().min(2).max(100),
      unit: z.string().min(1).max(32),
      currentReading: z.number().min(0).default(0),
    })
    .optional(),
});

export const UpdateAssetSchema = z.object({
  assetId: z.string().uuid(),
  name: z.string().min(2).max(200).optional(),
  criticality: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  topologyType: z.enum(['BOTTLENECK', 'BUFFERED', 'PARALLEL']),
  bufferCapacityMinutes: z.number().int().min(0).default(0),
  capacityImpactPercent: z.number().int().min(0).max(100).default(100),
  hourlyLostMarginRials: z.number().min(0).default(0),
  coldStartupThresholdMinutes: z.number().int().min(0).default(120),
  restartEnergyAndSetupCostRials: z.number().min(0).default(0),
  inLineScrapCostRials: z.number().min(0).default(0),
});

export const RecordMeterReadingSchema = z.object({
  meterId: z.string().uuid(),
  reading: z.number().min(0),
  clientId: z.string().max(64).optional(),
});

export function generateOpaqueQrToken(): string {
  return `ast_${randomBytes(16).toString('hex')}`;
}

export async function listAssets(
  ctx: ServiceContext,
  filters?: { search?: string; status?: string; criticality?: string; plantId?: string },
) {
  const scopeSql = accessibleWhere(ctx.ability, 'read', 'Asset', assets);
  const clauses = [scopeSql, isNull(assets.deletedAt)];

  if (filters?.plantId) {
    clauses.push(eq(assets.plantId, filters.plantId));
  }
  if (filters?.status) {
    clauses.push(eq(assets.status, filters.status as never));
  }
  if (filters?.criticality) {
    clauses.push(eq(assets.criticality, filters.criticality as never));
  }
  if (filters?.search && filters.search.trim().length > 0) {
    const q = `%${normalizePersianText(filters.search)}%`;
    const codeQ = `%${normalizeDigits(filters.search.trim())}%`;
    clauses.push(or(ilike(assets.nameNormalized, q), ilike(assets.code, codeQ))!);
  }

  const rows = await ctx.db
    .select({
      asset: assets,
      locationName: locations.name,
      locationCode: locations.code,
      plantName: plants.name,
    })
    .from(assets)
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .innerJoin(plants, eq(assets.plantId, plants.id))
    .where(and(...clauses))
    .orderBy(asc(assets.code));

  const meters = await ctx.db.select().from(assetMeters);
  const metersByAsset = new Map<string, typeof meters>();
  for (const m of meters) {
    const list = metersByAsset.get(m.assetId) ?? [];
    list.push(m);
    metersByAsset.set(m.assetId, list);
  }

  return rows.map((r) => ({
    ...r.asset,
    locationName: r.locationName ?? 'بدون محل استقرار',
    locationCode: r.locationCode ?? '-',
    plantName: r.plantName,
    meters: metersByAsset.get(r.asset.id) ?? [],
  }));
}

export async function getAssetById(ctx: ServiceContext, assetId: string) {
  const [row] = await ctx.db
    .select({
      asset: assets,
      locationName: locations.name,
      plantName: plants.name,
    })
    .from(assets)
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .innerJoin(plants, eq(assets.plantId, plants.id))
    .where(and(eq(assets.id, assetId), isNull(assets.deletedAt)))
    .limit(1);

  if (!row) return null;
  assertCan(ctx.ability, 'read', 'Asset', row.asset as unknown as Record<string, unknown>);

  const meters = await ctx.db
    .select()
    .from(assetMeters)
    .where(eq(assetMeters.assetId, row.asset.id));

  const childAssets = await ctx.db
    .select()
    .from(assets)
    .where(and(eq(assets.parentAssetId, row.asset.id), isNull(assets.deletedAt)))
    .orderBy(asc(assets.code));

  return {
    ...row.asset,
    locationName: row.locationName ?? 'بدون محل استقرار',
    plantName: row.plantName,
    meters,
    childAssets,
  };
}

export async function getAssetByQrToken(ctx: ServiceContext, qrToken: string) {
  const [asset] = await ctx.db
    .select()
    .from(assets)
    .where(and(eq(assets.qrOpaqueToken, qrToken.trim()), isNull(assets.deletedAt)))
    .limit(1);

  if (!asset) return null;
  assertCan(ctx.ability, 'read', 'Asset', asset as unknown as Record<string, unknown>);
  return getAssetById(ctx, asset.id);
}

export async function createAsset(
  ctx: ServiceContext,
  rawInput: z.infer<typeof CreateAssetSchema>,
) {
  const input = CreateAssetSchema.parse(rawInput);
  assertCan(ctx.ability, 'create', 'Asset', { plantId: input.plantId });

  const normalizedName = normalizePersianText(input.name);
  const normalizedCode = normalizeDigits(input.code.trim().toUpperCase());

  return ctx.db.transaction(async (tx) => {
    const [created] = await tx
      .insert(assets)
      .values({
        plantId: input.plantId,
        locationId: input.locationId ?? null,
        parentAssetId: input.parentAssetId ?? null,
        code: normalizedCode,
        name: input.name.trim(),
        nameNormalized: normalizedName,
        serialNumber: input.serialNumber ? normalizeDigits(input.serialNumber.trim()) : null,
        qrOpaqueToken: generateOpaqueQrToken(),
        status: input.status,
        criticality: input.criticality,
        topologyType: input.topologyType,
        bufferCapacityMinutes: input.bufferCapacityMinutes,
        capacityImpactPercent: input.capacityImpactPercent,
        hourlyLostMarginRials: Math.round(input.hourlyLostMarginRials),
        coldStartupThresholdMinutes: input.coldStartupThresholdMinutes,
        restartEnergyAndSetupCostRials: Math.round(input.restartEnergyAndSetupCostRials),
        inLineScrapCostRials: Math.round(input.inLineScrapCostRials),
        requiresLoto: input.requiresLoto,
        lotoProcedure: input.lotoProcedure,
      })
      .returning();

    if (!created) throw new Error('Failed to create asset');

    if (input.initialMeter) {
      await tx.insert(assetMeters).values({
        assetId: created.id,
        name: input.initialMeter.name.trim(),
        unit: input.initialMeter.unit.trim(),
        currentReading: input.initialMeter.currentReading,
      });
    }

    await writeAuditLog(
      { ...ctx, db: tx as unknown as DbClient },
      {
        plantId: created.plantId,
        action: 'ASSET_CREATED',
        entity: 'Asset',
        entityId: created.id,
        after: {
          code: created.code,
          name: created.name,
          criticality: created.criticality,
          topologyType: created.topologyType,
          hourlyLostMarginRials: created.hourlyLostMarginRials,
          requiresLoto: created.requiresLoto,
        },
      },
    );

    return created;
  });
}

export async function updateAsset(
  ctx: ServiceContext,
  rawInput: z.infer<typeof UpdateAssetSchema>,
) {
  const input = UpdateAssetSchema.parse(rawInput);

  const [existing] = await ctx.db
    .select()
    .from(assets)
    .where(and(eq(assets.id, input.assetId), isNull(assets.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error('تجهیز مورد نظر یافت نشد');
  }

  assertCan(ctx.ability, 'update', 'Asset', existing as unknown as Record<string, unknown>);

  const nextName = input.name ? input.name.trim() : existing.name;
  const nextNameNormalized = input.name ? normalizePersianText(input.name) : existing.nameNormalized;

  const [updated] = await ctx.db
    .update(assets)
    .set({
      name: nextName,
      nameNormalized: nextNameNormalized,
      criticality: input.criticality ?? existing.criticality,
      topologyType: input.topologyType,
      bufferCapacityMinutes: input.bufferCapacityMinutes,
      capacityImpactPercent: input.capacityImpactPercent,
      hourlyLostMarginRials: Math.round(input.hourlyLostMarginRials),
      coldStartupThresholdMinutes: input.coldStartupThresholdMinutes,
      restartEnergyAndSetupCostRials: Math.round(input.restartEnergyAndSetupCostRials),
      inLineScrapCostRials: Math.round(input.inLineScrapCostRials),
      updatedAt: ctx.now(),
    })
    .where(eq(assets.id, existing.id))
    .returning();

  if (!updated) {
    throw new Error('خطا در به‌روزرسانی پارامترهای تجهیز');
  }

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'ASSET_UPDATED',
    entity: 'Asset',
    entityId: existing.id,
    before: {
      topologyType: existing.topologyType,
      bufferCapacityMinutes: existing.bufferCapacityMinutes,
      capacityImpactPercent: existing.capacityImpactPercent,
      hourlyLostMarginRials: existing.hourlyLostMarginRials,
      coldStartupThresholdMinutes: existing.coldStartupThresholdMinutes,
      restartEnergyAndSetupCostRials: existing.restartEnergyAndSetupCostRials,
      inLineScrapCostRials: existing.inLineScrapCostRials,
    },
    after: {
      topologyType: updated.topologyType,
      bufferCapacityMinutes: updated.bufferCapacityMinutes,
      capacityImpactPercent: updated.capacityImpactPercent,
      hourlyLostMarginRials: updated.hourlyLostMarginRials,
      coldStartupThresholdMinutes: updated.coldStartupThresholdMinutes,
      restartEnergyAndSetupCostRials: updated.restartEnergyAndSetupCostRials,
      inLineScrapCostRials: updated.inLineScrapCostRials,
    },
  });

  return updated;
}

export async function recordMeterReading(
  ctx: ServiceContext,
  rawInput: z.infer<typeof RecordMeterReadingSchema>,
) {
  const input = RecordMeterReadingSchema.parse(rawInput);

  const [meterRow] = await ctx.db
    .select({ meter: assetMeters, asset: assets })
    .from(assetMeters)
    .innerJoin(assets, eq(assetMeters.assetId, assets.id))
    .where(eq(assetMeters.id, input.meterId))
    .limit(1);

  if (!meterRow) {
    throw new Error('کنتور تجهیز یافت نشد');
  }

  assertCan(ctx.ability, 'read', 'Asset', meterRow.asset as unknown as Record<string, unknown>);

  if (input.reading < meterRow.meter.currentReading) {
    throw new Error('مقدار کارکرد جدید نمی‌تواند کمتر از کارکرد فعلی دستگاه باشد');
  }

  return ctx.db.transaction(async (tx) => {
    const [readingRow] = await tx
      .insert(assetMeterReadings)
      .values({
        meterId: input.meterId,
        reading: input.reading,
        recordedById: ctx.user.id === 'SYSTEM' ? null : ctx.user.id,
        recordedAt: ctx.now(),
        clientId: input.clientId ?? null,
      })
      .onConflictDoNothing({ target: assetMeterReadings.clientId })
      .returning();

    await tx
      .update(assetMeters)
      .set({ currentReading: input.reading, updatedAt: ctx.now() })
      .where(eq(assetMeters.id, input.meterId));

    await writeAuditLog(
      { ...ctx, db: tx as unknown as DbClient },
      {
        plantId: meterRow.asset.plantId,
        action: 'METER_READING_RECORDED',
        entity: 'AssetMeter',
        entityId: input.meterId,
        before: { currentReading: meterRow.meter.currentReading },
        after: { currentReading: input.reading },
      },
    );

    return readingRow;
  });
}

export async function listRecentMeterReadings(ctx: ServiceContext, meterId: string) {
  return ctx.db
    .select()
    .from(assetMeterReadings)
    .where(eq(assetMeterReadings.meterId, meterId))
    .orderBy(desc(assetMeterReadings.recordedAt))
    .limit(10);
}
