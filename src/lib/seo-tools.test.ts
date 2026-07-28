import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPageSpeedInsights,
  validateSchema,
  performSEOAudit,
  formatPageSpeedResult,
  formatSEOAuditResult,
  type PageSpeedResult,
  type SchemaValidationResult,
  type SEOAuditResult,
} from './seo-tools';

// ═══════════════════════════════════════
// Mock fetch
// ═══════════════════════════════════════

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  process.env.PAGESPEED_API_KEY = undefined;
});

// ═══════════════════════════════════════
// PageSpeed Insights Tests
// ═══════════════════════════════════════

describe('getPageSpeedInsights', () => {
  it('returns PageSpeedResult structure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        lighthouseResult: {
          categories: {
            performance: { score: 0.85 },
            accessibility: { score: 0.92 },
            'best-practices': { score: 0.88 },
            seo: { score: 0.95 },
          },
          audits: {
            'first-contentful-paint': { displayValue: '1.2s', score: 0.9 },
            'largest-contentful-paint': { displayValue: '2.1s', score: 0.8 },
            'total-blocking-time': { displayValue: '150ms', score: 0.85 },
            'cumulative-layout-shift': { displayValue: '0.05', score: 0.95 },
            'speed-index': { displayValue: '1.8s', score: 0.82 },
          },
        },
      }),
    });

    const result = await getPageSpeedInsights('https://example.com', 'mobile');
    expect(result).toHaveProperty('url', 'https://example.com');
    expect(result).toHaveProperty('strategy', 'mobile');
    expect(result).toHaveProperty('performanceScore', 85);
    expect(result).toHaveProperty('accessibilityScore', 92);
    expect(result).toHaveProperty('seoScore', 95);
    expect(result).toHaveProperty('firstContentfulPaint', '1.2s');
  });

  it('returns zero scores on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await getPageSpeedInsights('https://example.com');
    expect(result.performanceScore).toBe(0);
    expect(result.accessibilityScore).toBe(0);
  });
});

// ═══════════════════════════════════════
// Schema Validation Tests
// ═══════════════════════════════════════

describe('validateSchema', () => {
  it('returns SchemaValidationResult structure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(`
        <html>
          <head>
            <script type="application/ld+json">
              {"@type": "Organization", "name": "Test Co"}
            </script>
          </head>
          <body></body>
        </html>
      `),
    });

    const result = await validateSchema('https://example.com');
    expect(result).toHaveProperty('url', 'https://example.com');
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('schemas');
    expect(result.schemas).toHaveLength(1);
    expect(result.schemas[0].type).toBe('Organization');
  });

  it('detects missing schema', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<html><body>No schema here</body></html>'),
    });

    const result = await validateSchema('https://example.com');
    expect(result.schemas).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles invalid JSON-LD', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(`
        <html>
          <head>
            <script type="application/ld+json">invalid json</script>
          </head>
          <body></body>
        </html>
      `),
    });

    const result = await validateSchema('https://example.com');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════
// SEO Audit Tests
// ═══════════════════════════════════════

describe('performSEOAudit', () => {
  it('returns SEOAuditResult structure', async () => {
    // Mock PageSpeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        lighthouseResult: {
          categories: {
            performance: { score: 0.8 },
            accessibility: { score: 0.9 },
            'best-practices': { score: 0.85 },
            seo: { score: 0.9 },
          },
          audits: {
            'first-contentful-paint': { displayValue: '1.5s', score: 0.85 },
            'largest-contentful-paint': { displayValue: '2.5s', score: 0.75 },
            'total-blocking-time': { displayValue: '200ms', score: 0.8 },
            'cumulative-layout-shift': { displayValue: '0.1', score: 0.9 },
            'speed-index': { displayValue: '2.0s', score: 0.78 },
          },
        },
      }),
    });

    // Mock Schema validation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue('<html><body>Page content</body></html>'),
    });

    // Mock page fetch for on-page analysis
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(`
        <html>
          <head>
            <title>Test Page Title</title>
            <meta name="description" content="Test description">
            <link rel="canonical" href="https://example.com">
          </head>
          <body>
            <h1>Main Heading</h1>
            <h2>Sub Heading</h2>
            <img src="test.jpg" alt="Test image">
            <a href="/page1">Link 1</a>
            <a href="https://external.com">External</a>
          </body>
        </html>
      `),
    });

    const result = await performSEOAudit('https://example.com');
    expect(result).toHaveProperty('url', 'https://example.com');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('technical');
    expect(result).toHaveProperty('onPage');
    expect(result).toHaveProperty('performance');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('recommendations');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════
// Format Functions Tests
// ═══════════════════════════════════════

describe('formatPageSpeedResult', () => {
  it('formats result with scores and metrics', () => {
    const result: PageSpeedResult = {
      url: 'https://example.com',
      strategy: 'mobile',
      performanceScore: 85,
      accessibilityScore: 92,
      bestPracticesScore: 88,
      seoScore: 95,
      firstContentfulPaint: '1.2s',
      largestContentfulPaint: '2.1s',
      totalBlockingTime: '150ms',
      cumulativeLayoutShift: '0.05',
      speedIndex: '1.8s',
      opportunities: [],
      diagnostics: [],
    };
    const formatted = formatPageSpeedResult(result);
    expect(formatted).toContain('85/100');
    expect(formatted).toContain('1.2s');
    expect(formatted).toContain('2.1s');
  });
});

describe('formatSEOAuditResult', () => {
  it('formats audit with technical health', () => {
    const result: SEOAuditResult = {
      url: 'https://example.com',
      timestamp: Date.now(),
      technical: {
        ssl: true,
        mobileFriendly: true,
        crawlable: true,
        indexable: true,
        hasRobotsTxt: true,
        hasSitemap: true,
        hasCanonicalTag: true,
        hasSchemaMarkup: true,
        redirectChain: 0,
        brokenLinks: 0,
      },
      onPage: {
        titleTag: { exists: true, length: 50, score: 100 },
        metaDescription: { exists: true, length: 150, score: 100 },
        headings: { h1: 1, h2: 3, h3: 2 },
        images: { total: 10, withAlt: 8, withoutAlt: 2 },
        internalLinks: 15,
        externalLinks: 5,
        wordCount: 1500,
      },
      performance: {
        firstContentfulPaint: 1.2,
        largestContentfulPaint: 2.1,
        totalBlockingTime: 150,
        cumulativeLayoutShift: 0.05,
        speedIndex: 1.8,
        timeToInteractive: 2.5,
      },
      score: 85,
      recommendations: [],
    };
    const formatted = formatSEOAuditResult(result);
    expect(formatted).toContain('85/100');
    expect(formatted).toContain('SSL');
    expect(formatted).toContain('✅');
  });
});
