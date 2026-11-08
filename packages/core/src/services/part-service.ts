import { z } from 'zod';
import { and, eq, asc } from 'drizzle-orm';
import { parts, type Part } from '@cmms/db';
import { assertCan, accessibleWhere } from '../auth/index';
import type { ServiceContext } from '../context';
import { writeAuditLog } from './audit-service';

export const adjustStockSchema = z.object({
  partId: z.string().uuid(),
  delta: z.number(),
  reason: z.string().min(2, 'ذکر دلیل اصلاح موجودی الزامی است'),
});

export async function listParts(
  ctx: ServiceContext,
  params?: { plantId?: string },
): Promise<Part[]> {
  assertCan(ctx.ability, 'read', 'Part');
  const scopeCondition = accessibleWhere(ctx.ability, 'read', 'Part', parts);

  const conditions = [];
  if (scopeCondition) conditions.push(scopeCondition);
  if (params?.plantId) conditions.push(eq(parts.plantId, params.plantId));

  return ctx.db
    .select()
    .from(parts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(parts.code));
}

export async function adjustPartStock(
  ctx: ServiceContext,
  input: z.infer<typeof adjustStockSchema>,
): Promise<Part> {
  const data = adjustStockSchema.parse(input);
  const [existing] = await ctx.db
    .select()
    .from(parts)
    .where(eq(parts.id, data.partId))
    .limit(1);

  if (!existing) {
    throw new Error('قطعه یدکی یافت نشد');
  }

  assertCan(ctx.ability, 'adjustStock', 'Part', { plantId: existing.plantId });

  const nextQty = Math.max(0, existing.quantityOnHand + data.delta);

  const [updated] = await ctx.db
    .update(parts)
    .set({
      quantityOnHand: nextQty,
      updatedAt: ctx.now(),
    })
    .where(eq(parts.id, existing.id))
    .returning();

  if (!updated) {
    throw new Error('خطا در اصلاح موجودی قطعه');
  }

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'PART_STOCK_ADJUSTED',
    entity: 'Part',
    entityId: existing.id,
    before: { quantityOnHand: existing.quantityOnHand },
    after: { quantityOnHand: updated.quantityOnHand },
    reason: data.reason,
  });

  return updated;
}
