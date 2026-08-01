// ═══════════════════════════════════════
// ORACLE — Content Extraction Engine
// Fetches any URL and extracts clean, readable text
// Waterfall: Jina Reader → Firecrawl → raw HTML→text
// ═══════════════════════════════════════

import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';
import { normalizeUrl, extractTitleFromUrl } from './utils';
import type { ExtractedContent, ExtractorConfig, ContentMetadata, ExtractionProvider } from './types';

const log = createLogger('Extractor');

// ─── Default Config ────────────────────

const DEFAULT_CONFIG = {
  maxContentLength: 50_000,
  timeoutMs: TIMEOUT_MODERATE_MS,
  includeHtml: false,
  provider: null as ExtractionProvider | null,
};

// ─── Main Extraction Function ──────────

/**
 * Extract clean readable content from a URL.
 * Tries providers in order: Jina Reader → Firecrawl → raw HTML→text.
 */
export async function extractContent(
  url: string,
  config: ExtractorConfig = {},
): Promise<ExtractedContent> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Normalize URL
  const normalizedUrl = normalizeUrl(url);
  log.info(`Extracting content from ${normalizedUrl}`);

  // If specific provider requested, use only that one
  if (cfg.provider) {
    return extractWithProvider(normalizedUrl, cfg.provider, cfg);
  }

  // Waterfall: try each provider in order
  const providers: ExtractionProvider[] = ['jina', 'firecrawl', 'raw'];
  const errors: Array<{ provider: string; error: string }> = [];

  for (const provider of providers) {
    try {
      const result = await extractWithProvider(normalizedUrl, provider, cfg);
      log.info(`Successfully extracted via ${provider}: ${result.title} (${result.metadata.wordCount} words)`);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ provider, error: errorMsg });
      log.warn(`${provider} extraction failed: ${errorMsg}`);
    }
  }

  // All providers failed
  throw new Error(
    `All extraction providers failed for ${normalizedUrl}: ` +
    errors.map((e) => `${e.provider}(${e.error})`).join(', ')
  );
}

// ─── Provider Router ───────────────────

async function extractWithProvider(
  url: string,
  provider: ExtractionProvider,
  config: { maxContentLength: number; timeoutMs: number; includeHtml: boolean },
): Promise<ExtractedContent> {
  switch (provider) {
    case 'jina':
      return extractWithJina(url, config);
    case 'firecrawl':
      return extractWithFirecrawl(url, config);
    case 'raw':
      return extractWithRawFetch(url, config);
    default:
      throw new Error(`Unknown extraction provider: ${provider}`);
  }
}

// ─── Jina Reader API ───────────────────
// Free tier: 1000 req/day
// Best quality: clean markdown extraction, handles JS-heavy pages

async function extractWithJina(
  url: string,
  config: { maxContentLength: number; timeoutMs: number; includeHtml: boolean; apiKeys?: Partial<Record<ExtractionProvider, string>> },
): Promise<ExtractedContent> {
  // BYOK: Use user-provided key first, fall back to environment variable
  const apiKey = config.apiKeys?.jina || process.env.JINA_API_KEY;
  if (!apiKey) throw new Error('JINA_API_KEY not configured. Add one in Settings → API Keys.');

  const response = await fetchWithTimeout('https://r.jina.ai/' + url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'text/markdown',
      'X-Return-Format': 'markdown',
      'X-Timeout': String(Math.round(config.timeoutMs / 1000)),
    },
    timeoutMs: config.timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`Jina API error (${response.status}): ${await response.text().catch(() => 'unknown')}`);
  }

  const rawContent = await response.text();
  const content = truncateContent(rawContent, config.maxContentLength);

  // Extract title from first heading or metadata
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() || extractTitleFromUrl(url);

  return {
    url,
    title,
    content,
    metadata: buildMetadata(content),
    extractedAt: Date.now(),
    provider: 'jina',
  };
}

// ─── Firecrawl ─────────────────────────
// Free tier: 500 pages/month
// Good for JS-heavy pages, returns markdown

