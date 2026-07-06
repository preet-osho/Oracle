// ═══════════════════════════════════════
// ORACLE — Scraping Layer (Firecrawl)
// URL scraping · Site crawling · Structured extraction · Markdown conversion
// ═══════════════════════════════════════

import FirecrawlApp from '@mendable/firecrawl-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('Scraping');

// ─── Types ────────────────────────────

export interface ScrapeOptions {
  /** Output formats: 'markdown' | 'html' | 'rawHtml' | 'screenshot' */
  formats?: Array<'markdown' | 'html' | 'rawHtml' | 'screenshot'>;
  /** Only include main content (remove nav, footer, etc.) */
  onlyMainContent?: boolean;
  /** Include tags to extract */
  includeTags?: string[];
  /** Exclude tags to skip */
  excludeTags?: string[];
  /** Timeout in milliseconds */
  timeout?: number;
  /** Wait for specific selector before scraping */
  waitForSelector?: number;
}

export interface ScrapeResult {
  url: string;
  title: string;
  markdown: string;
  html?: string;
  screenshot?: string;
  metadata: {
    description?: string;
    language?: string;
    sourceURL?: string;
    statusCode?: number;
    proxy?: string;
  };
  links: string[];
  scrapedAt: number;
}

export interface CrawlOptions {
  /** Maximum pages to crawl */
  limit?: number;
  /** URL patterns to include */
  includePaths?: string[];
  /** URL patterns to exclude */
  excludePaths?: string[];
  /** Scrape options for each page */
  scrapeOptions?: ScrapeOptions;
  /** Delay between requests in ms */
  delay?: number;
  /** Maximum depth from start URL */
  maxDepth?: number;
}

export interface CrawlResult {
  id: string;
  status: 'completed' | 'failed' | 'partial';
  pages: ScrapeResult[];
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  duration: number;
}

export interface ExtractOptions {
  /** Schema describing what to extract */
  schema: Record<string, string>;
  /** Prompt for the AI extraction */
  prompt?: string;
}

export interface ExtractResult {
  url: string;
  data: Record<string, unknown>;
  extractedAt: number;
}

// ─── Client Initialization ────────────

let firecrawlClient: FirecrawlApp | null = null;

function getFirecrawlClient(apiKey?: string): FirecrawlApp {
  const key = apiKey || process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error('Firecrawl API key not configured. Set FIRECRAWL_API_KEY environment variable or provide in request.');
  }

  if (!firecrawlClient || apiKey) {
    firecrawlClient = new FirecrawlApp({ apiKey: key });
  }

  return firecrawlClient;
}

// ─── Single URL Scraping ──────────────

