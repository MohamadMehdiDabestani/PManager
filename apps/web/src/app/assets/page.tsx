import Link from 'next/link';
import {
  Cpu,
  Gauge,
  Plus,
  QrCode,
  Search,
  ShieldAlert,
} from 'lucide-react';
import {
  listAssets,
  listAccessiblePlants,
  listLocations,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createAssetAction,
  recordMeterReadingAction,
} from '@/app/actions/phase1-actions';

export const dynamic = 'force-dynamic';

interface AssetsPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const params = await searchParams;
  const { ctx, sessionUser } = await getServerContext();

  let assetList: Awaited<ReturnType<typeof listAssets>> = [];
  let plantList: Awaited<ReturnType<typeof listAccessiblePlants>> = [];
  let locationList: Awaited<ReturnType<typeof listLocations>> = [];

  try {
    [assetList, plantList, locationList] = await Promise.all([
      listAssets(ctx, { search: params.q, status: params.status }),
      listAccessiblePlants(ctx),
      listLocations(ctx),
    ]);
  } catch {
    // Handled gracefully when DB is not yet migrated
  }

  const defaultPlantId = plantList[0]?.id ?? '';
  const canCreateAsset = ctx.ability.can('create', 'Asset');

  return (
    <AppShell activeNav="assets" user={sessionUser}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            درخت تجهیزات و ماشین‌آلات کارخانه
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            مدیریت شناسنامه دستگاه‌ها، رویه قفل ایمنی (LOTO)، توکن QR و ثبت کارکرد ساعت‌شمار
          </p>
        </div>

        {canCreateAsset && defaultPlantId && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 me-2" />
                ثبت تجهیز جدید
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>ثبت تجهیز جدید در درخت کارخانه</DialogTitle>
                <DialogDescription>
                  مشخصات فنی، محل استقرار، الزامات ایمنی LOTO و کنتور اولیه دستگاه را وارد کنید.
                </DialogDescription>
              </DialogHeader>
              <form action={createAssetAction} className="space-y-4 pt-2">
                <input type="hidden" name="plantId" value={defaultPlantId} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="asset-code">کد تجهیز (انگلیسی)</Label>
                    <Input
                      id="asset-code"
                      name="code"
                      placeholder="مثلاً: PRS-HYD-300"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-name">نام فارسی دستگاه</Label>
                    <Input
                      id="asset-name"
                      name="name"
                      placeholder="مثلاً: پرس هیدرولیک ۳۰۰ تن"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="locationId">سالن / خط تولید</Label>
                    <select
                      id="locationId"
                      name="locationId"
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">-- انتخاب سالن --</option>
                      {locationList.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="criticality">درجه اهمیت (Criticality)</Label>
                    <select
                      id="criticality"
                      name="criticality"
                      defaultValue="HIGH"
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="CRITICAL">بحرانی (A)</option>
                      <option value="HIGH">مهم (B)</option>
                      <option value="MEDIUM">متوسط (C)</option>
                      <option value="LOW">عادی (D)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="meterName">نام کنتور کارکرد (اختیاری)</Label>
                    <Input
                      id="meterName"
                      name="meterName"
                      placeholder="مثلاً: ساعت کارکرد پمپ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meterReading">کارکرد فعلی (ساعت)</Label>
                    <Input
                      id="meterReading"
                      name="meterReading"
                      type="number"
                      defaultValue="0"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      id="requiresLoto"
                      name="requiresLoto"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="requiresLoto" className="text-amber-300 font-semibold">
                      این تجهیز نیازمند قفل و برچسب ایمنی اجباری (LOTO) قبل از شروع تعمیرات است
                    </Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      name="lotoEnergySource"
                      placeholder="منبع انرژی (مثلاً: برق ۳۸۰ ولت + فشار هیدرولیک)"
                    />
                    <Input
                      name="lotoIsolationPoint"
                      placeholder="نقطه جداسازی (مثلاً: کلید Q1 + شیر تخلیه V-12)"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" className="w-full sm:w-auto">
                    ذخیره در درخت تجهیزات و ثبت Audit
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <form method="GET" action="/assets" className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="جستجو با نام دستگاه یا کد تجهیز (پشتیبانی از حروف و ارقام فارسی/عربی)..."
                className="ps-9"
              />
            </div>
            <Button type="submit" variant="secondary">
              جستجوی تجهیزات
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>فهرست ماشین‌آلات و تجهیزات ({toPersianDigits(assetList.length)})</CardTitle>
          <CardDescription>
            برای مشاهده رویه کامل LOTO، کد QR اختصاصی و زیرمجموعه‌ها روی «شناسنامه» کلیک کنید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>کد تجهیز</TableHead>
                <TableHead>نام دستگاه</TableHead>
                <TableHead>محل استقرار</TableHead>
                <TableHead>درجه اهمیت</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>گیت ایمنی LOTO</TableHead>
                <TableHead>کنتور کارکرد</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assetList.map((asset) => {
                const meter = asset.meters[0];
                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono font-bold">
                      <bdi>{asset.code}</bdi>
                    </TableCell>
                    <TableCell className="font-semibold">{asset.name}</TableCell>
                    <TableCell>{asset.locationName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          asset.criticality === 'CRITICAL'
                            ? 'destructive'
                            : asset.criticality === 'HIGH'
                              ? 'warning'
                              : 'secondary'
                        }
                      >
                        {fa.criticality[asset.criticality]}
                      </Badge>
                    </TableCell>
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
                        <Badge variant="destructive">
                          <ShieldAlert className="h-3.5 w-3.5 me-1" />
                          LOTO الزامی ({toPersianDigits(asset.lotoProcedure.length)} گام)
                        </Badge>
                      ) : (
                        <Badge variant="outline">ندارد</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {meter ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {toPersianDigits(meter.currentReading)} {meter.unit}
                          </span>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Gauge className="h-3.5 w-3.5 me-1" />
                                ثبت کارکرد
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>ثبت کارکرد جدید: {asset.name}</DialogTitle>
                                <DialogDescription>
                                  کنتور: {meter.name} | مقدار فعلی:{' '}
                                  {toPersianDigits(meter.currentReading)} {meter.unit}
                                </DialogDescription>
                              </DialogHeader>
                              <form action={recordMeterReadingAction} className="space-y-4 pt-2">
                                <input type="hidden" name="meterId" value={meter.id} />
                                <div className="space-y-2">
                                  <Label htmlFor={`reading-${meter.id}`}>
                                    مقدار جدید شمارنده ({meter.unit})
                                  </Label>
                                  <Input
                                    id={`reading-${meter.id}`}
                                    name="reading"
                                    type="number"
                                    min={meter.currentReading}
                                    defaultValue={meter.currentReading + 10}
                                    dir="ltr"
                                    required
                                  />
                                </div>
                                <DialogFooter>
                                  <Button type="submit" size="industrial" className="w-full">
                                    ثبت قرائت جدید کنتور
                                  </Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">فاقد کنتور</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/assets/${asset.id}`}>
                          <QrCode className="h-3.5 w-3.5 me-1" />
                          شناسنامه
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
