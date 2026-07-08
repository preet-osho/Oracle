// ═══════════════════════════════════════
// ORACLE — Scraping Module Tests
// Tests for scrapeUrl, scrapeUrls, crawlSite, extractStructuredData,
// mapSite, formatMarkdownForAI, extractKeyContent
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock references ────────────

const { mockScrapeUrl, mockCrawlUrl, mockMapUrl } = vi.hoisted(() => ({
  mockScrapeUrl: vi.fn(),
  mockCrawlUrl: vi.fn(),
  mockMapUrl: vi.fn(),
}));

// ─── Module Mocks ──────────────────────

vi.mock('@mendable/firecrawl-js', () => ({
  default: vi.fn().mockImplementation(function () {
    this.scrapeUrl = mockScrapeUrl;
    this.crawlUrl = mockCrawlUrl;
    this.mapUrl = mockMapUrl;
  }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Fresh Import Helper ────────────────

async function freshImport() {
  vi.resetModules();
  return import('./scraping');
}

// ─── Env Helper ─────────────────────────

function stubEnv(overrides: Record<string, string> = {}) {
  vi.stubEnv('FIRECRAWL_API_KEY', overrides.FIRECRAWL_API_KEY ?? 'fc_test_key');
}

// ═══════════════════════════════════════
// scrapeUrl Tests
// ═══════════════════════════════════════

describe('scrapeUrl', () => {
  beforeEach(() => {
    mockScrapeUrl.mockClear();
    stubEnv();
    mockScrapeUrl.mockResolvedValue({
      markdown: '# Hello World\n\nThis is content.',
      metadata: {
        title: 'Test Page',
        description: 'A test page',
        language: 'en',
        sourceURL: 'https://example.com',
        statusCode: 200,
      },
      links: ['https://example.com/about', 'https://example.com/contact'],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('scrapes a URL successfully with default options', async () => {
    const { scrapeUrl } = await freshImport();
    const result = await scrapeUrl('https://example.com');

    expect(result.url).toBe('https://example.com');
    expect(result.title).toBe('Test Page');
    expect(result.markdown).toBe('# Hello World\n\nThis is content.');
    expect(result.metadata.description).toBe('A test page');
    expect(result.metadata.language).toBe('en');
    expect(result.metadata.statusCode).toBe(200);
    expect(result.links).toEqual(['https://example.com/about', 'https://example.com/contact']);
    expect(result.scrapedAt).toBeTypeOf('number');
  });

  it('passes options to Firecrawl client', async () => {
    const { scrapeUrl } = await freshImport();
    await scrapeUrl('https://example.com', {
      formats: ['markdown', 'html'],
      onlyMainContent: false,
      includeTags: ['article'],
      excludeTags: ['nav'],
      timeout: 60000,
      waitForSelector: 5000,
    });

    expect(mockScrapeUrl).toHaveBeenCalledWith('https://example.com', {
      formats: ['markdown', 'html'],
      onlyMainContent: false,
      includeTags: ['article'],
      excludeTags: ['nav'],
      timeout: 60000,
      waitFor: 5000,
    });
  });

  it('includes HTML when formats includes html', async () => {
    mockScrapeUrl.mockResolvedValue({
      markdown: 'Content',
      html: '<p>Content</p>',
      metadata: { title: 'Page' },
      links: [],
    });

    const { scrapeUrl } = await freshImport();
    const result = await scrapeUrl('https://example.com', { formats: ['markdown', 'html'] });

    expect(result.html).toBe('<p>Content</p>');
  });

  it('does not include HTML when formats is markdown only', async () => {
    const { scrapeUrl } = await freshImport();
    const result = await scrapeUrl('https://example.com', { formats: ['markdown'] });

    expect(result.html).toBeUndefined();
  });

  it('includes screenshot when formats includes screenshot', async () => {
    mockScrapeUrl.mockResolvedValue({
      markdown: 'Content',
      screenshot: 'data:image/png;base64,abc123',
      metadata: { title: 'Page' },
      links: [],
    });

    const { scrapeUrl } = await freshImport();
    const result = await scrapeUrl('https://example.com', { formats: ['screenshot'] });

    expect(result.screenshot).toBe('data:image/png;base64,abc123');
  });

  it('uses custom API key when provided', async () => {
    const { scrapeUrl } = await freshImport();
    await scrapeUrl('https://example.com', {}, 'custom_api_key');

    // Should not throw — custom key creates a new client
    expect(mockScrapeUrl).toHaveBeenCalled();
  });

  it('throws when no API key is configured', async () => {
    stubEnv({ FIRECRAWL_API_KEY: '' });

    const { scrapeUrl } = await freshImport();
    await expect(scrapeUrl('https://example.com')).rejects.toThrow('Firecrawl API key not configured');
  });

  it('throws when Firecrawl client throws', async () => {
    mockScrapeUrl.mockRejectedValue(new Error('Rate limited'));

    const { scrapeUrl } = await freshImport();
    await expect(scrapeUrl('https://example.com')).rejects.toThrow('Rate limited');
  });

  it('handles missing metadata gracefully', async () => {
    mockScrapeUrl.mockResolvedValue({
      markdown: 'Content',
      links: [],
    });

    const { scrapeUrl } = await freshImport();
    const result = await scrapeUrl('https://example.com');

    expect(result.title).toBe('');
    expect(result.metadata.description).toBeUndefined();
    expect(result.metadata.sourceURL).toBe('https://example.com');
  });

  it('handles non-Error throw from Firecrawl', async () => {
    mockScrapeUrl.mockRejectedValue('string error');

    const { scrapeUrl } = await freshImport();
    await expect(scrapeUrl('https://example.com')).rejects.toBe('string error');
  });
});

// ═══════════════════════════════════════
// scrapeUrls Tests
// ═══════════════════════════════════════

describe('scrapeUrls', () => {
  beforeEach(() => {
    mockScrapeUrl.mockClear();
    stubEnv();
    mockScrapeUrl.mockResolvedValue({
      markdown: 'Content',
      metadata: { title: 'Page' },
      links: [],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('scrapes multiple URLs successfully', async () => {
    const { scrapeUrls } = await freshImport();
    const results = await scrapeUrls(['https://a.com', 'https://b.com']);

    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://a.com');
    expect(results[1].url).toBe('https://b.com');
    expect(mockScrapeUrl).toHaveBeenCalledTimes(2);
  });

  it('returns empty results for empty input', async () => {
    const { scrapeUrls } = await freshImport();
    const results = await scrapeUrls([]);

    expect(results).toEqual([]);
    expect(mockScrapeUrl).not.toHaveBeenCalled();
  });

  it('continues scraping when one URL fails', async () => {
    mockScrapeUrl
      .mockResolvedValueOnce({ markdown: 'OK', metadata: { title: 'OK' }, links: [] })
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({ markdown: 'OK2', metadata: { title: 'OK2' }, links: [] });

    const { scrapeUrls } = await freshImport();
    const results = await scrapeUrls(['https://ok.com', 'https://fail.com', 'https://ok2.com']);

    expect(results).toHaveLength(3);
    expect(results[0].markdown).toBe('OK');
    expect(results[1].markdown).toBe(''); // failed — empty fallback
    expect(results[2].markdown).toBe('OK2');
  });

  it('returns empty scrape result for failed URL', async () => {
    mockScrapeUrl.mockRejectedValue(new Error('Network error'));

    const { scrapeUrls } = await freshImport();
    const results = await scrapeUrls(['https://fail.com']);

    expect(results).toHaveLength(1);
    expect(results[0].markdown).toBe('');
    expect(results[0].links).toEqual([]);
    expect(results[0].scrapedAt).toBeTypeOf('number');
  });
});

// ═══════════════════════════════════════
// crawlSite Tests
// ═══════════════════════════════════════

describe('crawlSite', () => {
  beforeEach(() => {
    mockCrawlUrl.mockClear();
    stubEnv();
    mockCrawlUrl.mockResolvedValue({
      id: 'crawl_123',
      data: [
        {
          metadata: { sourceURL: 'https://example.com', title: 'Home' },
          markdown: '# Home page',
        },
        {
          metadata: { sourceURL: 'https://example.com/about', title: 'About' },
          markdown: '# About page',
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('crawls a site and returns pages', async () => {
    const { crawlSite } = await freshImport();
    const result = await crawlSite('https://example.com');

    expect(result.id).toBe('crawl_123');
    expect(result.status).toBe('completed');
    expect(result.pages).toHaveLength(2);
    expect(result.totalPages).toBe(2);
    expect(result.successfulPages).toBe(2);
    expect(result.failedPages).toBe(0);
    expect(result.pages[0].title).toBe('Home');
    expect(result.pages[1].title).toBe('About');
  });

  it('passes crawl options to Firecrawl', async () => {
    const { crawlSite } = await freshImport();
    await crawlSite('https://example.com', {
      limit: 10,
      includePaths: ['/blog/*'],
      excludePaths: ['/admin/*'],
      delay: 2000,
      scrapeOptions: { formats: ['html'], onlyMainContent: false },
    });

    expect(mockCrawlUrl).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      limit: 10,
      includePaths: ['/blog/*'],
      excludePaths: ['/admin/*'],
      delay: 2000,
    }));
  });

  it('handles partial failures in crawl results', async () => {
    mockCrawlUrl.mockResolvedValue({
      id: 'crawl_partial',
      data: [
        { metadata: { sourceURL: 'https://example.com' }, markdown: 'OK' },
        { error: 'Page not found' },
        { metadata: { sourceURL: 'https://example.com/ok2' }, markdown: 'OK2' },
      ],
    });

    const { crawlSite } = await freshImport();
    const result = await crawlSite('https://example.com');

    expect(result.status).toBe('partial');
    expect(result.successfulPages).toBe(2);
    expect(result.failedPages).toBe(1);
    expect(result.totalPages).toBe(3);
  });

  it('returns failed status when all pages fail', async () => {
    mockCrawlUrl.mockResolvedValue({
      id: 'crawl_failed',
      data: [
        { error: 'Error 1' },
        { error: 'Error 2' },
      ],
    });

    const { crawlSite } = await freshImport();
    const result = await crawlSite('https://example.com');

    expect(result.status).toBe('failed');
    expect(result.successfulPages).toBe(0);
    expect(result.failedPages).toBe(2);
  });

  it('handles empty crawl results', async () => {
    mockCrawlUrl.mockResolvedValue({ id: 'crawl_empty', data: [] });

    const { crawlSite } = await freshImport();
    const result = await crawlSite('https://example.com');

    expect(result.status).toBe('completed');
    expect(result.pages).toHaveLength(0);
    expect(result.totalPages).toBe(0);
  });

  it('throws when Firecrawl client throws', async () => {
    mockCrawlUrl.mockRejectedValue(new Error('Crawl API error'));

    const { crawlSite } = await freshImport();
    await expect(crawlSite('https://example.com')).rejects.toThrow('Crawl API error');
  });

  it('throws when API key is not configured', async () => {
    stubEnv({ FIRECRAWL_API_KEY: '' });

    const { crawlSite } = await freshImport();
    await expect(crawlSite('https://example.com')).rejects.toThrow('Firecrawl API key not configured');
  });
});

// ═══════════════════════════════════════
// extractStructuredData Tests
// ═══════════════════════════════════════

describe('extractStructuredData', () => {
  beforeEach(() => {
    mockScrapeUrl.mockClear();
    stubEnv();
    mockScrapeUrl.mockResolvedValue({
      markdown: 'Content',
      extract: { name: 'Acme Corp', industry: 'Technology' },
      metadata: { title: 'Page' },
      links: [],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('extracts structured data from a URL', async () => {
    const { extractStructuredData } = await freshImport();
    const result = await extractStructuredData('https://example.com', {
      schema: { name: 'string', industry: 'string' },
    });

    expect(result.url).toBe('https://example.com');
    expect(result.data).toEqual({ name: 'Acme Corp', industry: 'Technology' });
    expect(result.extractedAt).toBeTypeOf('number');
  });

  it('passes extract schema and prompt to Firecrawl', async () => {
    const { extractStructuredData } = await freshImport();
    await extractStructuredData('https://example.com', {
      schema: { name: 'string' },
      prompt: 'Extract company info',
    });

    expect(mockScrapeUrl).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      extract: {
        schema: { name: 'string' },
        systemPrompt: 'Extract company info',
      },
    }));
  });

  it('returns empty data when extract is missing', async () => {
    mockScrapeUrl.mockResolvedValue({
      markdown: 'Content',
      metadata: { title: 'Page' },
      links: [],
    });

    const { extractStructuredData } = await freshImport();
    const result = await extractStructuredData('https://example.com', {
      schema: { name: 'string' },
    });

    expect(result.data).toEqual({});
  });

  it('throws when Firecrawl client throws', async () => {
    mockScrapeUrl.mockRejectedValue(new Error('Extraction failed'));

    const { extractStructuredData } = await freshImport();
    await expect(
      extractStructuredData('https://example.com', { schema: { name: 'string' } }),
    ).rejects.toThrow('Extraction failed');
  });

  it('throws when API key is not configured', async () => {
    stubEnv({ FIRECRAWL_API_KEY: '' });

    const { extractStructuredData } = await freshImport();
    await expect(
      extractStructuredData('https://example.com', { schema: { name: 'string' } }),
    ).rejects.toThrow('Firecrawl API key not configured');
  });
});

// ═══════════════════════════════════════
// mapSite Tests
// ═══════════════════════════════════════

describe('mapSite', () => {
  beforeEach(() => {
    mockMapUrl.mockClear();
    stubEnv();
    mockMapUrl.mockResolvedValue({
      links: [
        { url: 'https://example.com', title: 'Home', description: 'Main page' },
        { url: 'https://example.com/about', title: 'About', description: 'About us' },
        { url: 'https://example.com/contact', title: '', description: '' },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps site structure and returns links', async () => {
    const { mapSite } = await freshImport();
    const result = await mapSite('https://example.com');

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ url: 'https://example.com', title: 'Home', description: 'Main page' });
    expect(result[1]).toEqual({ url: 'https://example.com/about', title: 'About', description: 'About us' });
    expect(result[2]).toEqual({ url: 'https://example.com/contact', title: '', description: '' });
  });

  it('passes options to Firecrawl mapUrl', async () => {
    const { mapSite } = await freshImport();
    await mapSite('https://example.com');

    expect(mockMapUrl).toHaveBeenCalledWith('https://example.com', {
      includeSubdomains: false,
      limit: 100,
    });
  });

  it('returns empty array when no links found', async () => {
    mockMapUrl.mockResolvedValue({ links: [] });

    const { mapSite } = await freshImport();
    const result = await mapSite('https://example.com');

    expect(result).toEqual([]);
  });

  it('throws when Firecrawl client throws', async () => {
    mockMapUrl.mockRejectedValue(new Error('Map failed'));

    const { mapSite } = await freshImport();
    await expect(mapSite('https://example.com')).rejects.toThrow('Map failed');
  });

  it('throws when API key is not configured', async () => {
    stubEnv({ FIRECRAWL_API_KEY: '' });

    const { mapSite } = await freshImport();
    await expect(mapSite('https://example.com')).rejects.toThrow('Firecrawl API key not configured');
  });
});

// ═══════════════════════════════════════
// formatMarkdownForAI Tests
// ═══════════════════════════════════════

describe('formatMarkdownForAI', () => {
  it('returns empty string for empty input', async () => {
    const { formatMarkdownForAI } = await freshImport();
    expect(formatMarkdownForAI('')).toBe('');
  });

  it('collapses excessive newlines', async () => {
    const { formatMarkdownForAI } = await freshImport();
    const input = 'Paragraph 1\n\n\n\n\nParagraph 2';
    const result = formatMarkdownForAI(input);

    expect(result).toBe('Paragraph 1\n\nParagraph 2');
  });

  it('removes navigation/footer/sidebar marker lines', async () => {
    const { formatMarkdownForAI } = await freshImport();
    const input = '# Title\n\n## Navigation\nMenu items here\n\nContent here\n\n## Footer\nCopyright info';

    const result = formatMarkdownForAI(input);
    expect(result).toContain('Content here');
    expect(result).toContain('Menu items here'); // content after marker is preserved
    expect(result).not.toMatch(/^## Navigation$/m); // marker line removed
    expect(result).not.toMatch(/^## Footer$/m); // marker line removed
  });

  it('truncates content exceeding maxLength', async () => {
    const { formatMarkdownForAI } = await freshImport();
    const longContent = 'A'.repeat(10000);
    const result = formatMarkdownForAI(longContent, 100);

    // Truncation message is 23 chars: '[Content truncated...]'
    expect(result.length).toBeLessThanOrEqual(130);
    expect(result).toContain('[Content truncated...]');
    expect(result.startsWith('A'.repeat(100))).toBe(true);
  });

  it('does not truncate when under maxLength', async () => {
    const { formatMarkdownForAI } = await freshImport();
    const shortContent = 'Short content';
    const result = formatMarkdownForAI(shortContent, 100);

    expect(result).toBe('Short content');
    expect(result).not.toContain('truncated');
  });

  it('trims whitespace from result', async () => {
    const { formatMarkdownForAI } = await freshImport();
    const result = formatMarkdownForAI('  \n\nContent\n\n  ');

    expect(result).toBe('Content');
  });

  it('handles null-like input gracefully', async () => {
    const { formatMarkdownForAI } = await freshImport();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(formatMarkdownForAI(null as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(formatMarkdownForAI(undefined as any)).toBe('');
  });
});

// ═══════════════════════════════════════
// extractKeyContent Tests
// ═══════════════════════════════════════

describe('extractKeyContent', () => {
  it('extracts headings from markdown', async () => {
    const { extractKeyContent } = await freshImport();
    const result = extractKeyContent('# Title\n## Subtitle\n### Section');

    expect(result.headings).toEqual(['Title', 'Subtitle', 'Section']);
  });

  it('extracts paragraphs (non-heading, non-empty lines)', async () => {
    const { extractKeyContent } = await freshImport();
    const result = extractKeyContent('# Heading\n\nFirst paragraph.\n\nSecond paragraph.');

    expect(result.paragraphs).toEqual(['First paragraph.', 'Second paragraph.']);
  });

  it('extracts links from markdown', async () => {
    const { extractKeyContent } = await freshImport();
    const result = extractKeyContent('Check [Google](https://google.com) and [GitHub](https://github.com)');

    expect(result.links).toEqual([
      { text: 'Google', url: 'https://google.com' },
      { text: 'GitHub', url: 'https://github.com' },
    ]);
  });

  it('extracts images from markdown', async () => {
    const { extractKeyContent } = await freshImport();
    const result = extractKeyContent('![Logo](https://example.com/logo.png)\n\n![Banner](https://example.com/banner.jpg)');

    expect(result.images).toEqual([
      { alt: 'Logo', src: 'https://example.com/logo.png' },
      { alt: 'Banner', src: 'https://example.com/banner.jpg' },
    ]);
  });

  it('extracts all content types from complex markdown', async () => {
    const { extractKeyContent } = await freshImport();
    const markdown = [
      '# Main Title',
      '',
      'Introduction paragraph.',
      '',
      '## Sub Section',
      '',
      'More content here.',
      '',
      '![Image](https://img.com/pic.png)',
      '',
      'Visit [Example](https://example.com) for details.',
    ].join('\n');

    const result = extractKeyContent(markdown);

    expect(result.headings).toEqual(['Main Title', 'Sub Section']);
    expect(result.paragraphs).toContain('Introduction paragraph.');
    expect(result.paragraphs).toContain('More content here.');
    expect(result.links).toEqual(expect.arrayContaining([
      { text: 'Example', url: 'https://example.com' },
    ]));
    expect(result.images).toEqual(expect.arrayContaining([
      { alt: 'Image', src: 'https://img.com/pic.png' },
    ]));
  });

  it('returns empty arrays for empty markdown', async () => {
    const { extractKeyContent } = await freshImport();
    const result = extractKeyContent('');

    expect(result.headings).toEqual([]);
    expect(result.paragraphs).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.images).toEqual([]);
  });

  it('ignores image lines in paragraphs', async () => {
    const { extractKeyContent } = await freshImport();
    const result = extractKeyContent('Paragraph text.\n![Alt](img.png)\nMore text.');

    expect(result.paragraphs).toEqual(['Paragraph text.', 'More text.']);
  });
});
