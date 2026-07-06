// ═══════════════════════════════════════
// ORACLE — Competitor Analyzer Tests
// Tests for SWOT generation, HTML parsing, report generation
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { generateSwot, generateReport } from './competitor-analyzer';
import type { CompetitorAnalysis } from './types';

// ─── Test Fixtures ────────────────────

function makeAnalysis(overrides: Partial<CompetitorAnalysis> = {}): CompetitorAnalysis {
  return {
    url: 'https://example.com',
    domain: 'example.com',
    scrapedAt: Date.now(),
    structure: {
      title: 'Example Company — Digital Agency',
      description: 'We build great websites',
      h1Tags: ['Welcome to Example'],
      h2Tags: ['Our Services', 'About Us'],
      navigation: ['Home', 'Services', 'About', 'Contact', 'Blog'],
      pages: ['/', '/services', '/about', '/contact', '/blog'],
      hasBlog: true,
      hasPricing: true,
      hasContact: true,
      hasTestimonials: true,
    },
    seo: {
      titleTag: 'Example Company — Best Digital Agency in India',
      metaDescription: 'We are a full-service digital agency offering comprehensive web design, development, SEO, and marketing solutions for businesses of all sizes across India.',
      canonicalUrl: 'https://example.com',
      hasSchemaMarkup: true,
      robotsMeta: 'index, follow',
      ogImage: 'https://example.com/og.png',
      hasSitemap: true,
    },
    contact: {
      emails: ['info@example.com'],
      phones: ['+91 98765 43210'],
      socialLinks: { facebook: 'facebook.com/example', linkedin: 'linkedin.com/company/example' },
    },
    content: {
      wordCount: 3000,
      blogPostCount: 15,
      lastBlogDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      topKeywords: ['digital', 'marketing', 'web', 'design'],
      contentFreshness: 'fresh',
    },
    pricing: {
      hasPricingPage: true,
      plans: [
        { name: 'Starter', price: '₹9,999/mo', features: ['5 pages', 'Basic SEO'] },
        { name: 'Pro', price: '₹29,999/mo', features: ['20 pages', 'Advanced SEO', 'Blog'] },
      ],
      pricingModel: 'subscription',
    },
    techStack: {
      framework: 'Next.js',
      analytics: ['Google Analytics', 'Hotjar'],
      cms: 'Contentful',
      cdn: 'Vercel',
    },
    ...overrides,
  };
}

// ─── generateSwot ─────────────────────

