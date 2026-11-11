import { toPersianDigits } from './i18n/persian';

export const REWORK_WINDOW_HOURS = 72;
export const PENCIL_WHIPPING_MIN_RATIO = 0.3;
export const PENCIL_WHIPPING_HISTORY_COUNT = 3;

// ============================================================================
// 1. Pencil-Whipping detection
// ============================================================================

export interface PencilWhippingInput {
  startedAt: Date | null;
  completedAt: Date;
  /** زمان تخمینی قالب چک‌لیست (دقیقه)؛ اگر نامشخص باشد قاعده ۱ ارزیابی نمی‌شود */
  estimatedMinutes?: number | null;
  /** مقادیر عددی فعلی چک‌لیست: itemId -> value */
  numericAnswers: Record<string, number>;
  /** مقادیر عددی سرویس‌های قبلی همان تجهیز (جدیدترین اول) */
  previousNumericAnswers: Array<Record<string, number>>;
}

export interface PencilWhippingResult {
  isSuspicious: boolean;
  reasonsFa: string[];
  reasonFa: string | null;
}

export function detectPencilWhipping(input: PencilWhippingInput): PencilWhippingResult {
  const reasonsFa: string[] = [];

  // قاعده ۱: زمان اجرای واقعی کمتر از ۳۰٪ زمان تخمینی
  if (input.estimatedMinutes && input.estimatedMinutes > 0) {
    const actualMinutes = input.startedAt
      ? Math.max(0, (input.completedAt.getTime() - input.startedAt.getTime()) / 60_000)
      : 0;
    if (actualMinutes < input.estimatedMinutes * PENCIL_WHIPPING_MIN_RATIO) {
      const shown = Math.round(actualMinutes * 10) / 10;
      reasonsFa.push(
        input.startedAt
          ? `چک‌لیست ${toPersianDigits(input.estimatedMinutes)} دقیقه‌ای در ${toPersianDigits(shown)} دقیقه بسته شده است (کمتر از ${toPersianDigits(Math.round(PENCIL_WHIPPING_MIN_RATIO * 100))}٪ زمان تخمینی)`
          : `زمان شروع عملیات ثبت نشده و چک‌لیست ${toPersianDigits(input.estimatedMinutes)} دقیقه‌ای بدون اجرای واقعی بسته شده است`,
      );
    }
  }

  // قاعده ۲: کپی دقیق مقادیر عددی ۳ سرویس قبلی (واریانس صفر)
  const itemIds = Object.keys(input.numericAnswers);
  if (
    itemIds.length > 0 &&
    input.previousNumericAnswers.length >= PENCIL_WHIPPING_HISTORY_COUNT
  ) {
    const history = input.previousNumericAnswers.slice(0, PENCIL_WHIPPING_HISTORY_COUNT);
    const allIdentical = itemIds.every((id) =>
      history.every((h) => h[id] !== undefined && h[id] === input.numericAnswers[id]),
    );
    if (allIdentical) {
      reasonsFa.push(
        `تمام ${toPersianDigits(itemIds.length)} مقدار عددی چک‌لیست (فشار/دما/...) دقیقاً برابر ${toPersianDigits(PENCIL_WHIPPING_HISTORY_COUNT)} سرویس قبلی همین تجهیز است (واریانس صفر)`,
      );
    }
  }

  return {
    isSuspicious: reasonsFa.length > 0,
    reasonsFa,
    reasonFa: reasonsFa.length > 0 ? reasonsFa.join(' | ') : null,
  };
}

// ============================================================================
// 2. Technician First-Time Fix Rate (FTFR)
// ============================================================================

