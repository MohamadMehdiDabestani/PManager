import type { PmSchedule } from '@cmms/db';

export interface MeterState {
  currentReading: number;
  dailyAverageUsage?: number;
}

/**
 * Pure domain calculation for next due date of a PM schedule.
 * Supports CALENDAR, METER (projected via daily average), and HYBRID (earliest wins).
 * Shifts off non-working days (e.g. Friday weekend in Iran: day 5).
 */
export function computeNextDue(
  schedule: Pick<
    PmSchedule,
    | 'triggerType'
    | 'anchorMode'
    | 'intervalDays'
    | 'intervalMeter'
    | 'lastDoneAt'
    | 'lastDoneMeter'
    | 'nextDueAt'
  >,
  ctx: {
    now: Date;
    meter?: MeterState | null;
    workingDays?: number[]; // default Sat(6)-Thu(4): [6,0,1,2,3,4]
  },
): Date | null {
  const workingDays = ctx.workingDays ?? [6, 0, 1, 2, 3, 4];
  let calendarDue: Date | null = null;
  let meterDue: Date | null = null;

  if (schedule.triggerType === 'CALENDAR' || schedule.triggerType === 'HYBRID') {
    if (schedule.nextDueAt && schedule.anchorMode === 'FIXED') {
      calendarDue = new Date(schedule.nextDueAt.getTime());
    } else if (schedule.intervalDays && schedule.intervalDays > 0) {
      const base = schedule.lastDoneAt ?? ctx.now;
      calendarDue = new Date(base.getTime() + schedule.intervalDays * 86_400_000);
    }
  }

  if (
    (schedule.triggerType === 'METER' || schedule.triggerType === 'HYBRID') &&
    schedule.intervalMeter &&
    schedule.intervalMeter > 0 &&
    ctx.meter
  ) {
    const baseMeter = schedule.lastDoneMeter ?? 0;
    const targetMeter = baseMeter + schedule.intervalMeter;
    const remaining = targetMeter - ctx.meter.currentReading;

    if (remaining <= 0) {
      meterDue = new Date(ctx.now.getTime());
    } else if (ctx.meter.dailyAverageUsage && ctx.meter.dailyAverageUsage > 0) {
      const daysLeft = Math.ceil(remaining / ctx.meter.dailyAverageUsage);
      meterDue = new Date(ctx.now.getTime() + daysLeft * 86_400_000);
    }
  }

  let chosen: Date | null = null;
  if (calendarDue && meterDue) {
    chosen = calendarDue <= meterDue ? calendarDue : meterDue;
  } else {
    chosen = calendarDue ?? meterDue;
  }

  if (!chosen) return null;
  return shiftToWorkingDay(chosen, workingDays);
}

export function shiftToWorkingDay(date: Date, workingDays: number[]): Date {
  if (workingDays.length === 0) return date;
  const result = new Date(date.getTime());
  for (let i = 0; i < 7; i++) {
    if (workingDays.includes(result.getUTCDay())) {
      return result;
    }
    result.setUTCDate(result.getUTCDate() + 1);
  }
  return result;
}

export function advanceNextDueOnCompletion(
  schedule: Pick<
    PmSchedule,
    'triggerType' | 'anchorMode' | 'intervalDays' | 'intervalMeter' | 'nextDueAt'
  >,
  completion: {
    completedAt: Date;
    completedMeter?: number;
    meter?: MeterState | null;
    workingDays?: number[];
  },
): { nextDueAt: Date | null; nextDueMeter: number | null } {
  const workingDays = completion.workingDays ?? [6, 0, 1, 2, 3, 4];
  let nextDueAt: Date | null = null;
  let nextDueMeter: number | null = null;

  if (schedule.triggerType === 'CALENDAR' || schedule.triggerType === 'HYBRID') {
    if (schedule.intervalDays && schedule.intervalDays > 0) {
      if (schedule.anchorMode === 'FIXED' && schedule.nextDueAt) {
        nextDueAt = new Date(schedule.nextDueAt.getTime() + schedule.intervalDays * 86_400_000);
      } else {
        nextDueAt = new Date(completion.completedAt.getTime() + schedule.intervalDays * 86_400_000);
      }
      nextDueAt = shiftToWorkingDay(nextDueAt, workingDays);
    }
  }

  if (
    (schedule.triggerType === 'METER' || schedule.triggerType === 'HYBRID') &&
    schedule.intervalMeter &&
    schedule.intervalMeter > 0
  ) {
    const baseMeter = completion.completedMeter ?? completion.meter?.currentReading ?? 0;
    nextDueMeter = baseMeter + schedule.intervalMeter;

    if (completion.meter?.dailyAverageUsage && completion.meter.dailyAverageUsage > 0) {
      const daysLeft = Math.ceil(schedule.intervalMeter / completion.meter.dailyAverageUsage);
      const projectedDate = shiftToWorkingDay(
        new Date(completion.completedAt.getTime() + daysLeft * 86_400_000),
        workingDays,
      );
      if (!nextDueAt || projectedDate < nextDueAt) {
        nextDueAt = projectedDate;
      }
    }
  }

  return { nextDueAt, nextDueMeter };
}

/**
 * Calculates rolling average daily usage from meter reading records.
 * Readings should ideally span a few days or weeks.
 */
export function calculateDailyAverageUsage(
  readings: Array<{ reading: number; recordedAt: Date }>,
): number | undefined {
  if (readings.length < 2) return undefined;
  const sorted = [...readings].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  if (!oldest || !newest) return undefined;
  const diffDays = (newest.recordedAt.getTime() - oldest.recordedAt.getTime()) / 86_400_000;
  const diffReading = newest.reading - oldest.reading;
  if (diffDays <= 0 || diffReading < 0) return undefined;
  return diffReading / diffDays;
}

