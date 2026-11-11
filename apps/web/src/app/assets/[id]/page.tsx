import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Gauge,
  Lock,
  QrCode,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  formatRialsFa,
  getAssetById,
  listRecentMeterReadings,
  TOPOLOGY_LABELS_FA,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const dynamic = 'force-dynamic';

interface AssetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { id } = await params;
  const { ctx, sessionUser } = await getServerContext();

  const asset = await getAssetById(ctx, id);
  if (!asset) {
    notFound();
  }

  const primaryMeter = asset.meters[0];
  const recentReadings = primaryMeter
    ? await listRecentMeterReadings(ctx, primaryMeter.id)
    : [];

  return (
    <AppShell activeNav="assets" user={sessionUser}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/assets" className="hover:underline inline-flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" />
              بازگشت به درخت تجهیزات
            </Link>
            <span>/</span>
            <bdi className="font-mono">{asset.code}</bdi>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            {asset.name}
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
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Technical Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              مشخصات شناسنامه‌ای و استقرار تجهیز
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-muted/40 p-3.5">
              <span className="text-muted-foreground block text-xs">کد شناسایی دستگاه</span>
              <bdi className="font-mono font-bold text-base mt-1 block">{asset.code}</bdi>
            </div>
            <div className="rounded-lg bg-muted/40 p-3.5">
              <span className="text-muted-foreground block text-xs">شماره سریال سازنده</span>
              <bdi className="font-mono font-semibold text-base mt-1 block">
                {asset.serialNumber ?? 'ثبت‌نشده'}
              </bdi>
            </div>
            <div className="rounded-lg bg-muted/40 p-3.5">
              <span className="text-muted-foreground block text-xs">سایت / کارخانه</span>
              <span className="font-semibold text-base mt-1 block">{asset.plantName}</span>
            </div>
            <div className="rounded-lg bg-muted/40 p-3.5">
              <span className="text-muted-foreground block text-xs">سالن / محل استقرار</span>
              <span className="font-semibold text-base mt-1 block">{asset.locationName}</span>
            </div>
            <div className="rounded-lg bg-muted/40 p-3.5">
              <span className="text-muted-foreground block text-xs">توپولوژی خط و بافر میانی</span>
              <span className="font-semibold text-sm mt-1 block">
                {TOPOLOGY_LABELS_FA[asset.topologyType ?? 'BOTTLENECK']} (بافر:{' '}
                {toPersianDigits(asset.bufferCapacityMinutes ?? 0)} دقیقه | اثر ظرفیت:{' '}
                {toPersianDigits(asset.capacityImpactPercent ?? 100)}٪)
              </span>
            </div>
            <div className="rounded-lg bg-muted/40 p-3.5">
              <span className="text-muted-foreground block text-xs">
                پارامترهای اقتصادی سه‌جزئی توقف (ریال)
              </span>
              <span className="font-mono font-semibold text-xs mt-1 block text-amber-300">
                سود ساعتی: {formatRialsFa(asset.hourlyLostMarginRials ?? 0)} | ضایعات خط:{' '}
                {formatRialsFa(asset.inLineScrapCostRials ?? 0)} | جریمه سرد شدن (
                {'>'}
                {toPersianDigits(asset.coldStartupThresholdMinutes ?? 120)} دقیقه):{' '}
                {formatRialsFa(asset.restartEnergyAndSetupCostRials ?? 0)} ریال
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Secure Opaque QR Code Token Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              برچسب امن QR تجهیز
            </CardTitle>
            <CardDescription>
              مطابق قوانین امنیتی، برچسب QR حاوی توکن مبهم (Opaque Token) است و شناسه دیتابیس را افشا نمی‌کند.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center space-y-2">
              <QrCode className="h-16 w-16 mx-auto text-primary" />
              <div className="text-xs text-muted-foreground">توکن اختصاصی برچسب بدنه:</div>
              <code
                dir="ltr"
                className="block rounded bg-background px-2 py-1.5 text-xs font-mono text-primary select-all"
              >
                {asset.qrOpaqueToken}
              </code>
            </div>
            <Button asChild variant="outline" className="w-full" size="sm">
              <Link href={`/m/scan?token=${encodeURIComponent(asset.qrOpaqueToken)}`}>
                شبیه‌سازی اسکن با تبلت تکنسین
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Mandatory LOTO Procedure Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            دستورالعمل ایمنی قفل‌گذاری و برچسب‌گذاری (LOTO - Lockout / Tagout)
          </CardTitle>
          <CardDescription>
            مراحل زیر قبل از شروع هرگونه دستورکار تعمیراتی یا نت پیشگیرانه روی این دستگاه اجباری است.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!asset.requiresLoto ? (
            <Alert>
              <AlertTitle>فاقد الزام قفل‌گذاری LOTO</AlertTitle>
              <AlertDescription>
                برای این تجهیز رویه LOTO اجباری ثبت نشده است. رعایت تجهیزات حفاظت فردی (PPE) عمومی الزامی است.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <div>
                  <AlertTitle>خطر انرژی ذخیره شده — گیت ایمنی فعال است</AlertTitle>
                  <AlertDescription>
                    سیستم به هیچ تکنسینی اجازه تغییر وضعیت دستورکار به «در حال انجام» را بدون ثبت شماره قفل و تایید مراحل زیر نمی‌دهد.
                  </AlertDescription>
                </div>
              </Alert>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>گام</TableHead>
                    <TableHead>منبع انرژی خطرناک</TableHead>
                    <TableHead>نقطه ایزولاسیون و قفل‌گذاری</TableHead>
                    <TableHead>روش تست و راستی‌آزمایی بی‌برقی / بی‌فشاری</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asset.lotoProcedure.map((step) => (
                    <TableRow key={step.stepNumber}>
                      <TableCell className="font-bold">
                        گام {toPersianDigits(step.stepNumber)}
                      </TableCell>
                      <TableCell className="font-medium text-red-300">
                        {step.energySource}
                      </TableCell>
                      <TableCell>{step.isolationPoint}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {step.verificationMethod}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meter Readings History */}
      {primaryMeter && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              کنتور کارکرد: {primaryMeter.name} (فعلی:{' '}
              {toPersianDigits(primaryMeter.currentReading)} {primaryMeter.unit})
            </CardTitle>
            <CardDescription>۱۰ قرائت اخیر ثبت‌شده برای محاسبه نت مبتنی بر کارکرد</CardDescription>
          </CardHeader>
          <CardContent>
            {recentReadings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                هنوز تاریخچه قرائتی برای این کنتور ثبت نشده است.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>مقدار ثبت‌شده</TableHead>
                    <TableHead>زمان ثبت (شمسی)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReadings.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold">
                        {toPersianDigits(r.reading)} {primaryMeter.unit}
                      </TableCell>
                      <TableCell>
                        {new Intl.DateTimeFormat('fa-IR', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Asia/Tehran',
                        }).format(r.recordedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
