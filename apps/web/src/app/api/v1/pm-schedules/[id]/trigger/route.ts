import { NextResponse, type NextRequest } from 'next/server';
import { getPmScheduleById, AppForbidden } from '@cmms/core';
import { enqueueGenerateWorkOrders } from '@cmms/queue';
import { getServerContext } from '@/lib/server-context';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await getServerContext();
    const { id } = await params;
    const schedule = await getPmScheduleById(ctx, id);
    if (!schedule) {
      return NextResponse.json({ message: 'برنامه نت یافت نشد' }, { status: 404 });
    }

    await enqueueGenerateWorkOrders({ scheduleId: id, horizonDays: 0 });

    return NextResponse.json({
      ok: true,
      message: 'دستور تولید دستورکار در صف پردازش قرار گرفت',
    });
  } catch (err) {
    if (err instanceof AppForbidden) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
