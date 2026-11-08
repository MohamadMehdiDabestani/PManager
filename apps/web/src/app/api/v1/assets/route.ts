import { NextResponse, type NextRequest } from 'next/server';
import { listAssets, createAsset, CreateAssetSchema, AppForbidden } from '@cmms/core';
import { getServerContext } from '@/lib/server-context';

export async function GET(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const items = await listAssets(ctx, { search, status });
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
    const input = CreateAssetSchema.parse(body);
    const created = await createAsset(ctx, input);
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
