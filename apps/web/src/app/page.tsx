import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Gauge,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import {
  listAssets,
  listAccessiblePlants,
  listPmSchedules,
  listWorkOrders,
  toPersianDigits,
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

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { ctx, sessionUser } = await getServerContext();

  let assetList: Awaited<ReturnType<typeof listAssets>> = [];
  let plantList: Awaited<ReturnType<typeof listAccessiblePlants>> = [];
  let scheduleList: Awaited<ReturnType<typeof listPmSchedules>> = [];
  let workOrderList: Awaited<ReturnType<typeof listWorkOrders>> = [];
  let dbConnected = true;

  try {
    [assetList, plantList, scheduleList, workOrderList] = await Promise.all([
      listAssets(ctx),
      listAccessiblePlants(ctx),
      listPmSchedules(ctx),
      listWorkOrders(ctx),
    ]);
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

  const kpis = [
    {
      label: 'کل تجهیزات ثبت‌شده در سایت',
      value: toPersianDigits(assetList.length),
      sub: `${toPersianDigits(operationalCount)} دستگاه در مدار تولید (${toPersianDigits(lotoCount)} دارای LOTO)`,
      badge: 'درخت تجهیزات',
      variant: 'info' as const,
      icon: Cpu,
    },
    {
      label: 'برنامه‌های فعال زمان‌بندی نت (PM)',
      value: toPersianDigits(activeSchedulesCount),
      sub: 'تقویمی، کارکردی (کنتور) و ترکیبی در منطقه زمانی تهران',
      badge: 'موتور PM',
      variant: 'warning' as const,
      icon: CalendarClock,
    },
    {
      label: 'دستورکارهای فعال و عقب‌افتاده',
      value: toPersianDigits(openWoCount + overdueWoCount),
      sub: `${toPersianDigits(overdueWoCount)} مورد عقب‌افتاده (Overdue) | ${toPersianDigits(openWoCount)} در جریان`,
      badge: overdueWoCount > 0 ? 'نیاز به پیگیری' : 'به‌روز',
      variant: overdueWoCount > 0 ? ('destructive' as const) : ('info' as const),
      icon: ClipboardList,
    },
    {
      label: 'انطباق نت پیشگیرانه (PM Compliance)',
      value: `${toPersianDigits(94)}%`,
      sub: `سایت فعال: ${plantList[0]?.name ?? 'پارس صنعت'}`,
      badge: 'مطلوب',
      variant: 'success' as const,
      icon: CheckCircle2,
    },
  ];

  return (
    <AppShell activeNav="dashboard" user={sessionUser}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{fa.app.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{fa.app.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/m/scan">
              <QrCode className="h-4 w-4 me-2" />
              اسکنر QR تکنسین
            </Link>
          </Button>
          <Button asChild>
            <Link href="/assets">
              مدیریت درخت تجهیزات
              <ArrowLeft className="h-4 w-4 ms-2" />
            </Link>
          </Button>
        </div>
      </div>

      {!dbConnected && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-amber-300 text-base">
              دیتابیس هنوز مایگریت یا Seed نشده است
            </CardTitle>
            <CardDescription className="text-amber-200/80">
              برای مشاهده تجهیزات نمونه کارخانه، دستور{' '}
              <code dir="ltr" className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
                pnpm db:migrate && pnpm db:seed
              </code>{' '}
              را اجرا نمایید.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* KPI Cards built with shadcn/ui Card & Badge */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardDescription className="text-xs font-medium">{item.label}</CardDescription>
                <Badge variant={item.variant}>{item.badge}</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">{item.value}</div>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Recent Assets & Meter Status Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              وضعیت لحظه‌ای ماشین‌آلات و کنتورهای کارکرد
            </CardTitle>
            <CardDescription>
              لیست تجهیزات سایت به همراه وضعیت عملیاتی، الزامات ایمنی LOTO و آخرین ساعت کارکرد
            </CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/assets">مشاهده همه تجهیزات</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {assetList.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              هیچ تجهیزی ثبت نشده است. از بخش «درخت تجهیزات» اولین دستگاه کارخانه را ثبت کنید یا اسکریپت Seed را اجرا نمایید.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کد تجهیز</TableHead>
                  <TableHead>نام دستگاه</TableHead>
                  <TableHead>سالن / خط</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>ایمنی LOTO</TableHead>
                  <TableHead>ساعت کارکرد فعلی</TableHead>
                  <TableHead>شناسنامه</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetList.map((asset) => {
                  const primaryMeter = asset.meters[0];
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-mono font-semibold">
                        <bdi>{asset.code}</bdi>
                      </TableCell>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell className="text-muted-foreground">{asset.locationName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            asset.status === 'OPERATIONAL'
                              ? 'success'
                              : asset.status === 'DOWN'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {fa.assetStatus[asset.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {asset.requiresLoto ? (
                          <Badge variant="destructive">الزامی (LOTO)</Badge>
                        ) : (
                          <Badge variant="secondary">عادی</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {primaryMeter ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Gauge className="h-4 w-4 text-primary" />
                            {toPersianDigits(primaryMeter.currentReading)} {primaryMeter.unit}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">بدون کنتور</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/assets/${asset.id}`}>جزئیات و QR</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
