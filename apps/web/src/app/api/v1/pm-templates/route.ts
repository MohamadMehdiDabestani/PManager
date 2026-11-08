import { NextResponse, type NextRequest } from 'next/server';
import {
  listPmTemplates,
  createPmTemplate,
  createPmTemplateSchema,
  AppForbidden,
} from '@cmms/core';
import { getServerContext } from '@/lib/server-context';

export async function GET(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const { searchParams } = new URL(req.url);
    const plantId = searchParams.get('plantId') ?? undefined;
    const items = await listPmTemplates(ctx, { plantId });
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
    const input = createPmTemplateSchema.parse(body);
    const created = await createPmTemplate(ctx, input);
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
