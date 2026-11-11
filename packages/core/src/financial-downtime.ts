import { toPersianDigits } from './i18n/persian';

export type AssetTopologyKind = 'BOTTLENECK' | 'BUFFERED' | 'PARALLEL';
export type DowntimeStoppageType = 'PLANNED' | 'UNPLANNED';

export interface AssetFinancialInput {
  id?: string;
  code?: string;
  name?: string;
  topologyType?: AssetTopologyKind | null;
  bufferCapacityMinutes?: number | null;
  capacityImpactPercent?: number | null;
  hourlyLostMarginRials?: number | null;
  coldStartupThresholdMinutes?: number | null;
  restartEnergyAndSetupCostRials?: number | null;
  inLineScrapCostRials?: number | null;
}

export interface CalculateDowntimeInput {
  asset: AssetFinancialInput;
  durationMinutes: number;
  stoppageType: DowntimeStoppageType;
  sparePartsCostRials?: number;
  technicianLaborHours?: number;
  laborHourlyRateRials?: number;
}

export interface DowntimeFormulaRow {
  rowNumber: number;
  key:
    | 'LOST_PRODUCTION'
    | 'IN_LINE_SCRAP'
    | 'COLD_RESTART'
    | 'DIRECT_MAINTENANCE'
    | 'TOTAL_LOSS';
  titleFa: string;
  formulaFa: string;
  detailsFa: string;
  amountRials: number;
}

export interface DowntimeFormulaExplanationFa {
  effectiveDowntime: string;
  lostProduction: string;
  inLineScrap: string;
  coldRestartPenalty: string;
  directMaintenance: string;
  totalLoss: string;
}

export interface DowntimeCostBreakdown {
  durationMinutes: number;
  stoppageType: DowntimeStoppageType;
  topologyType: AssetTopologyKind;
  bufferCapacityMinutes: number;
  capacityImpactPercent: number;
  effectiveLineDowntimeMinutes: number;
  lostProductionCostRials: number;
  inLineScrapCostRials: number;
  coldRestartPenaltyRials: number;
  sparePartsCostRials: number;
  laborCostRials: number;
  directMaintenanceCostRials: number;
  totalLossRials: number;
  formulaExplanationFa: DowntimeFormulaExplanationFa;
  rows: DowntimeFormulaRow[];
}

export function formatRialsFa(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const formattedEn = safe.toLocaleString('en-US');
  return toPersianDigits(formattedEn);
}

export const TOPOLOGY_LABELS_FA: Record<AssetTopologyKind, string> = {
  BOTTLENECK: 'گلوگاه مطلق خط (Bottleneck)',
  BUFFERED: 'دارای سیلو / بافر میانی (Buffered)',
  PARALLEL: 'موازی / دارای رزرو (Parallel)',
};

