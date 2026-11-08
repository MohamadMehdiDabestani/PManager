import { describe, it, expect } from 'vitest';
import { count } from 'drizzle-orm';
import { workOrders } from '@cmms/db';
import { makeGenerateWorkOrders } from '../src/processors/generate-work-orders';
import { buildTestDeps, fakeJob, seedSchedule } from './helpers'; // real Postgres + Drizzle + fake clock

describe('generate-work-orders', () => {
  it('creates one WO per due schedule and is idempotent when run twice', async () => {
    const d = await buildTestDeps({ now: '2026-03-01T22:30:00Z' }); // 02:00 Tehran next day
    await seedSchedule(d, { intervalDays: 30, leadDays: 3, lastDoneAt: '2026-01-29T00:00:00Z' });
    const run = makeGenerateWorkOrders(d);

    await run(fakeJob({ horizonDays: 0 }));
    await run(fakeJob({ horizonDays: 0 }));

    const [res] = await d.db.select({ total: count() }).from(workOrders);
    expect(res?.total).toBe(1);
  });

  it('does not create WOs for decommissioned assets', async () => { /* ... */ });
});

// Also test: send-notification skips closed WOs; permanent errors throw UnrecoverableError;
// escalation stops when WO acknowledged; scheduler registration twice yields one scheduler per id.
