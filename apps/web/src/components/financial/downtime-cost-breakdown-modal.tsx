'use client';

import { Calculator, CheckCircle2, Flame, Layers, ShieldAlert, Wrench } from 'lucide-react';
import { toPersianDigits } from '@cmms/core/i18n';
import {
  formatRialsFa,
  TOPOLOGY_LABELS_FA,
  type DowntimeCostBreakdown,
} from '@cmms/core/financial-downtime';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DowntimeCostBreakdownModalProps {
  assetName: string;
  assetCode: string;
  breakdown: DowntimeCostBreakdown;
  contextTitle?: string;
  triggerLabel?: string;
  compactTrigger?: boolean;
}

export function DowntimeCostBreakdownModal({
  assetName,
  assetCode,
  breakdown,
  contextTitle,
  triggerLabel = 'شفافیت فرمول محاسبه ضرر (ریز فاکتور)',
  compactTrigger = false,
}: DowntimeCostBreakdownModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={
            compactTrigger
              ? 'h-8 px-2.5 text-[11px] border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs'
          }
        >
          <Calculator className="h-3.5 w-3.5 me-1.5 shrink-0" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-amber-400" />
              شفافیت فرمول محاسبه ضرر (ریز فاکتور سه‌جزئی توقف)
            </DialogTitle>
            <Badge
              variant={breakdown.stoppageType === 'UNPLANNED' ? 'destructive' : 'info'}
              className="text-xs"
            >
              {breakdown.stoppageType === 'UNPLANNED'
                ? 'توقف ناگهانی / اضطراری (UNPLANNED)'
                : 'توقف با برنامه (PLANNED)'}
            </Badge>
          </div>
          <DialogDescription className="text-xs leading-relaxed">
            تجهیز: <span className="font-bold text-foreground">{assetName}</span> (
            <bdi className="font-mono">{assetCode}</bdi>)
            {contextTitle ? ` — ${contextTitle}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 text-xs">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              توپولوژی خط و ظرفیت بافر:
            </div>
            <div className="font-bold text-foreground">
              {TOPOLOGY_LABELS_FA[breakdown.topologyType]}
            </div>
            <div className="text-[11px] text-muted-foreground">
              ذخیره سیلو/بافر میانی: {toPersianDigits(breakdown.bufferCapacityMinutes)} دقیقه | اثر
              ظرفیت: {toPersianDigits(breakdown.capacityImpactPercent)}٪
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              مدت توقف تجهیز در برابر خواب خط:
            </div>
            <div className="font-bold text-foreground">
              توقف تجهیز: {toPersianDigits(breakdown.durationMinutes)} دقیقه
            </div>
            <div className="text-[11px] text-emerald-400 font-medium">
              خواب مؤثر خط اصلی: {toPersianDigits(breakdown.effectiveLineDowntimeMinutes)} دقیقه
            </div>
          </div>

          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 space-y-1">
            <div className="text-red-300 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              مجموع کل خسارت مالی قابل ممیزی:
            </div>
            <div className="text-base font-bold font-mono text-red-300">
              {formatRialsFa(breakdown.totalLossRials)} ریال
            </div>
            <div className="text-[11px] text-muted-foreground">
              معادل {formatRialsFa(Math.round(breakdown.totalLossRials / 10))} تومان
            </div>
          </div>
        </div>

        {/* 5-Row Verifiable Breakdown Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[240px] text-right">جزء خسارت (۵ سطر استاندارد)</TableHead>
                <TableHead className="text-right">فرمول دقیق محاسبه و منطق فرآیندی</TableHead>
                <TableHead className="w-[180px] text-left">مبلغ خسارت (ریال)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.rows.map((row) => {
                const isTotal = row.key === 'TOTAL_LOSS';
                return (
                  <TableRow
                    key={row.key}
                    className={
                      isTotal
                        ? 'bg-red-500/10 font-bold border-t-2 border-red-500/40'
                        : 'hover:bg-muted/20'
                    }
                  >
                    <TableCell className="align-top py-3">
                      <div className={isTotal ? 'text-red-300 font-bold text-xs' : 'font-semibold text-xs'}>
                        {row.titleFa}
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-3 space-y-1">
                      <div className="text-xs font-mono bg-background/70 rounded px-2.5 py-1.5 border border-border/60 text-foreground leading-relaxed">
                        {row.formulaFa}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">
                        {row.detailsFa}
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-3 text-left font-mono">
                      <span
                        className={
                          isTotal
                            ? 'text-sm font-bold text-red-400'
                            : row.amountRials > 0
                              ? 'text-xs font-bold text-amber-300'
                              : 'text-xs text-muted-foreground'
                        }
                      >
                        {formatRialsFa(row.amountRials)} ریال
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            این ریز فاکتور مستقیماً از روی پارامترهای مهندسی صنایع تجهیز، لاگ توقفات ثبت‌شده و مصرف واقعی قطعات از انبار محاسبه شده و ۱۰۰٪ قابل راستی‌آزمایی توسط مدیریت کارخانه است.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
