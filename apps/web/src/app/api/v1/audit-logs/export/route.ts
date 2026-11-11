import { NextResponse } from 'next/server';
import { formatAuditLogsCsv, listAuditLogs } from '@cmms/core';
import { getServerContext } from '@/lib/server-context';

export async function GET(request: Request) {
  try {
    const { ctx } = await getServerContext();
    const url = new URL(request.url);
    const plantId = url.searchParams.get('plantId') ?? undefined;
    const entity = url.searchParams.get('entity') ?? undefined;
    const action = url.searchParams.get('action') ?? undefined;

    const { logs } = await listAuditLogs(ctx, {
      plantId,
      entity,
      action,
      limit: 1000,
    });

    const csvData = formatAuditLogsCsv(logs);
    const filename = `cmms-iso-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطای دسترسی به لاگ‌های ممیزی';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
