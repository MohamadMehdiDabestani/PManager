import Link from 'next/link';
import {
  listPmSchedules,
  listPmTemplates,
  listAssets,
  listUsers,
  listAccessiblePlants,
  formatJalaliDateTime,
} from '@cmms/core';
import {
  CalendarClock,
  Plus,
  Play,
  Gauge,
  Calendar,
  Layers,
  Power,
  CheckCircle2,
  PauseCircle,
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createPmScheduleAction,
  togglePmScheduleActiveAction,
  triggerScheduleGenerationNowAction,
} from '@/app/actions/phase2-actions';

export const dynamic = 'force-dynamic';

const triggerBadges = {
  CALENDAR: { label: 'تقویمی (روزشمار)', variant: 'info' as const, icon: Calendar },
  METER: { label: 'کارکردی (کنتور)', variant: 'warning' as const, icon: Gauge },
  HYBRID: { label: 'ترکیبی (تقویم + کنتور)', variant: 'default' as const, icon: Layers },
};

const priorityBadges = {
  LOW: { label: 'کم', variant: 'secondary' as const },
  MEDIUM: { label: 'متوسط', variant: 'info' as const },
  HIGH: { label: 'مهم', variant: 'warning' as const },
  URGENT: { label: 'فوری / بحرانی', variant: 'destructive' as const },
};

