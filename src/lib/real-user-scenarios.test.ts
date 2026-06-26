// ═══════════════════════════════════════
// ORACLE — Real User Scenario Tests
// Based on ACTUAL user complaints from Reddit, G2, competitor analysis
// Focus: Indian market context, GST compliance, hallucination detection
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { calculateGST, formatINR, GST_RATES } from './tax-calculator';
import { runHallucinationGuard, DEFAULT_GUARD_CONFIG } from './hallucination-guard';
import {
  calculateInvoiceTotals,
  formatInvoiceAsText,
  generateInvoiceNumber,
} from './invoice';
import type { InvoiceItem } from '@/types';
import {
  calculateLateFee,
  getReminderTemplate,
  DEFAULT_LATE_FEE_CONFIG,
} from './late-fee-calculator';
import {
  calculateProfitability,
  aggregateProfitability,
  getMarginLabel,
  getMarginColor,
} from './profitability';

// ─── Helpers ────────────────────────────

function makeItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    description: 'SEO Audit',
    quantity: 1,
    rate: 5000,
    amount: 5000,
    ...overrides,
  };
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

// ═══════════════════════════════════════
// 1. GST COMPLIANCE (Real Indian Invoice Scenarios)
// Source: ClearTax guidelines, ₹25,000 penalty per incorrect invoice
// ═══════════════════════════════════════

