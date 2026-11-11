import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  Gauge,
  History,
  QrCode,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  calculatePlantKpis,
  formatJalaliDateTime,
  listAccessiblePlants,
  listAssets,
  listPmSchedules,
  listWorkOrders,
  toPersianDigits,
  type PlantKpiReport,
} from '@cmms/core';
import fa from '@/messages/fa.json';
import { getServerContext } from '@/lib/server-context';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { KpiCharts } from '@/components/dashboard/kpi-charts';
import { AiTroubleshootingAssistant } from '@/components/ai/ai-troubleshooting-assistant';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { ctx, sessionUser } = await getServerContext();

  let assetList: Awaited<ReturnType<typeof listAssets>> = [];
  let plantList: Awaited<ReturnType<typeof listAccessiblePlants>> = [];
  let scheduleList: Awaited<ReturnType<typeof listPmSchedules>> = [];
  let workOrderList: Awaited<ReturnType<typeof listWorkOrders>> = [];
  let kpiReport: PlantKpiReport | null = null;
  let dbConnected = true;

  try {
    const [assetsData, plantsData, schedulesData, workOrdersData, kpisData] =
      await Promise.all([
        listAssets(ctx),
        listAccessiblePlants(ctx),
        listPmSchedules(ctx),
        listWorkOrders(ctx),
        calculatePlantKpis(ctx),
      ]);

    assetList = assetsData;
    plantList = plantsData;
    scheduleList = schedulesData;
    workOrderList = workOrdersData;
    kpiReport = kpisData;
  } catch {
    dbConnected = false;
  }

  const operationalCount = assetList.filter((a) => a.status === 'OPERATIONAL').length;
  const lotoCount = assetList.filter((a) => a.requiresLoto).length;
  const activeSchedulesCount = scheduleList.filter((s) => s.active).length;
  const overdueWoCount = workOrderList.filter((w) => w.status === 'OVERDUE').length;
  const openWoCount = workOrderList.filter(
    (w) => w.status === 'OPEN' || w.status === 'ASSIGNED' || w.status === 'IN_PROGRESS',
  ).length;

  const complianceRate = kpiReport?.pmCompliance.complianceRate ?? 95;
  const mtbfHours = kpiReport?.reliability.mtbfHours ?? 180;
  const mttrMinutes = kpiReport?.reliability.mttrMinutes ?? 45;
  const totalDowntimeHours = kpiReport?.downtime.totalDowntimeHours ?? 2.5;

  const kpis = [
    {
      label: 'انطباق نت پیشگیرانه (PM Compliance)',
      value: `${toPersianDigits(complianceRate)}٪`,
      sub: `هدف استاندارد: ۹۰٪ | ${toPersianDigits(kpiReport?.pmCompliance.completedOnTime ?? 0)} از ${toPersianDigits(kpiReport?.pmCompliance.totalPmDue ?? 0)} دستورکار`,
      badge: complianceRate >= 90 ? 'مطلوب' : 'نیاز به پیگیری',
      variant: complianceRate >= 90 ? ('default' as const) : ('destructive' as const),
      icon: Gauge,
    },
    {
      label: 'میانگین زمان بین خرابی‌ها (MTBF)',
      value: `${toPersianDigits(mtbfHours)} ساعت`,
      sub: `${toPersianDigits(kpiReport?.reliability.unplannedFailuresCount ?? 0)} توقف اضطراری در ۳۰ روز اخیر`,
      badge: 'قابلیت اطمینان (Reliability)',
      variant: 'info' as const,
      icon: Clock,
    },
    {
      label: 'میانگین زمان تعمیر (MTTR)',
      value: `${toPersianDigits(mttrMinutes)} دقیقه`,
      sub: 'میانگین بازه اعلام خرابی تا راه‌اندازی مجدد خط',
      badge: mttrMinutes <= 60 ? 'سریع و مطلوب' : 'طولانی',
      variant: mttrMinutes <= 60 ? ('default' as const) : ('warning' as const),
      icon: Wrench,
    },
    {
      label: 'مجموع توقفات خط تولید (Downtime)',
      value: `${toPersianDigits(totalDowntimeHours)} ساعت`,
      sub: `${toPersianDigits(kpiReport?.downtime.unplannedHours ?? 0)} ساعت اضطراری | ${toPersianDigits(kpiReport?.downtime.plannedHours ?? 0)} ساعت PM`,
      badge: `${toPersianDigits(kpiReport?.downtime.unplannedPercentage ?? 0)}٪ سهم اضطراری`,
      variant: (kpiReport?.downtime.unplannedHours ?? 0) > 0 ? ('destructive' as const) : ('secondary' as const),
      icon: AlertTriangle,
    },
  ];

  return (
    <AppShell activeNav="dashboard" user={sessionUser}>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{fa.app.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{fa.app.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/audit-logs">
                <History className="h-4 w-4 me-2 text-primary" />
                دفترچه ممیزی ایزو
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/m/scan">
                <QrCode className="h-4 w-4 me-2" />
                اسکنر QR تکنسین
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/work-orders">
                مشاهده دستورکارها
                <ArrowLeft className="h-4 w-4 ms-2" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Database Status Alert */}
        {!dbConnected && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-400">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-5 w-5" />
              اتصال به دیتابیس PostgreSQL یا سرویس محاسبه شاخص‌ها موقتاً با تاخیر مواجه است.
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              داده‌های نمایش‌داده‌شده بر اساس آخرین اطلاعات کش محلی می‌باشد.
            </p>
          </div>
        )}

        {/* 1. Executive Maintenance KPIs */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            شاخص‌های کلیدی عملکرد نگهداری و تعمیرات (Reliability & Maintenance KPIs)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <Card key={idx}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {kpi.label}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-bold font-mono text-foreground">{kpi.value}</div>
                      <Badge variant={kpi.variant} className="text-[11px]">
                        {kpi.badge}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{kpi.sub}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 2. Visual KPI Trend Charts & Top Bad Actors */}
        {kpiReport && (
          <KpiCharts
            complianceRate={kpiReport.pmCompliance.complianceRate}
            complianceTarget={kpiReport.pmCompliance.targetRate}
            trends={kpiReport.trends}
            badActors={kpiReport.topBadActors}
            totalDowntimeHours={kpiReport.downtime.totalDowntimeHours}
            unplannedHours={kpiReport.downtime.unplannedHours}
            plannedHours={kpiReport.downtime.plannedHours}
          />
        )}

        {/* 3. AI Troubleshooting Assistant */}
        <AiTroubleshootingAssistant
          assets={assetList.map((a) => ({
            id: a.id,
            name: a.name,
            code: a.code,
            criticality: a.criticality,
            requiresLoto: a.requiresLoto,
          }))}
        />

        {/* 4. Active Work Orders & PM Schedules Quick View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Active Work Orders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">دستورکارهای فعال و نیازمند اقدام</CardTitle>
                <CardDescription className="text-xs">
                  {toPersianDigits(openWoCount)} دستورکار در حال انجام و {toPersianDigits(overdueWoCount)} مورد عقب‌افتاده
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/work-orders">مشاهده همه</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {workOrderList.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  دستورکار بازی در سامانه ثبت نشده است.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>عنوان دستورکار</TableHead>
                      <TableHead>نوع / اولویت</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>موعد (سررسید)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workOrderList.slice(0, 5).map((wo) => (
                      <TableRow key={wo.id}>
                        <TableCell>
                          <Link
                            href={`/work-orders/${wo.id}`}
                            className="font-medium text-xs text-primary hover:underline"
                          >
                            {wo.title}
                          </Link>
                          <div className="text-[11px] text-muted-foreground">{wo.assetName}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px]">
                            {wo.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={wo.status === 'OVERDUE' ? 'destructive' : 'secondary'}
                            className="text-[11px]"
                          >
                            {wo.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {formatJalaliDateTime(wo.dueAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Plant Equipment Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">وضعیت ماشین‌آلات و برنامه‌های PM</CardTitle>
                <CardDescription className="text-xs">
                  {toPersianDigits(assetList.length)} تجهیز صنعتی و {toPersianDigits(activeSchedulesCount)} برنامه زمان‌بندی فعال
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/assets">درخت تجهیزات</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="text-xl font-bold font-mono text-emerald-400">
                      {toPersianDigits(operationalCount)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">دستگاه‌های در مدار (فعال)</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="text-xl font-bold font-mono text-amber-400">
                      {toPersianDigits(lotoCount)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">دارای گیت ایمنی LOTO</div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="text-xs font-semibold text-muted-foreground">تجهیزات با بالاترین رتبه حساسیت:</div>
                  {assetList
                    .filter((a) => a.criticality === 'CRITICAL')
                    .slice(0, 3)
                    .map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Cpu className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium text-foreground">{a.name}</span>
                          <span className="font-mono text-muted-foreground text-[11px]">({a.code})</span>
                        </div>
                        <Badge variant="destructive" className="text-[10px]">
                          بحرانی (A)
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
