import { describe, it, expect, vi } from 'vitest';
import { calculatePlantKpis } from './kpi-service';
import { defineAbilityFor } from '../auth/ability';
import type { ServiceContext } from '../context';

describe('KPI Calculation Service (PM Compliance, MTBF, MTTR, Bad Actors)', () => {
  const managerUser = {
    id: 'mgr-1',
    role: 'MAINTENANCE_MANAGER' as const,
    plantIds: ['plant-1'],
    rulesVersion: 1,
  };
  const ability = defineAbilityFor(managerUser);

  it('calculates 100% PM compliance when all PM work orders are completed on time', async () => {
    const now = new Date('2026-11-08T12:00:00Z');
    const past = new Date(now.getTime() - 10 * 24 * 3600 * 1000);

    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            // Return 2 PM work orders, both completed on time
            return Promise.resolve([
              {
                id: 'wo-1',
                type: 'PM',
                status: 'DONE',
                priority: 'MEDIUM',
                dueAt: new Date('2026-11-05T12:00:00Z'),
                completedAt: new Date('2026-11-05T10:00:00Z'),
                createdAt: new Date('2026-11-01T12:00:00Z'),
              },
              {
                id: 'wo-2',
                type: 'PM',
                status: 'DONE',
                priority: 'HIGH',
                dueAt: new Date('2026-11-06T12:00:00Z'),
                completedAt: new Date('2026-11-06T11:00:00Z'),
                createdAt: new Date('2026-11-02T12:00:00Z'),
              },
            ]);
          }),
        })),
      })),
    };

    // Override sequential select queries: 1. workOrders, 2. downtimeLogs, 3. assets
    let callCount = 0;
    mockDb.select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Work Orders
            return Promise.resolve([
              {
                id: 'wo-1',
                type: 'PM',
                status: 'DONE',
                priority: 'MEDIUM',
                dueAt: new Date('2026-11-05T12:00:00Z'),
                completedAt: new Date('2026-11-05T10:00:00Z'),
                createdAt: new Date('2026-11-01T12:00:00Z'),
              },
              {
                id: 'wo-2',
                type: 'PM',
                status: 'DONE',
                priority: 'HIGH',
                dueAt: new Date('2026-11-06T12:00:00Z'),
                completedAt: new Date('2026-11-06T11:00:00Z'),
                createdAt: new Date('2026-11-02T12:00:00Z'),
              },
            ]);
          } else if (callCount === 2) {
            // Downtimes (one 120min unplanned failure)
            return Promise.resolve([
              {
                id: 'dt-1',
                assetId: 'asset-1',
                startedAt: new Date('2026-11-03T10:00:00Z'),
                endedAt: new Date('2026-11-03T12:00:00Z'), // 120 min
                isPlanned: false,
                reason: 'خرابی یاتاقان پمپ',
              },
            ]);
          } else {
            // Assets
            return Promise.resolve([
              {
                id: 'asset-1',
                code: 'PMP-101',
                name: 'پمپ تغذیه بویلر',
                criticality: 'CRITICAL',
              },
            ]);
          }
        }),
      })),
    }));

    const dummyLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => dummyLogger,
    };

    const ctx: ServiceContext = {
      db: mockDb as never,
      ability,
      user: managerUser,
      now: () => now,
      logger: dummyLogger,
    };

    const result = await calculatePlantKpis(ctx, {
      plantId: 'plant-1',
      from: past,
      to: now,
    });

    expect(result.pmCompliance.complianceRate).toBe(100);
    expect(result.pmCompliance.completedOnTime).toBe(2);
    expect(result.pmCompliance.totalPmDue).toBe(2);
    expect(result.reliability.unplannedFailuresCount).toBe(1);
    expect(result.reliability.mttrMinutes).toBe(120); // 120 min total / 1 failure
    expect(result.downtime.totalDowntimeHours).toBe(2);
    expect(result.topBadActors.length).toBe(1);
    expect(result.topBadActors[0]?.assetCode).toBe('PMP-101');
  });

  it('correctly handles zero failure scenarios without division by zero', async () => {
    const now = new Date('2026-11-08T12:00:00Z');
    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) return Promise.resolve([]);
            if (callCount === 2) return Promise.resolve([]);
            return Promise.resolve([
              { id: 'asset-1', code: 'A1', name: 'Asset 1', criticality: 'LOW' },
            ]);
          }),
        })),
      })),
    };

    const dummyLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => dummyLogger,
    };

    const ctx: ServiceContext = {
      db: mockDb as never,
      ability,
      user: managerUser,
      now: () => now,
      logger: dummyLogger,
    };

    const result = await calculatePlantKpis(ctx);

    expect(result.pmCompliance.complianceRate).toBe(100);
    expect(result.reliability.unplannedFailuresCount).toBe(0);
    expect(result.reliability.mttrMinutes).toBe(0);
    expect(result.downtime.totalDowntimeHours).toBe(0);
    expect(result.topBadActors).toEqual([]);
  });
});