export interface FtfrWorkOrderInput {
  id: string;
  assetId: string;
  componentCodeId: string | null;
  assigneeId: string | null;
  assigneeName?: string | null;
  type: 'PM' | 'CM' | 'PDM';
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface TechnicianFtfrStat {
  technicianId: string;
  technicianName: string;
  totalCompletedRepairs: number;
  reworkCount: number;
  firstTimeFixCount: number;
  /** درصد موفقیت بار اول (۰ تا ۱۰۰) */
  ftfrPercent: number;
}

export interface FtfrResult {
  /** دستورکارهایی که تعمیرشان ظرف ۷۲ ساعت دوباره خراب شده است (isRework = true) */
  reworkWorkOrderIds: string[];
  /** نگاشت دستورکار معیوب ← دستورکار اضطراریِ بعدی که تکرار خرابی را ثابت کرد */
  reworkTriggers: Record<string, string>;
  technicians: TechnicianFtfrStat[];
}

/**
 * اگر روی یک تجهیز و یک قطعه (componentCodeId) کمتر از ۷۲ ساعت پس از بسته شدن
 * یک دستورکار، دستورکار اضطراری (CM) دیگری ثبت شود، دستورکار قبلی «تعمیر ناموفق بار اول» است.
 * FTFR هر تکنسین = (تعمیرهای بدون تکرار ÷ کل تعمیرهای بسته‌شده) × ۱۰۰
 */
export function calculateTechnicianFTFR(workOrders: FtfrWorkOrderInput[]): FtfrResult {
  const windowMs = REWORK_WINDOW_HOURS * 3_600_000;

  const repairs = workOrders.filter(
    (w) =>
      w.status === 'DONE' &&
      w.completedAt !== null &&
      w.componentCodeId !== null &&
      w.type !== 'PM',
  );
  const emergencies = workOrders.filter((w) => w.type === 'CM' && w.componentCodeId !== null);

  const reworkTriggers: Record<string, string> = {};
  for (const prev of repairs) {
    const doneAt = prev.completedAt!.getTime();
    const trigger = emergencies
      .filter(
        (e) =>
          e.id !== prev.id &&
          e.assetId === prev.assetId &&
          e.componentCodeId === prev.componentCodeId &&
          e.createdAt.getTime() > doneAt &&
          e.createdAt.getTime() - doneAt <= windowMs,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (trigger) {
      reworkTriggers[prev.id] = trigger.id;
    }
  }

  const byTech = new Map<string, TechnicianFtfrStat>();
  for (const r of repairs) {
    if (!r.assigneeId) continue;
    const stat = byTech.get(r.assigneeId) ?? {
      technicianId: r.assigneeId,
      technicianName: r.assigneeName ?? r.assigneeId,
      totalCompletedRepairs: 0,
      reworkCount: 0,
      firstTimeFixCount: 0,
      ftfrPercent: 100,
    };
    stat.totalCompletedRepairs++;
    if (reworkTriggers[r.id]) {
      stat.reworkCount++;
    } else {
      stat.firstTimeFixCount++;
    }
    byTech.set(r.assigneeId, stat);
  }

  const technicians = Array.from(byTech.values())
    .map((s) => ({
      ...s,
      ftfrPercent:
        s.totalCompletedRepairs > 0
          ? Math.round((s.firstTimeFixCount / s.totalCompletedRepairs) * 1000) / 10
          : 100,
    }))
    .sort((a, b) => a.ftfrPercent - b.ftfrPercent || b.totalCompletedRepairs - a.totalCompletedRepairs);

  return {
    reworkWorkOrderIds: Object.keys(reworkTriggers),
    reworkTriggers,
    technicians,
  };
}

// ============================================================================
// 3. Pareto analysis (80/20)
// ============================================================================

export type ParetoGroupBy = 'PAIR' | 'COMPONENT' | 'ROOT_CAUSE';

export interface ParetoFailureInput {
  componentCodeId: string | null;
  rootCauseCodeId: string | null;
  downtimeMinutes: number;
  lossRials: number;
}

export interface ParetoPoint {
  key: string;
  labelFa: string;
  componentCodeId: string | null;
  rootCauseCodeId: string | null;
  incidentCount: number;
  downtimeHours: number;
  lossRials: number;
  /** مقدار متریک انتخاب‌شده (ساعت یا ریال) */
  value: number;
  percent: number;
  cumulativePercent: number;
  /** آیا این ستون در محدوده ۸۰٪ تجمعی (گروه «معدود حیاتی») است؟ */
  withinVitalFew: boolean;
}

export interface ParetoAnalysis {
  byLossRials: ParetoPoint[];
  byDowntimeHours: ParetoPoint[];
  totalLossRials: number;
  totalDowntimeHours: number;
}

export interface ParetoLabels {
  components: Record<string, string>;
  rootCauses: Record<string, string>;
}

function buildPareto(
  groups: Map<string, Omit<ParetoPoint, 'value' | 'percent' | 'cumulativePercent' | 'withinVitalFew'>>,
  metric: 'lossRials' | 'downtimeHours',
): ParetoPoint[] {
  const list = Array.from(groups.values()).sort(
    (a, b) => b[metric] - a[metric] || a.labelFa.localeCompare(b.labelFa, 'fa'),
  );
  const total = list.reduce((s, p) => s + p[metric], 0);
  let running = 0;
  return list.map((p) => {
    const before = total > 0 ? (running / total) * 100 : 0;
    running += p[metric];
    const cumulative = total > 0 ? (running / total) * 100 : 0;
    return {
      ...p,
      value: p[metric],
      percent: total > 0 ? Math.round((p[metric] / total) * 1000) / 10 : 0,
      cumulativePercent: Math.round(cumulative * 10) / 10,
      // ستونی که پیش از آن تجمعی هنوز کمتر از ۸۰٪ بوده جزو گروه حیاتی است
      withinVitalFew: before < 80,
    };
  });
}

export function calculateParetoAnalysis(
  failures: ParetoFailureInput[],
  labels: ParetoLabels,
  groupBy: ParetoGroupBy = 'PAIR',
): ParetoAnalysis {
  const groups = new Map<
    string,
    Omit<ParetoPoint, 'value' | 'percent' | 'cumulativePercent' | 'withinVitalFew'>
  >();

  for (const f of failures) {
    if (!f.componentCodeId && !f.rootCauseCodeId) continue;
    const comp = groupBy === 'ROOT_CAUSE' ? null : f.componentCodeId;
    const root = groupBy === 'COMPONENT' ? null : f.rootCauseCodeId;
    const key = `${comp ?? '-'}|${root ?? '-'}`;

    const compLabel = comp ? (labels.components[comp] ?? 'قطعه نامشخص') : null;
    const rootLabel = root ? (labels.rootCauses[root] ?? 'علت نامشخص') : null;
    const labelFa =
      compLabel && rootLabel ? `${compLabel} ← ${rootLabel}` : (compLabel ?? rootLabel ?? 'نامشخص');

    const g = groups.get(key) ?? {
      key,
      labelFa,
      componentCodeId: comp,
      rootCauseCodeId: root,
      incidentCount: 0,
      downtimeHours: 0,
      lossRials: 0,
    };
    g.incidentCount++;
    g.downtimeHours += Math.max(0, f.downtimeMinutes) / 60;
    g.lossRials += Math.max(0, f.lossRials);
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    g.downtimeHours = Math.round(g.downtimeHours * 100) / 100;
    g.lossRials = Math.round(g.lossRials);
  }

  const byLossRials = buildPareto(groups, 'lossRials');
  const byDowntimeHours = buildPareto(groups, 'downtimeHours');

  return {
    byLossRials,
    byDowntimeHours,
    totalLossRials: byLossRials.reduce((s, p) => s + p.lossRials, 0),
    totalDowntimeHours: Math.round(byDowntimeHours.reduce((s, p) => s + p.downtimeHours, 0) * 100) / 100,
  };
}
