'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Lock,
  CheckCircle2,
  Play,
  Save,
  PackagePlus,
  TimerOff,
  AlertOctagon,
  Camera,
  AlertTriangle,
} from 'lucide-react';
import type { WorkOrderWithDetails } from '@cmms/core';
import type { Part, ChecklistResultEntry } from '@cmms/db';
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
import { Separator } from '@/components/ui/separator';
import {
  enqueueOfflineAction,
  syncOutboxWithServer,
  cacheWorkOrderOffline,
  type OutboxActionType,
} from '@/lib/offline-outbox';

interface WorkOrderExecutorProps {
  workOrder: WorkOrderWithDetails;
  parts: Part[];
}

export function WorkOrderExecutor({ workOrder, parts }: WorkOrderExecutorProps) {
  const router = useRouter();

  const [status, setStatus] = useState(workOrder.status);
  const [lotoVerified, setLotoVerified] = useState(workOrder.lotoVerified);
  const [lotoLockId, setLotoLockId] = useState(workOrder.lotoLockId ?? '');
  const [checkedLotoSteps, setCheckedLotoSteps] = useState<Record<number, boolean>>({});

  // Build map of checklist answers
  const [answers, setAnswers] = useState<Record<string, ChecklistResultEntry>>(() => {
    const map: Record<string, ChecklistResultEntry> = {};
    for (const r of workOrder.checklistResult) {
      map[r.itemId] = r;
    }
    return map;
  });

  const [completionNote, setCompletionNote] = useState(workOrder.description ?? '');
  const [selectedPartId, setSelectedPartId] = useState(parts[0]?.id ?? '');
  const [partQty, setPartQty] = useState('1');

  const [downtimeMin, setDowntimeMin] = useState('30');
  const [downtimeReason, setDowntimeReason] = useState('');
  const [isPlannedDowntime, setIsPlannedDowntime] = useState(workOrder.type === 'PM');

  const [unsafeReason, setUnsafeReason] = useState('');
  const [showUnsafeBox, setShowUnsafeBox] = useState(false);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    void cacheWorkOrderOffline(workOrder as unknown as { id: string } & Record<string, unknown>);
  }, [workOrder]);

  const isLockedDone = status === 'DONE';
  const lotoBlocked = workOrder.requiresLoto && !lotoVerified;

  function setItemAnswer(
    itemId: string,
    value: boolean | number | string | null,
    extra?: Partial<ChecklistResultEntry>,
  ) {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        itemId,
        value,
        note: extra?.note ?? prev[itemId]?.note,
        photoUrl: extra?.photoUrl ?? prev[itemId]?.photoUrl,
        completedAt: new Date().toISOString(),
      },
    }));
  }

  async function dispatchAction(
    type: OutboxActionType,
    payload: Record<string, unknown>,
    successMsg: string,
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      await enqueueOfflineAction({
        workOrderId: workOrder.id,
        type,
        payload,
      });

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const res = await syncOutboxWithServer();
        if (res.failed > 0) {
          setFeedback({
            type: 'error',
            text: 'خطا در اجرای عملیات روی سرور. جزئیات را در نوار همگام‌سازی بررسی کنید.',
          });
        } else {
          setFeedback({ type: 'success', text: successMsg });
          router.refresh();
        }
      } else {
        setFeedback({
          type: 'warning',
          text: `${successMsg} (ذخیره در صف آفلاین دستگاه - به محض اتصال ارسال می‌شود)`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'خطا در ثبت عملیات',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyLoto() {
    if (!lotoLockId.trim()) {
      setFeedback({
        type: 'error',
        text: 'وارد کردن شماره قفل فیزیکی (Lock Tag ID) الزامی است.',
      });
      return;
    }

    const totalSteps = workOrder.lotoProcedure.length;
    const checkedCount = workOrder.lotoProcedure.filter(
      (s) => checkedLotoSteps[s.stepNumber],
    ).length;

    if (totalSteps > 0 && checkedCount < totalSteps) {
      setFeedback({
        type: 'error',
        text: 'لطفاً تمام مراحل ایزولاسیون انرژی و تست بی‌برقی را تیک بزنید.',
      });
      return;
    }

    setLotoVerified(true);
    await dispatchAction(
      'VERIFY_LOTO',
      { lotoLockId: lotoLockId.trim() },
      'ایزولاسیون انرژی و قفل ایمنی LOTO با موفقیت تایید و ثبت شد.',
    );
  }

  async function handleStartWorkOrder() {
    if (lotoBlocked) {
      setFeedback({
        type: 'error',
        text: 'ابتدا باید قفل ایمنی LOTO را تایید کنید.',
      });
      return;
    }
    setStatus('IN_PROGRESS');
    await dispatchAction('START_WO', {}, 'اجرای دستورکار آغاز شد.');
  }

  async function handleSaveProgress() {
    await dispatchAction(
      'SAVE_PROGRESS',
      {
        checklistResult: Object.values(answers),
        note: completionNote,
      },
      'پاسخ‌های چک‌لیست و یادداشت فنی ذخیره شد.',
    );
  }

  async function handleUsePart() {
    const qty = Number(partQty);
    if (!selectedPartId || Number.isNaN(qty) || qty <= 0) return;

    await dispatchAction(
      'USE_PART',
      {
        partId: selectedPartId,
        quantityUsed: qty,
      },
      'مصرف قطعه یدکی ثبت و از موجودی انبار کسر شد.',
    );
  }

  async function handleLogDowntime() {
    const mins = Number(downtimeMin);
    if (!downtimeReason.trim() || Number.isNaN(mins) || mins <= 0) {
      setFeedback({
        type: 'error',
        text: 'مدت توقف و علت توقف تجهیز را وارد نمایید.',
      });
      return;
    }

    await dispatchAction(
      'LOG_DOWNTIME',
      {
        assetId: workOrder.assetId,
        durationMinutes: mins,
        reason: downtimeReason.trim(),
        isPlanned: isPlannedDowntime,
      },
      `توقف ${mins.toLocaleString('fa-IR')} دقیقه‌ای تجهیز ثبت شد.`,
    );
    setDowntimeReason('');
  }

  async function handleCompleteWorkOrder() {
    if (lotoBlocked) {
      setFeedback({
        type: 'error',
        text: 'بدون تایید قفل ایمنی LOTO امکان بستن دستورکار وجود ندارد.',
      });
      return;
    }

    // Validate required checklist items client-side first
    for (const item of workOrder.checklistSnapshot) {
      if (item.required) {
        const entry = answers[item.id];
        if (!entry || entry.value === null || entry.value === undefined || entry.value === '') {
          setFeedback({
            type: 'error',
            text: `تکمیل گام الزامی «${item.label}» پیش از اتمام دستورکار اجباری است.`,
          });
          return;
        }
      }
    }

    setStatus('DONE');
    await dispatchAction(
      'COMPLETE_WO',
      {
        checklistResult: Object.values(answers),
        completionNote,
      },
      'دستورکار با موفقیت تکمیل، قفل و در سابقه ممیزی ثبت گردید.',
    );
  }

  async function handleFlagUnsafe() {
    if (!unsafeReason.trim()) return;
    setStatus('ON_HOLD');
    await dispatchAction(
      'FLAG_UNSAFE',
      { reason: unsafeReason.trim() },
      'توقف اضطراری ایمنی (Stop-Work) ثبت شد و دستورکار به حالت متوقف درآمد.',
    );
    setShowUnsafeBox(false);
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : feedback.type === 'warning'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 1. PPE Safety Banner */}
      {workOrder.requiredPpe.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              تجهیزات حفاظت فردی الزامی (PPE) پیش از نزدیک شدن به دستگاه:
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {workOrder.requiredPpe.map((ppe) => (
              <Badge key={ppe} variant="warning" className="px-3 py-1 text-xs">
                ✓ {ppe}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 2. Mandatory LOTO Safety Gate */}
      {workOrder.requiresLoto && (
        <Card
          className={
            lotoVerified
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-red-500/60 bg-red-500/10'
          }
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock
                  className={`h-5 w-5 ${lotoVerified ? 'text-emerald-400' : 'text-red-400'}`}
                />
                گیت ایمنی قفل و برچسب (LOTO Energy Isolation Gate)
              </CardTitle>
              {lotoVerified ? (
                <Badge variant="success">تاییدشده (قفل: {lotoLockId})</Badge>
              ) : (
                <Badge variant="destructive">الزامی پیش از شروع کار</Badge>
              )}
            </div>
            <CardDescription>
              طبق استاندارد ایمنی کارخانه، تا زمان جداسازی کامل منابع انرژی و ثبت شماره قفل فیزیکی، دکمه شروع و تکمیل دستورکار غیرفعال است.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {workOrder.lotoProcedure.length > 0 && (
              <div className="space-y-2">
                {workOrder.lotoProcedure.map((step) => {
                  const checked = Boolean(checkedLotoSteps[step.stepNumber]) || lotoVerified;
                  return (
                    <label
                      key={step.stepNumber}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card/80 p-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        disabled={lotoVerified || isLockedDone}
                        checked={checked}
                        onChange={(e) =>
                          setCheckedLotoSteps((prev) => ({
                            ...prev,
                            [step.stepNumber]: e.target.checked,
                          }))
                        }
                        className="mt-1 h-5 w-5 accent-emerald-500"
                      />
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-foreground">
                          گام {step.stepNumber.toLocaleString('fa-IR')}: قطع {step.energySource}
                        </div>
                        <div className="text-muted-foreground">
                          نقطه ایزولاسیون: <span className="text-foreground">{step.isolationPoint}</span>
                        </div>
                        <div className="text-amber-300">
                          روش تست انرژی صفر: {step.verificationMethod}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="lotoLockId">شماره سریال قفل فیزیکی (Lock Tag ID) *</Label>
                <Input
                  id="lotoLockId"
                  dir="ltr"
                  disabled={lotoVerified || isLockedDone}
                  value={lotoLockId}
                  onChange={(e) => setLotoLockId(e.target.value)}
                  placeholder="LOCK-HYD-04"
                  className="font-mono h-12"
                />
              </div>

              {!lotoVerified && !isLockedDone && (
                <Button
                  type="button"
                  size="industrial"
                  variant="destructive"
                  disabled={busy}
                  onClick={handleVerifyLoto}
                >
                  <Lock className="h-5 w-5 me-2" />
                  تایید ایزولاسیون و ثبت قفل LOTO
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Start Work Order Bar */}
      {status !== 'IN_PROGRESS' && status !== 'DONE' && (
        <Card>
          <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold">وضعیت فعلی دستورکار: {status}</div>
              <p className="text-xs text-muted-foreground">
                {lotoBlocked
                  ? '⚠️ ابتدا گیت ایمنی LOTO در کارت بالا را تکمیل کنید تا دکمه شروع فعال شود.'
                  : 'آماده شروع عملیات فنی روی تجهیز'}
              </p>
            </div>
            <Button
              type="button"
              size="industrial"
              disabled={busy || lotoBlocked}
              onClick={handleStartWorkOrder}
              className="w-full sm:w-auto"
            >
              <Play className="h-5 w-5 me-2" />
              شروع عملیات دستورکار (Start Work)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. Interactive Checklist Execution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            چک‌لیست عملیاتی و اندازه‌گیری‌های فنی ({workOrder.checklistSnapshot.length.toLocaleString('fa-IR')} گام)
          </CardTitle>
          <CardDescription>
            مقادیر اندازه‌گیری‌شده و وضعیت سلامت هر بخش را وارد نمایید. گام‌های ستاره‌دار (*) الزامی هستند.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {workOrder.checklistSnapshot.map((item, idx) => {
            const currentAns = answers[item.id]?.value ?? null;
            const numVal = typeof currentAns === 'number' ? currentAns : Number(currentAns);
            const isOutOfRange =
              item.type === 'NUMBER' &&
              currentAns !== null &&
              currentAns !== '' &&
              !Number.isNaN(numVal) &&
              ((item.minValue !== undefined && numVal < item.minValue) ||
                (item.maxValue !== undefined && numVal > item.maxValue));

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-muted/25 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm">
                    <span className="text-muted-foreground me-1.5">
                      {(idx + 1).toLocaleString('fa-IR')}.
                    </span>
                    {item.label}
                    {item.required && <span className="text-red-400 ms-1">*</span>}
                  </div>
                  {item.type === 'NUMBER' && (item.minValue !== undefined || item.maxValue !== undefined) && (
                    <Badge variant="outline" className="font-mono text-xs shrink-0" dir="ltr">
                      مجاز: {item.minValue ?? '-'} تا {item.maxValue ?? '-'} {item.unit ?? ''}
                    </Badge>
                  )}
                </div>

                {item.type === 'BOOLEAN' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      size="industrial"
                      disabled={isLockedDone}
                      variant={currentAns === true ? 'default' : 'outline'}
                      onClick={() => setItemAnswer(item.id, true)}
                      className={
                        currentAns === true
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : ''
                      }
                    >
                      ✓ سالم / مورد تایید (OK)
                    </Button>
                    <Button
                      type="button"
                      size="industrial"
                      disabled={isLockedDone}
                      variant={currentAns === false ? 'destructive' : 'outline'}
                      onClick={() => setItemAnswer(item.id, false)}
                    >
                      ✗ معیوب / نیاز به اصلاح (NOK)
                    </Button>
                  </div>
                )}

                {item.type === 'NUMBER' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="any"
                        dir="ltr"
                        disabled={isLockedDone}
                        value={currentAns !== null ? String(currentAns) : ''}
                        onChange={(e) =>
                          setItemAnswer(
                            item.id,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                        placeholder={`مقدار بر حسب ${item.unit ?? 'واحد'}...`}
                        className="h-12 text-base font-mono max-w-xs"
                      />
                      {item.unit && (
                        <span className="text-sm font-mono text-muted-foreground">
                          {item.unit}
                        </span>
                      )}
                    </div>
                    {isOutOfRange && (
                      <div className="text-xs text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        مقدار وارد شده خارج از محدوده استاندارد ({item.minValue} .. {item.maxValue}{' '}
                        {item.unit}) است!
                      </div>
                    )}
                  </div>
                )}

                {item.type === 'TEXT' && (
                  <Input
                    disabled={isLockedDone}
                    value={typeof currentAns === 'string' ? currentAns : ''}
                    onChange={(e) => setItemAnswer(item.id, e.target.value)}
                    placeholder="توضیحات و مشاهدات فنی را بنویسید..."
                    className="h-12"
                  />
                )}

                {item.type === 'PHOTO' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-input bg-secondary px-4 py-3 text-xs font-medium cursor-pointer hover:bg-secondary/80">
                      <Camera className="h-4 w-4 text-primary" />
                      <span>ثبت عکس با دوربین صنعتی / انتخاب تصویر</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={isLockedDone}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setItemAnswer(item.id, `PHOTO:${file.name}`, {
                              photoUrl: file.name,
                            });
                          }
                        }}
                      />
                    </label>
                    {currentAns && (
                      <Badge variant="success">تصویر پیوست شد: {String(currentAns)}</Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="space-y-2 pt-2">
            <Label htmlFor="wo-note">گزارش تکمیلی تکنسین / شرح تعمیرات انجام‌شده</Label>
            <Input
              id="wo-note"
              disabled={isLockedDone}
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="شرح اقدامات، تنظیمات یا پیشنهاد فنی برای دوره بعد..."
              className="h-12"
            />
          </div>
        </CardContent>
      </Card>

      {/* 5. Spare Parts Consumption & Downtime Logging */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Spare Parts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              مصرف قطعات یدکی از انبار (Spare Parts)
            </CardTitle>
            <CardDescription>
              ثبت قطعه مصرفی روی دستورکار به صورت خودکار و بدون تکرار (Idempotent) از موجودی انبار کسر می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isLockedDone && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">انتخاب قطعه از انبار</Label>
                  <select
                    value={selectedPartId}
                    onChange={(e) => setSelectedPartId(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  >
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) — موجودی: {p.quantityOnHand.toLocaleString('fa-IR')}{' '}
                        {p.unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">تعداد مصرفی</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0.1}
                      step="any"
                      dir="ltr"
                      value={partQty}
                      onChange={(e) => setPartQty(e.target.value)}
                      className="h-11"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={handleUsePart}
                      className="h-11 shrink-0"
                    >
                      ثبت
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                قطعات مصرف‌شده در این دستورکار:
              </div>
              {workOrder.partUsages.length === 0 ? (
                <div className="text-xs text-muted-foreground">هیچ قطعه‌ای ثبت نشده است.</div>
              ) : (
                workOrder.partUsages.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs"
                  >
                    <span>
                      {u.partName} (<span className="font-mono">{u.partCode}</span>)
                    </span>
                    <Badge variant="info">
                      {u.quantityUsed.toLocaleString('fa-IR')} {u.unit}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Downtime Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TimerOff className="h-5 w-5 text-amber-400" />
              ثبت توقف تجهیز (Downtime Log)
            </CardTitle>
            <CardDescription>
              داده‌های توقف برای محاسبه دقیق شاخص‌های کلیدی MTBF، MTTR و ساعات توقف خط تولید استفاده می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isLockedDone && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">مدت توقف (دقیقه)</Label>
                    <Input
                      type="number"
                      min={1}
                      dir="ltr"
                      value={downtimeMin}
                      onChange={(e) => setDowntimeMin(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">علت توقف</Label>
                    <Input
                      value={downtimeReason}
                      onChange={(e) => setDowntimeReason(e.target.value)}
                      placeholder="مثال: توقف برنامه‌ریزی‌شده جهت تعویض فیلتر"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPlannedDowntime}
                      onChange={(e) => setIsPlannedDowntime(e.target.checked)}
                      className="h-4 w-4"
                    />
                    توقف برنامه‌ریزی‌شده (Planned Shutdown)
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={handleLogDowntime}
                  >
                    ثبت توقف خط
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                سابقه توقفات ثبت‌شده روی این دستورکار:
              </div>
              {workOrder.downtimes.length === 0 ? (
                <div className="text-xs text-muted-foreground">توقفی ثبت نشده است.</div>
              ) : (
                workOrder.downtimes.map((d) => {
                  const mins = d.endedAt
                    ? Math.round((new Date(d.endedAt).getTime() - new Date(d.startedAt).getTime()) / 60_000)
                    : 0;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs"
                    >
                      <span>{d.reason ?? 'توقف ثبت‌شده'}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={d.isPlanned ? 'secondary' : 'warning'}>
                          {d.isPlanned ? 'برنامه‌ریزی‌شده' : 'اضطراری'}
                        </Badge>
                        <Badge variant="outline">{mins.toLocaleString('fa-IR')} دقیقه</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. Industrial Action Bar (56px Glove-Friendly Touch Targets) */}
      {!isLockedDone ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              type="button"
              size="industrial"
              variant="secondary"
              disabled={busy}
              onClick={handleSaveProgress}
            >
              <Save className="h-5 w-5 me-2" />
              ذخیره موقت چک‌لیست
            </Button>

            <Button
              type="button"
              size="industrial"
              disabled={busy || lotoBlocked}
              onClick={handleCompleteWorkOrder}
              className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <CheckCircle2 className="h-5 w-5 me-2" />
              تکمیل نهایی و امضای دستورکار (Sign-off & Complete)
            </Button>
          </div>

          <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              در صورت مشاهده خطر ایمنی پیش‌بینی‌نشده، اختیار توقف اضطراری کار (Stop-Work Authority) دارید:
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUnsafeBox((v) => !v)}
              className="text-red-400 border-red-500/40 hover:bg-red-500/10"
            >
              <AlertOctagon className="h-4 w-4 me-1.5" />
              اعلام شرایط ناایمن و توقف کار (ON_HOLD)
            </Button>
          </div>

          {showUnsafeBox && (
            <div className="flex gap-2 pt-2">
              <Input
                value={unsafeReason}
                onChange={(e) => setUnsafeReason(e.target.value)}
                placeholder="علت ناایمن بودن محیط یا تجهیز را وارد کنید..."
              />
              <Button type="button" variant="destructive" onClick={handleFlagUnsafe}>
                ثبت توقف ایمنی
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="py-6 text-center space-y-1">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <div className="font-bold text-emerald-300 text-base">
              این دستورکار تکمیل و قفل ممیزی (ISO Audit Locked) شده است
            </div>
            <p className="text-xs text-emerald-200/80">
              سررسید دوره بعدی برنامه نت پیشگیرانه به صورت خودکار محاسبه و به‌روزرسانی گردید.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
