// ═══════════════════════════════════════
// ORACLE — Q3 2026 Scenario Tests
// Tests for real user complaint scenarios
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  checkWhatsAppCompliance,
  compareBSPCosts,
  calculateTDS,
  checkInvoiceDateCompliance,
  warnHubSpotScalingCost,
  getTierBudgetRecommendation,
  checkINRBillingMigration,
  detectReclassification,
  estimateReclassificationImpact,
  warnAPIVerificationTimeline,
  getGreenTickChecklist,
  warnZohoFragmentation,
  calculateCRMRoi,
  getUpfrontPaymentPolicy,
  getAINativeValueFrame,
  getVernacularContentGuidance,
  getHumanPolishPipeline,
  getCommodityDifferentiation,
  BSP_PROVIDERS,
} from './q3-scenarios';

// ═══════════════════════════════════════
// 1. WhatsApp Compliance Warning (Q3-W3)
// Source: LinkedIn (Ravi Rai), AiSensy support forums
// ═══════════════════════════════════════

describe('WhatsApp Compliance Warning (Q3-W3)', () => {
  it('flags promotional campaign without opt-in as dangerous', () => {
    const result = checkWhatsAppCompliance('promotional', false, 500);
    expect(result.compliant).toBe(false);
    expect(result.riskLevel).toBe('danger');
    expect(result.optInRequired).toBe(true);
    expect(result.warnings.some(w => w.includes('opt-in'))).toBe(true);
  });

  it('suggests opt-in collection methods when non-compliant', () => {
    const result = checkWhatsAppCompliance('promotional', false, 100);
    expect(result.warnings.some(w => w.includes('Website form'))).toBe(true);
    expect(result.warnings.some(w => w.includes('QR code'))).toBe(true);
  });

  it('allows promotional campaign with opt-in', () => {
    const result = checkWhatsAppCompliance('promotional', true, 100);
    expect(result.compliant).toBe(true);
    expect(result.riskLevel).toBe('safe');
    expect(result.warnings).toHaveLength(0);
  });

  it('warns about high-volume promotional (>100 recipients)', () => {
    const result = checkWhatsAppCompliance('promotional', true, 500);
    expect(result.compliant).toBe(false);
    expect(result.riskLevel).toBe('caution');
    expect(result.warnings.some(w => w.includes('Meta review'))).toBe(true);
  });

  it('allows transactional messages without opt-in', () => {
    const result = checkWhatsAppCompliance('transactional', false, 1000);
    expect(result.riskLevel).toBe('caution'); // >1000 recipients
    expect(result.optInRequired).toBe(false);
  });

  it('warns about >1000 recipients requiring business verification', () => {
    const result = checkWhatsAppCompliance('otp', false, 1500);
    expect(result.warnings.some(w => w.includes('Business Verification'))).toBe(true);
    expect(result.riskLevel).toBe('caution');
  });

  it('safe for small transactional campaign', () => {
    const result = checkWhatsAppCompliance('transactional', false, 50);
    expect(result.compliant).toBe(true);
    expect(result.riskLevel).toBe('safe');
  });
});

// ═══════════════════════════════════════
// 2. BSP Cost Comparison (Q3-W1)
// Source: Lion CRM blog, AiSensy G2 reviews
// ═══════════════════════════════════════

