import { NextResponse, type NextRequest } from 'next/server';
import { listWorkOrders, AppForbidden } from '@cmms/core';
import type { WorkOrderStatus } from '@cmms/db';
import { getServerContext } from '@/lib/server-context';

export async function GET(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const { searchParams } = new URL(req.url);
    const plantId = searchParams.get('plantId') ?? undefined;
    const status = (searchParams.get('status') as WorkOrderStatus) ?? undefined;
    const assigneeId = searchParams.get('assigneeId') ?? undefined;
    const assetId = searchParams.get('assetId') ?? undefined;

    const items = await listWorkOrders(ctx, { plantId, status, assigneeId, assetId });
    return NextResponse.json({ data: items });
  } catch (err) {
    if (err instanceof AppForbidden) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 403 });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
