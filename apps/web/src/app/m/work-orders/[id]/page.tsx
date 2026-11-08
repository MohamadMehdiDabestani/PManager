import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWorkOrderById, listParts, formatJalaliDateTime } from '@cmms/core';
import { ArrowRight, Cpu, Clock } from 'lucide-react';
import { getServerContext } from '@/lib/server-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OfflineSyncBanner } from '@/components/pwa/offline-sync-banner';
import { WorkOrderExecutor } from '@/components/work-orders/work-order-executor';
import fa from '@/messages/fa.json';

export const dynamic = 'force-dynamic';

export default async function TechnicianMobileWorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ctx } = await getServerContext();
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
    <div className="min-h-screen bg-background text-foreground p-4 max-w-xl mx-auto space-y-4 pb-20">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/m/work-orders">
            <ArrowRight className="h-4 w-4 me-1.5" />
            لیست دستورکارهای من
          </Link>
        </Button>

        <Badge variant={wo.status === 'OVERDUE' ? 'destructive' : 'info'}>
          {statusLabel}
        </Badge>
      </div>

      <OfflineSyncBanner />

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold">{wo.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Link
            href={`/assets/${wo.assetId}`}
            className="flex items-center gap-1 text-primary font-semibold"
          >
            <Cpu className="h-3.5 w-3.5" />
            {wo.assetName} ({wo.assetCode})
          </Link>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            مهلت: {formatJalaliDateTime(wo.dueAt)}
          </span>
        </div>
      </div>

      <WorkOrderExecutor workOrder={wo} parts={parts} />
    </div>
  );
}
