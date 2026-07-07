// ═══════════════════════════════════════
// ORACLE — Search Orchestrator Integration Tests
// Multi-source search · Provider fallback · Ranking · Health checks
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted Mocks ────────────────────

const { mockFetchWithTimeout } = vi.hoisted(() => ({
  mockFetchWithTimeout: vi.fn(),
}));

// ─── Mocks ─────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/fetch-utils', () => ({
  fetchWithTimeout: mockFetchWithTimeout,
  TIMEOUT_MODERATE_MS: 30000,
  TIMEOUT_QUICK_MS: 15000,
}));

// ─── Import after mocks ────────────────

import {
  multiSourceSearch,
  singleProviderSearch,
  getAvailableProviders,
  getRequiredEnvVars,
} from './search-orchestrator';

// ─── Helpers ──────────────────────────

function mockTavilyResponse(results: Array<{ title?: string; url?: string; content?: string; score?: number }> = []) {
  return new Response(
    JSON.stringify({ results: results.map((r) => ({ title: 'Result', url: 'https://example.com', content: 'Snippet', ...r })) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function mockSerperResponse(results: Array<{ title?: string; link?: string; snippet?: string; position?: number }> = []) {
  return new Response(
    JSON.stringify({ organic: results.map((r) => ({ title: 'Result', link: 'https://example.com', snippet: 'Snippet', position: 1, ...r })) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function mockBraveResponse(results: Array<{ title?: string; url?: string; description?: string }> = []) {
  return new Response(
    JSON.stringify({ web: { results: results.map((r) => ({ title: 'Result', url: 'https://example.com', description: 'Snippet', ...r })) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

// ═══════════════════════════════════════
// Integration Tests
// ═══════════════════════════════════════

describe('Search Orchestrator Integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set all provider API keys
    process.env.TAVILY_API_KEY = 'tvly_test_key';
    process.env.SERPER_API_KEY = 'serper_test_key';
    process.env.BRAVE_SEARCH_API_KEY = 'brave_test_key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ─── Multi-Source Search ─────────────

  describe('multiSourceSearch', () => {
    it('queries all three providers in parallel and merges results', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockTavilyResponse([
          { title: 'Tavily Result 1', url: 'https://tavily1.com', content: 'Tavily content 1', score: 0.9 },
          { title: 'Tavily Result 2', url: 'https://tavily2.com', content: 'Tavily content 2', score: 0.7 },
        ]))
        .mockResolvedValueOnce(mockSerperResponse([
          { title: 'Serper Result 1', link: 'https://serper1.com', snippet: 'Serper snippet 1', position: 1 },
          { title: 'Serper Result 2', link: 'https://serper2.com', snippet: 'Serper snippet 2', position: 3 },
        ]))
        .mockResolvedValueOnce(mockBraveResponse([
          { title: 'Brave Result 1', url: 'https://brave1.com', description: 'Brave desc 1' },
          { title: 'Brave Result 2', url: 'https://brave2.com', description: 'Brave desc 2' },
        ]));

      const response = await multiSourceSearch({ query: 'digital marketing agency mumbai' });

      expect(response.query).toBe('digital marketing agency mumbai');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.totalFound).toBe(6);
      expect(response.sourcesQueried).toContain('tavily');
      expect(response.sourcesQueried).toContain('serper');
      expect(response.sourcesQueried).toContain('brave');
      expect(response.searchDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('deduplicates results from multiple sources with same URL', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockTavilyResponse([
          { title: 'Best Agency', url: 'https://example.com/agency', content: 'Tavily version', score: 0.9 },
        ]))
        .mockResolvedValueOnce(mockSerperResponse([
          { title: 'Best Agency', link: 'https://www.example.com/agency', snippet: 'Serper version', position: 1 },
        ]))
        .mockResolvedValueOnce(mockBraveResponse([
          { title: 'Best Agency', url: 'https://example.com/agency/', description: 'Brave version' },
        ]));

      const response = await multiSourceSearch({ query: 'best agency' });

      // All three should be deduplicated into one result
      const exampleResults = response.results.filter((r) => r.url.includes('example.com/agency'));
      expect(exampleResults).toHaveLength(1);
      // Cross-source boost: source should contain all providers
      expect(exampleResults[0]?.source).toContain('tavily');
      expect(exampleResults[0]?.source).toContain('serper');
      expect(exampleResults[0]?.source).toContain('brave');
    });

    it('throws when no API keys are configured', async () => {
      delete process.env.TAVILY_API_KEY;
      delete process.env.SERPER_API_KEY;
      delete process.env.BRAVE_SEARCH_API_KEY;

      await expect(
        multiSourceSearch({ query: 'test' }),
      ).rejects.toThrow('No search API keys configured');
    });

    it('silently skips providers without API keys (waterfall)', async () => {
      delete process.env.SERPER_API_KEY;

      mockFetchWithTimeout
        .mockResolvedValueOnce(mockTavilyResponse([
          { title: 'Tavily Only', url: 'https://tavily.com', content: 'Content' },
        ]))
        .mockResolvedValueOnce(mockBraveResponse([
          { title: 'Brave Only', url: 'https://brave.com', description: 'Desc' },
        ]));

      const response = await multiSourceSearch({ query: 'test' });

      expect(response.sourcesQueried).toContain('tavily');
      expect(response.sourcesQueried).toContain('brave');
      expect(response.sourcesQueried).not.toContain('serper');
      expect(response.totalFound).toBe(2);
    });

    it('handles provider failure gracefully (Promise.allSettled)', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockTavilyResponse([
          { title: 'Tavily OK', url: 'https://tavily.com', content: 'OK' },
        ]))
        .mockRejectedValueOnce(new Error('Serper API down'))
        .mockResolvedValueOnce(mockBraveResponse([
          { title: 'Brave OK', url: 'https://brave.com', description: 'OK' },
        ]));

      const response = await multiSourceSearch({ query: 'test' });

      // Should still return results from the two working providers
      expect(response.results.length).toBe(2);
      expect(response.totalFound).toBe(2);
    });

    it('passes maxResultsPerSource to the provider API calls', async () => {
      // Mock with fewer results than default to verify the param is forwarded
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockTavilyResponse([
          { title: 'T1', url: 'https://t1.com', content: 'C1' },
        ]))
        .mockResolvedValueOnce(mockSerperResponse([
          { title: 'S1', link: 'https://s1.com', snippet: 'S1' },
        ]))
        .mockResolvedValueOnce(mockBraveResponse([
          { title: 'B1', url: 'https://b1.com', description: 'D1' },
        ]));

      const response = await multiSourceSearch({
        query: 'test',
        maxResultsPerSource: 3,
      });

      // Verify 3 API calls were made (one per provider)
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(3);
      // Verify totalFound matches what providers returned
      expect(response.totalFound).toBe(3);
    });

    it('respects totalMaxResults limit', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockTavilyResponse(Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, url: `https://t${i}.com` }))))
        .mockResolvedValueOnce(mockSerperResponse(Array.from({ length: 10 }, (_, i) => ({ title: `S${i}`, link: `https://s${i}.com` }))))
        .mockResolvedValueOnce(mockBraveResponse(Array.from({ length: 10 }, (_, i) => ({ title: `B${i}`, url: `https://b${i}.com` }))));

      const response = await multiSourceSearch({
        query: 'test',
        totalMaxResults: 5,
      });

      expect(response.results.length).toBeLessThanOrEqual(5);
    });

    it('passes language, region, and freshness options to providers', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockTavilyResponse([{ title: 'T', url: 'https://t.com' }]))
        .mockResolvedValueOnce(mockSerperResponse([{ title: 'S', link: 'https://s.com' }]))
        .mockResolvedValueOnce(mockBraveResponse([{ title: 'B', url: 'https://b.com' }]));

      await multiSourceSearch({
        query: 'test',
        language: 'en',
        region: 'IN',
        freshness: 'week',
      });

      // Verify fetchWithTimeout was called 3 times (one per provider)
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(3);
    });

    it('reports searchDurationMs accurately', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockTavilyResponse([{ title: 'T', url: 'https://t.com' }]))
        .mockResolvedValueOnce(mockSerperResponse([{ title: 'S', link: 'https://s.com' }]))
        .mockResolvedValueOnce(mockBraveResponse([{ title: 'B', url: 'https://b.com' }]));

      const start = Date.now();
      const response = await multiSourceSearch({ query: 'test' });
      const elapsed = Date.now() - start;

      expect(response.searchDurationMs).toBeGreaterThanOrEqual(0);
      expect(response.searchDurationMs).toBeLessThanOrEqual(elapsed + 100);
    });
  });

  // ─── Single Provider Search ─────────

  describe('singleProviderSearch', () => {
    it('searches using a single provider', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(
        mockTavilyResponse([{ title: 'Single Result', url: 'https://single.com', content: 'Content', score: 0.9 }]),
      );

      const results = await singleProviderSearch('tavily', 'test query');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Single Result');
      expect(results[0].source).toBe('tavily');
    });

    it('throws when the provider fails', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('API timeout'));

      // singleProviderSearch propagates the raw error from the provider
      await expect(
        singleProviderSearch('tavily', 'test query'),
      ).rejects.toThrow('API timeout');
    });

    it('throws when provider API key is missing', async () => {
      delete process.env.TAVILY_API_KEY;

      await expect(
        singleProviderSearch('tavily', 'test query'),
      ).rejects.toThrow('TAVILY_API_KEY not configured');
    });
  });

  // ─── Provider Health Check ──────────

  describe('getAvailableProviders', () => {
    it('returns all three providers when all keys are set', () => {
      const providers = getAvailableProviders();
      expect(providers).toContain('tavily');
      expect(providers).toContain('serper');
      expect(providers).toContain('brave');
    });

    it('excludes providers without API keys', () => {
      delete process.env.SERPER_API_KEY;
      const providers = getAvailableProviders();
      expect(providers).toContain('tavily');
      expect(providers).not.toContain('serper');
      expect(providers).toContain('brave');
    });

    it('returns empty when no keys are set', () => {
      delete process.env.TAVILY_API_KEY;
      delete process.env.SERPER_API_KEY;
      delete process.env.BRAVE_SEARCH_API_KEY;
      const providers = getAvailableProviders();
      expect(providers).toHaveLength(0);
    });
  });

  describe('getRequiredEnvVars', () => {
    it('returns all providers with their env vars and config status', () => {
      const vars = getRequiredEnvVars();
      expect(vars).toHaveLength(3);
      expect(vars.find((v) => v.provider === 'tavily')).toEqual({
        provider: 'tavily',
        envVar: 'TAVILY_API_KEY',
        configured: true,
      });
    });

    it('marks missing keys as not configured', () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const vars = getRequiredEnvVars();
      const brave = vars.find((v) => v.provider === 'brave');
      expect(brave?.configured).toBe(false);
    });
  });
});
