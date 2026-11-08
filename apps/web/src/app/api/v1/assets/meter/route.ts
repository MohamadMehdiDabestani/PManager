import { NextResponse, type NextRequest } from 'next/server';
import { recordMeterReading, RecordMeterReadingSchema, AppForbidden } from '@cmms/core';
import { enqueueProjectMeterDue, enqueueGenerateWorkOrders } from '@cmms/queue';
import { getServerContext } from '@/lib/server-context';

export async function POST(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const body = await req.json();
    const input = RecordMeterReadingSchema.parse(body);
    const recorded = await recordMeterReading(ctx, input);

    try {
      await enqueueProjectMeterDue({ meterId: input.meterId });
      await enqueueGenerateWorkOrders({ horizonDays: 0 });
    } catch {
      // Queue connectivity errors should not fail the meter reading save
    }

    return NextResponse.json({ data: recorded }, { status: 201 });
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
