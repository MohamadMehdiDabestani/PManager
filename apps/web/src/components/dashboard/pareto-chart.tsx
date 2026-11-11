'use client';

import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Clock,
  Coins,
  Info,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { formatRialsFa } from '@cmms/core/financial-downtime';
import { toPersianDigits } from '@cmms/core/i18n';
import type { ParetoAnalysis, ParetoPoint } from '@cmms/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';

interface ParetoChartProps {
  pareto: ParetoAnalysis;
}

export function ParetoChart({ pareto }: ParetoChartProps) {
  const [metric, setMetric] = useState<'loss' | 'downtime'>('loss');
  const [activeItem, setActiveItem] = useState<ParetoPoint | null>(null);

  const points = metric === 'loss' ? pareto.byLossRials : pareto.byDowntimeHours;
  const topPoints = points.slice(0, 8); // Top 8 items for clean legibility

  const chartConfig = {
    value: {
      label: metric === 'loss' ? 'خسارت مالی (ریال)' : 'ساعت توقف (h)',
      color: metric === 'loss' ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-2))',
    },
    cumulativePercent: {
      label: 'درصد تجمعی (٪)',
      color: '#38bdf8',
    },
  } satisfies ChartConfig;

  const chartData = topPoints.map((p) => ({
    key: p.key,
    shortName: p.labelFa.split('←')[0]?.trim() || p.labelFa,
    fullName: p.labelFa,
    value: p.value,
    cumulativePercent: p.cumulativePercent,
    withinVitalFew: p.withinVitalFew,
    incidentCount: p.incidentCount,
    rawPoint: p,
  }));

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-base font-bold">
                نمودار پارتو علل ریشه‌ای خرابی (قانون ۸۰/۲۰ پارتو)
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                shadcn Chart
              </Badge>
            </div>
            <CardDescription className="text-xs">
              تمرکز روی ۲۰٪ علل ریشه‌ای که مسبب ۸۰٪ ضرر مالی یا خواب خط تولید در کارخانه هستند.
            </CardDescription>
          </div>

          {/* Metric Toggle Buttons */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={metric === 'loss' ? 'default' : 'ghost'}
              className="text-xs h-8 px-3 gap-1.5"
              onClick={() => {
                setMetric('loss');
                setActiveItem(null);
              }}
            >
              <Coins className="h-3.5 w-3.5 text-amber-300" />
              پارتو بر اساس ضرر ریالی
            </Button>
            <Button
              type="button"
              size="sm"
              variant={metric === 'downtime' ? 'default' : 'ghost'}
              className="text-xs h-8 px-3 gap-1.5"
              onClick={() => {
                setMetric('downtime');
                setActiveItem(null);
              }}
            >
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              پارتو بر اساس ساعت توقف
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {points.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            داده‌ای از خرابی‌های ثبت‌شده با کد علل ۳ لایه‌ای در این بازه یافت نشد.
          </div>
        ) : (
          <>
            {/* Summary Highlights Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-muted-foreground flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-red-400" />
                  مجموع خسارت در تحلیل پارتو:
                </div>
                <div className="text-base font-bold font-mono text-red-400 mt-1">
                  {formatRialsFa(pareto.totalLossRials)} ریال
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-sky-400" />
                  مجموع ساعت خواب تجهیزات:
                </div>
                <div className="text-base font-bold font-mono text-sky-400 mt-1">
                  {toPersianDigits(pareto.totalDowntimeHours)} ساعت
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  معدود حیاتی (Vital Few ۸۰٪):
                </div>
                <div className="text-xs text-foreground font-semibold mt-1">
                  {toPersianDigits(points.filter((p) => p.withinVitalFew).length)} عامل اول مسئول بخش اعظم خسارت هستند.
                </div>
              </div>
            </div>

            {/* shadcn Chart Container with ComposedChart (Bars + Cumulative Line) */}
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <ChartContainer config={chartConfig} className="h-72 w-full aspect-auto">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 20, bottom: 25, left: 20 }}
                  onClick={(state: any) => {
                    const activePayload = state?.activePayload?.[0]?.payload;
                    if (activePayload?.rawPoint) {
                      setActiveItem(activePayload.rawPoint as ParetoPoint);
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    className="stroke-border/40"
                  />
                  <XAxis
                    dataKey="shortName"
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={40}
                  />
                  {/* Left Y-Axis: Loss Rials or Downtime Hours */}
                  <YAxis
                    yAxisId="left"
                    orientation="right"
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickFormatter={(val: number) => {
                      if (metric === 'loss') {
                        if (val >= 1_000_000_000) {
                          return `${toPersianDigits(Math.round(val / 1_000_000_000))} B`;
                        }
                        if (val >= 1_000_000) {
                          return `${toPersianDigits(Math.round(val / 1_000_000))} M`;
                        }
                        return toPersianDigits(val);
                      }
                      return `${toPersianDigits(val)} h`;
                    }}
                  />
                  {/* Right Y-Axis: Cumulative Percentage (0 to 100%) */}
                  <YAxis
                    yAxisId="right"
                    orientation="left"
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickFormatter={(val: number) => `${toPersianDigits(val)}٪`}
                  />
                  {/* 80% Pareto Reference Line */}
                  <ReferenceLine
                    y={80}
                    yAxisId="right"
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: 'آستانه ۸۰٪ پارتو',
                      fill: '#ef4444',
                      fontSize: 10,
                      position: 'insideTopLeft',
                    }}
                  />
                  {/* Custom shadcn Tooltip */}
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]?.payload as (typeof chartData)[number];
                      if (!data) return null;

                      return (
                        <div className="rounded-lg border border-border bg-card p-3 shadow-xl text-xs space-y-2 max-w-xs">
                          <div className="font-bold text-foreground border-b border-border pb-1.5">
                            {data.fullName}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-muted-foreground">
                            <span>{metric === 'loss' ? 'خسارت مالی:' : 'ساعت توقف:'}</span>
                            <span className="font-bold font-mono text-foreground">
                              {metric === 'loss'
                                ? `${formatRialsFa(data.value)} ریال`
                                : `${toPersianDigits(data.value)} ساعت`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-muted-foreground">
                            <span>درصد تجمعی:</span>
                            <span className="font-bold font-mono text-sky-400">
                              {toPersianDigits(data.cumulativePercent)}٪
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-muted-foreground">
                            <span>تعداد توقف:</span>
                            <span className="font-mono text-foreground">
                              {toPersianDigits(data.incidentCount)} رخداد
                            </span>
                          </div>
                          <div className="pt-1">
                            {data.withinVitalFew ? (
                              <Badge variant="destructive" className="text-[10px] py-0 px-2">
                                جزء ۲۰٪ علل بحرانی (Vital Few)
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] py-0 px-2">
                                علت فرعی (Useful Many)
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* Bars */}
                  <Bar
                    yAxisId="left"
                    dataKey="value"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={
                          entry.withinVitalFew
                            ? metric === 'loss'
                              ? '#f59e0b' // amber-500
                              : '#38bdf8' // sky-400
                            : '#64748b' // slate-500
                        }
                        className="cursor-pointer transition-opacity hover:opacity-80"
                      />
                    ))}
                  </Bar>
                  {/* Cumulative Percentage Line */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulativePercent"
                    stroke="#0284c7"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#0284c7' }}
                  />
                </ComposedChart>
              </ChartContainer>

              {/* Legend Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-4 border-t border-border/60 mt-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-amber-500" />
                    <span>معدود حیاتی (مشمول قانون ۸۰٪)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-slate-500" />
                    <span>سایر علل فرعی</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400 border border-white" />
                    <span>منحنی درصد تجمعی پارتو</span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  * با کلیک روی هر ستون یا سطر جدول، جزئیات آن علت نمایش داده می‌شود.
                </div>
              </div>
            </div>

            {/* Selected Cause Detail Inspector Card */}
            {activeItem && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-2 animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      جزئیات علت منتخب: {activeItem.labelFa}
                    </span>
                  </div>
                  {activeItem.withinVitalFew ? (
                    <Badge variant="destructive" className="text-xs">
                      علت گلوگاهی (بخش ۲۰٪ حیاتی)
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      علت با اولویت ثانویه
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-muted-foreground">خسارت مالی برآوردی: </span>
                    <span className="font-mono font-bold text-foreground">
                      {formatRialsFa(activeItem.lossRials)} ریال
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ساعت خواب: </span>
                    <span className="font-mono font-bold text-foreground">
                      {toPersianDigits(activeItem.downtimeHours)} ساعت
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">سهم از کل: </span>
                    <span className="font-mono font-bold text-amber-400">
                      {toPersianDigits(activeItem.percent)}٪
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">درصد تجمعی: </span>
                    <span className="font-mono font-bold text-sky-400">
                      {toPersianDigits(activeItem.cumulativePercent)}٪
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pareto Ranking Table */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-bold text-foreground">
                  جدول تفکیک علل خرابی و محاسبه تجمعی قانون ۸۰/۲۰
                </h4>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رتبه</TableHead>
                      <TableHead className="text-right">قطعه معیوب ← علت ریشه‌ای</TableHead>
                      <TableHead className="text-right">تعداد رخداد</TableHead>
                      <TableHead className="text-right">
                        {metric === 'loss' ? 'خسارت مالی (ریال)' : 'ساعت خواب'}
                      </TableHead>
                      <TableHead className="text-right">سهم درصدی</TableHead>
                      <TableHead className="text-right">درصد تجمعی</TableHead>
                      <TableHead className="text-right">اولویت پارتو</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {points.map((point, idx) => {
                      const isVital = point.withinVitalFew;
                      const isSelected = activeItem?.key === point.key;

                      return (
                        <TableRow
                          key={point.key}
                          onClick={() => setActiveItem(point)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary/10'
                              : isVital
                                ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                : 'hover:bg-muted/40'
                          }`}
                        >
                          <TableCell className="font-mono text-xs font-bold">
                            #{toPersianDigits(idx + 1)}
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            {point.labelFa}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {toPersianDigits(point.incidentCount)}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold">
                            {metric === 'loss'
                              ? `${formatRialsFa(point.value)} ریال`
                              : `${toPersianDigits(point.value)} ساعت`}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-amber-400">
                            {toPersianDigits(point.percent)}٪
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-sky-400">
                            {toPersianDigits(point.cumulativePercent)}٪
                          </TableCell>
                          <TableCell>
                            {isVital ? (
                              <Badge
                                variant="destructive"
                                className="text-[11px] font-medium"
                              >
                                حیاتی (۲۰٪ اول)
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="text-[11px] font-medium"
                              >
                                فرعی
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
