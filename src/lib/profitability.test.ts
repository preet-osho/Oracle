// ═══════════════════════════════════════
// ORACLE — Profitability Tracker Tests
// Pure calculation functions, margin analysis, aggregation
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  calculateProfitability,
  getMarginColor,
  getMarginLabel,
  getROIIcon,
  aggregateProfitability,
  type CostBreakdown,
  type ProfitabilityData,
} from './profitability';

// ─── calculateProfitability Tests ───────

describe('calculateProfitability', () => {
  const costs: CostBreakdown[] = [
    { category: 'freelancer', amount: 5000, percentage: 62.5 },
    { category: 'tools', amount: 3000, percentage: 37.5 },
  ];

  it('calculates basic profitability', () => {
    const result = calculateProfitability('p1', 'Acme', 20000, costs, 100);
    expect(result.projectId).toBe('p1');
    expect(result.clientName).toBe('Acme');
    expect(result.totalRevenue).toBe(20000);
    expect(result.totalCosts).toBe(8000);
    expect(result.totalHours).toBe(100);
    expect(result.grossMargin).toBe(12000);
    expect(result.hourlyRate).toBe(200);
    expect(result.status).toBe('profitable');
  });

  it('calculates gross margin percent', () => {
    const result = calculateProfitability('p1', 'Acme', 20000, costs, 100);
    // (12000 / 20000) * 100 = 60
    expect(result.grossMarginPercent).toBe(60);
  });

  it('calculates ROI', () => {
    const result = calculateProfitability('p1', 'Acme', 20000, costs, 100);
    // ((20000 - 8000) / 8000) * 100 = 150
    expect(result.roi).toBe(150);
  });

  it('rounds hourlyRate to 2 decimal places', () => {
    const result = calculateProfitability('p1', 'Acme', 10000, costs, 3);
    // 10000 / 3 = 3333.333... → 3333.33
    expect(result.hourlyRate).toBe(3333.33);
  });

  it('rounds grossMargin to 2 decimal places', () => {
    const result = calculateProfitability('p1', 'Acme', 10000, [{ category: 'misc', amount: 3333.33, percentage: 100 }], 10);
    expect(result.grossMargin).toBe(6666.67);
  });

  it('rounds grossMarginPercent to 1 decimal place', () => {
    const result = calculateProfitability('p1', 'Acme', 30000, costs, 100);
    // (22000 / 30000) * 100 = 73.333... → 73.3
    expect(result.grossMarginPercent).toBe(73.3);
  });

  it('rounds ROI to 1 decimal place', () => {
    const result = calculateProfitability('p1', 'Acme', 15000, costs, 100);
    // ((15000 - 8000) / 8000) * 100 = 87.5
    expect(result.roi).toBe(87.5);
  });

  it('marks as profitable when margin > 0', () => {
    const result = calculateProfitability('p1', 'Acme', 10000, [{ category: 'c', amount: 5000, percentage: 100 }], 10);
    expect(result.status).toBe('profitable');
    expect(result.grossMargin).toBe(5000);
  });

  it('marks as breakeven when margin === 0', () => {
    const result = calculateProfitability('p1', 'Acme', 8000, costs, 10);
    expect(result.status).toBe('breakeven');
    expect(result.grossMargin).toBe(0);
  });

  it('marks as loss when margin < 0', () => {
    const result = calculateProfitability('p1', 'Acme', 5000, costs, 10);
    expect(result.status).toBe('loss');
    expect(result.grossMargin).toBe(-3000);
  });

  it('marks as no-data when both revenue and costs are 0', () => {
    const result = calculateProfitability('p1', 'Acme', 0, [], 0);
    expect(result.status).toBe('no-data');
  });

  it('marks as loss when revenue is 0 but costs exist', () => {
    const result = calculateProfitability('p1', 'Acme', 0, costs, 0);
    expect(result.status).toBe('loss');
  });

  it('marks as profitable when revenue exists but costs are 0', () => {
    const result = calculateProfitability('p1', 'Acme', 10000, [], 10);
    expect(result.status).toBe('profitable');
    expect(result.totalCosts).toBe(0);
  });

  it('returns 0 hourlyRate when totalHours is 0', () => {
    const result = calculateProfitability('p1', 'Acme', 10000, costs, 0);
    expect(result.hourlyRate).toBe(0);
  });

  it('returns 0 ROI when totalCosts is 0', () => {
    const result = calculateProfitability('p1', 'Acme', 10000, [], 10);
    expect(result.roi).toBe(0);
  });

  it('returns 0 marginPercent when revenue is 0', () => {
    const result = calculateProfitability('p1', 'Acme', 0, costs, 0);
    expect(result.grossMarginPercent).toBe(0);
  });

  it('handles negative ROI (loss scenario)', () => {
    const result = calculateProfitability('p1', 'Acme', 2000, costs, 10);
    // ((2000 - 8000) / 8000) * 100 = -75
    expect(result.roi).toBe(-75);
  });

  it('sums multiple cost categories', () => {
    const multiCosts: CostBreakdown[] = [
      { category: 'a', amount: 1000, percentage: 20 },
      { category: 'b', amount: 2000, percentage: 40 },
      { category: 'c', amount: 2000, percentage: 40 },
    ];
    const result = calculateProfitability('p1', 'Acme', 10000, multiCosts, 10);
    expect(result.totalCosts).toBe(5000);
    expect(result.grossMargin).toBe(5000);
  });
});