describe('generateSwot', () => {
  it('generates strengths for well-configured sites', () => {
    const analysis = makeAnalysis();
    const swot = generateSwot(analysis);

    expect(swot.strengths.length).toBeGreaterThan(0);
    expect(swot.strengths.some((s) => s.includes('title tag'))).toBe(true);
    expect(swot.strengths.some((s) => s.includes('meta description'))).toBe(true);
    expect(swot.strengths.some((s) => s.includes('schema markup'))).toBe(true);
    expect(swot.strengths.some((s) => s.includes('sitemap'))).toBe(true);
    expect(swot.strengths.some((s) => s.includes('Open Graph'))).toBe(true);
  });

  it('generates weaknesses for poorly configured sites', () => {
    const analysis = makeAnalysis({
      seo: {
        hasSchemaMarkup: false,
        hasSitemap: false,
      },
      content: {
        wordCount: 200,
        blogPostCount: 0,
        contentFreshness: 'abandoned',
        topKeywords: [],
      },
      structure: {
        ...makeAnalysis().structure,
        hasTestimonials: false,
        h1Tags: [],
        navigation: ['Home'],
      },
      contact: {
        emails: [],
        phones: [],
        socialLinks: {},
      },
    });

    const swot = generateSwot(analysis);

    expect(swot.weaknesses.length).toBeGreaterThan(0);
    expect(swot.weaknesses.some((w) => w.includes('schema markup') || w.includes('structured data'))).toBe(true);
    expect(swot.weaknesses.some((w) => w.includes('sitemap'))).toBe(true);
    expect(swot.weaknesses.some((w) => w.includes('thin content') || w.includes('Very thin'))).toBe(true);
    expect(swot.weaknesses.some((w) => w.includes('No H1'))).toBe(true);
    expect(swot.weaknesses.some((w) => w.includes('No testimonials'))).toBe(true);
    expect(swot.weaknesses.some((w) => w.includes('No visible contact'))).toBe(true);
  });

  it('generates opportunities from competitor weaknesses', () => {
    const analysis = makeAnalysis({
      seo: { hasSchemaMarkup: false, hasSitemap: false },
      content: { ...makeAnalysis().content, blogPostCount: 0, contentFreshness: 'abandoned' },
      contact: { emails: [], phones: [], socialLinks: {} },
    });

    const swot = generateSwot(analysis);

    expect(swot.opportunities.length).toBeGreaterThan(0);
    expect(swot.opportunities.some((o) => o.includes('schema markup'))).toBe(true);
    expect(swot.opportunities.some((o) => o.includes('content marketing') || o.includes('Content marketing'))).toBe(true);
    expect(swot.opportunities.some((o) => o.includes('accessibility') || o.includes('easier choice'))).toBe(true);
  });

  it('generates threats from competitor strengths', () => {
    const analysis = makeAnalysis({
      techStack: { framework: 'Next.js', analytics: ['Google Analytics', 'Hotjar'] },
      contact: { ...makeAnalysis().contact, socialLinks: { facebook: 'f', linkedin: 'l', twitter: 't' } },
    });

    const swot = generateSwot(analysis);

    expect(swot.threats.length).toBeGreaterThan(0);
    expect(swot.threats.some((t) => t.includes('Next.js'))).toBe(true);
    expect(swot.threats.some((t) => t.includes('analytics') || t.includes('data-driven'))).toBe(true);
    expect(swot.threats.some((t) => t.includes('social presence') || t.includes('social media'))).toBe(true);
  });

  it('generates a summary string', () => {
    const analysis = makeAnalysis();
    const swot = generateSwot(analysis);

    expect(swot.summary).toBeTruthy();
    expect(typeof swot.summary).toBe('string');
    expect(swot.summary.length).toBeGreaterThan(10);
  });

  it('detects freemium pricing as a threat', () => {
    const analysis = makeAnalysis({
      pricing: { hasPricingPage: true, plans: [], pricingModel: 'freemium' },
    });

    const swot = generateSwot(analysis);
    expect(swot.threats.some((t) => t.includes('Freemium'))).toBe(true);
  });

  it('detects multiple H1 tags as weakness', () => {
    const analysis = makeAnalysis({
      structure: { ...makeAnalysis().structure, h1Tags: ['Tag 1', 'Tag 2', 'Tag 3'] },
    });

    const swot = generateSwot(analysis);
    expect(swot.weaknesses.some((w) => w.includes('Multiple H1'))).toBe(true);
  });
});

// ─── generateReport ───────────────────

describe('generateReport', () => {
  it('generates a complete markdown report', () => {
    const analysis = makeAnalysis();
    const swot = generateSwot(analysis);
    const report = generateReport(analysis, swot);

    expect(report).toContain('# Competitor Analysis: example.com');
    expect(report).toContain('## Website Structure');
    expect(report).toContain('## SEO Signals');
    expect(report).toContain('## Content Signals');
    expect(report).toContain('## Contact Information');
    expect(report).toContain('## Pricing');
    expect(report).toContain('## Tech Stack');
    expect(report).toContain('## SWOT Analysis');
    expect(report).toContain('### Strengths');
    expect(report).toContain('### Weaknesses');
    expect(report).toContain('### Opportunities');
    expect(report).toContain('### Threats');
  });

  it('includes actual data from the analysis', () => {
    const analysis = makeAnalysis();
    const swot = generateSwot(analysis);
    const report = generateReport(analysis, swot);

    expect(report).toContain('Next.js');
    expect(report).toContain('Google Analytics');
    expect(report).toContain('Starter');
    expect(report).toContain('₹9,999/mo');
    expect(report).toContain('info@example.com');
  });

  it('handles missing data gracefully', () => {
    const analysis = makeAnalysis({
      seo: { hasSchemaMarkup: false, hasSitemap: false },
      contact: { emails: [], phones: [], socialLinks: {} },
      pricing: { hasPricingPage: false, plans: [] },
      techStack: {},
    });
    const swot = generateSwot(analysis);
    const report = generateReport(analysis, swot);

    expect(report).toContain('—');
    expect(report).toContain('❌');
  });
});
