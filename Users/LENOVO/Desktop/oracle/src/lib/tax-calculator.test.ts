import { describe, it, expect } from 'vitest';
import {
  calculateGST,
  formatINR,
  GST_RATES,
} from './tax-calculator';

describe('calculateGST', () => {
  describe('intra-state (CGST + SGST)', () => {
    it('calculates 18% GST on ₹10,000', () => {
      const result = calculateGST(10000);
      expect(result.baseAmount).toBe(10000);
      expect(result.cgst).toBe(900);
      expect(result.sgst).toBe(900);
      expect(result.igst).toBe(0);
      expect(result.totalTax).toBe(1800);
      expect(result.totalAmount).toBe(11800);
      expect(result.gstRate).toBe(18);
      expect(result.isInterstate).toBe(false);
    });

    it('calculates 12% GST on ₹5,000', () => {
      const result = calculateGST(5000, 12);
      expect(result.cgst).toBe(300);
      expect(result.sgst).toBe(300);
      expect(result.igst).toBe(0);
      expect(result.totalTax).toBe(600);
      expect(result.totalAmount).toBe(5600);
      expect(result.gstRate).toBe(12);
    });

    it('calculates 0% GST (exempt)', () => {
      const result = calculateGST(10000, 0);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.totalAmount).toBe(10000);
    });

    it('handles decimal amounts', () => {
      const result = calculateGST(1234.56);
      expect(result.totalTax).toBeCloseTo(222.22, 2);
      expect(result.totalAmount).toBeCloseTo(1456.78, 2);
      expect(result.cgst).toBeCloseTo(111.11, 2);
      expect(result.sgst).toBeCloseTo(111.11, 2);
    });

    it('handles zero amount', () => {
      const result = calculateGST(0);
      expect(result.totalTax).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
    });

    it('splits tax equally between CGST and SGST', () => {
      const result = calculateGST(10000, 18);
      expect(result.cgst).toBe(result.sgst);
      expect(result.cgst + result.sgst).toBe(result.totalTax);
    });
  });

  describe('inter-state (IGST)', () => {
    it('calculates IGST for interstate transaction', () => {
      const result = calculateGST(10000, 18, true);
      expect(result.igst).toBe(1800);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.totalTax).toBe(1800);
      expect(result.totalAmount).toBe(11800);
      expect(result.isInterstate).toBe(true);
    });

    it('calculates IGST with 12% rate', () => {
      const result = calculateGST(25000, 12, true);
      expect(result.igst).toBe(3000);
      expect(result.totalTax).toBe(3000);
      expect(result.totalAmount).toBe(28000);
    });

    it('handles zero amount interstate', () => {
      const result = calculateGST(0, 18, true);
      expect(result.igst).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });

  describe('defaults', () => {
    it('defaults to 18% standard rate', () => {
      const result = calculateGST(10000);
      expect(result.gstRate).toBe(18);
    });

    it('defaults to intra-state', () => {
      const result = calculateGST(10000);
      expect(result.isInterstate).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles very large amounts', () => {
      const result = calculateGST(10000000); // 1 crore
      expect(result.totalTax).toBe(1800000);
      expect(result.totalAmount).toBe(11800000);
    });

    it('handles very small amounts', () => {
      const result = calculateGST(0.01);
      expect(result.totalAmount).toBeCloseTo(0.0118, 4);
    });

    it('handles floating point precision', () => {
      const result = calculateGST(3333.33);
      expect(result.totalTax).toBeCloseTo(599.9994, 2);
    });
  });
});

describe('formatINR', () => {
  it('formats whole numbers with ₹ symbol', () => {
    expect(formatINR(1000)).toBe('₹1,000.00');
  });

  it('formats with decimal places', () => {
    expect(formatINR(1234.56)).toBe('₹1,234.56');
  });

  it('formats zero', () => {
    expect(formatINR(0)).toBe('₹0.00');
  });

  it('formats large numbers in Indian system', () => {
    expect(formatINR(100000)).toBe('₹1,00,000.00');
    expect(formatINR(10000000)).toBe('₹1,00,00,000.00');
  });

  it('formats negative numbers', () => {
    expect(formatINR(-5000)).toBe('₹-5,000.00');
  });

  it('formats with exactly 2 decimal places', () => {
    expect(formatINR(1234.5)).toBe('₹1,234.50');
    expect(formatINR(1234.567)).toBe('₹1,234.57');
  });
});

describe('GST_RATES', () => {
  it('has standard rate of 18%', () => {
    expect(GST_RATES.standard).toBe(18);
  });

  it('has reduced rate of 12%', () => {
    expect(GST_RATES.reduced).toBe(12);
  });

  it('has exempt rate of 0%', () => {
    expect(GST_RATES.exempt).toBe(0);
  });
});
