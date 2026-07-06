// ═══════════════════════════════════════
// ORACLE — Multi-Source Search Orchestrator
// Queries Tavily + Serper + Brave in parallel
// Waterfall fallback for missing API keys
// ═══════════════════════════════════════

import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';
import { rankAndDeduplicate } from './ranker';
import type { SearchProvider, ResearchQuery, ResearchResponse, RankedResult } from './types';

const log = createLogger('SearchOrchestrator');

// ─── Provider API Key Mapping ─────────

const PROVIDER_KEY_MAP: Record<SearchProvider, string> = {
  tavily: 'TAVILY_API_KEY',
  serper: 'SERPER_API_KEY',
  brave: 'BRAVE_SEARCH_API_KEY',
};

// ─── Provider Query Limits ────────────

// ─── Raw Provider Result ──────────────

interface ProviderResult {
  provider: SearchProvider;
  results: RankedResult[];
  durationMs: number;
  error?: string;
}

// ─── Main Orchestrator ────────────────

/**
 * Execute a multi-source search across Tavily, Serper, and Brave.
 * Queries available providers in parallel, then ranks and deduplicates results.
 *
 * Missing API keys are silently skipped (waterfall behavior).
 * At least one provider must have a key configured.
 */
export async function multiSourceSearch(query: ResearchQuery): Promise<ResearchResponse> {
  const startTime = Date.now();

  const {
    query: searchQuery,
    sources = ['tavily', 'serper', 'brave'],
    maxResultsPerSource = 5,
    totalMaxResults = 15,
    language,
    region,
    freshness,
  } = query;

  // Clamp per-source limits to provider maximums
  const clampedPerSource = Math.min(maxResultsPerSource, 10);

  // Determine which providers have API keys configured
  const availableProviders = sources.filter((source) => {
    const envKey = PROVIDER_KEY_MAP[source];
    return !!process.env[envKey];
  });

  if (availableProviders.length === 0) {
    throw new Error(
      `No search API keys configured. Required env vars: ${sources.map((s) => PROVIDER_KEY_MAP[s]).join(', ')}`,
    );
  }

  log.info(`Searching ${availableProviders.length}/${sources.length} providers`, {
    query: searchQuery,
    providers: availableProviders,
  });

  // Query all available providers in parallel
  const providerPromises = availableProviders.map((provider) =>
    queryProvider(provider, searchQuery, clampedPerSource, { language, region, freshness }),
  );

  const settled = await Promise.allSettled(providerPromises);

  // Collect results from fulfilled promises
  const providerResults: ProviderResult[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === 'fulfilled') {
      providerResults.push(result.value);
    } else {
      providerResults.push({
        provider: availableProviders[i],
        results: [],
        durationMs: 0,
        error: result.reason?.message || 'Provider query failed',
      });
    }
  }

  // Log provider performance
  for (const pr of providerResults) {
    if (pr.error) {
      log.warn(`${pr.provider} failed: ${pr.error}`);
    } else {
      log.info(`${pr.provider} returned ${pr.results.length} results in ${pr.durationMs}ms`);
    }
  }

  // Merge all results and rank/deduplicate
  const allResults: RankedResult[] = providerResults.flatMap((pr) => pr.results);
  const rankedResults = rankAndDeduplicate(allResults, searchQuery, totalMaxResults);

  const totalFound = allResults.length;
  const durationMs = Date.now() - startTime;

  log.info(
    `Search complete: ${rankedResults.length} ranked results from ${totalFound} total in ${durationMs}ms`,
  );

  return {
    query: searchQuery,
    results: rankedResults,
    sourcesQueried: availableProviders,
    totalFound,
    searchDurationMs: durationMs,
  };
}

// ─── Provider Query Functions ─────────

async function queryProvider(
  provider: SearchProvider,
  query: string,
  maxResults: number,
  opts: { language?: string; region?: string; freshness?: string },
): Promise<ProviderResult> {
  const startTime = Date.now();

  switch (provider) {
    case 'tavily':
      return {
        provider,
        results: await queryTavily(query, maxResults, opts),
        durationMs: Date.now() - startTime,
      };
    case 'serper':
      return {
        provider,
        results: await querySerper(query, maxResults, opts),
        durationMs: Date.now() - startTime,
      };
    case 'brave':
      return {
        provider,
        results: await queryBrave(query, maxResults, opts),
        durationMs: Date.now() - startTime,
      };
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

// ─── Tavily ───────────────────────────
// POST https://api.tavily.com/search
// API key: TAVILY_API_KEY

async function queryTavily(
  query: string,
  maxResults: number,
  opts: { language?: string; freshness?: string },
): Promise<RankedResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

  // Map freshness to Tavily's search_depth
  const searchDepth = opts.freshness === 'day' ? 'advanced' : 'basic';

  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
    }),
    timeoutMs: TIMEOUT_MODERATE_MS,
  });

  if (!response.ok) {
    throw new Error(`Tavily API error (${response.status}): ${await response.text().catch(() => 'unknown')}`);
  }

  const data = await response.json();
  const results = (data.results || []) as Array<{
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
    score?: number;
  }>;

  return results.map((r) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    score: typeof r.score === 'number' ? Math.min(r.score * 100, 100) : 50,
    source: 'tavily' as const,
    publishedDate: r.published_date || undefined,
  }));
}

