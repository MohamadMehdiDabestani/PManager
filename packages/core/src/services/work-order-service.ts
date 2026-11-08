import { and, eq, isNull, inArray, lt, desc } from 'drizzle-orm';
import {
  workOrders,
  assets,
  users,
  type WorkOrder,
  type WorkOrderStatus,
} from '@cmms/db';
import { assertCan, accessibleWhere } from '../auth/index';
import type { ServiceContext } from '../context';

export type WorkOrderWithDetails = WorkOrder & {
  assetName: string;
  assetCode: string;
  assigneeName?: string | null;
};

export async function listWorkOrders(
  ctx: ServiceContext,
  params?: {
    plantId?: string;
    status?: WorkOrderStatus;
    assigneeId?: string;
    assetId?: string;
  },
): Promise<WorkOrderWithDetails[]> {
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
      assigneeName: users.fullName,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(and(...conditions))
    .orderBy(desc(workOrders.dueAt));

  return rows.map((r: {
    order: WorkOrder;
    assetName: string;
    assetCode: string;
    assigneeName: string | null;
  }) => ({
    ...r.order,
    assetName: r.assetName,
    assetCode: r.assetCode,
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
      assigneeName: users.fullName,
    })
    .from(workOrders)
    .innerJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(and(...conditions))
    .limit(1);

  if (!row) return null;

  return {
    ...row.order,
    assetName: row.assetName,
    assetCode: row.assetCode,
    assigneeName: row.assigneeName,
  };
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
