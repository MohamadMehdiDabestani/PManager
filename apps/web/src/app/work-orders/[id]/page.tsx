import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatJalaliDateTime,
  formatRialsFa,
  getWorkOrderById,
  listFailureCodes,
  listParts,
  TOPOLOGY_LABELS_FA,
  toPersianDigits,
} from '@cmms/core';
import { ArrowRight, Smartphone, Cpu, CalendarClock, Flame } from 'lucide-react';
import { getServerContext } from '@/lib/server-context';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OfflineSyncBanner } from '@/components/pwa/offline-sync-banner';
import { WorkOrderExecutor } from '@/components/work-orders/work-order-executor';
import { DowntimeCostBreakdownModal } from '@/components/financial/downtime-cost-breakdown-modal';
import fa from '@/messages/fa.json';

export const dynamic = 'force-dynamic';

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ctx, sessionUser } = await getServerContext();
  const { id } = await params;

  const [wo, parts, failureCodes] = await Promise.all([
    getWorkOrderById(ctx, id),
    listParts(ctx),
    listFailureCodes(ctx),
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

      {/* کارت خلاصه خسارت مالی توقف و دکمه مودال شفافیت فرمول (ریز فاکتور ۵ سطری) */}
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="pt-5 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Flame className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-foreground">
                برآورد خسارت مالی توقف و تعمیرات این دستورکار:
              </span>
              <Badge variant="outline" className="text-[11px]">
                {TOPOLOGY_LABELS_FA[wo.topologyType]}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                توقف تجهیز: {toPersianDigits(wo.financialImpact.durationMinutes)} دقیقه (خواب مؤثر خط:{' '}
                {toPersianDigits(wo.financialImpact.effectiveLineDowntimeMinutes)} دقیقه)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              نرخ دستمزد تکنسین: {formatRialsFa(wo.laborHourlyRateRials)} ریال/ساعت | هزینه قطعات
              مصرفی: {formatRialsFa(wo.financialImpact.sparePartsCostRials)} ریال | تولید از دست
              رفته: {formatRialsFa(wo.financialImpact.lostProductionCostRials)} ریال
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-left">
              <div className="text-xs text-muted-foreground">مجموع خسارت مالی (ریال):</div>
              <div className="text-lg font-bold font-mono text-red-400">
                {formatRialsFa(wo.financialImpact.totalLossRials)} ریال
              </div>
            </div>
            <DowntimeCostBreakdownModal
              assetName={wo.assetName}
              assetCode={wo.assetCode}
              breakdown={wo.financialImpact}
              contextTitle={`دستورکار: ${wo.title}`}
              triggerLabel="شفافیت فرمول محاسبه ضرر (ریز فاکتور)"
            />
          </div>
        </CardContent>
      </Card>

      <WorkOrderExecutor workOrder={wo} parts={parts} failureCodes={failureCodes} />
    </AppShell>
  );
}
