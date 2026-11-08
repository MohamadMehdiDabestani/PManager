---
name: pm-scheduling-engine
description: Use when implementing PM schedule rules - next-due calculation (calendar, meter, hybrid), fixed vs floating schedules, lead time, work-order generation, plant working calendar, PM templates/checklists, compliance KPI, and grouping tasks per asset shutdown.
---

# PM scheduling engine

Pure domain logic in `packages/core/domain/pm-schedule.ts`. No DB, no `new Date()`; take `now` and readings as inputs so it is unit-testable.

## Trigger types
- `CALENDAR`: every N days/weeks/months/years.
- `METER`: every N units of a meter (running hours, cycles, pieces produced).
- `HYBRID`: whichever comes first.
- `CONDITION` (later, PdM): created from an alert/threshold, not by cron.

## Fixed vs floating
- **FIXED**: next due = previous *due* + interval (keeps cadence; use for statutory/regulatory checks, calibration).
- **FLOATING**: next due = *completion date* + interval (use for lubrication, filters; avoids bunching after late work).
Store `strategy` on the schedule. Late completion under FIXED can create catch-up WOs: cap at 1 outstanding WO per schedule (skip duplicates; mark missed).

## computeNextDue (contract)
```ts
computeNextDue(schedule, { now, meter? }): Date | null
```
- Calendar: add interval in the plant timezone; Jalali months are NOT a calendar interval choice - offer "monthly" as 30 days or "same Jalali day each month" explicitly.
- Meter: `remaining = nextDueMeter - currentMeter`; `daysLeft = remaining / avgDailyUsage(last 30d)`; due = now + daysLeft. If usage data is missing, fall back to the calendar fallback interval.
- Hybrid: min of both.
- Respect plant calendar: if due date is a non-working day, shift to the previous working day (configurable: previous/next).
- Return `null` when schedule inactive, asset decommissioned, or already has an open WO for the cycle.

## Work-order generation rules
- Lead time `leadDays`: create WO when `dueAt - leadDays <= now`.
- One open WO per schedule; unique `(pmScheduleId, dueAt)` in DB.
- Snapshot the checklist (`checklistSnapshot`) into the WO so later template edits do not rewrite history.
- **Group by asset shutdown**: when an asset needs a shutdown, bundle all schedules due within a configurable window (default 7 days) into one WO group; suggest the next planned stop from the production plan.
- Priority derives from asset criticality (A/B/C) and overdue age.
- Default assignee from schedule, else round-robin by skill/shift, else planner queue.
- After completion: write `lastDoneAt`, `lastDoneMeter`, recompute `nextDueAt`/`nextDueMeter`, write audit, enqueue next generation check.

## Overdue & compliance
- Status machine: `OPEN -> ASSIGNED -> IN_PROGRESS -> DONE`; side states `ON_HOLD` (waiting part/shutdown), `OVERDUE` (derived/flagged by job), `CANCELLED`.
- **PM compliance %** = completed on time / scheduled in period (grace window configurable, default 10% of interval or 1 day for daily tasks). Exclude cancelled-with-reason.
- KPIs: MTBF = operating time / failures; MTTR = total repair time / repairs; downtime from `DowntimeEvent`; backlog size and age; PM:CM ratio.

## Edge cases to test
Leap/Jalali month ends, DST-free Asia/Tehran vs UTC conversion, meter reset/rollover, meter reading going backwards (reject with audit), schedule edited mid-cycle, asset moved, template changed, WO completed twice (offline duplicates), generator run twice, generator run late after downtime of the worker (catch-up without spamming 30 WOs).

## Related
Queue/job wiring: `bullmq-worker`. Offline completion conflicts: `pwa-offline`.