async function extractWithFirecrawl(
  url: string,
  config: { maxContentLength: number; timeoutMs: number; includeHtml: boolean; apiKeys?: Partial<Record<ExtractionProvider, string>> },
): Promise<ExtractedContent> {
  // BYOK: Use user-provided key first, fall back to environment variable
  const apiKey = config.apiKeys?.firecrawl || process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not configured. Add one in Settings → API Keys.');

  const response = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      timeout: Math.round(config.timeoutMs / 1000),
    }),
    timeoutMs: config.timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`Firecrawl API error (${response.status}): ${await response.text().catch(() => 'unknown')}`);
  }

  const data = await response.json();
  const markdown = data?.data?.markdown || '';
  if (!markdown) throw new Error('Firecrawl returned empty content');

  const content = truncateContent(markdown, config.maxContentLength);
  const title = data?.data?.metadata?.title || extractTitleFromUrl(url);

  return {
    url,
    title,
    content,
    html: config.includeHtml ? data?.data?.html : undefined,
    metadata: buildMetadata(content, data?.data?.metadata),
    extractedAt: Date.now(),
    provider: 'firecrawl',
  };
}

// ─── Raw HTML → Text Fallback ──────────
// No API key required, basic but always available

async function extractWithRawFetch(
  url: string,
  config: { maxContentLength: number; timeoutMs: number; includeHtml: boolean; apiKeys?: Partial<Record<ExtractionProvider, string>> },
): Promise<ExtractedContent> {
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ORACLEBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeoutMs: config.timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`HTTP error (${response.status})`);
  }

  const html = await response.text();
  const { content, title } = htmlToText(html);

  const truncated = truncateContent(content, config.maxContentLength);

  return {
    url,
    title: title || extractTitleFromUrl(url),
    content: truncated,
    html: config.includeHtml ? html : undefined,
    metadata: buildMetadata(truncated),
    extractedAt: Date.now(),
    provider: 'raw',
  };
}

// ─── HTML → Text Conversion ────────────

/**
 * Basic HTML to text conversion without external dependencies.
 * Strips tags, extracts text content, removes scripts and styles.
 */
function htmlToText(html: string): { content: string; title: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || '';

  // Remove scripts, styles, nav, footer, header
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

  // Convert block elements to newlines
  cleaned = cleaned
    .replace(/<\/?(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')        // Strip remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')      // Collapse multiple newlines
    .replace(/[ \t]+/g, ' ')          // Collapse spaces
    .trim();

  return { content: cleaned, title };
}

// ─── Helpers ───────────────────────────



function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '\n\n[Content truncated — exceeded maximum length]';
}

function buildMetadata(
  content: string,
  providerMetadata?: Record<string, unknown>,
): ContentMetadata {
  const words = content.split(/\s+/).filter((w) => w.length > 0);
  return {
    description: typeof providerMetadata?.description === 'string' ? providerMetadata.description : undefined,
    author: typeof providerMetadata?.author === 'string' ? providerMetadata.author : undefined,
    publishDate: typeof providerMetadata?.publishDate === 'string' ? providerMetadata.publishDate : undefined,
    language: typeof providerMetadata?.language === 'string' ? providerMetadata.language : undefined,
    wordCount: words.length,
    charCount: content.length,
  };
}

// ─── Batch Extraction ──────────────────

/**
 * Extract content from multiple URLs in parallel with concurrency limit.
 */
export async function extractBatch(
  urls: string[],
  config: ExtractorConfig = {},
  concurrency: number = 3,
): Promise<Array<{ url: string; result?: ExtractedContent; error?: string }>> {
  const results: Array<{ url: string; result?: ExtractedContent; error?: string }> = [];

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((url) => extractContent(url, config)),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (!r) continue;
      if (r.status === 'fulfilled') {
        results.push({ url: batch[j]!, result: r.value });
      } else {
        results.push({ url: batch[j]!, error: r.reason?.message || 'Extraction failed' });
      }
    }
  }

  return results;
}
