import { describe, it, expect } from 'vitest';
import {
  computeNextDue,
  advanceNextDueOnCompletion,
  calculateDailyAverageUsage,
} from './pm-schedule';

describe('PM Schedule Engine - computeNextDue', () => {
  it('calculates floating calendar due date and shifts Friday (day 5) to Saturday (day 6)', () => {
    // 2026-03-04 is Wednesday; +2 days = Friday 2026-03-06 -> should shift to Saturday 2026-03-07
    const lastDoneAt = new Date('2026-03-04T08:00:00Z');
    const now = new Date('2026-03-04T08:00:00Z');
    const due = computeNextDue(
      {
        triggerType: 'CALENDAR',
        anchorMode: 'FLOATING',
        intervalDays: 2,
        intervalMeter: null,
        lastDoneAt,
        lastDoneMeter: null,
        nextDueAt: null,
      },
      { now, workingDays: [6, 0, 1, 2, 3, 4] },
    );

    expect(due?.toISOString()).toBe('2026-03-07T08:00:00.000Z');
    expect(due?.getUTCDay()).toBe(6); // Saturday
  });

  it('chooses the earlier due date in HYBRID mode', () => {
    const now = new Date('2026-03-01T08:00:00Z'); // Sunday
    const due = computeNextDue(
      {
        triggerType: 'HYBRID',
        anchorMode: 'FLOATING',
        intervalDays: 30,
        intervalMeter: 100,
        lastDoneAt: now,
        lastDoneMeter: 500,
        nextDueAt: null,
      },
      {
        now,
        meter: { currentReading: 580, dailyAverageUsage: 10 }, // 20 remaining / 10 per day = 2 days (Tuesday)
      },
    );

    expect(due?.toISOString()).toBe('2026-03-03T08:00:00.000Z');
  });

  it('triggers immediately when meter target reading is already reached or exceeded', () => {
    const now = new Date('2026-03-01T08:00:00Z');
    const due = computeNextDue(
      {
        triggerType: 'METER',
        anchorMode: 'FLOATING',
        intervalDays: null,
        intervalMeter: 50,
        lastDoneAt: null,
        lastDoneMeter: 1000,
        nextDueAt: null,
      },
      {
        now,
        meter: { currentReading: 1060 }, // 1000 + 50 = 1050 target -> exceeded!
      },
    );

    expect(due?.toISOString()).toBe('2026-03-01T08:00:00.000Z');
  });

  it('advances next due date correctly on completion in FIXED vs FLOATING modes', () => {
    const fixedSchedule = {
      triggerType: 'CALENDAR' as const,
      anchorMode: 'FIXED' as const,
      intervalDays: 7,
      intervalMeter: null,
      nextDueAt: new Date('2026-03-01T08:00:00Z'), // Sunday
    };

    // Completed 2 days late on 2026-03-03
    const nextFixed = advanceNextDueOnCompletion(fixedSchedule, {
      completedAt: new Date('2026-03-03T10:00:00Z'),
    });
    // In FIXED, next due is previous nextDueAt + 7 days = 2026-03-08
    expect(nextFixed.nextDueAt?.toISOString()).toBe('2026-03-08T08:00:00.000Z');

    const floatingSchedule = {
      triggerType: 'CALENDAR' as const,
      anchorMode: 'FLOATING' as const,
      intervalDays: 7,
      intervalMeter: null,
      nextDueAt: new Date('2026-03-01T08:00:00Z'),
    };

    // Completed 2 days late on 2026-03-03
    const nextFloating = advanceNextDueOnCompletion(floatingSchedule, {
      completedAt: new Date('2026-03-03T10:00:00Z'),
    });
    // In FLOATING, next due is completedAt + 7 days = 2026-03-10
    expect(nextFloating.nextDueAt?.toISOString()).toBe('2026-03-10T10:00:00.000Z');
  });

  it('calculates average daily usage across multiple readings', () => {
    const readings = [
      { reading: 100, recordedAt: new Date('2026-03-01T00:00:00Z') },
      { reading: 150, recordedAt: new Date('2026-03-06T00:00:00Z') }, // 5 days, 50 units -> 10/day
    ];
    const avg = calculateDailyAverageUsage(readings);
    expect(avg).toBe(10);
  });
});