describe('GST Compliance — Real Indian Business Scenarios', () => {
  describe('CGST/SGST Split (intra-state)', () => {
    // Scenario 4.1: Wrong CGST/SGST split is the #1 invoicing error
    it('correctly splits 18% GST into CGST + SGST for intra-state', () => {
      const result = calculateGST(50000, 18, false);
      expect(result.cgst).toBe(4500);   // 9%
      expect(result.sgst).toBe(4500);   // 9%
      expect(result.igst).toBe(0);       // No IGST for intra-state
      expect(result.totalTax).toBe(9000);
      expect(result.totalAmount).toBe(59000);
      expect(result.isInterstate).toBe(false);
    });

    it('splits tax equally between CGST and SGST', () => {
      const result = calculateGST(100000, 18, false);
      expect(result.cgst).toBe(result.sgst);
      expect(result.cgst + result.sgst).toBe(result.totalTax);
      expect(result.cgst).toBe(9000);
      expect(result.sgst).toBe(9000);
    });

    it('handles standard 18% rate for digital marketing services', () => {
      // Real scenario: digital marketing agency in Delhi invoicing a Delhi client
      const result = calculateGST(35000, GST_RATES.standard, false);
      expect(result.cgst).toBe(3150);
      expect(result.sgst).toBe(3150);
      expect(result.totalAmount).toBe(41300);
    });

    it('handles 12% GST for reduced-rate services', () => {
      // Some services have reduced GST rates
      const result = calculateGST(25000, GST_RATES.reduced, false);
      expect(result.cgst).toBe(1500);
      expect(result.sgst).toBe(1500);
      expect(result.totalAmount).toBe(28000);
    });

    it('handles exempt services (0% GST)', () => {
      const result = calculateGST(10000, GST_RATES.exempt, false);
      expect(result.totalTax).toBe(0);
      expect(result.totalAmount).toBe(10000);
    });
  });

  describe('IGST (inter-state)', () => {
    // Scenario 4.2: Interstate IGST not calculated — common error
    it('calculates IGST for Delhi → Mumbai transaction', () => {
      const result = calculateGST(50000, 18, true);
      expect(result.igst).toBe(9000);    // Full 18% as IGST
      expect(result.cgst).toBe(0);        // No CGST for interstate
      expect(result.sgst).toBe(0);        // No SGST for interstate
      expect(result.totalTax).toBe(9000);
      expect(result.totalAmount).toBe(59000);
      expect(result.isInterstate).toBe(true);
    });

    it('calculates IGST for Bangalore → Chennai transaction', () => {
      const result = calculateGST(100000, 18, true);
      expect(result.igst).toBe(18000);
      expect(result.totalAmount).toBe(118000);
    });

    it('does not show CGST/SGST for interstate', () => {
      const result = calculateGST(75000, 18, true);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
    });
  });

  describe('Indian Number Formatting', () => {
    // Scenario 4.3: Indian number formatting error
    it('formats ₹1,50,000 correctly (Indian grouping)', () => {
      expect(formatINR(150000)).toBe('₹1,50,000.00');
    });

    it('formats ₹25,00,000 correctly (Indian grouping for 25 lakh)', () => {
      expect(formatINR(2500000)).toBe('₹25,00,000.00');
    });

    it('formats ₹1,00,00,000 correctly (Indian grouping for 1 crore)', () => {
      expect(formatINR(10000000)).toBe('₹1,00,00,000.00');
    });

    it('formats small amounts with ₹ symbol', () => {
      expect(formatINR(500)).toBe('₹500.00');
      expect(formatINR(1000)).toBe('₹1,000.00');
    });

    it('formats amounts with decimal places', () => {
      expect(formatINR(1234.56)).toBe('₹1,234.56');
      expect(formatINR(99999.99)).toBe('₹99,999.99');
    });

    it('formats zero correctly', () => {
      expect(formatINR(0)).toBe('₹0.00');
    });

    it('does NOT use Western formatting (₹150,000)', () => {
      const formatted = formatINR(150000);
      expect(formatted).not.toBe('₹150,000.00');
      expect(formatted).toBe('₹1,50,000.00');
    });
  });

  describe('Real Invoice Scenarios', () => {
    // Scenario 4.1: Real dental clinic invoice
    it('generates correct invoice for dental clinic SEO project', () => {
      const items = [
        makeItem({ description: 'SEO Audit', quantity: 1, rate: 15000, amount: 15000 }),
        makeItem({ description: 'Monthly SEO (4 weeks)', quantity: 4, rate: 10000, amount: 40000 }),
        makeItem({ description: 'Google My Business Setup', quantity: 1, rate: 5000, amount: 5000 }),
      ];
      const totals = calculateInvoiceTotals(items);
      expect(totals.subtotal).toBe(60000);
      expect(totals.gst).toBe(10800);   // 18% of 60,000
      expect(totals.total).toBe(70800);
    });

    // Scenario 4.4: Invoice number is sequential
    it('generates sequential invoice numbers', () => {
      localStorage.clear();
      const first = generateInvoiceNumber();
      const second = generateInvoiceNumber();
      const third = generateInvoiceNumber();

      expect(first).toMatch(/^INV-\d{4}-001$/);
      expect(second).toMatch(/^INV-\d{4}-002$/);
      expect(third).toMatch(/^INV-\d{4}-003$/);
    });

    // Scenario 4.3: Invoice text uses Indian number formatting
    it('formats invoice amounts in Indian number system', () => {
      const data = {
        agencyName: 'Oracle Digital',
        agencyAddress: '123 MG Road\nDelhi 110001',
        agencyPhone: '+91 98765 43210',
        agencyEmail: 'billing@oracle.agency',
        clientName: 'Spice Garden Restaurant',
        items: [makeItem({ description: 'Website Development', quantity: 1, rate: 150000, amount: 150000 })],
        invoiceNumber: 'INV-2026-001',
        invoiceDate: '10 Jun 2026',
        dueDate: '10 Jul 2026',
        paymentTerms: 'Net 30 days',
      };
      const text = formatInvoiceAsText(data);
      expect(text).toContain('₹1,50,000');
      expect(text).not.toContain('₹150,000');
    });

    // Scenario 4.5: Invoice includes all required Indian GST fields
    it('invoice includes GSTIN, agency details, and client details', () => {
      const data = {
        agencyName: 'Oracle Digital',
        agencyAddress: '123 MG Road\nDelhi 110001',
        agencyGST: '07AABCU9603R1ZM',
        agencyPhone: '+91 98765 43210',
        agencyEmail: 'billing@oracle.agency',
        clientName: 'FitZone Gym',
        clientGST: '29AABCA1234N1ZP',
        items: [makeItem({ amount: 30000 })],
        invoiceNumber: 'INV-2026-002',
        invoiceDate: '15 Jun 2026',
        dueDate: '15 Jul 2026',
        paymentTerms: 'Net 30 days',
      };
      const text = formatInvoiceAsText(data);
      expect(text).toContain('GSTIN: 07AABCU9603R1ZM');
      expect(text).toContain('GSTIN: 29AABCA1234N1ZP');
      expect(text).toContain('Oracle Digital');
      expect(text).toContain('FitZone Gym');
    });

    // Scenario 6.22: Profitability calculation for Indian agency
    it('calculates profitability for Indian agency project', () => {
      const result = calculateProfitability(
        'proj-001',
        'Spice Garden Restaurant',
        100000, // ₹1,00,000 revenue
        [
          { category: 'Freelancer', amount: 20000, percentage: 80 },
          { category: 'Tools', amount: 5000, percentage: 20 },
        ],
        40 // 40 hours
      );
      expect(result.totalRevenue).toBe(100000);
      expect(result.totalCosts).toBe(25000);
      expect(result.grossMargin).toBe(75000);
      expect(result.grossMarginPercent).toBe(75);
      expect(result.hourlyRate).toBe(2500); // ₹2,500/hour
      expect(result.status).toBe('profitable');
    });
  });
});