describe('BSP Cost Comparison (Q3-W1)', () => {
  it('sorts providers by total cost ascending', () => {
    const results = compareBSPCosts(10000);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].totalCostINR).toBeGreaterThanOrEqual(results[i - 1].totalCostINR);
    }
  });

  it('Meta Direct has zero subscription and zero per-message fees', () => {
    const results = compareBSPCosts(10000);
    const meta = results.find(r => r.provider === 'Meta Direct (no BSP)');
    expect(meta).toBeDefined();
    expect(meta!.subscriptionINR).toBe(0);
    expect(meta!.platformFeePerMsg).toBe(0);
    expect(meta!.markupPercent).toBe(0);
    expect(meta!.totalCostINR).toBe(meta!.metaCostINR);
  });

  it('AiSensy total cost is 2.5-4x Meta base (higher with hidden reclassification costs)', () => {
    const results = compareBSPCosts(10000);
    const aisensy = results.find(r => r.provider === 'AiSensy');
    expect(aisensy).toBeDefined();
    expect(aisensy!.totalMultiplier).toBeGreaterThanOrEqual(2.5);
    expect(aisensy!.totalMultiplier).toBeLessThanOrEqual(4);
  });

  it('Wati total cost is 2.5-4x Meta base (higher with hidden reclassification costs)', () => {
    const results = compareBSPCosts(10000);
    const wati = results.find(r => r.provider === 'Wati');
    expect(wati).toBeDefined();
    expect(wati!.totalMultiplier).toBeGreaterThanOrEqual(2.5);
    expect(wati!.totalMultiplier).toBeLessThanOrEqual(4);
  });

  it('calculates correct meta base cost', () => {
    const results = compareBSPCosts(5000, 0.75);
    const metaCost = 5000 * 0.75;
    expect(results[0].metaCostINR).toBeCloseTo(metaCost, 0);
  });

  it('cheaper providers (360dialog, WANotifier) have lower multipliers', () => {
    const results = compareBSPCosts(10000);
    const cheap = results.filter(r => ['360dialog', 'WANotifier'].includes(r.provider));
    const expensive = results.filter(r => ['AiSensy', 'Wati'].includes(r.provider));
    for (const c of cheap) {
      for (const e of expensive) {
        expect(c.totalCostINR).toBeLessThan(e.totalCostINR);
      }
    }
  });

  it('savings vs most expensive are positive for cheaper providers', () => {
    const results = compareBSPCosts(50000);
    expect(results[0].savingsVsHighest).toBeGreaterThan(0);
  });

  it('subscription fees are included in total cost', () => {
    const results = compareBSPCosts(100);
    const aisensy = results.find(r => r.provider === 'AiSensy');
    // At low volume, subscription dominates
    expect(aisensy!.totalCostINR).toBeGreaterThan(aisensy!.subscriptionINR);
  });
});

// ═══════════════════════════════════════
// 3. TDS Deduction Tracking (Q3-P3)
// Source: Reddit r/IndianBusiness, LinkedIn posts
// ═══════════════════════════════════════

describe('TDS Deduction Tracking (Q3-P3)', () => {
  it('calculates 10% TDS correctly on ₹50,000 invoice', () => {
    const result = calculateTDS(50000, 10, '2026-06-01', '2026-06-15');
    expect(result.tdsDeducted).toBe(5000);
    expect(result.netReceived).toBe(45000);
    expect(result.tdsRate).toBe(10);
  });

  it('calculates 2% TDS for contractors (Section 194C)', () => {
    const result = calculateTDS(100000, 2, '2026-06-01', '2026-06-15');
    expect(result.tdsDeducted).toBe(2000);
    expect(result.netReceived).toBe(98000);
  });

  it('marks certificate as received within 45 days', () => {
    const result = calculateTDS(50000, 10, '2026-06-01', '2026-06-15');
    expect(result.tdsCertificateStatus).toBe('received');
    expect(result.followUpRequired).toBe(false);
  });

  it('marks certificate as pending after 45 days', () => {
    const result = calculateTDS(50000, 10, '2026-06-01', '2026-07-20');
    expect(result.tdsCertificateStatus).toBe('pending');
    expect(result.followUpRequired).toBe(true);
    expect(result.daysSinceInvoice).toBe(49);
  });

  it('marks certificate as overdue after 60 days', () => {
    const result = calculateTDS(50000, 10, '2026-06-01', '2026-08-01');
    expect(result.tdsCertificateStatus).toBe('overdue');
    expect(result.followUpRequired).toBe(true);
    expect(result.daysSinceInvoice).toBe(61);
  });

  it('handles large invoice amounts correctly', () => {
    const result = calculateTDS(500000, 10, '2026-06-01', '2026-06-15');
    expect(result.tdsDeducted).toBe(50000);
    expect(result.netReceived).toBe(450000);
  });
});

// ═══════════════════════════════════════
// 4. Invoice Date Compliance (Q3-P1)
// Source: LinkedIn (Neeraj Sancheti, Kreativ Street)
// ═══════════════════════════════════════

