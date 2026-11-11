import Link from 'next/link';
import {
  Cpu,
  Gauge,
  Layers,
  Pencil,
  Plus,
  QrCode,
  Search,
  ShieldAlert,
} from 'lucide-react';
import {
  formatRialsFa,
  listAssets,
  listAccessiblePlants,
  listLocations,
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
  updateAssetAction,
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>ثبت تجهیز جدید در درخت کارخانه (فرآیند پیوسته)</DialogTitle>
                <DialogDescription>
                  مشخصات فنی، توپولوژی خط، زمان بافر میانی، پارامترهای سه‌جزئی ضرر ریالی توقف و الزامات ایمنی LOTO را وارد کنید.
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
                      placeholder="مثلاً: KLN-RLR-02"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-name">نام فارسی دستگاه</Label>
                    <Input
                      id="asset-name"
                      name="name"
                      placeholder="مثلاً: کوره رولری پخت کاشی خط ۲"
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
                      defaultValue="CRITICAL"
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="CRITICAL">بحرانی (A)</option>
                      <option value="HIGH">مهم (B)</option>
                      <option value="MEDIUM">متوسط (C)</option>
                      <option value="LOW">عادی (D)</option>
                    </select>
                  </div>
                </div>

                {/* توپولوژی فرآیند پیوسته و هزینه‌های سه‌جزئی توقف */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-3">
                  <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Layers className="h-4 w-4" />
                    توپولوژی خط تولید و هزینه‌های سه‌جزئی توقف (ویژه صنایع کاشی، سرامیک و گندله‌سازی)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="topologyType" className="text-xs">
                        نقش در توپولوژی خط (Topology)
                      </Label>
                      <select
                        id="topologyType"
                        name="topologyType"
                        defaultValue="BOTTLENECK"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                      >
                        <option value="BOTTLENECK">گلوگاه مطلق (BOTTLENECK - کوره/نوار پخت)</option>
                        <option value="BUFFERED">دارای بافر میانی (BUFFERED - بالمیل/اتمایزر)</option>
                        <option value="PARALLEL">موازی / رزرو (PARALLEL - پرس موازی)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bufferCapacityMinutes" className="text-xs">
                        ظرفیت سیلو/بافر میانی (دقیقه)
                      </Label>
                      <Input
                        id="bufferCapacityMinutes"
                        name="bufferCapacityMinutes"
                        type="number"
                        min={0}
                        defaultValue="0"
                        dir="ltr"
                        className="h-10 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="capacityImpactPercent" className="text-xs">
                        درصد افت ظرفیت خط (٪)
                      </Label>
                      <Input
                        id="capacityImpactPercent"
                        name="capacityImpactPercent"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue="100"
                        dir="ltr"
                        className="h-10 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="hourlyLostMarginRials" className="text-xs">
                        ۱. سود ناخالص از دست رفته هر ساعت خواب خط (ریال)
                      </Label>
                      <Input
                        id="hourlyLostMarginRials"
                        name="hourlyLostMarginRials"
                        type="number"
                        min={0}
                        defaultValue="150000000"
                        dir="ltr"
                        className="h-10 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="inLineScrapCostRials" className="text-xs">
                        ۲. ارزش ضایعات داخل کوره/خط در توقف ناگهانی (ریال)
                      </Label>
                      <Input
                        id="inLineScrapCostRials"
                        name="inLineScrapCostRials"
                        type="number"
                        min={0}
                        defaultValue="180000000"
                        dir="ltr"
                        className="h-10 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="coldStartupThresholdMinutes" className="text-xs">
                        آستانه زمانی سرد شدن کوره/دستگاه (دقیقه)
                      </Label>
                      <Input
                        id="coldStartupThresholdMinutes"
                        name="coldStartupThresholdMinutes"
                        type="number"
                        min={0}
                        defaultValue="120"
                        dir="ltr"
                        className="h-10 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="restartEnergyAndSetupCostRials" className="text-xs">
                        ۳. هزینه سوخت پیش‌گرم و راه‌اندازی مجدد (ریال)
                      </Label>
                      <Input
                        id="restartEnergyAndSetupCostRials"
                        name="restartEnergyAndSetupCostRials"
                        type="number"
                        min={0}
                        defaultValue="500000000"
                        dir="ltr"
                        className="h-10 font-mono"
                      />
                    </div>
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
                <TableHead>توپولوژی خط و بافر</TableHead>
                <TableHead>نرخ خسارت توقف (ریال/ساعت)</TableHead>
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
                    <TableCell>
                      <div className="font-semibold">{asset.name}</div>
                      <div className="text-[11px] text-muted-foreground">{asset.locationName}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          asset.topologyType === 'BOTTLENECK'
                            ? 'destructive'
                            : asset.topologyType === 'BUFFERED'
                              ? 'info'
                              : 'secondary'
                        }
                        className="text-[11px]"
                      >
                        {TOPOLOGY_LABELS_FA[asset.topologyType ?? 'BOTTLENECK']}
                      </Badge>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        بافر: {toPersianDigits(asset.bufferCapacityMinutes ?? 0)} دقیقه | اثر:{' '}
                        {toPersianDigits(asset.capacityImpactPercent ?? 100)}٪
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="font-bold text-amber-300">
                        {formatRialsFa(asset.hourlyLostMarginRials ?? 0)} ریال/ساعت
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        سرد شدن ({'>'}
                        {toPersianDigits(asset.coldStartupThresholdMinutes ?? 120)} دقیقه):{' '}
                        {formatRialsFa(asset.restartEnergyAndSetupCostRials ?? 0)} ریال
                      </div>
                    </TableCell>
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
                      <div className="flex items-center gap-1.5">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Pencil className="h-3.5 w-3.5 me-1" />
                              ویرایش هزینه/توپولوژی
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-xl">
                            <DialogHeader>
                              <DialogTitle>
                                ویرایش توپولوژی و هزینه‌های سه‌جزئی توقف: {asset.name}
                              </DialogTitle>
                              <DialogDescription>
                                کد تجهیز: <bdi className="font-mono">{asset.code}</bdi> — مقادیر ریالی در موتور محاسبه خسارت توقف لحاظ می‌شوند.
                              </DialogDescription>
                            </DialogHeader>
                            <form action={updateAssetAction} className="space-y-4 pt-2">
                              <input type="hidden" name="assetId" value={asset.id} />
                              <div className="space-y-1.5">
                                <Label htmlFor={`name-${asset.id}`}>نام فارسی دستگاه</Label>
                                <Input
                                  id={`name-${asset.id}`}
                                  name="name"
                                  defaultValue={asset.name}
                                  required
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`topo-${asset.id}`} className="text-xs">
                                    توپولوژی خط
                                  </Label>
                                  <select
                                    id={`topo-${asset.id}`}
                                    name="topologyType"
                                    defaultValue={asset.topologyType ?? 'BOTTLENECK'}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                                  >
                                    <option value="BOTTLENECK">گلوگاه مطلق (BOTTLENECK)</option>
                                    <option value="BUFFERED">دارای بافر میانی (BUFFERED)</option>
                                    <option value="PARALLEL">موازی / رزرو (PARALLEL)</option>
                                  </select>
                                </div>

                                <div className="space-y-1.5">
                                  <Label htmlFor={`buf-${asset.id}`} className="text-xs">
                                    زمان بافر میانی (دقیقه)
                                  </Label>
                                  <Input
                                    id={`buf-${asset.id}`}
                                    name="bufferCapacityMinutes"
                                    type="number"
                                    min={0}
                                    defaultValue={asset.bufferCapacityMinutes ?? 0}
                                    dir="ltr"
                                    className="h-10 font-mono"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label htmlFor={`imp-${asset.id}`} className="text-xs">
                                    درصد افت ظرفیت (٪)
                                  </Label>
                                  <Input
                                    id={`imp-${asset.id}`}
                                    name="capacityImpactPercent"
                                    type="number"
                                    min={0}
                                    max={100}
                                    defaultValue={asset.capacityImpactPercent ?? 100}
                                    dir="ltr"
                                    className="h-10 font-mono"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`margin-${asset.id}`} className="text-xs">
                                    سود از دست رفته هر ساعت توقف (ریال)
                                  </Label>
                                  <Input
                                    id={`margin-${asset.id}`}
                                    name="hourlyLostMarginRials"
                                    type="number"
                                    min={0}
                                    defaultValue={asset.hourlyLostMarginRials ?? 0}
                                    dir="ltr"
                                    className="h-10 font-mono"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label htmlFor={`scrap-${asset.id}`} className="text-xs">
                                    ارزش ضایعات داخل خط در توقف ناگهانی (ریال)
                                  </Label>
                                  <Input
                                    id={`scrap-${asset.id}`}
                                    name="inLineScrapCostRials"
                                    type="number"
                                    min={0}
                                    defaultValue={asset.inLineScrapCostRials ?? 0}
                                    dir="ltr"
                                    className="h-10 font-mono"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`cold-${asset.id}`} className="text-xs">
                                    آستانه سرد شدن کوره/تجهیز (دقیقه)
                                  </Label>
                                  <Input
                                    id={`cold-${asset.id}`}
                                    name="coldStartupThresholdMinutes"
                                    type="number"
                                    min={0}
                                    defaultValue={asset.coldStartupThresholdMinutes ?? 120}
                                    dir="ltr"
                                    className="h-10 font-mono"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label htmlFor={`restart-${asset.id}`} className="text-xs">
                                    هزینه سوخت پیش‌گرم و راه‌اندازی مجدد (ریال)
                                  </Label>
                                  <Input
                                    id={`restart-${asset.id}`}
                                    name="restartEnergyAndSetupCostRials"
                                    type="number"
                                    min={0}
                                    defaultValue={asset.restartEnergyAndSetupCostRials ?? 0}
                                    dir="ltr"
                                    className="h-10 font-mono"
                                  />
                                </div>
                              </div>

                              <DialogFooter>
                                <Button type="submit" className="w-full sm:w-auto">
                                  ذخیره تغییرات و ثبت در ممیزی (Audit)
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>

                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/assets/${asset.id}`}>
                            <QrCode className="h-3.5 w-3.5 me-1" />
                            شناسنامه
                          </Link>
                        </Button>
                      </div>
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
