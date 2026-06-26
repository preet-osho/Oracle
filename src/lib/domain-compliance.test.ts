// ═══════════════════════════════════════
// ORACLE — Domain Compliance Tests
// P1 Critical: SEBI, Healthcare, Legal disclaimer auto-inclusion
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { runHallucinationGuard, DEFAULT_GUARD_CONFIG } from './hallucination-guard';
import type { GuardConfig } from '@/types';

// Minimal config: domain strictness ON, everything else OFF for isolated testing
const DOMAIN_ONLY_CONFIG: GuardConfig = {
  ...DEFAULT_GUARD_CONFIG,
  selfVerification: false,
  factGrounding: false,
  patternDetection: false,
};

// ═══════════════════════════════════════
// SEBI / Finance Disclaimer
// ═══════════════════════════════════════

describe('Domain Compliance — SEBI / Finance Disclaimer', () => {
  it('FAILS output without any financial disclaimer', async () => {
    const text = 'Invest in mutual funds for 12-15% annual returns. This is a great opportunity for wealth creation. Start with ₹5,000 SIP today.';
    const result = await runHallucinationGuard(text, 'investment advice', { domain: 'finance' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(false);
    expect(domainCheck!.details).toContain('financial disclaimer');
  });

  it('FAILS output without risk acknowledgment', async () => {
    const text = 'This investment is educational purposes only. Consult a SEBI-registered advisor. Returns are guaranteed.';
    const result = await runHallucinationGuard(text, 'investment advice', { domain: 'finance' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    // Has SEBI disclaimer but missing "risk" mention
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(false);
    expect(domainCheck!.details).toContain('risk');
  });

  it('PASSES output with SEBI disclaimer AND risk acknowledgment', async () => {
    const text = 'Invest in mutual funds for 12-15% annual returns. This is for educational purposes only. Consult a SEBI-registered advisor before making investment decisions. All investments carry risk.';
    const result = await runHallucinationGuard(text, 'investment advice', { domain: 'finance' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(true);
    expect(domainCheck!.score).toBe(100);
  });

  it('PASSES output with "not financial advice" phrasing', async () => {
    const text = 'Consider diversified equity mutual funds. This is not financial advice. Consult a qualified financial advisor. Market investments are subject to risk.';
    const result = await runHallucinationGuard(text, 'investment advice', { domain: 'finance' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('PASSES output with "consult an advisor" phrasing', async () => {
    const text = 'Nifty 50 index funds have historically returned 12% CAGR. Consult an advisor for personalized advice. Past performance does not guarantee future results. Risk: market volatility.';
    const result = await runHallucinationGuard(text, 'investment advice', { domain: 'finance' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('Also covers "investment" domain (not just "finance")', async () => {
    const text = 'ELSS funds offer tax benefits under Section 80C. This is for educational purposes only. All investments carry risk. Consult a SEBI-registered advisor.';
    const result = await runHallucinationGuard(text, 'investment advice', { domain: 'investment' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(true);
  });

  it('FAILS investment domain without disclaimer', async () => {
    const text = 'ELSS funds offer 15% returns. Buy now before deadline.';
    const result = await runHallucinationGuard(text, 'investment advice', { domain: 'investment' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(false);
  });
});

// ═══════════════════════════════════════
// Healthcare Disclaimer
// ═══════════════════════════════════════

describe('Domain Compliance — Healthcare Disclaimer', () => {
  it('FAILS output without medical disclaimer', async () => {
    const text = 'Dental implants cost ₹20,000-₹50,000 per implant in India. The procedure involves titanium posts surgically placed in the jawbone. Recovery takes 3-6 months.';
    const result = await runHallucinationGuard(text, 'dental advice', { domain: 'healthcare' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(false);
    expect(domainCheck!.details).toContain('healthcare disclaimer');
  });

  it('PASSES output with "consult a doctor" disclaimer', async () => {
    const text = 'Dental implants cost ₹20,000-₹50,000 per implant. Always consult a doctor before undergoing any dental procedure. This information is for educational purposes only.';
    const result = await runHallucinationGuard(text, 'dental advice', { domain: 'healthcare' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(true);
    expect(domainCheck!.score).toBe(100);
  });

  it('PASSES output with "medical professional" disclaimer', async () => {
    const text = 'Root canal treatment typically costs ₹3,000-₹8,000. Consult a medical professional for diagnosis. This is not medical advice.';
    const result = await runHallucinationGuard(text, 'dental advice', { domain: 'healthcare' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('PASSES output with "not medical advice" disclaimer', async () => {
    const text = 'Teeth whitening procedures range from ₹5,000-₹15,000. This is not medical advice. Please consult your dentist for personalized treatment plans.';
    const result = await runHallucinationGuard(text, 'dental advice', { domain: 'healthcare' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('FAILS output that looks like medical advice without disclaimer', async () => {
    const text = 'Take ibuprofen 400mg every 6 hours for pain relief. Apply ice pack for 20 minutes. If swelling persists more than 48 hours, increase dosage.';
    const result = await runHallucinationGuard(text, 'patient advice', { domain: 'healthcare' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(false);
  });
});

// ═══════════════════════════════════════
// Legal Disclaimer
// ═══════════════════════════════════════

describe('Domain Compliance — Legal Disclaimer', () => {
  it('FAILS output without legal disclaimer', async () => {
    const text = 'Under the Indian Contract Act, Section 73, the party suffering from breach can claim damages. The compensation shall be for any loss or damage caused.';
    const result = await runHallucinationGuard(text, 'legal advice', { domain: 'legal' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(false);
    expect(domainCheck!.details).toContain('legal disclaimer');
  });

  it('PASSES output with "consult a lawyer" disclaimer', async () => {
    const text = 'Under the Indian Contract Act, Section 73, damages may be claimed for breach. Please consult a lawyer for legal advice specific to your situation. This is general information only.';
    const result = await runHallucinationGuard(text, 'legal advice', { domain: 'legal' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(true);
    expect(domainCheck!.score).toBe(100);
  });

  it('PASSES output with "legal professional" disclaimer', async () => {
    const text = 'The DPDP Act 2023 requires data fiduciaries to implement reasonable security practices. Consult a legal professional for compliance guidance. This is not legal advice.';
    const result = await runHallucinationGuard(text, 'legal advice', { domain: 'legal' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('PASSES output with "not legal advice" disclaimer', async () => {
    const text = 'GST registration is mandatory for businesses with turnover above ₹40 lakhs. This is not legal advice. Please consult a qualified legal professional for your specific situation.';
    const result = await runHallucinationGuard(text, 'legal advice', { domain: 'legal' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('FAILS output that gives specific legal guidance without disclaimer', async () => {
    const text = 'File a complaint under Section 138 of the Negotiable Instruments Act. You have 30 days from the date of dishonor. Send a legal notice via registered post.';
    const result = await runHallucinationGuard(text, 'legal advice', { domain: 'legal' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(false);
  });
});

// ═══════════════════════════════════════
// Ads Domain — Conversion Tracking
// ═══════════════════════════════════════

describe('Domain Compliance — Ads (Conversion Tracking)', () => {
  it('FAILS ads output without conversion tracking mention', async () => {
    const text = 'Run Google Ads targeting dental clinics in Chennai. Budget ₹50,000/month. Use responsive search ads with 15 headlines. Target CPA ₹500.';
    const result = await runHallucinationGuard(text, 'ads campaign', { domain: 'ads' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(false);
    expect(domainCheck!.details).toContain('conversion tracking');
  });

  it('PASSES ads output with conversion tracking', async () => {
    const text = 'Run Google Ads targeting dental clinics in Chennai. Set up conversion tracking with Google Analytics 4 and Meta Pixel to measure campaign performance. Budget ₹50,000/month.';
    const result = await runHallucinationGuard(text, 'ads campaign', { domain: 'ads' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeDefined();
    expect(domainCheck!.passed).toBe(true);
  });

  it('PASSES ads output mentioning analytics', async () => {
    const text = 'Launch Meta Ads campaign. Install analytics tracking. Use Google Tag Manager for conversion measurement. Budget allocation: 60% awareness, 40% conversion.';
    const result = await runHallucinationGuard(text, 'ads campaign', { domain: 'ads' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });
});

// ═══════════════════════════════════════
// Non-Strict Domains — No Check Required
// ═══════════════════════════════════════

describe('Domain Compliance — Non-Strict Domains', () => {
  it('Does NOT run domain check for "marketing" domain', async () => {
    const text = 'Use Instagram for food photography. Post 3 times per week. Engage with local food bloggers. Budget ₹20,000/month.';
    const result = await runHallucinationGuard(text, 'social strategy', { domain: 'marketing' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeUndefined();
  });

  it('Does NOT run domain check for "development" domain', async () => {
    const text = 'Build the website with Next.js. Use Supabase for the database. Deploy to Vercel. Set up CI/CD with GitHub Actions.';
    const result = await runHallucinationGuard(text, 'tech stack', { domain: 'development' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeUndefined();
  });

  it('Does NOT run domain check when no domain specified', async () => {
    const text = 'Create a marketing plan for a dental clinic. Include SEO, social media, and Google Ads strategies.';
    const result = await runHallucinationGuard(text, 'marketing plan', {}, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck).toBeUndefined();
  });
});

// ═══════════════════════════════════════
// Combined Domain Compliance Scenarios
// ═══════════════════════════════════════

describe('Domain Compliance — Real-World Scenarios', () => {
  it('Finance: Complete compliant investment recommendation', async () => {
    const text = 'For a 30-year-old with moderate risk tolerance, consider allocating 60% to equity mutual funds (HDFC Flexi Cap, ₹5,000 SIP), 25% to debt funds, and 15% to gold ETFs. This is for educational purposes only. Consult a SEBI-registered investment advisor. All investments are subject to market risk.';
    const result = await runHallucinationGuard(text, 'portfolio advice', { domain: 'finance' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('Healthcare: Complete compliant dental advice', async () => {
    const text = 'Dental implants are a permanent solution for missing teeth. Cost: ₹20,000-₹50,000 per implant. The procedure involves 2-3 visits over 3-6 months. Always consult a medical professional before treatment. This is not medical advice.';
    const result = await runHallucinationGuard(text, 'dental info', { domain: 'healthcare' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('Legal: Complete compliant legal information', async () => {
    const text = 'Under the Indian Contract Act, Section 73, damages for breach are compensatory, not punitive. The limitation period is 3 years from the date of breach. Please consult a lawyer for advice specific to your situation. This is general information, not legal advice.';
    const result = await runHallucinationGuard(text, 'contract law', { domain: 'legal' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });

  it('Ads: Complete compliant ad campaign strategy', async () => {
    const text = 'Launch Google Ads campaign for dental clinic. Set up conversion tracking with GA4. Budget: ₹50,000/month. Target keywords: "dentist near me", "dental implants cost". Expected CPC: ₹15-40. Track form submissions and phone calls.';
    const result = await runHallucinationGuard(text, 'ads campaign', { domain: 'ads' }, DOMAIN_ONLY_CONFIG);
    const domainCheck = result.checks.find((c) => c.name === 'domain_strictness');
    expect(domainCheck!.passed).toBe(true);
  });
});