describe('Invoice Date Compliance (Q3-P1)', () => {
  it('flags date change as non-compliant', () => {
    const result = checkInvoiceDateCompliance(
      '2026-06-01',
      '2026-06-15',
      50000,
      false
    );
    expect(result.compliant).toBe(false);
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.risks.some(r => r.includes('GST filing'))).toBe(true);
  });

  it('warns about revenue recognition impact', () => {
    const result = checkInvoiceDateCompliance(
      '2026-06-01',
      '2026-07-01',
      50000,
      false
    );
    expect(result.risks.some(r => r.includes('Revenue recognition'))).toBe(true);
  });

  it('warns about high-value invoice scrutiny', () => {
    const result = checkInvoiceDateCompliance(
      '2026-06-01',
      '2026-06-15',
      600000,
      false
    );
    expect(result.risks.some(r => r.includes('scrutiny'))).toBe(true);
  });

  it('adds audit risk when already filed', () => {
    const result = checkInvoiceDateCompliance(
      '2026-06-01',
      '2026-06-15',
      50000,
      true
    );
    expect(result.compliant).toBe(false);
    expect(result.risks.some(r => r.includes('audit'))).toBe(true);
  });

  it('allows same-date requests (no change)', () => {
    const result = checkInvoiceDateCompliance(
      '2026-06-15',
      '2026-06-15',
      50000,
      false
    );
    expect(result.compliant).toBe(true);
    expect(result.risks).toHaveLength(0);
  });

  it('allows earlier date requests', () => {
    const result = checkInvoiceDateCompliance(
      '2026-06-15',
      '2026-06-01',
      50000,
      false
    );
    expect(result.compliant).toBe(true);
  });

  it('recommends credit note + new invoice approach', () => {
    const result = checkInvoiceDateCompliance(
      '2026-06-01',
      '2026-06-15',
      50000,
      false
    );
    expect(result.recommendation).toContain('credit note');
  });

  it('recommends contract clause for prevention', () => {
    const result = checkInvoiceDateCompliance(
      '2026-06-01',
      '2026-06-15',
      50000,
      false
    );
    expect(result.recommendation).toContain('final');
  });
});

// ═══════════════════════════════════════
// 5. HubSpot Cost Warning (Q3-C1)
// Source: Vedpragya blog, G2 HubSpot reviews
// ═══════════════════════════════════════

describe('HubSpot Cost Warning (Q3-C1)', () => {
  it('warns strongly at 20 users', () => {
    const result = warnHubSpotScalingCost(20);
    expect(result.warningMessage).toContain('20 users');
    expect(result.warningMessage).toContain('alternatives');
    expect(result.annualCostINR).toBeGreaterThan(1000000); // >₹10L/year
  });

  it('warns moderately at 15 users', () => {
    const result = warnHubSpotScalingCost(15);
    expect(result.warningMessage).toContain('Monitor closely');
  });

  it('competitive at 5 users', () => {
    const result = warnHubSpotScalingCost(5);
    expect(result.warningMessage).toContain('competitive');
  });

  it('includes Zoho CRM as alternative', () => {
    const result = warnHubSpotScalingCost(20);
    const zoho = result.alternatives.find(a => a.name === 'Zoho CRM');
    expect(zoho).toBeDefined();
    expect(zoho!.monthlyCostINR).toBeLessThan(result.monthlyCostINR);
  });

  it('includes Custom CRM as alternative with payback note', () => {
    const result = warnHubSpotScalingCost(20);
    const custom = result.alternatives.find(a => a.name === 'Custom CRM');
    expect(custom).toBeDefined();
    expect(custom!.notes.toLowerCase()).toContain('payback');
  });

  it('monthly cost scales with team size', () => {
    const small = warnHubSpotScalingCost(5);
    const large = warnHubSpotScalingCost(25);
    expect(large.monthlyCostINR).toBeGreaterThan(small.monthlyCostINR);
  });

  it('annual cost is 12x monthly', () => {
    const result = warnHubSpotScalingCost(20);
    expect(result.annualCostINR).toBeCloseTo(result.monthlyCostINR * 12, 0);
  });
});

// ═══════════════════════════════════════
// 6. Tier-2/3 Budget Adjustment (Q3-A3)
// Source: LinkedIn (Indian agency owners), Reddit r/marketingIndia
// ═══════════════════════════════════════

