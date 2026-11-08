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
