import Link from 'next/link';
import { listWorkOrders, formatJalaliDateTime } from '@cmms/core';
import {
  QrCode,
  Wrench,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Clock,
  LayoutDashboard,
} from 'lucide-react';
import { getServerContext } from '@/lib/server-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OfflineSyncBanner } from '@/components/pwa/offline-sync-banner';
import fa from '@/messages/fa.json';

export const dynamic = 'force-dynamic';

export default async function TechnicianMobileWorkOrdersPage() {
  const { ctx, sessionUser } = await getServerContext();
  const orders = await listWorkOrders(ctx);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 max-w-xl mx-auto space-y-4 pb-16">
      {/* Mobile Industrial Top Header */}
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-base">پنل همراه تکنسین نت (PWA)</h1>
            <p className="text-xs text-muted-foreground">
              {sessionUser ? sessionUser.fullName : 'تکنسین شیفت سالن تولید'}
            </p>
          </div>
        </div>

        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <LayoutDashboard className="h-4 w-4 me-1.5" />
            میزکار اصلی
          </Link>
        </Button>
      </header>

      <OfflineSyncBanner />

      {/* Big Glove-Friendly QR Scanner Action */}
      <Button asChild size="industrial" variant="secondary" className="w-full justify-between">
        <Link href="/m/scan">
          <span className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            اسکن پلاک QR دستگاه و ثبت کارکرد کنتور
          </span>
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>

      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-muted-foreground">
            دستورکارهای فعال و تخصیص‌یافته ({orders.length.toLocaleString('fa-IR')} مورد)
          </h2>
        </div>

        {orders.map((wo) => {
          const isDone = wo.status === 'DONE';
          const isOverdue = wo.status === 'OVERDUE';
          const statusLabel = fa.status[wo.status as keyof typeof fa.status] ?? wo.status;

          return (
            <Card
              key={wo.id}
              className={
                isOverdue
                  ? 'border-red-500/50 bg-red-500/5'
                  : isDone
                    ? 'border-emerald-500/30 opacity-85'
                    : ''
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        isOverdue ? 'destructive' : isDone ? 'success' : 'info'
                      }
                    >
                      {statusLabel}
                    </Badge>
                    {wo.requiresLoto && (
                      <Badge variant="destructive" className="gap-1">
                        <Lock className="h-3 w-3" />
                        LOTO الزامی
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                    {wo.assetCode}
                  </span>
                </div>
                <CardTitle className="text-base pt-1">{wo.title}</CardTitle>
                <CardDescription className="text-xs font-medium text-foreground/90">
                  دستگاه: {wo.assetName}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    مهلت: {formatJalaliDateTime(wo.dueAt)}
                  </span>
                  <span>
                    {wo.checklistSnapshot.length.toLocaleString('fa-IR')} گام چک‌لیست
                  </span>
                </div>

                <Button
                  asChild
                  size="industrial"
                  variant={isDone ? 'outline' : 'default'}
                  className="w-full"
                >
                  <Link href={`/m/work-orders/${wo.id}`}>
                    {isDone ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 me-2 text-emerald-400" />
                        مشاهده سابقه دستورکار تکمیل‌شده
                      </>
                    ) : (
                      <>
                        اجرای دستورکار، تایید LOTO و چک‌لیست
                        <ArrowLeft className="h-5 w-5 ms-2" />
                      </>
                    )}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