describe('Tier-2/3 Budget Adjustment (Q3-A3)', () => {
  it('returns Tier-1 for Mumbai', () => {
    const result = getTierBudgetRecommendation('Mumbai');
    expect(result.tier).toBe(1);
    expect(result.averageBudgetRange.min).toBe(50000);
  });

  it('returns Tier-2 for Lucknow', () => {
    const result = getTierBudgetRecommendation('Lucknow');
    expect(result.tier).toBe(2);
    expect(result.averageBudgetRange.max).toBe(30000);
  });

  it('returns Tier-3 for Varanasi', () => {
    const result = getTierBudgetRecommendation('Varanasi');
    expect(result.tier).toBe(3);
    expect(result.averageBudgetRange.max).toBe(15000);
  });

  it('Tier-3 city gets affordable package recommendation', () => {
    const result = getTierBudgetRecommendation('Patna');
    expect(result.packagePrice).toBeLessThanOrEqual(15000);
    expect(result.notes).toContain('affordable');
  });

  it('Tier-1 city gets full-service recommendation', () => {
    const result = getTierBudgetRecommendation('Delhi');
    expect(result.recommendedPackage).toContain('Full-service');
    expect(result.packagePrice).toBeGreaterThan(100000);
  });

  it('Tier-2 city focuses on local SEO', () => {
    const result = getTierBudgetRecommendation('Jaipur');
    expect(result.recommendedPackage).toContain('Google My Business');
    expect(result.notes).toContain('Tier-2');
  });

  it('case-insensitive city matching', () => {
    const lower = getTierBudgetRecommendation('lucknow');
    const upper = getTierBudgetRecommendation('LUCKNOW');
    const proper = getTierBudgetRecommendation('Lucknow');
    expect(lower.tier).toBe(proper.tier);
    expect(upper.tier).toBe(proper.tier);
  });

  it('unknown city defaults to Tier-3', () => {
    const result = getTierBudgetRecommendation('SomeTinyVillage');
    expect(result.tier).toBe(3);
    expect(result.averageBudgetRange.max).toBe(15000);
  });
});

// ═══════════════════════════════════════
// 7. WhatsApp INR Billing Migration Warning
// Source: Meta for Developers, Jan 2026 policy
// ═══════════════════════════════════════

