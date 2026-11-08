import Link from 'next/link';
import { ArrowLeft, Cpu, QrCode, ShieldAlert } from 'lucide-react';
import { getAssetByQrToken, toPersianDigits } from '@cmms/core';
import fa from '@/messages/fa.json';
import { getServerContext } from '@/lib/server-context';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

interface ScanPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function TechnicianQrScanPage({ searchParams }: ScanPageProps) {
  const { token } = await searchParams;
  const { ctx, sessionUser } = await getServerContext();

  const scannedAsset = token ? await getAssetByQrToken(ctx, token) : null;

  return (
    <AppShell activeNav="scan" user={sessionUser}>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" />
            اسکنر سریع برچسب QR تجهیز (موبایل تکنسین)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            طراحی‌شده برای کار با دستکش در سالن تولید (دکمه‌های ۵۶px و حداقل تایپ)
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ورود یا اسکن توکن QR دستگاه</CardTitle>
            <CardDescription>
              دوربین تبلت را مقابل برچسب QR دستگاه بگیرید یا یکی از توکن‌های نمونه زیر را انتخاب کنید.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form method="GET" action="/m/scan" className="space-y-3">
              <Input
                name="token"
                defaultValue={token ?? 'ast_prs_hyd_250_demo_token'}
                placeholder="ast_..."
                dir="ltr"
                className="h-12 font-mono text-center"
              />
              <Button type="submit" size="industrial" className="w-full">
                <QrCode className="h-5 w-5 me-2" />
                شناسایی فوری دستگاه
              </Button>
            </form>

            <div className="pt-2 space-y-2">
              <span className="text-xs text-muted-foreground block">
                توکن‌های آماده تست روی تجهیزات کارخانه:
              </span>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/m/scan?token=ast_prs_hyd_250_demo_token">
                    پرس هیدرولیک ۲۵۰ تن
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/m/scan?token=ast_cmp_atl_01_demo_token">
                    کمپرسور اسکرو اطلس
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/m/scan?token=ast_cnv_asm_02_demo_token">
                    نوار نقاله خط ۱
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {token && !scannedAsset && (
          <Alert variant="destructive">
            <AlertTitle>تجهیزی با این کد QR یافت نشد</AlertTitle>
            <AlertDescription>
              توکن واردشده معتبر نیست یا خارج از محدوده کارخانه مجاز شماست.
            </AlertDescription>
          </Alert>
        )}

        {scannedAsset && (
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="info">
                  <bdi>{scannedAsset.code}</bdi>
                </Badge>
                <Badge
                  variant={
                    scannedAsset.status === 'OPERATIONAL' ? 'success' : 'warning'
                  }
                >
                  {fa.assetStatus[scannedAsset.status]}
                </Badge>
              </div>
              <CardTitle className="pt-2 text-xl">{scannedAsset.name}</CardTitle>
              <CardDescription>
                محل استقرار: {scannedAsset.locationName} | {scannedAsset.plantName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {scannedAsset.requiresLoto && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <div>
                    <AlertTitle>هشدار ایمنی LOTO قبل از شروع کار!</AlertTitle>
                    <AlertDescription>
                      این دستگاه دارای {toPersianDigits(scannedAsset.lotoProcedure.length)} مرحله ایزولاسیون انرژی اجباری است.
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button asChild size="industrial" className="w-full">
                <Link href={`/assets/${scannedAsset.id}`}>
                  <Cpu className="h-5 w-5 me-2" />
                  مشاهده شناسنامه کامل و مراحل LOTO
                  <ArrowLeft className="h-5 w-5 ms-2" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
