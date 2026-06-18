import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectRisks,
  detectOpportunities,
  generateHealthCheck,
  saveInsights,
  getInsights,
  dismissInsight,
  getActiveInsights,
} from './proactive-intelligence';

describe('detectRisks', () => {
  it('detects no web presence', () => {
    const risks = detectRisks({ hasWebsite: false, clientType: 'business' });
    expect(risks.some((r) => r.title === 'No Web Presence Detected')).toBe(true);
  });

  it('detects low Google rating', () => {
    const risks = detectRisks({ googleRating: 3.0 });
    expect(risks.some((r) => r.title === 'Low Google Rating')).toBe(true);
  });

  it('detects no SEO tracking', () => {
    const risks = detectRisks({ hasWebsite: true, hasGSC: false });
    expect(risks.some((r) => r.title === 'No SEO Tracking')).toBe(true);
  });

  it('detects overdue invoices', () => {
    const risks = detectRisks({ overdueInvoiceCount: 2 });
    expect(risks.some((r) => r.title === 'Overdue Invoice')).toBe(true);
  });

  it('detects single channel dependency', () => {
    const risks = detectRisks({ activeChannels: ['website'] });
    expect(risks.some((r) => r.title === 'Single Channel Dependency')).toBe(true);
  });

  it('returns empty for healthy context', () => {
    const risks = detectRisks({
      hasWebsite: true,
      hasGSC: true,
      hasGA4: true,
      hasEmailMarketing: true,
      socialPlatforms: ['instagram', 'linkedin'],
      activeChannels: ['website', 'social', 'email'],
      googleRating: 4.5,
      overdueInvoiceCount: 0,
    });
    expect(risks).toEqual([]);
  });

  it('risks have correct structure', () => {
    const risks = detectRisks({ overdueInvoiceCount: 1 });
    expect(risks.length).toBeGreaterThan(0);
    const risk = risks[0];
    expect(risk.id).toBeDefined();
    expect(risk.category).toBe('risk');
    expect(risk.severity).toBeDefined();
    expect(risk.title).toBeDefined();
    expect(risk.description).toBeDefined();
    expect(risk.actionable).toBe(true);
    expect(risk.dismissed).toBe(false);
  });
});

describe('detectOpportunities', () => {
  it('detects competitor weakness', () => {
    const opps = detectOpportunities({ competitorWeakDigital: true });
    expect(opps.some((o) => o.title === 'Competitor Has Weak Digital Presence')).toBe(true);
  });

  it('detects expansion potential', () => {
    const opps = detectOpportunities({ revenueGrowth: 25 });
    expect(opps.some((o) => o.title === 'Expansion Potential')).toBe(true);
  });

  it('detects content gap', () => {
    const opps = detectOpportunities({ blogPostCount: 0, hasWebsite: true });
    expect(opps.some((o) => o.title === 'Content Gap Opportunity')).toBe(true);
  });

  it('returns empty for no opportunities', () => {
    const opps = detectOpportunities({});
    expect(opps).toEqual([]);
  });
});

describe('generateHealthCheck', () => {
  it('returns 100 for healthy context', () => {
    const check = generateHealthCheck('proj1', {
      hasWebsite: true,
      hasGSC: true,
      hasGA4: true,
      hasEmailMarketing: true,
      socialPlatforms: ['instagram'],
      activeChannels: ['website', 'social'],
      overdueInvoiceCount: 0,
    });
    expect(check.overallScore).toBe(100);
    expect(check.risks).toEqual([]);
  });

  it('reduces score for risks', () => {
    const check = generateHealthCheck('proj1', { overdueInvoiceCount: 1 });
    expect(check.overallScore).toBeLessThan(100);
    expect(check.risks.length).toBeGreaterThan(0);
  });

  it('increases score for opportunities', () => {
    const check = generateHealthCheck('proj1', { competitorWeakDigital: true });
    expect(check.overallScore).toBeGreaterThanOrEqual(100);
    expect(check.opportunities.length).toBeGreaterThan(0);
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveInsights and getInsights round-trip', () => {
    const insights = detectRisks({ overdueInvoiceCount: 1 });
    saveInsights(insights);
    const loaded = getInsights();
    expect(loaded.length).toBeGreaterThan(0);
  });

  it('dismissInsight marks as dismissed', () => {
    const insights = detectRisks({ overdueInvoiceCount: 1 });
    saveInsights(insights);
    dismissInsight(insights[0].id);
    const active = getActiveInsights();
    expect(active.find((i) => i.id === insights[0].id)).toBeUndefined();
  });

  it('getActiveInsights excludes dismissed', () => {
    saveInsights(detectRisks({ overdueInvoiceCount: 1 }));
    const all = getInsights();
    dismissInsight(all[0].id);
    const active = getActiveInsights();
    expect(active.every((i) => !i.dismissed)).toBe(true);
  });
});
