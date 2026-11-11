import { describe, it, expect } from 'vitest';
import { calculateDowntimeFinancialImpact } from './financial-downtime';

describe('calculateDowntimeFinancialImpact (3-Part Downtime Financial Loss Engine)', () => {
  const rollerKilnBottleneck = {
    code: 'KLN-RLR-01',
    name: 'کوره رولری پخت کاشی خط ۱',
    topologyType: 'BOTTLENECK' as const,
    bufferCapacityMinutes: 0,
    capacityImpactPercent: 100,
    hourlyLostMarginRials: 150_000_000, // 150M Rials/hr
    coldStartupThresholdMinutes: 120,
    restartEnergyAndSetupCostRials: 500_000_000, // 500M Rials
    inLineScrapCostRials: 180_000_000, // 180M Rials
  };

  const ballMillBuffered = {
    code: 'BML-SLR-01',
    name: 'بالمیل تهیه دوغاب و سیلوهای میانی',
    topologyType: 'BUFFERED' as const,
    bufferCapacityMinutes: 180, // 3 hours silo buffer
    capacityImpactPercent: 100,
    hourlyLostMarginRials: 150_000_000,
    coldStartupThresholdMinutes: 360,
    restartEnergyAndSetupCostRials: 40_000_000,
    inLineScrapCostRials: 25_000_000,
  };

  it('calculates full bottleneck unplanned outage crossing cold startup threshold', () => {
    // 180 minutes (3 hours) unplanned stop on roller kiln
    const result = calculateDowntimeFinancialImpact({
      asset: rollerKilnBottleneck,
      durationMinutes: 180,
      stoppageType: 'UNPLANNED',
      sparePartsCostRials: 35_000_000,
      technicianLaborHours: 3,
      laborHourlyRateRials: 2_000_000,
    });

    expect(result.effectiveLineDowntimeMinutes).toBe(180);
    // 3 hours * 150,000,000 * 1.0 = 450,000,000
    expect(result.lostProductionCostRials).toBe(450_000_000);
    // Unplanned -> full in-line scrap
    expect(result.inLineScrapCostRials).toBe(180_000_000);
    // 180 > 120 -> cold restart penalty applies
    expect(result.coldRestartPenaltyRials).toBe(500_000_000);
    // 35,000,000 + (3 * 2,000,000) = 41,000,000
    expect(result.directMaintenanceCostRials).toBe(41_000_000);
    // Total = 450M + 180M + 500M + 41M = 1,171,000,000
    expect(result.totalLossRials).toBe(1_171_000_000);
    expect(result.rows).toHaveLength(5);
    expect(result.formulaExplanationFa.totalLoss).toContain('۱,۱۷۱,۰۰۰,۰۰۰');
  });

  it('deducts intermediate silo buffer for BUFFERED equipment and zeros scrap on PLANNED stop', () => {
    // 240 minutes planned stop on ball mill with 180 min buffer -> 60 min effective downtime
    const result = calculateDowntimeFinancialImpact(
      ballMillBuffered,
      240,
      'PLANNED',
      10_000_000,
      4,
      2_000_000,
    );

    expect(result.effectiveLineDowntimeMinutes).toBe(60);
    // (60 / 60) * 150M * 100% = 150,000,000
    expect(result.lostProductionCostRials).toBe(150_000_000);
    // Planned -> 0 scrap
    expect(result.inLineScrapCostRials).toBe(0);
    // 240 <= 360 -> 0 cold restart penalty
    expect(result.coldRestartPenaltyRials).toBe(0);
    // 10M + 8M = 18,000,000
    expect(result.directMaintenanceCostRials).toBe(18_000_000);
    expect(result.totalLossRials).toBe(168_000_000);
  });

  it('results in 0 lost production when BUFFERED stop is shorter than bufferCapacityMinutes', () => {
    const result = calculateDowntimeFinancialImpact({
      asset: ballMillBuffered,
      durationMinutes: 120,
      stoppageType: 'PLANNED',
      sparePartsCostRials: 5_000_000,
      technicianLaborHours: 2,
      laborHourlyRateRials: 2_000_000,
    });

    expect(result.effectiveLineDowntimeMinutes).toBe(0);
    expect(result.lostProductionCostRials).toBe(0);
    expect(result.totalLossRials).toBe(9_000_000);
  });
});
