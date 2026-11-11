'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  History,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { formatJalaliDateTime, toPersianDigits } from '@cmms/core/i18n';
import type { QualityScorecard as QualityScorecardData } from '@cmms/core';
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

interface QualityScorecardProps {
  scorecard: QualityScorecardData;
}

export function QualityScorecard({ scorecard }: QualityScorecardProps) {
  const [activeTab, setActiveTab] = useState<'ftfr' | 'suspicious'>('ftfr');

  const overallFtfr = scorecard.overallFtfrPercent;
  const isFtfrGood = overallFtfr >= 85;
  const suspiciousCount = scorecard.suspiciousInspections.length;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-400" />
              <CardTitle className="text-base font-bold">
                کارنامه کیفیت تعمیرات و سلامت بازرسی‌ها (FTFR & Integrity)
              </CardTitle>
              <Badge
                variant={isFtfrGood ? 'success' : 'warning'}
                className="font-mono text-xs"
              >
                FTFR کل: {toPersianDigits(overallFtfr)}٪
              </Badge>
            </div>
            <CardDescription className="text-xs">
              پایش نرخ تعمیر موفق بار اول (First-Time Fix Rate) و شناسایی هوشمند تیک‌زدن‌های صوری چک‌لیست (Pencil-Whipping)
            </CardDescription>
          </div>

          {/* Tab Controls */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'ftfr' ? 'default' : 'ghost'}
              className="text-xs h-8 px-3 gap-1.5"
              onClick={() => setActiveTab('ftfr')}
            >
              <Wrench className="h-3.5 w-3.5 text-primary" />
              شاخص FTFR تکنسین‌ها
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'suspicious' ? 'default' : 'ghost'}
              className="text-xs h-8 px-3 gap-1.5"
              onClick={() => setActiveTab('suspicious')}
            >
              <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
              هشدارهای بازرسی صوری
              {suspiciousCount > 0 && (
                <span className="ms-1 rounded-full bg-red-500/20 text-red-300 px-1.5 py-0.2 text-[10px] font-mono">
                  {toPersianDigits(suspiciousCount)}
                </span>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              میانگین نرخ تعمیر بار اول کارخانه:
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {toPersianDigits(overallFtfr)}٪
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              هدف استاندارد قابلیت اطمینان: بالای ۹۰٪
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
              تعداد دستورکارهای تکرار خرابی (Rework):
            </div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {toPersianDigits(scorecard.reworkWorkOrderIds.length)} مورد
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              تکرار خرابی کمتر از ۷۲ ساعت پس از تعمیر قبلی
            </div>
          </div>

          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <div className="text-red-300 flex items-center gap-1.5">
              <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
              موارد مشکوک به تیک‌زدن صوری:
            </div>
            <div className="text-xl font-bold font-mono text-red-400 mt-1">
              {toPersianDigits(suspiciousCount)} چک‌لیست
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              اجرا در کمتر از ۳۰٪ زمان یا کپی برابر اصل ۳ دوره
            </div>
          </div>
        </div>

        {/* Tab 1: Technician FTFR Scorecard Table */}
        {activeTab === 'ftfr' && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              شاخص FTFR (First-Time Fix Rate) نشان‌دهنده درصد تعمیراتی است که پس از ترخیص، حداقل تا ۷۲ ساعت مجدداً دچار خرابی در همان قطعه نشده‌اند:
            </div>

            {scorecard.technicians.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                هنوز تعمیری با ثبت کدهای ۳ لایه‌ای توسط تکنسین‌ها تکمیل نشده است.
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-right">نام تکنسین</TableHead>
                      <TableHead className="text-right">کل تعمیرات انجام‌شده</TableHead>
                      <TableHead className="text-right">تعمیر موفق بار اول</TableHead>
                      <TableHead className="text-right">خرابی مجدد (Rework {'<'} ۷۲h)</TableHead>
                      <TableHead className="text-right">درصد کیفیت FTFR</TableHead>
                      <TableHead className="text-left">ارزیابی عملکرد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scorecard.technicians.map((tech) => {
                      const isHigh = tech.ftfrPercent >= 90;
                      const isMed = tech.ftfrPercent >= 70 && tech.ftfrPercent < 90;

                      return (
                        <TableRow key={tech.technicianId}>
                          <TableCell className="font-semibold text-xs text-foreground">
                            {tech.technicianName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {toPersianDigits(tech.totalCompletedRepairs)} دستورکار
                          </TableCell>
                          <TableCell className="font-mono text-xs text-emerald-400">
                            {toPersianDigits(tech.firstTimeFixCount)} موفق
                          </TableCell>
                          <TableCell className="font-mono text-xs text-amber-400">
                            {toPersianDigits(tech.reworkCount)} بار
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold">
                            <div className="flex items-center gap-2">
                              <span>{toPersianDigits(tech.ftfrPercent)}٪</span>
                              <div className="w-16 h-2 bg-muted/60 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${Math.max(5, tech.ftfrPercent)}%` }}
                                  className={`h-full rounded-full ${
                                    isHigh
                                      ? 'bg-emerald-500'
                                      : isMed
                                        ? 'bg-amber-400'
                                        : 'bg-red-500'
                                  }`}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <Badge
                              variant={isHigh ? 'success' : isMed ? 'warning' : 'destructive'}
                              className="text-[10px]"
                            >
                              {isHigh ? 'عالی و پایدار' : isMed ? 'قابل قبول' : 'نیازمند آموزش فنی'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Pencil-Whipping Suspicious Inspections */}
        {activeTab === 'suspicious' && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              الگوریتم ضدتیک‌زدن صوری بازرسی‌های زیر را به دلیل ثبت در زمان غیرواقعی یا کپی کامل داده‌های دوره‌های قبل پرچم‌گذاری کرده است:
            </div>

            {scorecard.suspiciousInspections.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>تمامی بازرسی‌های ثبت‌شده دارای الگوی زمانی و انحراف معیار طبیعی هستند و تخلفی ثبت نشده است.</span>
              </div>
            ) : (
              <div className="rounded-xl border border-red-500/40 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-500/10">
                      <TableHead className="text-right">دستورکار / تجهیز</TableHead>
                      <TableHead className="text-right">تکنسین بازرس</TableHead>
                      <TableHead className="text-right">زمان ثبت (شمسی)</TableHead>
                      <TableHead className="text-right">علت تشخیص تیک‌زدن صوری</TableHead>
                      <TableHead className="text-left">اقدام</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scorecard.suspiciousInspections.map((item) => (
                      <TableRow key={item.workOrderId} className="hover:bg-red-500/5">
                        <TableCell>
                          <Link
                            href={`/work-orders/${item.workOrderId}`}
                            className="font-semibold text-xs text-primary hover:underline block"
                          >
                            {item.title}
                          </Link>
                          <span className="text-[11px] text-muted-foreground">
                            {item.assetName} (<bdi className="font-mono">{item.assetCode}</bdi>)
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.technicianName ?? 'تکنسین نامشخص'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatJalaliDateTime(item.completedAt)}
                        </TableCell>
                        <TableCell className="text-xs text-red-300 font-medium">
                          {item.reasonFa}
                        </TableCell>
                        <TableCell className="text-left">
                          <Button asChild size="sm" variant="outline" className="text-xs h-7">
                            <Link href={`/work-orders/${item.workOrderId}`}>
                              بررسی چک‌لیست
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
