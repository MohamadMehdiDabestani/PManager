import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { plants, locations, type DbClient } from '@cmms/db';
import { assertCan } from '../auth/index';
import type { ServiceContext } from '../context';
import { writeAuditLog } from './audit-service';

export const CreateLocationSchema = z.object({
  plantId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(64),
  name: z.string().min(2).max(150),
});

export async function listAccessiblePlants(ctx: ServiceContext) {
  if (ctx.user.role === 'ADMIN' || ctx.user.role === 'AUDITOR') {
    return ctx.db.select().from(plants).orderBy(asc(plants.code));
  }
  if (ctx.user.plantIds.length === 0) {
    return [];
  }
  return ctx.db
    .select()
    .from(plants)
    .where(inArray(plants.id, ctx.user.plantIds))
    .orderBy(asc(plants.code));
}

export async function listLocations(ctx: ServiceContext, plantId?: string) {
  assertCan(ctx.ability, 'read', 'Asset');
  if (plantId) {
    return ctx.db
      .select()
      .from(locations)
      .where(eq(locations.plantId, plantId))
      .orderBy(asc(locations.code));
  }
  if (ctx.user.role === 'ADMIN' || ctx.user.role === 'AUDITOR') {
    return ctx.db.select().from(locations).orderBy(asc(locations.code));
  }
  if (ctx.user.plantIds.length === 0) return [];
  return ctx.db
    .select()
    .from(locations)
    .where(inArray(locations.plantId, ctx.user.plantIds))
    .orderBy(asc(locations.code));
}

export async function createLocation(
  ctx: ServiceContext,
  rawInput: z.infer<typeof CreateLocationSchema>,
) {
  const input = CreateLocationSchema.parse(rawInput);
  assertCan(ctx.ability, 'create', 'Asset', { plantId: input.plantId });

  return ctx.db.transaction(async (tx) => {
    const [loc] = await tx
      .insert(locations)
      .values({
        plantId: input.plantId,
        parentId: input.parentId ?? null,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
      })
      .returning();

    if (!loc) throw new Error('Failed to create location');

    await writeAuditLog(
      { ...ctx, db: tx as unknown as DbClient },
      {
        plantId: input.plantId,
        action: 'LOCATION_CREATED',
        entity: 'Location',
        entityId: loc.id,
        after: { code: loc.code, name: loc.name },
      },
    );

    return loc;
  });
}
