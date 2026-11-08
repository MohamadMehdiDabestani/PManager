import { NextResponse, type NextRequest } from 'next/server';
import { getWorkOrderById, AppForbidden } from '@cmms/core';
import { getServerContext } from '@/lib/server-context';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await getServerContext();
    const { id } = await params;
    const item = await getWorkOrderById(ctx, id);
    if (!item) {
      return NextResponse.json({ message: 'دستورکار یافت نشد' }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch (err) {
    if (err instanceof AppForbidden) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 403 });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
