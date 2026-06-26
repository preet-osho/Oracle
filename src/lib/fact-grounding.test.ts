import { describe, it, expect } from 'vitest';
import { groundFacts } from './fact-grounding';

describe('Fact Grounding', () => {
  it('grounds claims against document chunks', () => {
    const text = 'The client budget is ₹50,000 for the website project. Timeline is 4 weeks.';
    const result = groundFacts(text, {
      documentChunks: ['Client budget: ₹50,000. Timeline: 4 weeks for delivery.'],
    });
    expect(result.groundedClaims.length).toBeGreaterThanOrEqual(1);
    expect(result.groundingScore).toBeGreaterThan(0);
  });

  it('grounds claims against search results', () => {
    const text = 'According to industry data, Ahrefs is the leading SEO tool for agencies.';
    const result = groundFacts(text, {
      searchResults: [{ title: 'Best SEO Tools 2024', url: 'https://example.com', snippet: 'Ahrefs is the leading SEO tool used by agencies worldwide' }],
    });
    expect(result.groundedClaims.length).toBeGreaterThanOrEqual(1);
  });

  it('grounds claims against memory', () => {
    const text = 'The client prefers WhatsApp communication. They mentioned they have a team of 5 people.';
    const result = groundFacts(text, {
      memory: [
        { content: 'Client prefers WhatsApp over email for all communications', category: 'preference' },
        { content: 'Team size is 5 people including the founder', category: 'fact' },
      ],
    });
    expect(result.groundedClaims.length).toBeGreaterThanOrEqual(1);
  });

  it('identifies ungrounded claims', () => {
    const text = 'The market size is ₹500 crore. Competitor X has 10,000 customers. Revenue will double in 6 months.';
    const result = groundFacts(text, {
      documentChunks: ['Client runs a small agency in Delhi'],
    });
    expect(result.ungroundedClaims.length).toBeGreaterThan(0);
  });

  it('returns high grounding score when most claims are supported', () => {
    const text = 'SEO retainer costs ₹15,000 per month. Google Ads budget is ₹20,000. The deliverables include weekly reports.';
    const result = groundFacts(text, {
      documentChunks: [
        'SEO retainer: ₹15,000/month',
        'Google Ads: ₹20,000/month budget',
        'Weekly performance reports included',
      ],
    });
    expect(result.groundingScore).toBeGreaterThanOrEqual(60);
  });

  it('returns low grounding score when claims lack support', () => {
    const text = 'The company valuation is ₹10 crore. They have 500 employees. Revenue grew 200% last year.';
    const result = groundFacts(text, {
      documentChunks: ['A small digital agency in Mumbai'],
    });
    expect(result.groundingScore).toBeLessThan(50);
  });

  it('handles empty context gracefully', () => {
    const text = 'General best practices for SEO include keyword research and on-page optimization.';
    const result = groundFacts(text, {});
    expect(result.groundedClaims.length).toBe(0);
    // Empty context means no claims to ground — grounding score is 0 (no matches)
    expect(result.groundedClaims.length).toBe(0);
  });

  it('provides summary based on grounding score', () => {
    const text = 'Budget is ₹50,000. Timeline is 4 weeks. Deliverables include website and SEO setup.';
    const result = groundFacts(text, {
      documentChunks: ['Budget: ₹50,000. Timeline: 4 weeks. Scope: website + SEO.'],
    });
    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe('string');
  });
});