// ─── Serper (Google) ──────────────────
// POST https://google.serper.dev/search
// API key: SERPER_API_KEY

async function querySerper(
  query: string,
  maxResults: number,
  opts: { language?: string; region?: string; freshness?: string },
): Promise<RankedResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY not configured');

  // Map freshness to Serper's tbs parameter
  const freshnessMap: Record<string, string> = {
    day: 'qdr:d',
    week: 'qdr:w',
    month: 'qdr:m',
    year: 'qdr:y',
  };

  const body: Record<string, string | number> = {
    q: query,
    num: maxResults,
  };

  if (opts.language) body.gl = opts.language;
  if (opts.region) body.hl = opts.region;
  if (opts.freshness && freshnessMap[opts.freshness]) {
    body.tbs = freshnessMap[opts.freshness];
  }

  const response = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(body),
    timeoutMs: TIMEOUT_MODERATE_MS,
  });

  if (!response.ok) {
    throw new Error(`Serper API error (${response.status}): ${await response.text().catch(() => 'unknown')}`);
  }

  const data = await response.json();
  const results = (data.organic || []) as Array<{
    title?: string;
    link?: string;
    snippet?: string;
    date?: string;
    position?: number;
  }>;

  return results.map((r, i) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
    // Inverse position scoring: position 1 = 100, position 10 = 10
    score: r.position ? Math.max(10, 100 - (r.position - 1) * 10) : 50,
    source: 'serper' as const,
    publishedDate: r.date || undefined,
  }));
}

// ─── Brave Search ─────────────────────
// GET https://api.search.brave.com/res/v1/web/search
// API key: BRAVE_SEARCH_API_KEY

async function queryBrave(
  query: string,
  maxResults: number,
  opts: { language?: string; region?: string; freshness?: string },
): Promise<RankedResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY not configured');

  // Map freshness to Brave's freshness param
  const freshnessMap: Record<string, string> = {
    day: 'pd',
    week: 'pw',
    month: 'pm',
    year: 'py',
  };

  const params = new URLSearchParams({
    q: query,
    count: String(maxResults),
  });

  if (opts.language) params.set('search_lang', opts.language);
  if (opts.region) params.set('country', opts.region);
  if (opts.freshness && freshnessMap[opts.freshness]) {
    params.set('freshness', freshnessMap[opts.freshness]);
  }

  const response = await fetchWithTimeout(
    `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      timeoutMs: TIMEOUT_MODERATE_MS,
    },
  );

  if (!response.ok) {
    throw new Error(`Brave API error (${response.status}): ${await response.text().catch(() => 'unknown')}`);
  }

  const data = await response.json();
  const results = (data.web?.results || []) as Array<{
    title?: string;
    url?: string;
    description?: string;
    age?: string;
    meta_url?: { hostname?: string };
  }>;

  return results.map((r, i) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
    // Brave doesn't expose a score, use inverse position
    score: Math.max(10, 100 - i * 10),
    source: 'brave' as const,
    publishedDate: r.age || undefined,
  }));
}

// ─── Convenience: Single Provider Search ─

/**
 * Search using a single specific provider.
 * Useful when the caller knows which provider they want.
 */
export async function singleProviderSearch(
  provider: SearchProvider,
  query: string,
  maxResults: number = 5,
  opts: { language?: string; region?: string; freshness?: string } = {},
): Promise<RankedResult[]> {
  const result = await queryProvider(provider, query, maxResults, opts);
  if (result.error) {
    throw new Error(`${provider} search failed: ${result.error}`);
  }
  return result.results;
}

// ─── Provider Health Check ────────────

/**
 * Check which search providers have API keys configured.
 * Useful for UI to show available providers.
 */
export function getAvailableProviders(): SearchProvider[] {
  const all: SearchProvider[] = ['tavily', 'serper', 'brave'];
  return all.filter((provider) => !!process.env[PROVIDER_KEY_MAP[provider]]);
}

/**
 * Get the list of configured provider env var names.
 */
export function getRequiredEnvVars(): Array<{ provider: SearchProvider; envVar: string; configured: boolean }> {
  return (['tavily', 'serper', 'brave'] as SearchProvider[]).map((provider) => ({
    provider,
    envVar: PROVIDER_KEY_MAP[provider],
    configured: !!process.env[PROVIDER_KEY_MAP[provider]],
  }));
}
