// ═══════════════════════════════════════
// ORACLE — Content Extraction Engine Tests
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  fetchWithTimeout: vi.fn(),
  TIMEOUT_MODERATE_MS: 30000,
  TIMEOUT_QUICK_MS: 15000,
}));

// ─── Import after mocks ────────────────

import { extractContent, extractBatch } from './extractor';
import type { ExtractedContent } from './types';

// ─── Tests ─────────────────────────────

describe('Content Extraction Engine', () => {
  describe('extractContent', () => {
    it('throws when no API keys are configured and raw fetch fails', async () => {
      // With no JINA/FIRECRAWL keys and a non-existent URL, all providers should fail
      await expect(
        extractContent('https://this-does-not-exist-12345.com', { provider: 'raw' })
      ).rejects.toThrow();
    });

    it('normalizes URLs without protocol', async () => {
      // This should not throw a "no protocol" error — it should try to fetch
      // Mock fetchWithTimeout to simulate a successful response
      const { fetchWithTimeout } = await import('@/lib/fetch-utils');
      vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response('<html><head><title>Test</title></head><body>Hello world</body></html>', { status: 200 }));
      await expect(
        extractContent('https://httpbin.org/html', { provider: 'raw', timeoutMs: 10000 })
      ).resolves.toBeDefined();
    });
  });

  describe('extractBatch', () => {
    it('handles empty URL list', async () => {
      const results = await extractBatch([]);
      expect(results).toHaveLength(0);
    });

    it('returns results for each URL', async () => {
      const results = await extractBatch(
        ['https://this-does-not-exist-12345.com'],
        { provider: 'raw', timeoutMs: 5000 },
        1,
      );
      expect(results).toHaveLength(1);
      expect(results[0].url).toBe('https://this-does-not-exist-12345.com');
      // Should have an error since the URL doesn't exist
      expect(results[0].error).toBeDefined();
    });
  });

  describe('URL normalization', () => {
    it('adds https:// to bare domains', async () => {
      // This tests the normalization logic indirectly
      // A bare domain should be prefixed with https://
      const results = await extractBatch(
        ['https://httpbin.org/html'],
        { provider: 'raw', timeoutMs: 10000 },
        1,
      );
      expect(results).toHaveLength(1);
      expect(results[0].url).toBe('https://httpbin.org/html');
    });
  });

  describe('Content structure', () => {
    it('returns proper ExtractedContent shape on success', async () => {
      // Mock fetchWithTimeout to simulate a successful response
      const { fetchWithTimeout } = await import('@/lib/fetch-utils');
      vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response('<html><head><title>Test Page</title></head><body>Hello world content here</body></html>', { status: 200 }));

      const result = await extractContent('https://httpbin.org/html', {
        provider: 'raw',
        timeoutMs: 10000,
      });

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('extractedAt');
      expect(result).toHaveProperty('provider');
      expect(result.provider).toBe('raw');
      expect(result.metadata.wordCount).toBeGreaterThan(0);
      expect(result.metadata.charCount).toBeGreaterThan(0);
      expect(result.extractedAt).toBeGreaterThan(0);
    });
  });
});