export default async function PmSchedulesPage() {
  const { ctx, sessionUser } = await getServerContext();
  const [schedules, templates, assets, users, plants] = await Promise.all([
    listPmSchedules(ctx),
    listPmTemplates(ctx),
    listAssets(ctx),
    listUsers(ctx),
    listAccessiblePlants(ctx),
  ]);

  const activePlantId = plants[0]?.id ?? '';
  const technicians = users.filter(
    (u) => u.role === 'TECHNICIAN' || u.role === 'SUPERVISOR',
  );
  const allMeters = assets.flatMap((a) =>
    a.meters.map((m) => ({
      ...m,
      assetName: a.name,
      assetCode: a.code,
    })),
  );

  const activeCount = schedules.filter((s) => s.active).length;
  const hybridOrMeterCount = schedules.filter(
    (s) => s.triggerType === 'METER' || s.triggerType === 'HYBRID',
  ).length;

  return (
    <AppShell activeNav="pm-schedules" user={sessionUser}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <CalendarClock className="h-6 w-6 text-primary" />
            موتور زمان‌بندی نت پیشگیرانه (PM Schedules)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            تعریف قوانین دوره‌ای تقویمی، کارکردی (کنتور ساعت/سیکل) و ترکیبی با استراتژی‌های ثابت و شناور و تطبیق با تقویم کاری کارخانه
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 me-2" />
              تعریف برنامه زمان‌بندی جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تعریف برنامه زمان‌بندی نت پیشگیرانه (PM)</DialogTitle>
              <DialogDescription>
                ورکر BullMQ هر شب ساعت ۰۲:۰۰ بامداد (به وقت تهران) و همچنین پس از ثبت کارکرد کنتور، سررسیدها را بررسی و دستورکار صادر می‌کند.
              </DialogDescription>
            </DialogHeader>

            <form action={createPmScheduleAction} className="space-y-4 mt-2">
              <input type="hidden" name="plantId" value={activePlantId} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assetId">انتخاب تجهیز / ماشین *</Label>
                  <select
                    id="assetId"
                    name="assetId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="templateId">قالب چک‌لیست استاندارد *</Label>
                  <select
                    id="templateId"
                    name="templateId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.checklist.length.toLocaleString('fa-IR')} گام)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="triggerType">نوع محرک زمان‌بندی (Trigger)</Label>
                  <select
                    id="triggerType"
                    name="triggerType"
                    defaultValue="CALENDAR"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="CALENDAR">تقویمی (هر N روز)</option>
                    <option value="METER">کارکردی (هر N واحد کنتور)</option>
                    <option value="HYBRID">ترکیبی (هرکدام زودتر فرا برسد)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anchorMode">استراتژی محاسبه دوره بعد</Label>
                  <select
                    id="anchorMode"
                    name="anchorMode"
                    defaultValue="FIXED"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="FIXED">ثابت (FIXED - بر پایه سررسید قبلی)</option>
                    <option value="FLOATING">شناور (FLOATING - بر پایه تاریخ انجام واقعی)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border border-border bg-muted/30 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="intervalDays" className="text-xs">
                    دوره تقویمی (روز)
                  </Label>
                  <Input
                    id="intervalDays"
                    name="intervalDays"
                    type="number"
                    min={1}
                    defaultValue="30"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meterId" className="text-xs">
                    کنتور مرتبط (برای کارکردی)
                  </Label>
                  <select
                    id="meterId"
                    name="meterId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">-- بدون کنتور --</option>
                    {allMeters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.assetCode} - {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="intervalMeter" className="text-xs">
                    فاصله کارکرد (مثلاً ۵۰۰ ساعت)
                  </Label>
                  <Input
                    id="intervalMeter"
                    name="intervalMeter"
                    type="number"
                    min={1}
                    placeholder="500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leadDays">فرجه صدور قبل از موعد (روز)</Label>
                  <Input
                    id="leadDays"
                    name="leadDays"
                    type="number"
                    min={0}
                    max={30}
                    defaultValue="3"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">اولویت دستورکار</Label>
                  <select
                    id="priority"
                    name="priority"
                    defaultValue="HIGH"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="LOW">کم (LOW)</option>
                    <option value="MEDIUM">متوسط (MEDIUM)</option>
                    <option value="HIGH">مهم (HIGH)</option>
                    <option value="URGENT">فوری / بحرانی (URGENT)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultAssigneeId">تکنسین مسئول پیش‌فرض</Label>
                  <select
                    id="defaultAssigneeId"
                    name="defaultAssigneeId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- صف برنامه‌ریز --</option>
                    {technicians.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit">ثبت و فعال‌سازی برنامه نت</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>کل برنامه‌های فعال نت</CardDescription>
            <CardTitle className="text-2xl text-emerald-400">
              {activeCount.toLocaleString('fa-IR')} برنامه
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            پایش خودکار روزانه در منطقه زمانی Asia/Tehran با حذف روزهای تعطیل (جمعه)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>برنامه‌های کارکردی و ترکیبی (کنتورمحور)</CardDescription>
            <CardTitle className="text-2xl text-amber-400">
              {hybridOrMeterCount.toLocaleString('fa-IR')} برنامه
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            پیش‌بینی هوشمند تاریخ سررسید بر اساس میانگین کارکرد ۳۰ روز اخیر کنتور
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>تضمین عدم تکرار (Idempotency)</CardDescription>
            <CardTitle className="text-lg font-mono text-sky-400" dir="ltr">
              UNIQUE (pm_schedule_id, due_at)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            اجرای چندباره ورکر هرگز دستورکار یا اعلان تکراری ایجاد نمی‌کند
          </CardContent>
        </Card>
      </div>

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">فهرست برنامه‌های زمان‌بندی نت پیشگیرانه</CardTitle>
          <CardDescription>
            می‌توانید علاوه بر اجرای خودکار شبانه، با دکمه «صدور آنی دستورکار» همین لحظه موتور تولید دستورکار را برای هر ردیف اجرا کنید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>تجهیز / کد</TableHead>
                <TableHead>قالب چک‌لیست</TableHead>
                <TableHead>نوع تریگر و استراتژی</TableHead>
                <TableHead>دوره تناوب</TableHead>
                <TableHead>اولویت / مسئول</TableHead>
                <TableHead>سررسید بعدی (جلالی)</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="text-left">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => {
                const trig = triggerBadges[s.triggerType];
                const TrigIcon = trig.icon;
                const prio = priorityBadges[s.priority];

                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/assets/${s.assetId}`}
                        className="font-semibold hover:text-primary transition-colors block"
                      >
                        {s.assetName}
                      </Link>
                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {s.assetCode}
                      </span>
                    </TableCell>

                    <TableCell className="font-medium">{s.templateName}</TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={trig.variant} className="gap-1 text-[11px]">
                          <TrigIcon className="h-3 w-3" />
                          {trig.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          استراتژی: {s.anchorMode === 'FIXED' ? 'ثابت (FIXED)' : 'شناور (FLOATING)'}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs space-y-1">
                      {s.intervalDays && (
                        <div>هر {s.intervalDays.toLocaleString('fa-IR')} روز</div>
                      )}
                      {s.intervalMeter && (
                        <div className="text-amber-400">
                          هر {s.intervalMeter.toLocaleString('fa-IR')} {s.meterUnit ?? 'واحد'}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        فرجه: {s.leadDays.toLocaleString('fa-IR')} روز قبل
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={prio.variant} className="text-[10px]">
                          {prio.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {s.assigneeName ?? 'صف برنامه‌ریز'}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs">
                      {s.nextDueAt ? formatJalaliDateTime(s.nextDueAt) : 'محاسبه‌نشده'}
                    </TableCell>

                    <TableCell>
                      {s.active ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          فعال
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <PauseCircle className="h-3 w-3" />
                          متوقف
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <form action={triggerScheduleGenerationNowAction}>
                          <input type="hidden" name="scheduleId" value={s.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            title="تولید آنی دستورکار از این برنامه"
                          >
                            <Play className="h-3.5 w-3.5 me-1 text-emerald-400" />
                            صدور دستورکار
                          </Button>
                        </form>

                        <form action={togglePmScheduleActiveAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={s.active ? 'false' : 'true'}
                          />
                          <Button
                            type="submit"
                            size="icon"
                            variant="ghost"
                            title={s.active ? 'غیرفعال‌سازی برنامه' : 'فعال‌سازی مجدد'}
                          >
                            <Power className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </form>
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