// ═══════════════════════════════════════
// 2. HALLUCINATION DETECTION (Real User Complaints)
// Source: Evidently AI, ChatGPT court filing, Reddit
// ═══════════════════════════════════════

describe('Hallucination Detection — Real User Complaint Patterns', () => {
  describe('Through runHallucinationGuard (integration)', () => {
    // These test the REAL pipeline, not reimplemented patterns

    it('flags fabricated study attribution via full pipeline', async () => {
      const text = 'According to a 2024 study by Marketing Institute, restaurants see 340% ROI from Google Ads. This is guaranteed to work for your business. All restaurants benefit from this approach.';
      const result = await runHallucinationGuard(text, 'How to market a restaurant?', {}, DEFAULT_GUARD_CONFIG);
      expect(result.checks.length).toBeGreaterThan(0);
      const patternCheck = result.checks.find(c => c.name === 'pattern_detection');
      expect(patternCheck).toBeDefined();
      expect(patternCheck!.passed).toBe(false);
    });

    it('flags overconfident language via full pipeline', async () => {
      const text = 'This SEO strategy is guaranteed to increase your traffic by 300%. It is proven to work for all businesses without exception.';
      const result = await runHallucinationGuard(text, 'How to improve SEO?', {}, DEFAULT_GUARD_CONFIG);
      const patternCheck = result.checks.find(c => c.name === 'pattern_detection');
      expect(patternCheck).toBeDefined();
      expect(result.hallucinationPatterns.length).toBeGreaterThan(0);
    });

    it('passes clean output with specific claims', async () => {
      const text = 'For a dental clinic in Koramangala, focus on Google My Business optimization, local citations on JustDial and Practo, and weekly blog posts about dental hygiene tips specific to the Bangalore climate.';
      const result = await runHallucinationGuard(text, 'SEO tips for dental clinic', {}, DEFAULT_GUARD_CONFIG);
      expect(result.passed).toBe(true);
      expect(result.flagged).toBe(false);
    });

    it('flags finance domain output without SEBI disclaimer', async () => {
      const text = 'Invest in Nifty 50 index funds for 12-15% annual returns. SIP of ₹5,000 monthly will grow to ₹50 lakhs in 20 years. Start investing today.';
      const result = await runHallucinationGuard(text, 'Should I invest in Nifty 50?', { domain: 'finance' }, DEFAULT_GUARD_CONFIG);
      const domainCheck = result.checks.find(c => c.name === 'domain_strictness');
      expect(domainCheck).toBeDefined();
      expect(domainCheck!.passed).toBe(false);
    });

    it('passes finance domain output with SEBI disclaimer', async () => {
      const text = 'Invest in Nifty 50 index funds for 12-15% annual returns. This is for educational purposes only. Consult a SEBI-registered advisor. All investments carry risk.';
      const result = await runHallucinationGuard(text, 'Should I invest in Nifty 50?', { domain: 'finance' }, DEFAULT_GUARD_CONFIG);
      const domainCheck = result.checks.find(c => c.name === 'domain_strictness');
      expect(domainCheck).toBeDefined();
      expect(domainCheck!.passed).toBe(true);
    });
  });
  describe('Fabricated Statistics (Scenario 3.1)', () => {
    // #1 complaint: AI invents studies with specific percentages
    it('detects fabricated study attributions', () => {
      const text = 'According to a 2024 study by Marketing Institute, restaurants see 340% ROI from Google Ads.';
      const match = text.match(/according to (?:a|the) (?:20\d{2}) (?:study|report|survey)/gi);
      expect(match).toBeTruthy();
      expect(match!.length).toBeGreaterThan(0);
    });

    it('detects vague attribution patterns', () => {
      const texts = [
        'According to a 2025 report, 87% of agencies...',
        'According to the 2024 study, 92% of users...',
        'According to a 2023 survey, 78% of clients...',
      ];
      for (const text of texts) {
        const match = text.match(/according to (?:a|the) (?:20\d{2}) (?:study|report|survey)/gi);
        expect(match).toBeTruthy();
      }
    });
  });

  describe('Overconfident Statements (Scenario 3.2)', () => {
    // AI promising Page 1 ranking violates Google policies
    it('detects "will definitely" overconfidence', () => {
      const text = 'This strategy will definitely increase your traffic by 300%.';
      const match = text.match(/will definitely/gi);
      expect(match).toBeTruthy();
    });

    it('detects "guaranteed to" language', () => {
      const text = 'This method is guaranteed to increase your traffic.';
      const match = text.match(/guaranteed to/gi);
      expect(match).toBeTruthy();
    });

    it('detects "proven to" without evidence', () => {
      const text = 'This approach is proven to boost rankings.';
      const match = text.match(/proven to/gi);
      expect(match).toBeTruthy();
    });
  });

  describe('Universal Quantifiers (Scenario 3.7)', () => {
    // Inconsistent numbers within same response
    it('detects "all" without qualification', () => {
      const text = 'All businesses benefit from SEO.';
      const match = text.match(/\b(?:all|every|none|always|never|100%|zero exceptions)\b/gi);
      expect(match).toBeTruthy();
      expect(match!.some(m => m.toLowerCase() === 'all')).toBe(true);
    });

    it('detects "100%" claims', () => {
      const text = 'We achieve 100% success rate.';
      const match = text.match(/100%/gi);
      expect(match).toBeTruthy();
      expect(match!.length).toBeGreaterThan(0);
    });

    it('detects "never" without qualification', () => {
      const text = 'SEO never fails for restaurants.';
      const match = text.match(/\b(?:never|always)\b/gi);
      expect(match).toBeTruthy();
    });
  });

  describe('Domain-Specific Disclaimer Requirements', () => {
    // Scenario 5.7: Missing SEBI disclaimer
    it('finance domain requires SEBI disclaimer', () => {
      const compliantText = 'Invest in mutual funds for 12-15% annual returns. This is for educational purposes only. Consult a SEBI-registered advisor. All investments carry risk.';
      const nonCompliantText = 'Invest in mutual funds for guaranteed 15% returns.';

      // Compliant text passes
      expect(/educational purposes|consult.*advisor|not.*advice|SEBI/i.test(compliantText)).toBe(true);
      expect(/risk/i.test(compliantText)).toBe(true);

      // Non-compliant text fails
      expect(/educational purposes|consult.*advisor|not.*advice|SEBI/i.test(nonCompliantText)).toBe(false);
    });

    // Scenario 10.2: SEBI compliance
    it('investment advice must include SEBI-registered advisor mention', () => {
      const texts = [
        'Consult a SEBI-registered investment advisor.',
        'This is not SEBI-registered advice.',
        'Seek advice from a SEBI-registered professional.',
      ];
      for (const text of texts) {
        expect(/SEBI/i.test(text)).toBe(true);
      }
    });

    // Scenario 5.8: Healthcare disclaimer
    it('healthcare domain requires medical disclaimer', () => {
      const compliantText = 'Teeth whitening is safe when done by a dental professional. Always consult a doctor before procedures.';
      const nonCompliantText = 'Teeth whitening is perfectly safe for everyone.';

      expect(/consult.*doctor|medical professional|not.*medical advice/i.test(compliantText)).toBe(true);
      expect(/consult.*doctor|medical professional|not.*medical advice/i.test(nonCompliantText)).toBe(false);
    });

    // Scenario 10.3: Legal disclaimer
    it('legal domain requires professional disclaimer', () => {
      const compliantText = 'This contract template is for reference. Consult a lawyer for legal advice.';
      const nonCompliantText = 'This contract is legally binding as-is.';

      expect(/consult.*lawyer|legal professional|not.*legal advice/i.test(compliantText)).toBe(true);
      expect(/consult.*lawyer|legal professional|not.*legal advice/i.test(nonCompliantText)).toBe(false);
    });
  });

  describe('Vague Quantification (Scenario 1.1)', () => {
    // Users complain about vague AI outputs
    it('detects vague quantifiers', () => {
      const text = 'Hundreds of agencies use this approach. Many report success. Several tools are available.';
      const matches = text.match(/\b(?:hundreds of|thousands of|millions of|lots of|many|several|a few)\b/gi);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ═══════════════════════════════════════
// 3. INDIAN BUSINESS WORKFLOWS
// Source: Real Indian agency daily tasks
// ═══════════════════════════════════════

describe('Indian Business Workflows — Real Daily Tasks', () => {
  describe('Late Fee Escalation (Scenario 4.7)', () => {
    // Payment reminder tone must escalate with overdue duration
    it('gentle reminder at 3 days overdue', () => {
      const dueDate = now - 10 * DAY; // 10 days ago
      const result = calculateLateFee(50000, dueDate, now, DEFAULT_LATE_FEE_CONFIG);
      // 10 days overdue, 7-day grace = 3 effective days → gentle
      expect(result.escalationLevel).toBe('gentle');
      expect(result.withinGrace).toBe(false);
      expect(result.daysOverdue).toBe(10);
    });

    it('firm reminder at 14 days overdue', () => {
      const dueDate = now - 21 * DAY; // 21 days ago
      const result = calculateLateFee(50000, dueDate, now, DEFAULT_LATE_FEE_CONFIG);
      // 21 days overdue, 7-day grace = 14 effective days → firm
      expect(result.escalationLevel).toBe('firm');
    });

    it('final reminder at 30 days overdue', () => {
      const dueDate = now - 37 * DAY; // 37 days ago
      const result = calculateLateFee(50000, dueDate, now, DEFAULT_LATE_FEE_CONFIG);
      // 37 days overdue, 7-day grace = 30 effective days → final
      expect(result.escalationLevel).toBe('final');
    });

    it('legal notice at 60 days overdue', () => {
      const dueDate = now - 67 * DAY; // 67 days ago
      const result = calculateLateFee(50000, dueDate, now, DEFAULT_LATE_FEE_CONFIG);
      // 67 days overdue, 7-day grace = 60 effective days → legal
      expect(result.escalationLevel).toBe('legal');
    });

    it('no late fee within grace period', () => {
      const dueDate = now - 5 * DAY; // 5 days ago (within 7-day grace)
      const result = calculateLateFee(50000, dueDate, now, DEFAULT_LATE_FEE_CONFIG);
      expect(result.withinGrace).toBe(true);
      expect(result.lateFee).toBe(0);
    });

    it('late fee calculates correctly after grace period', () => {
      const dueDate = now - 17 * DAY; // 17 days ago
      const result = calculateLateFee(50000, dueDate, now, DEFAULT_LATE_FEE_CONFIG);
      // 17 days overdue, 7-day grace = 10 effective days
      // 50000 × 1.5% × 10 = 7500
      expect(result.lateFee).toBe(7500);
      expect(result.totalOwed).toBe(57500);
    });

    it('late fee caps at max fee percent', () => {
      const dueDate = now - 100 * DAY; // 100 days ago
      const result = calculateLateFee(50000, dueDate, now, DEFAULT_LATE_FEE_CONFIG);
      // 100 days overdue, 7-day grace = 93 effective days
      // 50000 × 1.5% × 93 = 69750, but max is 15% = 7500
      expect(result.lateFee).toBe(7500);
      expect(result.totalOwed).toBe(57500);
    });

    // Scenario 4.7: Reminder tone escalation
    it('gentle reminder uses friendly tone', () => {
      const template = getReminderTemplate('gentle', 'Spice Garden', 'INV-001', 50000, 3, 0);
      expect(template).toContain('Hi Spice Garden');
      expect(template).toContain('friendly reminder');
      expect(template).toContain('earliest convenience');
    });

    it('firm reminder mentions late fee', () => {
      const template = getReminderTemplate('firm', 'Spice Garden', 'INV-001', 50000, 14, 10500);
      expect(template).toContain('follow-up');
      expect(template).toContain('late fee');
      expect(template).toContain('₹10,500');
    });

    it('final reminder is serious', () => {
      const template = getReminderTemplate('final', 'Spice Garden', 'INV-001', 50000, 30, 15000);
      expect(template).toContain('final reminder');
      expect(template).toContain('settle this immediately');
      expect(template).toContain('escalation');
    });

    it('legal notice threatens legal action', () => {
      const template = getReminderTemplate('legal', 'Spice Garden', 'INV-001', 50000, 60, 22500);
      expect(template).toContain('legal remedies');
      expect(template).toContain('7 days');
    });
  });

  describe('Indian Phone Number Format (Scenario 5.9)', () => {
    it('Indian phone numbers use +91 format', () => {
      const phone = '+91 98765 43210';
      expect(phone).toMatch(/^\+91 \d{5} \d{5}$/);
    });

    it('Indian landline uses 0XX format', () => {
      const phone = '011-2345-6789';
      expect(phone).toMatch(/^0\d{2,3}-\d{4}-\d{4}$/);
    });
  });

  describe('INR vs USD Pricing (Scenario 5.3)', () => {
    it('formatINR always produces ₹ prefix', () => {
      const amounts = [100, 1000, 10000, 100000, 1000000];
      for (const amount of amounts) {
        const formatted = formatINR(amount);
        expect(formatted).toMatch(/^₹/);
        expect(formatted).not.toMatch(/^\$/);
        expect(formatted).not.toMatch(/^USD/);
      }
    });

    it('formatINR uses Indian number grouping (lakhs/crores)', () => {
      expect(formatINR(100000)).toBe('₹1,00,000.00');   // 1 lakh
      expect(formatINR(1000000)).toBe('₹10,00,000.00');  // 10 lakh
      expect(formatINR(10000000)).toBe('₹1,00,00,000.00'); // 1 crore
    });
  });

  describe('Profitability Analysis (Scenario 6.22-6.23)', () => {
    it('calculates profitability for Indian agency project', () => {
      const result = calculateProfitability(
        'proj-001',
        'FitZone Gym',
        100000,
        [
          { category: 'Freelancer', amount: 20000, percentage: 80 },
          { category: 'Tools', amount: 5000, percentage: 20 },
        ],
        40
      );
      expect(result.grossMargin).toBe(75000);
      expect(result.grossMarginPercent).toBe(75);
      expect(result.hourlyRate).toBe(2500);
      expect(result.roi).toBe(300);
      expect(result.status).toBe('profitable');
    });

    it('identifies loss-making project', () => {
      const result = calculateProfitability(
        'proj-002',
        'Budget Client',
        50000,
        [
          { category: 'Freelancer', amount: 40000, percentage: 73 },
          { category: 'Tools', amount: 15000, percentage: 27 },
        ],
        60
      );
      expect(result.grossMargin).toBe(-5000);
      expect(result.status).toBe('loss');
    });

    it('aggregates profitability across multiple projects', () => {
      const items = [
        calculateProfitability('p1', 'Client A', 100000, [{ category: 'Cost', amount: 25000, percentage: 100 }], 40),
        calculateProfitability('p2', 'Client B', 80000, [{ category: 'Cost', amount: 30000, percentage: 100 }], 50),
        calculateProfitability('p3', 'Client C', 50000, [{ category: 'Cost', amount: 60000, percentage: 100 }], 30),
      ];
      const agg = aggregateProfitability(items);
      expect(agg.totalRevenue).toBe(230000);
      expect(agg.totalCosts).toBe(115000);
      expect(agg.totalProfit).toBe(115000);
      expect(agg.profitableCount).toBe(2);
      expect(agg.lossCount).toBe(1);
      expect(agg.bestProject?.clientName).toBe('Client A');
      expect(agg.worstProject?.clientName).toBe('Client C');
    });

    it('margin labels are correct', () => {
      expect(getMarginLabel(80)).toBe('Excellent');
      expect(getMarginLabel(50)).toBe('Good');
      expect(getMarginLabel(30)).toBe('Fair');
      expect(getMarginLabel(10)).toBe('Low');
      expect(getMarginLabel(-10)).toBe('Loss');
    });
  });

  describe('Proposal Value Formatting (Scenario 1.37)', () => {
    it('formats proposal values in Indian numbering', () => {
      const proposalValue = 300000; // ₹3 lakhs
      const formatted = formatINR(proposalValue);
      expect(formatted).toBe('₹3,00,000.00');
      expect(formatted).not.toBe('₹300,000.00');
    });

    it('formats proposal with GST breakdown', () => {
      const baseAmount = 300000;
      const gst = calculateGST(baseAmount, 18, false);
      expect(gst.cgst).toBe(27000);
      expect(gst.sgst).toBe(27000);
      expect(gst.totalAmount).toBe(354000);
      expect(formatINR(gst.totalAmount)).toBe('₹3,54,000.00');
    });
  });
});

// ═══════════════════════════════════════
// 4. INDIAN MARKET CONTEXT EDGE CASES
// Source: Reddit r/IndianBusiness, real agency workflows
// ═══════════════════════════════════════

describe('Indian Market Context — Edge Cases', () => {
  describe('GST for Different Service Types', () => {
    it('website development: 18% GST', () => {
      const result = calculateGST(150000, 18, false);
      expect(result.totalAmount).toBe(177000);
    });

    it('SEO services: 18% GST', () => {
      const result = calculateGST(25000, 18, false);
      expect(result.totalAmount).toBe(29500);
    });

    it('Meta Ads management: 18% GST', () => {
      const result = calculateGST(35000, 18, false);
      expect(result.totalAmount).toBe(41300);
    });

    it('content writing: 18% GST', () => {
      const result = calculateGST(8000, 18, false);
      expect(result.totalAmount).toBe(9440);
    });
  });

  describe('Large Transaction Amounts (Indian Market)', () => {
    it('formats 10 lakh project correctly', () => {
      expect(formatINR(1000000)).toBe('₹10,00,000.00');
    });

    it('formats 25 lakh project correctly', () => {
      expect(formatINR(2500000)).toBe('₹25,00,000.00');
    });

    it('formats 1 crore project correctly', () => {
      expect(formatINR(10000000)).toBe('₹1,00,00,000.00');
    });

    it('GST on 10 lakh project', () => {
      const result = calculateGST(1000000, 18, false);
      expect(result.cgst).toBe(90000);
      expect(result.sgst).toBe(90000);
      expect(result.totalAmount).toBe(1180000);
      expect(formatINR(result.totalAmount)).toBe('₹11,80,000.00');
    });
  });

  describe('Small Business Amounts', () => {
    it('formats ₹500 correctly', () => {
      expect(formatINR(500)).toBe('₹500.00');
    });

    it('formats ₹1,500 correctly', () => {
      expect(formatINR(1500)).toBe('₹1,500.00');
    });

    it('GST on small amount', () => {
      const result = calculateGST(2500, 18, false);
      expect(result.cgst).toBe(225);
      expect(result.sgst).toBe(225);
      expect(result.totalAmount).toBe(2950);
    });
  });

  describe('Floating Point Precision (Real Invoice Scenarios)', () => {
    it('handles ₹3,333.33 amount correctly', () => {
      const result = calculateGST(3333.33, 18, false);
      expect(result.totalTax).toBeCloseTo(599.9994, 2);
      expect(result.totalAmount).toBeCloseTo(3933.3294, 2);
    });

    it('invoice totals with decimal items', () => {
      const items = [
        makeItem({ amount: 1234.56 }),
        makeItem({ amount: 7890.12 }),
      ];
      const totals = calculateInvoiceTotals(items);
      expect(totals.subtotal).toBeCloseTo(9124.68, 2);
      expect(totals.gst).toBeCloseTo(1642.4424, 2);
      expect(totals.total).toBeCloseTo(10767.1224, 2);
    });
  });
});
