import { describe, it, expect } from 'vitest';
import {
  detectPencilWhipping,
  calculateTechnicianFTFR,
  calculateParetoAnalysis,
  type FtfrWorkOrderInput,
  type ParetoFailureInput,
} from './quality-and-pareto';

describe('quality-and-pareto logic', () => {
  describe('detectPencilWhipping', () => {
    it('flags checklist completed in less than 30% of estimated minutes', () => {
      const startedAt = new Date('2026-11-10T10:00:00Z');
      // 5 minutes later, but template estimate is 60 minutes (30% is 18 minutes)
      const completedAt = new Date('2026-11-10T10:05:00Z');

      const result = detectPencilWhipping({
        startedAt,
        completedAt,
        estimatedMinutes: 60,
        numericAnswers: { 'item-1': 4.5 },
        previousNumericAnswers: [],
      });

      expect(result.isSuspicious).toBe(true);
      expect(result.reasonFa).toContain('کمتر از ۳۰٪ زمان تخمینی');
    });

    it('flags identical numeric values across 3 previous inspections (zero variance copy-paste)', () => {
      const startedAt = new Date('2026-11-10T10:00:00Z');
      const completedAt = new Date('2026-11-10T10:45:00Z'); // 45 min for 60 min -> normal duration

      const currentAnswers = { pressure: 220.5, temp: 48.2 };
      const previousAnswers = [
        { pressure: 220.5, temp: 48.2 },
        { pressure: 220.5, temp: 48.2 },
        { pressure: 220.5, temp: 48.2 },
      ];

      const result = detectPencilWhipping({
        startedAt,
        completedAt,
        estimatedMinutes: 60,
        numericAnswers: currentAnswers,
        previousNumericAnswers: previousAnswers,
      });

      expect(result.isSuspicious).toBe(true);
      expect(result.reasonFa).toContain('واریانس صفر');
    });

    it('passes legitimate inspection with normal duration and natural variance', () => {
      const startedAt = new Date('2026-11-10T10:00:00Z');
      const completedAt = new Date('2026-11-10T10:50:00Z');

      const result = detectPencilWhipping({
        startedAt,
        completedAt,
        estimatedMinutes: 60,
        numericAnswers: { pressure: 224.1, temp: 51.0 },
        previousNumericAnswers: [
          { pressure: 220.5, temp: 48.2 },
          { pressure: 219.0, temp: 47.9 },
          { pressure: 222.0, temp: 49.5 },
        ],
      });

      expect(result.isSuspicious).toBe(false);
      expect(result.reasonFa).toBeNull();
    });
  });

  describe('calculateTechnicianFTFR', () => {
    it('marks repair as rework if another CM occurs on same asset and component within 72 hours', () => {
      const t0 = new Date('2026-11-01T08:00:00Z');
      const t0Done = new Date('2026-11-01T11:00:00Z');
      // 24 hours later -> within 72h window
      const t1 = new Date('2026-11-02T11:00:00Z');

      const workOrders: FtfrWorkOrderInput[] = [
        {
          id: 'wo-repair-1',
          assetId: 'kiln-1',
          componentCodeId: 'comp-roller-1',
          assigneeId: 'tech-reza',
          assigneeName: 'رضا اکبری',
          type: 'CM',
          status: 'DONE',
          createdAt: t0,
          completedAt: t0Done,
        },
        {
          id: 'wo-emergency-2',
          assetId: 'kiln-1',
          componentCodeId: 'comp-roller-1',
          assigneeId: 'tech-ali',
          assigneeName: 'علی حسینی',
          type: 'CM',
          status: 'OPEN',
          createdAt: t1,
          completedAt: null,
        },
        // Another repair by reza on a different component that was successful
        {
          id: 'wo-repair-3',
          assetId: 'press-1',
          componentCodeId: 'comp-valve-1',
          assigneeId: 'tech-reza',
          assigneeName: 'رضا اکبری',
          type: 'CM',
          status: 'DONE',
          createdAt: new Date('2026-11-05T08:00:00Z'),
          completedAt: new Date('2026-11-05T10:00:00Z'),
        },
      ];

      const ftfr = calculateTechnicianFTFR(workOrders);

      expect(ftfr.reworkWorkOrderIds).toContain('wo-repair-1');
      expect(ftfr.reworkTriggers['wo-repair-1']).toBe('wo-emergency-2');

      const reza = ftfr.technicians.find((t) => t.technicianId === 'tech-reza');
      expect(reza).toBeDefined();
      expect(reza?.totalCompletedRepairs).toBe(2);
      expect(reza?.reworkCount).toBe(1);
      expect(reza?.firstTimeFixCount).toBe(1);
      expect(reza?.ftfrPercent).toBe(50); // 1 / 2 = 50%
    });

    it('does NOT mark repair as rework if failure happens after 72 hours or on different component', () => {
      const t0Done = new Date('2026-11-01T10:00:00Z');
      // 80 hours later (beyond 72h)
      const tLate = new Date('2026-11-04T18:00:00Z');

      const workOrders: FtfrWorkOrderInput[] = [
        {
          id: 'wo-repair-1',
          assetId: 'kiln-1',
          componentCodeId: 'comp-roller-1',
          assigneeId: 'tech-reza',
          type: 'CM',
          status: 'DONE',
          createdAt: new Date('2026-11-01T08:00:00Z'),
          completedAt: t0Done,
        },
        {
          id: 'wo-emergency-late',
          assetId: 'kiln-1',
          componentCodeId: 'comp-roller-1',
          assigneeId: 'tech-reza',
          type: 'CM',
          status: 'DONE',
          createdAt: tLate,
          completedAt: null,
        },
      ];

      const ftfr = calculateTechnicianFTFR(workOrders);
      expect(ftfr.reworkWorkOrderIds).not.toContain('wo-repair-1');
      const reza = ftfr.technicians.find((t) => t.technicianId === 'tech-reza');
      expect(reza?.ftfrPercent).toBe(100);
    });
  });

  describe('calculateParetoAnalysis', () => {
    it('computes Pareto 80/20 distribution with cumulative percentages and vital-few boundaries', () => {
      const failures: ParetoFailureInput[] = [
        // Big failure: Roller + Thermal Shock (700M loss, 10h downtime)
        { componentCodeId: 'comp-roller', rootCauseCodeId: 'rc-thermal', downtimeMinutes: 600, lossRials: 700_000_000 },
        // Second failure: Die + Wear (200M loss, 4h downtime)
        { componentCodeId: 'comp-die', rootCauseCodeId: 'rc-wear', downtimeMinutes: 240, lossRials: 200_000_000 },
        // Small failure: Fan Bearing + Lubrication (100M loss, 1h downtime)
        { componentCodeId: 'comp-fan', rootCauseCodeId: 'rc-lube', downtimeMinutes: 60, lossRials: 100_000_000 },
      ];

      const labels = {
        components: {
          'comp-roller': 'رولر سرامیکی کوره',
          'comp-die': 'قالب پرس',
          'comp-fan': 'یاتاقان فن اصلی',
        },
        rootCauses: {
          'rc-thermal': 'شوک حرارتی',
          'rc-wear': 'فرسایش پایان عمر',
          'rc-lube': 'نقص روانکاری',
        },
      };

      const result = calculateParetoAnalysis(failures, labels, 'PAIR');

      expect(result.totalLossRials).toBe(1_000_000_000);
      expect(result.totalDowntimeHours).toBe(15);

      // by loss
      const topLoss = result.byLossRials[0]!;
      expect(topLoss.labelFa).toBe('رولر سرامیکی کوره ← شوک حرارتی');
      expect(topLoss.value).toBe(700_000_000);
      expect(topLoss.percent).toBe(70);
      expect(topLoss.cumulativePercent).toBe(70);
      expect(topLoss.withinVitalFew).toBe(true);

      const secondLoss = result.byLossRials[1]!;
      expect(secondLoss.value).toBe(200_000_000);
      expect(secondLoss.cumulativePercent).toBe(90);
      expect(secondLoss.withinVitalFew).toBe(true); // before this it was 70% < 80%

      const thirdLoss = result.byLossRials[2]!;
      expect(thirdLoss.withinVitalFew).toBe(false); // before this it was 90% >= 80%
    });
  });
});
