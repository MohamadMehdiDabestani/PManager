import { NextResponse, type NextRequest } from 'next/server';
import {
  getPmTemplateById,
  updatePmTemplate,
  deletePmTemplate,
  updatePmTemplateSchema,
  AppForbidden,
} from '@cmms/core';
import { getServerContext } from '@/lib/server-context';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await getServerContext();
    const { id } = await params;
    const template = await getPmTemplateById(ctx, id);
    if (!template) {
      return NextResponse.json({ message: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ data: template });
  } catch (err) {
    if (err instanceof AppForbidden) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 403 });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await getServerContext();
    const { id } = await params;
    const body = await req.json();
    const input = updatePmTemplateSchema.parse(body);
    const updated = await updatePmTemplate(ctx, id, input);
    return NextResponse.json({ data: updated });
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await getServerContext();
    const { id } = await params;
    await deletePmTemplate(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AppForbidden) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 403 });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
