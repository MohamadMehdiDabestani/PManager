import Link from 'next/link';
import { listWorkOrders, formatJalaliDateTime } from '@cmms/core';
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  CalendarClock,
  Smartphone,
  Lock,
} from 'lucide-react';
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
import fa from '@/messages/fa.json';

export const dynamic = 'force-dynamic';

const statusVariants: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
> = {
  OPEN: 'info',
  ASSIGNED: 'default',
  IN_PROGRESS: 'warning',
  ON_HOLD: 'secondary',
  DONE: 'success',
  CANCELLED: 'outline',
  OVERDUE: 'destructive',
};

const priorityBadges = {
  LOW: { label: 'کم', variant: 'secondary' as const },
  MEDIUM: { label: 'متوسط', variant: 'info' as const },
  HIGH: { label: 'مهم', variant: 'warning' as const },
  URGENT: { label: 'فوری / بحرانی', variant: 'destructive' as const },
};

export default async function WorkOrdersPage() {
  const { ctx, sessionUser } = await getServerContext();
  const orders = await listWorkOrders(ctx);

  const openOrAssigned = orders.filter(
    (o) => o.status === 'OPEN' || o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS',
  ).length;
  const overdueCount = orders.filter((o) => o.status === 'OVERDUE').length;
  const doneCount = orders.filter((o) => o.status === 'DONE').length;

  return (
    <AppShell activeNav="work-orders" user={sessionUser}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <ClipboardList className="h-6 w-6 text-primary" />
            فهرست دستورکارهای نت (Work Orders)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            دستورکارهای صادرشده خودکار توسط موتور زمان‌بندی PM به همراه اسنپ‌شات چک‌لیست و وضعیت پایش تاخیر
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="secondary">
            <Link href="/m/work-orders">
              <Smartphone className="h-4 w-4 me-2 text-primary" />
              پنل همراه و آفلاین تکنسین (PWA)
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pm-schedules">
              <CalendarClock className="h-4 w-4 me-2" />
              مدیریت برنامه‌های زمان‌بندی PM
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-sky-400" />
              در جریان / باز
            </CardDescription>
            <CardTitle className="text-2xl text-sky-400">
              {openOrAssigned.toLocaleString('fa-IR')} دستورکار
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              عقب‌افتاده (Overdue)
            </CardDescription>
            <CardTitle className="text-2xl text-red-400">
              {overdueCount.toLocaleString('fa-IR')} دستورکار
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              تکمیل‌شده (Done)
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-400">
              {doneCount.toLocaleString('fa-IR')} دستورکار
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">جدول دستورکارهای فعال و آرشیو</CardTitle>
          <CardDescription>
            هر دستورکار شامل اسنپ‌شات غیرقابل‌تغییر چک‌لیست در لحظه صدور است تا تغییرات بعدی قالب، سوابق ممیزی ایزو را مخدوش نکند.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان دستورکار</TableHead>
                <TableHead>نوع</TableHead>
                <TableHead>تجهیز / کد</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>اولویت</TableHead>
                <TableHead>مسئول اجرا</TableHead>
                <TableHead>چک‌لیست (Snapshot)</TableHead>
                <TableHead>مهلت انجام (جلالی)</TableHead>
                <TableHead className="text-left">عملیات و اجرا</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((wo) => {
                const statusLabel =
                  fa.status[wo.status as keyof typeof fa.status] ?? wo.status;
                const statusVariant = statusVariants[wo.status] ?? 'default';
                const prio = priorityBadges[wo.priority];

                return (
                  <TableRow key={wo.id}>
                    <TableCell>
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="font-semibold hover:text-primary transition-colors block"
                      >
                        {wo.title}
                      </Link>
                      {wo.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {wo.description}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="outline" className="font-mono text-xs">
                          <Wrench className="h-3 w-3 me-1 text-primary" />
                          {wo.type}
                        </Badge>
                        {wo.requiresLoto && (
                          <Badge
                            variant={wo.lotoVerified ? 'success' : 'destructive'}
                            className="text-[10px] gap-1"
                          >
                            <Lock className="h-2.5 w-2.5" />
                            {wo.lotoVerified ? 'LOTO تاییدشد' : 'نیاز به LOTO'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Link
                        href={`/assets/${wo.assetId}`}
                        className="font-medium hover:text-primary transition-colors block"
                      >
                        {wo.assetName}
                      </Link>
                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {wo.assetCode}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={prio.variant}>{prio.label}</Badge>
                    </TableCell>

                    <TableCell className="text-xs">
                      {wo.assigneeName ?? 'تخصیص‌نیافته'}
                    </TableCell>

                    <TableCell className="text-xs">
                      <Badge variant="secondary">
                        {wo.checklistSnapshot.length.toLocaleString('fa-IR')} گام کنترلی
                      </Badge>
                    </TableCell>

                    <TableCell className="font-mono text-xs">
                      {formatJalaliDateTime(wo.dueAt)}
                    </TableCell>

                    <TableCell className="text-left">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/work-orders/${wo.id}`}>
                          اجرا و چک‌لیست
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