// ─── getMarginColor Tests ───────────────

describe('getMarginColor', () => {
  it('returns success color for margin >= 40', () => {
    expect(getMarginColor(40)).toBe('var(--oracle-success)');
    expect(getMarginColor(60)).toBe('var(--oracle-success)');
    expect(getMarginColor(100)).toBe('var(--oracle-success)');
  });

  it('returns warning color for margin 20-39', () => {
    expect(getMarginColor(20)).toBe('var(--oracle-warning)');
    expect(getMarginColor(30)).toBe('var(--oracle-warning)');
    expect(getMarginColor(39.9)).toBe('var(--oracle-warning)');
  });

  it('returns error color for margin < 20', () => {
    expect(getMarginColor(0)).toBe('var(--oracle-error)');
    expect(getMarginColor(10)).toBe('var(--oracle-error)');
    expect(getMarginColor(-10)).toBe('var(--oracle-error)');
  });
});

// ─── getMarginLabel Tests ───────────────

describe('getMarginLabel', () => {
  it('returns Excellent for margin >= 60', () => {
    expect(getMarginLabel(60)).toBe('Excellent');
    expect(getMarginLabel(80)).toBe('Excellent');
  });

  it('returns Good for margin 40-59', () => {
    expect(getMarginLabel(40)).toBe('Good');
    expect(getMarginLabel(55)).toBe('Good');
  });

  it('returns Fair for margin 20-39', () => {
    expect(getMarginLabel(20)).toBe('Fair');
    expect(getMarginLabel(35)).toBe('Fair');
  });

  it('returns Low for margin 0-19', () => {
    expect(getMarginLabel(0)).toBe('Low');
    expect(getMarginLabel(15)).toBe('Low');
  });

  it('returns Loss for negative margin', () => {
    expect(getMarginLabel(-1)).toBe('Loss');
    expect(getMarginLabel(-50)).toBe('Loss');
  });
});

// ─── getROIIcon Tests ───────────────────

describe('getROIIcon', () => {
  it('returns fire for ROI >= 100', () => {
    expect(getROIIcon(100)).toBe('🔥');
    expect(getROIIcon(200)).toBe('🔥');
  });

  it('returns check for ROI 50-99', () => {
    expect(getROIIcon(50)).toBe('✅');
    expect(getROIIcon(75)).toBe('✅');
  });

  it('returns arrow for ROI 0-49', () => {
    expect(getROIIcon(0)).toBe('➡️');
    expect(getROIIcon(25)).toBe('➡️');
  });

  it('returns warning for negative ROI', () => {
    expect(getROIIcon(-1)).toBe('⚠️');
    expect(getROIIcon(-50)).toBe('⚠️');
  });
});

// ─── aggregateProfitability Tests ────────

