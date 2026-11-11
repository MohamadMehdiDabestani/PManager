'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
} from 'lucide-react';
import type { BadActorAsset, PeriodTrendBucket } from '@cmms/core';
import { toPersianDigits } from '@cmms/core/i18n';
import {
  formatRialsFa,
  TOPOLOGY_LABELS_FA,
  type AssetTopologyKind,
} from '@cmms/core/financial-downtime';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DowntimeCostBreakdownModal } from '@/components/financial/downtime-cost-breakdown-modal';

interface KpiChartsProps {
  complianceRate: number;
  complianceTarget: number;
  trends: PeriodTrendBucket[];
  badActors: BadActorAsset[];
  totalDowntimeHours: number;
  unplannedHours: number;
  plannedHours: number;
}

export function KpiCharts({
  complianceRate,
  complianceTarget,
  trends,
  badActors,
  totalDowntimeHours,
  unplannedHours,
  plannedHours,
}: KpiChartsProps) {
  const isComplianceOnTarget = complianceRate >= complianceTarget;

  // Find max downtime among bad actors for relative bar widths
  const maxBadActorMinutes = Math.max(1, ...badActors.map((b) => b.totalDowntimeMinutes));

  const unplannedPct =
    totalDowntimeHours > 0 ? Math.round((unplannedHours / totalDowntimeHours) * 100) : 0;
  const plannedPct = totalDowntimeHours > 0 ? 100 - unplannedPct : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 1. PM Compliance Trend Chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                روند هفتگی انطباق نت پیشگیرانه (PM Compliance)
              </CardTitle>
            </div>
            <Badge
              variant={isComplianceOnTarget ? 'default' : 'destructive'}
              className="font-mono text-xs"
            >
              هدف: {complianceTarget}٪
            </Badge>
          </div>
          <CardDescription className="text-xs">
            نسبت دستورکارهای PM انجام‌شده در موعد به کل دستورکارهای سررسیدشده
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-border">
            {trends.map((bucket, idx) => {
              const heightPct = Math.max(8, Math.min(100, bucket.complianceRate));
              const isTargetMet = bucket.complianceRate >= complianceTarget;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="font-mono text-[11px] font-bold text-foreground">
                    {bucket.complianceRate}٪
                  </span>
                  <div className="w-full max-w-[48px] bg-muted/40 rounded-t-md h-full flex items-end overflow-hidden p-0.5">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all duration-500 ${
                        isTargetMet ? 'bg-primary' : 'bg-amber-500'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {bucket.periodLabel}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span>موفق (بالای ۹۰٪)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>نیاز به پیگیری (زیر ۹۰٪)</span>
            </div>
            <div className="font-bold text-foreground">
              میانگین فعلی: {complianceRate}٪
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Top Bad Actors (Ranked by Total Financial Loss in Rials) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-base">
                تجهیزات پرخسارت و گلوگاه خط تولید (Top Bad Actors)
              </CardTitle>
            </div>
            <Badge variant="destructive" className="text-xs">
              مرتب‌سازی بر اساس بیشترین ضرر ریالی
            </Badge>
          </div>
          <CardDescription className="text-xs">
            رتبه‌بندی تجهیزات بر اساس مجموع خسارت مالی سه‌جزئی (تولید از دست رفته با کسر بافر، ضایعات داخل کوره، جریمه سرد شدن و تعمیرات)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {badActors.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-primary/60" />
              <span>در این بازه زمانی توقف ثبت‌شده‌ای روی تجهیزات وجود ندارد.</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">تجهیز / توپولوژی خط</TableHead>
                  <TableHead className="text-right">ساعت توقف (خواب مؤثر)</TableHead>
                  <TableHead className="text-right">مجموع خسارت مالی (ریال)</TableHead>
                  <TableHead className="text-left">شفافیت فرمول</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badActors.map((actor, idx) => {
                  const hours = Math.round((actor.totalDowntimeMinutes / 60) * 10) / 10;
                  const effectiveHours =
                    Math.round(
                      (actor.financialBreakdown.effectiveLineDowntimeMinutes / 60) * 10,
                    ) / 10;

                  return (
                    <TableRow key={actor.assetId}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-muted-foreground text-[11px]">
                            #{toPersianDigits(idx + 1)}
                          </span>
                          <Link
                            href={`/assets/${actor.assetId}`}
                            className="font-bold text-xs text-foreground hover:text-primary"
                          >
                            {actor.assetName}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({actor.assetCode})
                          </span>
                          <Badge
                            variant={
                              actor.topologyType === 'BOTTLENECK'
                                ? 'destructive'
                                : actor.topologyType === 'BUFFERED'
                                  ? 'info'
                                  : 'secondary'
                            }
                            className="text-[10px] px-1.5 py-0"
                          >
                            {TOPOLOGY_LABELS_FA[actor.topologyType]}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="font-bold text-amber-400">
                          {toPersianDigits(hours)} ساعت ({toPersianDigits(actor.incidentCount)} توقف)
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          خواب مؤثر خط: {toPersianDigits(effectiveHours)} ساعت
                        </div>
                      </TableCell>

                      <TableCell className="font-mono">
                        <div className="text-xs font-bold text-red-400">
                          {formatRialsFa(actor.totalFinancialLossRials)} ریال
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          معادل {formatRialsFa(Math.round(actor.totalFinancialLossRials / 10))} تومان
                        </div>
                      </TableCell>

                      <TableCell className="text-left">
                        <DowntimeCostBreakdownModal
                          assetName={actor.assetName}
                          assetCode={actor.assetCode}
                          breakdown={actor.financialBreakdown}
                          contextTitle={`تجمیع ${toPersianDigits(actor.incidentCount)} رخداد توقف در بازه گزارش`}
                          triggerLabel="شفافیت فرمول محاسبه ضرر (ریز فاکتور)"
                          compactTrigger
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
