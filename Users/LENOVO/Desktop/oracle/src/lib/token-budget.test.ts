import { describe, it, expect } from 'vitest';
import { getPromptSizes, calculateAllCosts, getBudgetSummary, formatCost } from './token-budget';

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
      expect(calculateAllCosts().length).toBeGreaterThan(0);
    });
    it('each cost has required fields', () => {
      for (const c of calculateAllCosts()) {
        expect(c.providerId).toBeDefined();
        expect(c.modelId).toBeDefined();
        expect(typeof c.isFree).toBe('boolean');
        expect(typeof c.fullRequestCostUSD).toBe('number');
      }
    });
    it('free models have isFree flag', () => {
      const free = calculateAllCosts().filter(c => c.isFree);
      expect(free.length).toBeGreaterThan(0);
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
    it('monthlyEstimates has 3 entries', () => {
      expect(getBudgetSummary().monthlyEstimates).toHaveLength(3);
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
  });
});
