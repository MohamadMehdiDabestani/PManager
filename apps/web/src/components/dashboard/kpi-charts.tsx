'use client';

import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
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
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';

interface KpiChartsProps {
  complianceRate: number;
  complianceTarget: number;
  trends: PeriodTrendBucket[];
  badActors: BadActorAsset[];
  totalDowntimeHours: number;
  unplannedHours: number;
  plannedHours: number;
}

const complianceChartConfig = {
  complianceRate: {
    label: 'انطباق PM (٪)',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

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
      {/* 1. PM Compliance Trend Chart with shadcn Chart */}
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
              هدف: {toPersianDigits(complianceTarget)}٪
            </Badge>
          </div>
          <CardDescription className="text-xs">
            نسبت دستورکارهای PM انجام‌شده در موعد به کل دستورکارهای سررسیدشده
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full">
            <ChartContainer config={complianceChartConfig} className="h-44 w-full aspect-auto">
              <BarChart
                data={trends}
                margin={{ top: 10, right: 10, bottom: 5, left: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/40"
                />
                <XAxis
                  dataKey="periodLabel"
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickFormatter={(val: number) => `${toPersianDigits(val)}٪`}
                />
                <ReferenceLine
                  y={complianceTarget}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={{
                    value: `هدف: ${toPersianDigits(complianceTarget)}٪`,
                    fill: 'hsl(var(--primary))',
                    fontSize: 10,
                    position: 'insideTopLeft',
                  }}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const bucket = payload[0]?.payload as PeriodTrendBucket;
                    if (!bucket) return null;

                    return (
                      <div className="rounded-lg border border-border bg-card p-2.5 shadow-xl text-xs space-y-1">
                        <div className="font-bold text-foreground">{bucket.periodLabel}</div>
                        <div className="flex items-center justify-between gap-3 text-muted-foreground">
                          <span>انطباق نت پیشگیرانه:</span>
                          <span className="font-bold font-mono text-primary">
                            {toPersianDigits(bucket.complianceRate)}٪
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-muted-foreground">
                          <span>انجام به‌موقع:</span>
                          <span className="font-mono text-foreground">
                            {toPersianDigits(bucket.completedOnTime)} از {toPersianDigits(bucket.totalPmDue)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="complianceRate"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                >
                  {trends.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.complianceRate >= complianceTarget
                          ? 'hsl(var(--primary))'
                          : '#f59e0b'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span>موفق (بالای ۹۰٪)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>نیاز به پیگیری (زیر ۹۰٪)</span>
            </div>
            <div className="font-bold text-foreground">
              میانگین فعلی: {toPersianDigits(complianceRate)}٪
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
                  <TableHead className="text-right">مجموع توقف</TableHead>
                  <TableHead className="text-right">خسارت مالی (ریال)</TableHead>
                  <TableHead className="text-right">تحلیل هزینه</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badActors.map((actor, idx) => {
                  const hours = Math.round((actor.totalDowntimeMinutes / 60) * 10) / 10;
                  const effectiveHours = Math.round(
                    ((actor.financialBreakdown?.effectiveLineDowntimeMinutes ?? actor.totalDowntimeMinutes) / 60) * 10
                  ) / 10;
                  const barWidth = Math.max(
                    12,
                    Math.round((actor.totalDowntimeMinutes / maxBadActorMinutes) * 100)
                  );
                  const topologyKind = (actor.topologyType || 'BOTTLENECK') as AssetTopologyKind;
                  const topologyLabel = TOPOLOGY_LABELS_FA[topologyKind] ?? actor.topologyType;

                  return (
                    <TableRow key={actor.assetId}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{toPersianDigits(idx + 1)}
                            </span>
                            <Link
                              href={`/assets/${actor.assetId}`}
                              className="font-medium text-xs hover:text-primary transition-colors"
                            >
                              {actor.assetName}
                            </Link>
                            <Badge
                              variant={
                                topologyKind === 'BOTTLENECK'
                                  ? 'destructive'
                                  : topologyKind === 'BUFFERED'
                                    ? 'secondary'
                                    : 'outline'
                              }
                              className="text-[10px] px-1.5 py-0"
                            >
                              {topologyLabel}
                            </Badge>
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground block">
                            {actor.assetCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {toPersianDigits(hours)} ساعت ({toPersianDigits(actor.incidentCount)} توقف)
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            خواب مؤثر خط: {toPersianDigits(effectiveHours)} ساعت
                          </span>
                          <div className="w-24 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                            <div
                              style={{ width: `${barWidth}%` }}
                              className="h-full bg-amber-500 rounded-full"
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs font-bold text-red-400">
                            {formatRialsFa(actor.totalFinancialLossRials)}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">ریال</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DowntimeCostBreakdownModal
                          breakdown={actor.financialBreakdown}
                          assetName={actor.assetName}
                          assetCode={actor.assetCode}
                          contextTitle={`تجمیع ${toPersianDigits(actor.incidentCount)} رخداد توقف در بازه گزارش`}
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
