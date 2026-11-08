import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWorkOrderById, listParts, formatJalaliDateTime } from '@cmms/core';
import { ArrowRight, Smartphone, Cpu, CalendarClock } from 'lucide-react';
import { getServerContext } from '@/lib/server-context';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OfflineSyncBanner } from '@/components/pwa/offline-sync-banner';
import { WorkOrderExecutor } from '@/components/work-orders/work-order-executor';
import fa from '@/messages/fa.json';

export const dynamic = 'force-dynamic';

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ctx, sessionUser } = await getServerContext();
  const { id } = await params;

  const [wo, parts] = await Promise.all([
    getWorkOrderById(ctx, id),
    listParts(ctx),
  ]);

  if (!wo) {
    notFound();
  }

  const statusLabel = fa.status[wo.status as keyof typeof fa.status] ?? wo.status;

  return (
    <AppShell activeNav="work-orders" user={sessionUser}>
      <OfflineSyncBanner />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/work-orders">
                <ArrowRight className="h-4 w-4 me-1" />
                بازگشت به دستورکارها
              </Link>
            </Button>
            <Badge variant="outline" className="font-mono">
              {wo.type}
            </Badge>
            <Badge variant={wo.status === 'OVERDUE' ? 'destructive' : 'info'}>
              {statusLabel}
            </Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{wo.title}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            <Link
              href={`/assets/${wo.assetId}`}
              className="flex items-center gap-1 hover:text-primary font-medium"
            >
              <Cpu className="h-3.5 w-3.5" />
              {wo.assetName} ({wo.assetCode})
            </Link>
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              مهلت انجام: {formatJalaliDateTime(wo.dueAt)}
            </span>
            <span>مسئول اجرا: {wo.assigneeName ?? 'تخصیص‌نیافته'}</span>
          </div>
        </div>

        <Button asChild variant="secondary" size="sm">
          <Link href={`/m/work-orders/${wo.id}`}>
            <Smartphone className="h-4 w-4 me-2 text-primary" />
            باز کردن در نمای موبایل تکنسین (/m)
          </Link>
        </Button>
      </div>

      <WorkOrderExecutor workOrder={wo} parts={parts} />
    </AppShell>
  );
}
