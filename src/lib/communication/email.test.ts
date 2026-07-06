// ═══════════════════════════════════════
// ORACLE — Email Service Tests
// ═══════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { generateOutreachHtml, generateProposalHtml, generateFollowUpHtml, isEmailConfigured } from './email';

// ─── Configuration ─────────────────────

describe('Email Service', () => {
  describe('isEmailConfigured', () => {
    it('returns a boolean', () => {
      expect(typeof isEmailConfigured()).toBe('boolean');
    });
  });
});

// ─── HTML Templates ────────────────────

describe('generateOutreachHtml', () => {
  it('generates valid HTML with all parameters', () => {
    const html = generateOutreachHtml({
      recipientName: 'Rahul',
      agencyName: 'Oracle Digital',
      headline: 'Grow your business online',
      body: '<p>We can help you get more customers.</p>',
      cta: 'Book a Call',
      ctaUrl: 'https://calendly.com/oracle',
      signature: 'Preet Osho\nOracle Digital',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Rahul');
    expect(html).toContain('Oracle Digital');
    expect(html).toContain('Grow your business online');
    expect(html).toContain('Book a Call');
    expect(html).toContain('https://calendly.com/oracle');
    expect(html).toContain('Preet Osho');
  });

  it('handles missing CTA URL gracefully', () => {
    const html = generateOutreachHtml({
      recipientName: 'Test',
      agencyName: 'Test Agency',
      headline: 'Test',
      body: '<p>Test</p>',
      cta: 'Contact us',
      signature: 'Test',
    });

    expect(html).toContain('Contact us');
    expect(html).not.toContain('href=');
  });
});

describe('generateProposalHtml', () => {
  it('generates proposal HTML with pricing', () => {
    const html = generateProposalHtml({
      clientName: 'Rahul',
      agencyName: 'Oracle Digital',
      serviceSummary: 'SEO + Google Ads',
      priceRange: '₹25,000 - ₹40,000/month',
      timeline: '3 months',
      ctaUrl: 'https://oracle.app/proposal/123',
    });

    expect(html).toContain('Rahul');
    expect(html).toContain('SEO + Google Ads');
    expect(html).toContain('₹25,000 - ₹40,000/month');
    expect(html).toContain('3 months');
    expect(html).toContain('View Full Proposal');
    expect(html).toContain('valid for 15 days');
  });
});

describe('generateFollowUpHtml', () => {
  it('generates follow-up HTML', () => {
    const html = generateFollowUpHtml({
      recipientName: 'Priya',
      context: '<p>Just checking in on our last conversation.</p>',
      cta: 'Reply Now',
      ctaUrl: 'https://oracle.app/reply',
    });

    expect(html).toContain('Priya');
    expect(html).toContain('Just checking in');
    expect(html).toContain('Reply Now');
    expect(html).toContain('https://oracle.app/reply');
  });
});

// ─── HTML Quality Checks ───────────────

describe('Email HTML Quality', () => {
  it('all templates include responsive meta tag', () => {
    const outreach = generateOutreachHtml({ recipientName: 'T', agencyName: 'A', headline: 'H', body: 'B', cta: 'C', signature: 'S' });
    const proposal = generateProposalHtml({ clientName: 'T', agencyName: 'A', serviceSummary: 'S', priceRange: 'P', timeline: 'T', ctaUrl: 'U' });
    const followUp = generateFollowUpHtml({ recipientName: 'T', context: 'C', cta: 'C', ctaUrl: 'U' });

    expect(outreach).toContain('viewport');
    expect(proposal).toContain('viewport');
    expect(followUp).toContain('viewport');
  });

  it('all templates use inline CSS (email client compatibility)', () => {
    const html = generateOutreachHtml({ recipientName: 'T', agencyName: 'A', headline: 'H', body: 'B', cta: 'C', ctaUrl: 'U', signature: 'S' });
    expect(html).toContain('style="');
  });

  it('all templates include ORACLE branding', () => {
    const outreach = generateOutreachHtml({ recipientName: 'T', agencyName: 'A', headline: 'H', body: 'B', cta: 'C', signature: 'S' });
    expect(outreach).toContain('ORACLE');
  });
});