describe('WhatsApp INR Billing Migration Warning', () => {
  it('flags migration as needed before deadline', () => {
    const result = checkINRBillingMigration('2026-09-01', false);
    expect(result.needsMigration).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('shows critical urgency within 30 days of deadline', () => {
    const result = checkINRBillingMigration('2026-12-10', false);
    expect(result.urgencyLevel).toBe('critical');
    expect(result.warnings.some(w => w.includes('URGENT'))).toBe(true);
    expect(result.daysUntilDeadline).toBeLessThanOrEqual(30);
  });

  it('shows high urgency within 90 days', () => {
    const result = checkINRBillingMigration('2026-10-02', false);
    expect(result.urgencyLevel).toBe('high');
    expect(result.warnings.some(w => w.includes('immediately'))).toBe(true);
  });

  it('shows medium urgency within 180 days', () => {
    const result = checkINRBillingMigration('2026-07-15', false);
    expect(result.urgencyLevel).toBe('medium');
  });

  it('no migration needed if already migrated', () => {
    const result = checkINRBillingMigration('2026-09-01', true);
    expect(result.needsMigration).toBe(false);
    expect(result.warnings).toHaveLength(0);
    expect(result.steps).toHaveLength(0);
  });

  it('deadline is December 31, 2026', () => {
    const result = checkINRBillingMigration('2026-09-01', false);
    expect(result.deadline).toBe('2026-12-31');
  });

  it('provides migration steps', () => {
    const result = checkINRBillingMigration('2026-09-01', false);
    expect(result.steps.some(s => s.includes('Meta Business Manager'))).toBe(true);
    expect(result.steps.some(s => s.includes('Migration API'))).toBe(true);
  });
});

// ═══════════════════════════════════════
// 8. Template Reclassification Alert
// Source: Agency owner complaints, Meta AI reclassification
// ═══════════════════════════════════════

describe('Template Reclassification Alert', () => {
  describe('detectReclassification', () => {
    it('critical alert when utility reclassified to marketing', () => {
      const result = detectReclassification('order_update', 'utility', 'marketing', 10000);
      expect(result.alertLevel).toBe('critical');
      expect(result.costMultiplier).toBeGreaterThanOrEqual(4);
      expect(result.estimatedMonthlyImpactINR).toBeGreaterThan(0);
    });

    it('critical alert includes resubmission recommendation', () => {
      const result = detectReclassification('promo_offer', 'utility', 'marketing', 5000);
      expect(result.recommendation).toContain('Resubmit');
      expect(result.recommendation).toContain('pausing');
    });

    it('warning alert for significant cost reclassification', () => {
      const result = detectReclassification('otp_code', 'service', 'utility', 5000);
      expect(result.alertLevel).toBe('warning');
      expect(result.costMultiplier).toBeGreaterThan(1);
    });

    it('info alert for minor reclassification', () => {
      const result = detectReclassification('booking_confirm', 'utility', 'service', 5000);
      expect(result.alertLevel).toBe('info');
      expect(result.estimatedMonthlyImpactINR).toBeLessThanOrEqual(0);
    });

    it('calculates correct monthly impact for 10K marketing reclassification', () => {
      // Utility: 10000 * 0.75 = 7500
      // Marketing: 10000 * 0.75 * 4.5 = 33750
      // Impact: 26250
      const result = detectReclassification('bulk_msg', 'utility', 'marketing', 10000, 0.75);
      expect(result.estimatedMonthlyImpactINR).toBeCloseTo(26250, -2);
    });

    it('handles service-to-marketing (infinite multiplier becomes critical)', () => {
      const result = detectReclassification('welcome_msg', 'service', 'marketing', 1000);
      expect(result.alertLevel).toBe('critical');
      expect(result.recommendation).toContain('MARKETING');
    });
  });

  describe('estimateReclassificationImpact', () => {
    it('aggregates impact across multiple templates', () => {
      const result = estimateReclassificationImpact([
        { name: 'promo1', originalCategory: 'utility', currentCategory: 'marketing', monthlyVolume: 5000 },
        { name: 'promo2', originalCategory: 'utility', currentCategory: 'marketing', monthlyVolume: 3000 },
      ]);
      expect(result.alerts).toHaveLength(2);
      expect(result.totalMonthlyImpactINR).toBeGreaterThan(0);
      expect(result.criticalCount).toBe(2);
    });

    it('counts only critical alerts', () => {
      const result = estimateReclassificationImpact([
        { name: 'otp', originalCategory: 'utility', currentCategory: 'authentication', monthlyVolume: 5000 },
        { name: 'promo', originalCategory: 'utility', currentCategory: 'marketing', monthlyVolume: 5000 },
      ]);
      expect(result.criticalCount).toBe(1);
    });

    it('returns zero impact for unchanged templates', () => {
      const result = estimateReclassificationImpact([
        { name: 'confirm', originalCategory: 'utility', currentCategory: 'utility', monthlyVolume: 5000 },
      ]);
      expect(result.totalMonthlyImpactINR).toBe(0);
      expect(result.criticalCount).toBe(0);
    });
  });
});

// ═══════════════════════════════════════
// 9. WhatsApp API Verification Timeline Warning
// Source: RichAutomate, MyOperator, Meta docs
// ═══════════════════════════════════════

describe('WhatsApp API Verification Timeline Warning (Q3-W2)', () => {
  it('estimates ~14 days for fully verified business', () => {
    const result = warnAPIVerificationTimeline(true, false);
    expect(result.estimatedDays).toBe(14);
    expect(result.warningMessage).toContain('14 business days');
  });

  it('adds 7 days when business not verified', () => {
    const result = warnAPIVerificationTimeline(false, false);
    expect(result.estimatedDays).toBe(21);
    expect(result.warningMessage).toContain('21 business days');
  });

  it('adds 5 days for existing WhatsApp number migration', () => {
    const result = warnAPIVerificationTimeline(true, true);
    expect(result.estimatedDays).toBe(19);
  });

  it('combines both delays for unverified + existing number', () => {
    const result = warnAPIVerificationTimeline(false, true);
    expect(result.estimatedDays).toBe(26);
  });

  it('suggests WhatsApp Business app as interim solution', () => {
    const result = warnAPIVerificationTimeline(false, false);
    expect(result.interimSolution).toContain('WhatsApp Business app');
    expect(result.interimSolution).toContain('free');
  });

  it('provides checklist for smooth onboarding', () => {
    const result = warnAPIVerificationTimeline(true, false);
    expect(result.checklist.length).toBeGreaterThanOrEqual(5);
    expect(result.checklist.some(s => s.includes('GSTIN'))).toBe(true);
    expect(result.checklist.some(s => s.includes('Business Manager'))).toBe(true);
  });

  it('warns about phone number migration delay', () => {
    const result = warnAPIVerificationTimeline(true, true);
    expect(result.warningMessage).toContain('migration');
  });
});

// ═══════════════════════════════════════
// 10. Green Tick Verification Checklist (Q3-W4)
// Source: Meta WhatsApp docs, agency owner guides
// ═══════════════════════════════════════

describe('Green Tick Verification Checklist (Q3-W4)', () => {
  it('eligible when all requirements met', () => {
    const result = getGreenTickChecklist(true, true, 1500, 45, true);
    expect(result.eligible).toBe(true);
    expect(result.requirementsPending).toHaveLength(0);
    expect(result.requirementsMet).toHaveLength(5);
  });

  it('not eligible when business not verified', () => {
    const result = getGreenTickChecklist(false, true, 1500, 45, true);
    expect(result.eligible).toBe(false);
    expect(result.requirementsPending.some(r => r.includes('business verification'))).toBe(true);
  });

  it('not eligible when messages below 1000 threshold', () => {
    const result = getGreenTickChecklist(true, true, 500, 45, true);
    expect(result.eligible).toBe(false);
    expect(result.requirementsPending.some(r => r.includes('1000'))).toBe(true);
  });

  it('not eligible when account too new', () => {
    const result = getGreenTickChecklist(true, true, 1500, 10, true);
    expect(result.eligible).toBe(false);
    expect(result.requirementsPending.some(r => r.includes('30+ days'))).toBe(true);
  });

  it('provides actionable steps', () => {
    const result = getGreenTickChecklist(true, true, 1500, 45, true);
    expect(result.steps.length).toBeGreaterThanOrEqual(5);
    expect(result.steps.some(s => s.includes('WhatsApp Manager') || s.includes('Meta') || s.includes('business'))).toBe(true);
  });

  it('shows timeline for eligible accounts', () => {
    const result = getGreenTickChecklist(true, true, 1500, 45, true);
    expect(result.estimatedTimeline).toContain('1-2 weeks');
  });

  it('counts remaining requirements correctly', () => {
    const result = getGreenTickChecklist(false, false, 100, 5, false);
    expect(result.requirementsPending).toHaveLength(5);
    expect(result.requirementsMet).toHaveLength(0);
  });
});

// ═══════════════════════════════════════
// 11. Zoho Fragmentation Warning (Q3-C2)
// Source: Zoho community forums, G2 reviews
// ═══════════════════════════════════════

describe('Zoho Fragmentation Warning (Q3-C2)', () => {
  it('no risk with single app', () => {
    const result = warnZohoFragmentation(['CRM']);
    expect(result.hasFragmentationRisk).toBe(false);
    expect(result.integrationOptions).toHaveLength(0);
  });

  it('detects fragmentation with multiple apps', () => {
    const result = warnZohoFragmentation(['CRM', 'Books', 'Projects']);
    expect(result.hasFragmentationRisk).toBe(true);
    expect(result.affectedApps).toContain('CRM');
    expect(result.affectedApps).toContain('Books');
  });

  it('suggests Zoho Flow for simple sync', () => {
    const result = warnZohoFragmentation(['CRM', 'Books']);
    expect(result.integrationOptions.some(o => o.name === 'Zoho Flow')).toBe(true);
  });

  it('suggests Zapier for cross-platform needs', () => {
    const result = warnZohoFragmentation(['CRM', 'Books', 'Projects']);
    expect(result.integrationOptions.some(o => o.name === 'Zapier')).toBe(true);
  });

  it('recommends consolidation for 3+ apps', () => {
    const result = warnZohoFragmentation(['CRM', 'Books', 'Projects', 'Desk']);
    expect(result.recommendation).toContain('consolidate');
  });

  it('handles empty app list', () => {
    const result = warnZohoFragmentation([]);
    expect(result.hasFragmentationRisk).toBe(false);
  });
});

// ═══════════════════════════════════════
// 12. Custom CRM ROI Calculator (Q3-C3)
// Source: Vedpragya blog, G2 HubSpot reviews
// ═══════════════════════════════════════

describe('Custom CRM ROI Calculator (Q3-C3)', () => {
  it('recommends SaaS for small teams', () => {
    const result = calculateCRMRoi(5);
    expect(result.recommendation).toContain('more cost-effective');
    expect(result.paybackMonths).toBe(999);
  });

  it('calculates viable payback for large teams', () => {
    const result = calculateCRMRoi(150);
    expect(result.paybackMonths).toBeLessThan(36);
    expect(result.saasAnnualCostINR).toBeGreaterThan(result.annualMaintenanceINR);
  });

  it('shows SaaS annual cost scales with team size', () => {
    const small = calculateCRMRoi(10);
    const large = calculateCRMRoi(30);
    expect(large.saasAnnualCostINR).toBeGreaterThan(small.saasAnnualCostINR);
  });

  it('maintenance cost is fixed regardless of team size', () => {
    const a = calculateCRMRoi(10);
    const b = calculateCRMRoi(30);
    expect(a.annualMaintenanceINR).toBe(b.annualMaintenanceINR);
  });

  it('includes build cost in analysis', () => {
    const result = calculateCRMRoi(20, 3000000);
    expect(result.buildCostINR).toBe(3000000);
  });
});

// ═══════════════════════════════════════
// 13. Upfront Payment Policy (Q3-P2)
// Source: LinkedIn (Neeraj Sancheti), Reddit r/agency
// ═══════════════════════════════════════

describe('Upfront Payment Policy (Q3-P2)', () => {
  it('100% upfront for small projects', () => {
    const result = getUpfrontPaymentPolicy(30000);
    expect(result.milestoneStructure).toHaveLength(1);
    expect(result.milestoneStructure[0].percent).toBe(100);
  });

  it('50/50 split for medium projects', () => {
    const result = getUpfrontPaymentPolicy(100000);
    expect(result.milestoneStructure).toHaveLength(2);
    expect(result.milestoneStructure[0].percent).toBe(50);
  });

  it('4-milestone structure for large projects', () => {
    const result = getUpfrontPaymentPolicy(500000);
    expect(result.milestoneStructure).toHaveLength(4);
    const totalPercent = result.milestoneStructure.reduce((sum, m) => sum + m.percent, 0);
    expect(totalPercent).toBe(100);
  });

  it('provides enforcement steps', () => {
    const result = getUpfrontPaymentPolicy(100000);
    expect(result.enforcementSteps.length).toBeGreaterThanOrEqual(5);
    expect(result.enforcementSteps.some(s => s.toLowerCase().includes('auto-hold'))).toBe(true);
  });

  it('includes escalation template', () => {
    const result = getUpfrontPaymentPolicy(100000);
    expect(result.escalationTemplate).toContain('{{client_name}}');
    expect(result.escalationTemplate).toContain('{{amount}}');
  });

  it('percentages sum to 100', () => {
    for (const value of [30000, 100000, 500000]) {
      const result = getUpfrontPaymentPolicy(value);
      const total = result.milestoneStructure.reduce((s, m) => s + m.percent, 0);
      expect(total).toBe(100);
    }
  });
});

// ═══════════════════════════════════════
// 14. AI-Native Value Framing (Q3-A1)
// Source: Lion CRM blog, LinkedIn (Luke Shalom)
// ═══════════════════════════════════════

describe('AI-Native Value Framing (Q3-A1)', () => {
  it('returns positioning framework', () => {
    const result = getAINativeValueFrame();
    expect(result.positioningFramework).toContain('AI-augmented');
    expect(result.positioningFramework).toContain('60%');
  });

  it('provides talking points', () => {
    const result = getAINativeValueFrame();
    expect(result.talkingPoints.length).toBeGreaterThanOrEqual(4);
    expect(result.talkingPoints.every(t => t.length > 20)).toBe(true);
  });

  it('includes differentiation strategies', () => {
    const result = getAINativeValueFrame();
    expect(result.differentiationStrategies.length).toBeGreaterThanOrEqual(5);
    expect(result.differentiationStrategies.some(s => s.includes('Results-based'))).toBe(true);
    expect(result.differentiationStrategies.some(s => s.toLowerCase().includes('niche'))).toBe(true);
  });

  it('includes pricing justification', () => {
    const result = getAINativeValueFrame();
    expect(result.pricingJustification).toContain('value');
  });
});

// ═══════════════════════════════════════
// 15. Vernacular Content Guidance (Q3-A2)
// Source: Lion CRM blog, G2 Jasper reviews
// ═══════════════════════════════════════

describe('Vernacular Content Guidance (Q3-A2)', () => {
  it('provides Hindi urban guidance', () => {
    const result = getVernacularContentGuidance('hindi', 'urban');
    expect(result.detectedLanguage).toBe('hindi');
    expect(result.toneGuidance).toContain('Hinglish');
    expect(result.examples.length).toBeGreaterThan(0);
  });

  it('provides Hindi rural guidance', () => {
    const result = getVernacularContentGuidance('hindi', 'rural');
    expect(result.toneGuidance).toContain('conversational');
    expect(result.toneGuidance).not.toContain('Hinglish');
  });

  it('provides Tamil guidance', () => {
    const result = getVernacularContentGuidance('tamil');
    expect(result.detectedLanguage).toBe('tamil');
    expect(result.examples.length).toBeGreaterThan(0);
  });

  it('provides Bengali guidance', () => {
    const result = getVernacularContentGuidance('bengali');
    expect(result.detectedLanguage).toBe('bengali');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('falls back for unknown languages', () => {
    const result = getVernacularContentGuidance('marathi');
    expect(result.detectedLanguage).toBe('marathi');
    expect(result.toneGuidance).toContain('conversational');
    expect(result.warnings.some(w => w.includes('native speakers'))).toBe(true);
  });

  it('includes warnings for all languages', () => {
    for (const lang of ['hindi', 'tamil', 'bengali', 'marathi']) {
      const result = getVernacularContentGuidance(lang);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════
// 16. Human Polish Pipeline (Q3-A4)
// Source: LinkedIn (multiple agency founders), G2 reviews
// ═══════════════════════════════════════

describe('Human Polish Pipeline (Q3-A4)', () => {
  it('provides blog-specific polish checklist', () => {
    const result = getHumanPolishPipeline('blog');
    expect(result.contentType).toBe('blog');
    expect(result.estimatedAiContribution).toBe(70);
    expect(result.polishChecklist.length).toBeGreaterThanOrEqual(6);
  });

  it('provides social media-specific checklist', () => {
    const result = getHumanPolishPipeline('social');
    expect(result.estimatedAiContribution).toBe(60);
    expect(result.polishChecklist.some(s => s.toLowerCase().includes('hashtag'))).toBe(true);
  });

  it('provides email-specific checklist', () => {
    const result = getHumanPolishPipeline('email');
    expect(result.estimatedAiContribution).toBe(65);
    expect(result.polishChecklist.some(s => s.includes('INR'))).toBe(true);
  });

  it('provides proposal-specific checklist', () => {
    const result = getHumanPolishPipeline('proposal');
    expect(result.estimatedAiContribution).toBe(55);
    expect(result.polishChecklist.some(s => s.includes('GST'))).toBe(true);
    expect(result.polishChecklist.some(s => s.includes('Tier'))).toBe(true);
  });

  it('falls back to default checklist for unknown content type', () => {
    const result = getHumanPolishPipeline('newsletter');
    expect(result.estimatedAiContribution).toBe(65);
    expect(result.polishChecklist.length).toBeGreaterThanOrEqual(5);
  });

  it('includes quality gates for all content types', () => {
    for (const type of ['blog', 'social', 'email', 'proposal', 'video']) {
      const result = getHumanPolishPipeline(type);
      expect(result.qualityGates.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('provides time estimates', () => {
    const blog = getHumanPolishPipeline('blog');
    expect(blog.timeEstimate).toContain('minute');
    const social = getHumanPolishPipeline('social');
    expect(social.timeEstimate).toContain('minute');
  });
});

// ═══════════════════════════════════════
// 17. Commodity Differentiation (Q3-A5)
// Source: Reddit r/marketing, r/agency, LinkedIn posts
// ═══════════════════════════════════════

describe('Commodity Differentiation (Q3-A5)', () => {
  it('high threat with 70%+ AI adoption', () => {
    const result = getCommodityDifferentiation(30000, 75);
    expect(result.currentThreatLevel).toBe('high');
    expect(result.riskFactors.length).toBeGreaterThanOrEqual(2);
    expect(result.defensiveStrategies.some(s => s.includes('Urgent'))).toBe(true);
  });

  it('medium threat with 40-70% AI adoption', () => {
    const result = getCommodityDifferentiation(30000, 50);
    expect(result.currentThreatLevel).toBe('medium');
    expect(result.riskFactors.some(r => r.includes('Moderate'))).toBe(true);
  });

  it('low threat with <40% AI adoption', () => {
    const result = getCommodityDifferentiation(30000, 20);
    expect(result.currentThreatLevel).toBe('low');
    expect(result.riskFactors.some(r => r.includes('Low AI adoption'))).toBe(true);
  });

  it('adds low-value risk factor for sub-₹20K projects', () => {
    const result = getCommodityDifferentiation(15000, 50);
    expect(result.riskFactors.some(r => r.includes('Low project value'))).toBe(true);
  });

  it('high threat includes pricing restructure urgency', () => {
    const result = getCommodityDifferentiation(30000, 80);
    expect(result.pricingRecommendation).toContain('outcome-based');
  });

  it('includes client education script', () => {
    const result = getCommodityDifferentiation(30000, 50);
    expect(result.clientEducationScript).toContain('AI tools are powerful');
    expect(result.clientEducationScript).toContain('guarantee');
  });

  it('includes differentiation strategies for all threat levels', () => {
    for (const adoption of [20, 50, 80]) {
      const result = getCommodityDifferentiation(30000, adoption);
      expect(result.defensiveStrategies.length).toBeGreaterThanOrEqual(5);
    }
  });
});
