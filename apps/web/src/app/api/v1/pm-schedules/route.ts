import { NextResponse, type NextRequest } from 'next/server';
import {
  listPmSchedules,
  createPmSchedule,
  createPmScheduleSchema,
  AppForbidden,
} from '@cmms/core';
import { enqueueGenerateWorkOrders } from '@cmms/queue';
import { getServerContext } from '@/lib/server-context';

export async function GET(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const { searchParams } = new URL(req.url);
    const plantId = searchParams.get('plantId') ?? undefined;
    const assetId = searchParams.get('assetId') ?? undefined;
    const activeStr = searchParams.get('active');
    const active = activeStr !== null ? activeStr === 'true' : undefined;

    const items = await listPmSchedules(ctx, { plantId, assetId, active });
    return NextResponse.json({ data: items });
  } catch (err) {
    if (err instanceof AppForbidden) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 403 });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const body = await req.json();
    const input = createPmScheduleSchema.parse(body);
    const created = await createPmSchedule(ctx, input);

    // If due within lead time, trigger immediate work order generation
    if (created.active && created.nextDueAt) {
      const now = new Date();
      const leadThreshold = new Date(created.nextDueAt.getTime() - created.leadDays * 86_400_000);
      if (leadThreshold <= now) {
        try {
          await enqueueGenerateWorkOrders({ scheduleId: created.id, horizonDays: 0 });
        } catch {
          // ignore queue error in HTTP response
        }
      }
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    if (err instanceof AppForbidden) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 },
    );
  }
}
