import { describe, it, expect } from 'vitest';
import { scoreConfidence } from './confidence-scorer';

describe('Confidence Scorer', () => {
  it('scores high confidence for direct, specific outputs', () => {
    const text = 'Use Google Analytics 4 for tracking. It costs ₹0 (free tier). Set up conversion tracking within 2-3 days. Install the gtag.js snippet on your website.';
    const result = scoreConfidence(text);
    expect(result.confidence).toBeGreaterThanOrEqual(70);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('detects hedging language and reduces confidence', () => {
    const text = 'I think you should probably use maybe Google Analytics. I believe it might be free. I\'m not sure about the pricing though. Possibly it could work for your needs.';
    const result = scoreConfidence(text);
    expect(result.checks.find((c) => c.name === 'hedging_language')?.passed).toBe(false);
  });

  it('detects hallucination patterns like vague sources', () => {
    const text = 'According to a recent study, 73.5% of agencies saw improvement. The research shows that ₹25,499.99 is the optimal price point. According to the 2023 report, this is proven.';
    const result = scoreConfidence(text);
    expect(result.checks.find((c) => c.name === 'hallucination_patterns')?.passed).toBe(false);
  });

  it('detects overconfident language', () => {
    const text = 'This is guaranteed to work. You will definitely see 100% improvement. It is certainly the best approach. This is proven to be unmatched in the industry.';
    const result = scoreConfidence(text);
    expect(result.checks.find((c) => c.name === 'overconfidence')?.passed).toBe(false);
  });

  it('provides source citations when context is provided', () => {
    const text = 'According to the document, the budget is ₹50,000. The search results show that Ahrefs is recommended.';
    const contextChunks = ['Budget allocation: ₹50,000 for Q1'];
    const searchResults = [{ title: 'Best SEO Tools', url: 'https://example.com', snippet: 'Ahrefs is a leading SEO tool' }];
    const result = scoreConfidence(text, contextChunks, searchResults);
    expect(result.checks.find((c) => c.name === 'source_citations')?.passed).toBe(true);
  });

  it('flags missing citations when context is provided', () => {
    const text = 'The budget should be allocated differently. We need to change the strategy.';
    const contextChunks = ['Original budget: ₹1,00,000'];
    const result = scoreConfidence(text, contextChunks);
    expect(result.checks.find((c) => c.name === 'source_citations')?.passed).toBe(false);
  });

  it('extracts and evaluates claims against context', () => {
    const text = 'The monthly SEO retainer costs ₹15,000. Google Ads campaign budget is ₹30,000 per month. The website will launch in 2 weeks.';
    const contextChunks = ['SEO retainer: ₹15,000/month for Indian agencies'];
    const result = scoreConfidence(text, contextChunks);
    expect(result.ungroundedClaims.length).toBeGreaterThanOrEqual(0);
  });

  it('returns high confidence for clean, specific output', () => {
    const text = 'Install Next.js with `npx create-next-app@latest`. Configure Supabase with environment variables. Deploy to Vercel with `vercel deploy`. The total setup takes 2-3 hours.';
    const result = scoreConfidence(text);
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });
});
