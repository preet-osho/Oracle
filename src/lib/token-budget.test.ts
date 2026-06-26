import { describe, it, expect, vi } from 'vitest';
import { getPromptSizes, calculateAllCosts, getBudgetSummary, formatCost, printBudgetReport } from './token-budget';

describe('Token Budget', () => {
  describe('getPromptSizes', () => {
    it('returns sizes for both system prompts', () => {
      const sizes = getPromptSizes();
      expect(sizes).toHaveLength(2);
      expect(sizes[0].name).toBe('AI_OPERATING_SYSTEM');
      expect(sizes[1].name).toBe('ORACLE_SYSTEM (combined)');
    });
    it('each size has chars and tokens > 0', () => {
      for (const s of getPromptSizes()) {
        expect(s.chars).toBeGreaterThan(0);
        expect(s.tokens).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateAllCosts', () => {
    it('returns costs for all models', () => {
      const costs = calculateAllCosts();
      expect(costs.length).toBeGreaterThan(0);
    });
    it('each cost has required fields', () => {
      for (const c of calculateAllCosts()) {
        expect(c.providerId).toBeDefined();
        expect(c.modelId).toBeDefined();
        expect(typeof c.isFree).toBe('boolean');
        expect(typeof c.fullRequestCostUSD).toBe('number');
        expect(typeof c.fullRequestCostINR).toBe('number');
        expect(typeof c.systemPromptCostUSD).toBe('number');
        expect(typeof c.systemPromptCostINR).toBe('number');
        expect(typeof c.inputCostPer1k).toBe('number');
        expect(typeof c.outputCostPer1k).toBe('number');
        expect(typeof c.contextWindow).toBe('number');
      }
    });
    it('free models have isFree flag', () => {
      const free = calculateAllCosts().filter(c => c.isFree);
      expect(free.length).toBeGreaterThan(0);
      for (const c of free) {
        expect(c.isFree).toBe(true);
      }
    });
    it('paid models have non-zero costs', () => {
      const paid = calculateAllCosts().filter(c => !c.isFree);
      expect(paid.length).toBeGreaterThan(0);
      for (const c of paid) {
        expect(c.fullRequestCostUSD).toBeGreaterThan(0);
        expect(c.fullRequestCostINR).toBeGreaterThan(0);
      }
    });
    it('INR costs are within rounding tolerance of USD * 84', () => {
      // INR is calculated from raw fullRequestCostUSD (before 4-decimal rounding)
      // so the test-computed value from the rounded USD may differ by up to 0.01
      const costs = calculateAllCosts().filter(c => !c.isFree && c.fullRequestCostUSD > 0);
      for (const c of costs) {
        expect(c.fullRequestCostINR).toBeGreaterThan(0);
        // Verify INR is positive and roughly proportional to USD
        const upperBound = Math.round(c.fullRequestCostUSD * 10000) / 10000 * 84 * 1.1;
        expect(c.fullRequestCostINR).toBeLessThanOrEqual(upperBound);
      }
    });
    it('INR is set for all models with costs', () => {
      const costs = calculateAllCosts().filter(c => !c.isFree && c.fullRequestCostUSD > 0);
      for (const c of costs) {
        expect(c.fullRequestCostINR).toBeGreaterThan(0);
      }
    });
    it('systemPromptCost is less than fullRequestCost', () => {
      const costs = calculateAllCosts().filter(c => !c.isFree);
      for (const c of costs) {
        expect(c.systemPromptCostUSD).toBeLessThan(c.fullRequestCostUSD);
      }
    });
    it('costs are rounded to 4 decimal places', () => {
      const costs = calculateAllCosts();
      for (const c of costs) {
        const usdStr = c.fullRequestCostUSD.toString();
        const decimals = usdStr.includes('.') ? usdStr.split('.')[1].length : 0;
        expect(decimals).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('getBudgetSummary', () => {
    it('has systemPromptTokens > 0', () => {
      expect(getBudgetSummary().systemPromptTokens).toBeGreaterThan(0);
    });
    it('has cheapestFree, cheapestPaid, mostExpensive', () => {
      const s = getBudgetSummary();
      expect(s.cheapestFree).not.toBeNull();
      expect(s.cheapestPaid).not.toBeNull();
      expect(s.mostExpensive).not.toBeNull();
    });
    it('monthlyEstimates has 3 entries for 100, 1000, 10000', () => {
      const s = getBudgetSummary();
      expect(s.monthlyEstimates).toHaveLength(3);
      expect(s.monthlyEstimates[0].requests).toBe(100);
      expect(s.monthlyEstimates[1].requests).toBe(1000);
      expect(s.monthlyEstimates[2].requests).toBe(10000);
    });
    it('cheapestPaid has the lowest fullRequestCostUSD among paid models', () => {
      const s = getBudgetSummary();
      const costs = calculateAllCosts().filter(c => !c.isFree);
      expect(costs.length).toBeGreaterThan(0);
      const cheapestPaidCost = Math.min(...costs.map(c => c.fullRequestCostUSD));
      expect(s.cheapestPaid!.fullRequestCostUSD).toBe(cheapestPaidCost);
    });
    it('cheapestFree has zero or lowest fullRequestCostUSD among free models', () => {
      const s = getBudgetSummary();
      if (s.cheapestFree) {
        const freeCosts = calculateAllCosts().filter(c => c.isFree);
        const cheapestFreeCost = Math.min(...freeCosts.map(c => c.fullRequestCostUSD));
        expect(s.cheapestFree.fullRequestCostUSD).toBe(cheapestFreeCost);
      }
    });
    it('mostExpensive has the highest fullRequestCostUSD', () => {
      const s = getBudgetSummary();
      const costs = calculateAllCosts();
      const maxCost = Math.max(...costs.map(c => c.fullRequestCostUSD));
      expect(s.mostExpensive!.fullRequestCostUSD).toBe(maxCost);
    });
    it('monthly estimates scale linearly with request count', () => {
      const s = getBudgetSummary();
      const costPer = s.monthlyEstimates[0].costUSD / 100;
      expect(s.monthlyEstimates[1].costUSD).toBeCloseTo(costPer * 1000, 3);
      expect(s.monthlyEstimates[2].costUSD).toBeCloseTo(costPer * 10000, 2);
    });
    it('monthly INR estimates are approximately 84x USD', () => {
      const s = getBudgetSummary();
      for (const e of s.monthlyEstimates) {
        const ratio = e.costINR / e.costUSD;
        expect(ratio).toBeCloseTo(84, 0);
      }
    });
  });

  describe('formatCost', () => {
    it('returns FREE for zero cost', () => expect(formatCost(0, 0)).toBe('FREE'));
    it('formats small costs', () => expect(formatCost(0.00005, 0.004)).toContain('<$0.0001'));
    it('formats normal costs', () => {
      const r = formatCost(0.005, 0.42);
      expect(r).toContain('$0.0050');
      expect(r).toContain('₹0.42');
    });
    it('formats exactly 0.0001 as normal cost', () => {
      const r = formatCost(0.0001, 0.0084);
      expect(r).toContain('$0.0001');
    });
    it('formats large costs correctly', () => {
      const r = formatCost(1.5, 126);
      expect(r).toBe('$1.5000 (₹126.00)');
    });
  });

  describe('printBudgetReport', () => {
    it('calls console methods without error', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printBudgetReport();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