export async function scrapeUrl(
  url: string,
  options: ScrapeOptions = {},
  apiKey?: string
): Promise<ScrapeResult> {
  const client = getFirecrawlClient(apiKey);
  const startTime = Date.now();

  const {
    formats = ['markdown'],
    onlyMainContent = true,
    includeTags,
    excludeTags,
    timeout = 30000,
    waitForSelector,
  } = options;

  log.info('Scraping URL', { url, formats });

  try {
    const result = await client.scrapeUrl(url, {
      formats,
      onlyMainContent,
      includeTags,
      excludeTags,
      timeout,
      waitFor: waitForSelector,
    });

    const markdown = (result as Record<string, unknown>).markdown as string || '';
    const html = formats.includes('html') ? (result as Record<string, unknown>).html as string : undefined;
    const screenshot = formats.includes('screenshot') ? (result as Record<string, unknown>).screenshot as string : undefined;
    const metadata = (result as Record<string, unknown>).metadata as Record<string, unknown> || {};
    const links = (result as Record<string, unknown>).links as string[] || [];

    return {
      url,
      title: (metadata.title as string) || '',
      markdown,
      html,
      screenshot,
      metadata: {
        description: metadata.description as string | undefined,
        language: metadata.language as string | undefined,
        sourceURL: (metadata.sourceURL as string) || url,
        statusCode: metadata.statusCode as number | undefined,
        proxy: metadata.proxy as string | undefined,
      },
      links,
      scrapedAt: Date.now(),
    };
  } catch (error) {
    log.error('Scrape failed', { url, error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }
}

// ─── Batch URL Scraping ───────────────

export async function scrapeUrls(
  urls: string[],
  options: ScrapeOptions = {},
  apiKey?: string
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  for (const url of urls) {
    try {
      const result = await scrapeUrl(url, options, apiKey);
      results.push(result);
    } catch (error) {
      log.warn('Failed to scrape URL', { url, error: error instanceof Error ? error.message : 'Unknown' });
      results.push({
        url,
        title: '',
        markdown: '',
        metadata: {},
        links: [],
        scrapedAt: Date.now(),
      });
    }
  }

  return results;
}

// ─── Site Crawling ────────────────────

export async function crawlSite(
  startUrl: string,
  options: CrawlOptions = {},
  apiKey?: string
): Promise<CrawlResult> {
  const client = getFirecrawlClient(apiKey);
  const startTime = Date.now();

  const {
    limit = 50,
    includePaths,
    excludePaths,
    scrapeOptions = {},
    delay = 1000,
    maxDepth,
  } = options;

  log.info('Starting site crawl', { startUrl, limit });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crawlResult: any = await client.crawlUrl(startUrl, {
      limit,
      includePaths,
      excludePaths,
      scrapeOptions: {
        formats: scrapeOptions.formats || ['markdown'],
        onlyMainContent: scrapeOptions.onlyMainContent ?? true,
      },
      delay,
    });

    const pages: ScrapeResult[] = [];
    let successfulPages = 0;
    let failedPages = 0;

    // Process crawl results — Firecrawl returns { data: CrawlPage[] }
    const crawlPages: unknown[] = Array.isArray(crawlResult?.data) ? crawlResult.data : [];
    for (const page of crawlPages) {
      const p = page as Record<string, unknown>;
      if (p.error) {
        failedPages++;
        continue;
      }
      const meta = (p.metadata || {}) as Record<string, unknown>;
      pages.push({
        url: (meta.sourceURL as string) || startUrl,
        title: (meta.title as string) || '',
        markdown: (p.markdown as string) || '',
        metadata: {
          description: meta.description as string | undefined,
          sourceURL: meta.sourceURL as string | undefined,
        },
        links: [],
        scrapedAt: Date.now(),
      });
      successfulPages++;
    }

    return {
      id: (crawlResult as Record<string, unknown>).id as string || '',
      status: failedPages === 0 ? 'completed' : successfulPages > 0 ? 'partial' : 'failed',
      pages,
      totalPages: successfulPages + failedPages,
      successfulPages,
      failedPages,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    log.error('Crawl failed', { startUrl, error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }
}

// ─── AI-Powered Data Extraction ───────

export async function extractStructuredData(
  url: string,
  options: ExtractOptions,
  apiKey?: string
): Promise<ExtractResult> {
  const client = getFirecrawlClient(apiKey);

  log.info('Extracting structured data', { url, schema: Object.keys(options.schema) });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.scrapeUrl(url, {
      formats: ['markdown'] as any,
      extract: {
        schema: options.schema,
        systemPrompt: options.prompt,
      },
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractResult: any = result;
    const extractData: Record<string, unknown> = extractResult?.extract || {};

    return {
      url,
      data: extractData,
      extractedAt: Date.now(),
    };
  } catch (error) {
    log.error('Extraction failed', { url, error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }
}

// ─── URL Mapping (Discover Site Structure) ──

export async function mapSite(
  url: string,
  apiKey?: string
): Promise<{ url: string; title: string; description: string }[]> {
  const client = getFirecrawlClient(apiKey);

  log.info('Mapping site structure', { url });

  try {
    const result = await client.mapUrl(url, {
      includeSubdomains: false,
      limit: 100,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapResult: any = result;
    const links: Array<Record<string, string>> = mapResult?.links || [];
    return links.map((link) => ({
      url: link.url || '',
      title: link.title || '',
      description: link.description || '',
    }));
  } catch (error) {
    log.error('Site mapping failed', { url, error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }
}

// ─── Markdown Formatting ──────────────

export function formatMarkdownForAI(markdown: string, maxLength: number = 8000): string {
  if (!markdown) return '';

  // Remove excessive whitespace
  let cleaned = markdown.replace(/\n{3,}/g, '\n\n');

  // Remove navigation/footer content markers
  cleaned = cleaned.replace(/##\s*(Navigation|Footer|Sidebar|Menu|Copyright).*$/gim, '');

  // Truncate if too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength) + '\n\n[Content truncated...]';
  }

  return cleaned.trim();
}

export function extractKeyContent(markdown: string): {
  headings: string[];
  paragraphs: string[];
  links: Array<{ text: string; url: string }>;
  images: Array<{ alt: string; src: string }>;
} {
  const headings: string[] = [];
  const paragraphs: string[] = [];
  const links: Array<{ text: string; url: string }> = [];
  const images: Array<{ alt: string; src: string }> = [];

  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith('#')) {
      headings.push(trimmed.replace(/^#+\s*/, ''));
    }

    // Paragraphs (non-empty, non-heading lines)
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!') && !trimmed.startsWith('[')) {
      paragraphs.push(trimmed);
    }

    // Links: [text](url)
    const linkMatch = trimmed.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (linkMatch) {
      for (const match of linkMatch) {
        const m = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (m) {
          links.push({ text: m[1], url: m[2] });
        }
      }
    }

    // Images: ![alt](src)
    const imgMatch = trimmed.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      images.push({ alt: imgMatch[1], src: imgMatch[2] });
    }
  }

  return { headings, paragraphs, links, images };
}