export function calculateDowntimeFinancialImpact(
  input: CalculateDowntimeInput,
): DowntimeCostBreakdown;
export function calculateDowntimeFinancialImpact(
  asset: AssetFinancialInput,
  durationMinutes: number,
  stoppageType: DowntimeStoppageType,
  sparePartsCostRials?: number,
  technicianLaborHours?: number,
  laborHourlyRateRials?: number,
): DowntimeCostBreakdown;
export function calculateDowntimeFinancialImpact(
  arg1: CalculateDowntimeInput | AssetFinancialInput,
  arg2?: number,
  arg3?: DowntimeStoppageType,
  arg4?: number,
  arg5?: number,
  arg6?: number,
): DowntimeCostBreakdown {
  const isObjectCall =
    typeof arg1 === 'object' && arg1 !== null && 'asset' in arg1 && 'durationMinutes' in arg1;

  const asset: AssetFinancialInput = isObjectCall ? arg1.asset : arg1;
  const rawDuration = isObjectCall ? arg1.durationMinutes : (arg2 ?? 0);
  const stoppageType: DowntimeStoppageType = isObjectCall
    ? arg1.stoppageType
    : (arg3 ?? 'UNPLANNED');
  const rawSparePartsCost = isObjectCall ? (arg1.sparePartsCostRials ?? 0) : (arg4 ?? 0);
  const rawLaborHours = isObjectCall ? (arg1.technicianLaborHours ?? 0) : (arg5 ?? 0);
  const laborHourlyRateRials = isObjectCall
    ? (arg1.laborHourlyRateRials ?? 2_000_000)
    : (arg6 ?? 2_000_000);

  const durationMinutes = Math.max(0, Math.round(rawDuration));
  const topologyType: AssetTopologyKind = asset.topologyType ?? 'BOTTLENECK';
  const bufferCapacityMinutes = Math.max(0, Math.round(asset.bufferCapacityMinutes ?? 0));
  const capacityImpactPercent = Math.max(
    0,
    Math.min(100, Math.round(asset.capacityImpactPercent ?? (topologyType === 'PARALLEL' ? 50 : 100))),
  );
  const hourlyLostMarginRials = Math.max(0, Math.round(asset.hourlyLostMarginRials ?? 0));
  const coldStartupThresholdMinutes = Math.max(
    0,
    Math.round(asset.coldStartupThresholdMinutes ?? 120),
  );
  const restartEnergyAndSetupCostRials = Math.max(
    0,
    Math.round(asset.restartEnergyAndSetupCostRials ?? 0),
  );
  const assetInLineScrapRials = Math.max(0, Math.round(asset.inLineScrapCostRials ?? 0));

  // 1. effectiveLineDowntimeMinutes
  const effectiveLineDowntimeMinutes =
    topologyType === 'BUFFERED'
      ? Math.max(0, durationMinutes - bufferCapacityMinutes)
      : durationMinutes;

  // 2. lostProductionCostRials
  const lostProductionCostRials = Math.round(
    (effectiveLineDowntimeMinutes / 60) *
      hourlyLostMarginRials *
      (capacityImpactPercent / 100),
  );

  // 3. inLineScrapCostRials
  const inLineScrapCostRials =
    stoppageType === 'UNPLANNED' && durationMinutes > 0 ? assetInLineScrapRials : 0;

  // 4. coldRestartPenaltyRials
  const coldRestartPenaltyRials =
    durationMinutes > coldStartupThresholdMinutes ? restartEnergyAndSetupCostRials : 0;

  // 5. directMaintenanceCostRials
  const sparePartsCostRials = Math.max(0, Math.round(rawSparePartsCost));
  const safeLaborHours = Math.max(0, rawLaborHours);
  const laborCostRials = Math.round(safeLaborHours * Math.max(0, laborHourlyRateRials));
  const directMaintenanceCostRials = sparePartsCostRials + laborCostRials;

  // 6. totalLossRials
  const totalLossRials =
    lostProductionCostRials +
    inLineScrapCostRials +
    coldRestartPenaltyRials +
    directMaintenanceCostRials;

  const effectiveDowntimeText =
    topologyType === 'BUFFERED'
      ? `max(۰, ${toPersianDigits(durationMinutes)} دقیقه توقف تجهیز − ${toPersianDigits(bufferCapacityMinutes)} دقیقه ذخیره سیلو/بافر میانی) = ${toPersianDigits(effectiveLineDowntimeMinutes)} دقیقه توقف مؤثر خط اصلی`
      : `${toPersianDigits(durationMinutes)} دقیقه توقف مستقیم (${TOPOLOGY_LABELS_FA[topologyType]} — بدون بافر میانی)`;

  const lostProductionText = `(${toPersianDigits(effectiveLineDowntimeMinutes)} ÷ ۶۰ ساعت) × ${formatRialsFa(hourlyLostMarginRials)} ریال/ساعت × ${toPersianDigits(capacityImpactPercent)}٪ ضریب افت ظرفیت = ${formatRialsFa(lostProductionCostRials)} ریال`;

  const inLineScrapText =
    stoppageType === 'UNPLANNED'
      ? durationMinutes > 0
        ? `توقف ناگهانی (UNPLANNED) ← ضایع شدن محصول و مواد داخل کوره/خط = ${formatRialsFa(inLineScrapCostRials)} ریال`
        : 'بدون توقف (۰ دقیقه) ← ضایعات داخل خط = ۰ ریال'
      : 'توقف با برنامه (PLANNED) ← تخلیه کامل کوره و خط پیش از خاموشی = ۰ ریال';

  const coldRestartText =
    durationMinutes > coldStartupThresholdMinutes
      ? `مدت توقف (${toPersianDigits(durationMinutes)} دقیقه) > آستانه سرد شدن (${toPersianDigits(coldStartupThresholdMinutes)} دقیقه) ← جریمه سوخت پیش‌گرم و راه‌اندازی مجدد = ${formatRialsFa(coldRestartPenaltyRials)} ریال`
      : `مدت توقف (${toPersianDigits(durationMinutes)} دقیقه) ≤ آستانه سرد شدن (${toPersianDigits(coldStartupThresholdMinutes)} دقیقه) ← عدم سرد شدن کوره = ۰ ریال`;

  const laborHoursFormatted = toPersianDigits(Math.round(safeLaborHours * 10) / 10);
  const directMaintenanceText = `قطعات مصرفی (${formatRialsFa(sparePartsCostRials)} ریال) + دستمزد تکنسین (${laborHoursFormatted} ساعت × ${formatRialsFa(laborHourlyRateRials)} ریال = ${formatRialsFa(laborCostRials)} ریال) = ${formatRialsFa(directMaintenanceCostRials)} ریال`;

  const totalLossText = `${formatRialsFa(lostProductionCostRials)} + ${formatRialsFa(inLineScrapCostRials)} + ${formatRialsFa(coldRestartPenaltyRials)} + ${formatRialsFa(directMaintenanceCostRials)} = ${formatRialsFa(totalLossRials)} ریال`;

  const formulaExplanationFa: DowntimeFormulaExplanationFa = {
    effectiveDowntime: effectiveDowntimeText,
    lostProduction: lostProductionText,
    inLineScrap: inLineScrapText,
    coldRestartPenalty: coldRestartText,
    directMaintenance: directMaintenanceText,
    totalLoss: totalLossText,
  };

  const rows: DowntimeFormulaRow[] = [
    {
      rowNumber: 1,
      key: 'LOST_PRODUCTION',
      titleFa: '۱. تولید از دست رفته (با کسر زمان بافر میانی)',
      formulaFa: lostProductionText,
      detailsFa: effectiveDowntimeText,
      amountRials: lostProductionCostRials,
    },
    {
      rowNumber: 2,
      key: 'IN_LINE_SCRAP',
      titleFa: '۲. ضایعات مواد و محصول داخل کوره / خط تولید',
      formulaFa: inLineScrapText,
      detailsFa:
        stoppageType === 'UNPLANNED'
          ? 'خرابی بدون برنامه باعث توقف بار در ناحیه پخت/فرآیند و افت کیفی یا ضایعات کامل می‌شود.'
          : 'در تعمیرات پیشگیرانه برنامه‌ریزی‌شده، ورودی خط از قبل قطع و محصول تخلیه می‌گردد.',
      amountRials: inLineScrapCostRials,
    },
    {
      rowNumber: 3,
      key: 'COLD_RESTART',
      titleFa: '۳. جریمه سرد شدن کوره و انرژی پیش‌گرم مجدد',
      formulaFa: coldRestartText,
      detailsFa: `آستانه بحرانی افت دما: ${toPersianDigits(coldStartupThresholdMinutes)} دقیقه | هزینه گاز/برق و کالیبراسیون مجدد: ${formatRialsFa(restartEnergyAndSetupCostRials)} ریال`,
      amountRials: coldRestartPenaltyRials,
    },
    {
      rowNumber: 4,
      key: 'DIRECT_MAINTENANCE',
      titleFa: '۴. هزینه مستقیم تعمیرات (قطعات یدکی + دستمزد تکنسین)',
      formulaFa: directMaintenanceText,
      detailsFa: `مجموع بهای قطعات مصرفی از انبار و نفرساعت تیم تعمیرات`,
      amountRials: directMaintenanceCostRials,
    },
    {
      rowNumber: 5,
      key: 'TOTAL_LOSS',
      titleFa: '۵. مجموع کل خسارت مالی توقف (جمع کل ریز فاکتور)',
      formulaFa: totalLossText,
      detailsFa: 'مجموع ۴ جزء اقتصادی بالا (قابل راستی‌آزمایی توسط مدیریت کارخانه و واحد مالی)',
      amountRials: totalLossRials,
    },
  ];

  return {
    durationMinutes,
    stoppageType,
    topologyType,
    bufferCapacityMinutes,
    capacityImpactPercent,
    effectiveLineDowntimeMinutes,
    lostProductionCostRials,
    inLineScrapCostRials,
    coldRestartPenaltyRials,
    sparePartsCostRials,
    laborCostRials,
    directMaintenanceCostRials,
    totalLossRials,
    formulaExplanationFa,
    rows,
  };
}