describe('aggregateProfitability', () => {
  const profitable: ProfitabilityData = {
    projectId: 'p1', clientName: 'Acme', totalRevenue: 20000, totalCosts: 8000,
    totalHours: 100, hourlyRate: 200, grossMargin: 12000, grossMarginPercent: 60,
    roi: 150, status: 'profitable',
  };

  const loss: ProfitabilityData = {
    projectId: 'p2', clientName: 'Beta', totalRevenue: 5000, totalCosts: 8000,
    totalHours: 50, hourlyRate: 100, grossMargin: -3000, grossMarginPercent: -60,
    roi: -37.5, status: 'loss',
  };

  const breakeven: ProfitabilityData = {
    projectId: 'p3', clientName: 'Gamma', totalRevenue: 8000, totalCosts: 8000,
    totalHours: 80, hourlyRate: 100, grossMargin: 0, grossMarginPercent: 0,
    roi: 0, status: 'breakeven',
  };

  it('returns zeros for empty array', () => {
    const result = aggregateProfitability([]);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalCosts).toBe(0);
    expect(result.totalProfit).toBe(0);
    expect(result.avgMargin).toBe(0);
    expect(result.avgROI).toBe(0);
    expect(result.profitableCount).toBe(0);
    expect(result.lossCount).toBe(0);
    expect(result.breakevenCount).toBe(0);
    expect(result.bestProject).toBeNull();
    expect(result.worstProject).toBeNull();
  });

  it('aggregates totals correctly', () => {
    const result = aggregateProfitability([profitable, loss, breakeven]);
    expect(result.totalRevenue).toBe(33000);
    expect(result.totalCosts).toBe(24000);
    expect(result.totalProfit).toBe(9000);
  });

  it('calculates average margin', () => {
    const result = aggregateProfitability([profitable, loss, breakeven]);
    // (60 + (-60) + 0) / 3 = 0
    expect(result.avgMargin).toBe(0);
  });

  it('calculates average ROI', () => {
    const result = aggregateProfitability([profitable, loss, breakeven]);
    // (150 + (-37.5) + 0) / 3 = 37.5
    expect(result.avgROI).toBe(37.5);
  });

  it('counts status categories', () => {
    const result = aggregateProfitability([profitable, loss, breakeven]);
    expect(result.profitableCount).toBe(1);
    expect(result.lossCount).toBe(1);
    expect(result.breakevenCount).toBe(1);
  });

  it('identifies best project by margin', () => {
    const result = aggregateProfitability([profitable, loss, breakeven]);
    expect(result.bestProject?.projectId).toBe('p1');
    expect(result.bestProject?.grossMarginPercent).toBe(60);
  });

  it('identifies worst project by margin', () => {
    const result = aggregateProfitability([profitable, loss, breakeven]);
    expect(result.worstProject?.projectId).toBe('p2');
    expect(result.worstProject?.grossMarginPercent).toBe(-60);
  });

  it('works with single item', () => {
    const result = aggregateProfitability([profitable]);
    expect(result.totalRevenue).toBe(20000);
    expect(result.profitableCount).toBe(1);
    expect(result.bestProject?.projectId).toBe('p1');
    expect(result.worstProject?.projectId).toBe('p1');
  });

  it('rounds totalProfit to 2 decimal places', () => {
    const result = aggregateProfitability([
      { ...profitable, totalRevenue: 10000.33, totalCosts: 5000.11, grossMargin: 5000.22, grossMarginPercent: 50, roi: 100 },
      { ...loss, totalRevenue: 2000.11, totalCosts: 1000.22, grossMargin: 999.89, grossMarginPercent: 50, roi: 100 },
    ]);
    // totalProfit = (10000.33 + 2000.11) - (5000.11 + 1000.22) = 6000.11
    expect(result.totalProfit).toBe(6000.11);
  });

  it('rounds avgMargin and avgROI to 1 decimal place', () => {
    const result = aggregateProfitability([
      { ...profitable, grossMarginPercent: 33.33, roi: 66.67 },
      { ...loss, grossMarginPercent: 22.22, roi: 44.44 },
    ]);
    // avgMargin = (33.33 + 22.22) / 2 = 27.775 → 27.8
    expect(result.avgMargin).toBe(27.8);
    // avgROI = (66.67 + 44.44) / 2 = 55.555 → 55.6
    expect(result.avgROI).toBe(55.6);
  });

  it('bestProject is highest grossMarginPercent', () => {
    const items: ProfitabilityData[] = [
      { ...profitable, projectId: 'a', grossMarginPercent: 30 },
      { ...profitable, projectId: 'b', grossMarginPercent: 80 },
      { ...profitable, projectId: 'c', grossMarginPercent: 50 },
    ];
    const result = aggregateProfitability(items);
    expect(result.bestProject?.projectId).toBe('b');
  });

  it('worstProject is lowest grossMarginPercent', () => {
    const items: ProfitabilityData[] = [
      { ...loss, projectId: 'a', grossMarginPercent: -20 },
      { ...loss, projectId: 'b', grossMarginPercent: -80 },
      { ...loss, projectId: 'c', grossMarginPercent: -50 },
    ];
    const result = aggregateProfitability(items);
    expect(result.worstProject?.projectId).toBe('b');
  });
});
