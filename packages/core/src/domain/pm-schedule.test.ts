import { describe, it, expect } from 'vitest';
import { computeNextDue } from './pm-schedule.js';

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
});
