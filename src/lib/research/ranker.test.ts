// ═══════════════════════════════════════
// ORACLE — Result Ranker Tests
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { rankAndDeduplicate, normalizeSearchUrl, normalizeScores } from './ranker';
import type { RankedResult } from './types';

// ─── Helpers ──────────────────────────

function makeResult(overrides: Partial<RankedResult> = {}): RankedResult {
  return {
    title: 'Test Result',
    url: 'https://example.com/page',
    snippet: 'Test snippet content',
    score: 50,
    source: 'tavily',
    ...overrides,
  };
}

// ─── normalizeSearchUrl ───────────────

describe('normalizeSearchUrl', () => {
  it('strips www prefix', () => {
    expect(normalizeSearchUrl('https://www.example.com/page')).toBe('example.com/page');
  });

  it('removes trailing slash', () => {
    expect(normalizeSearchUrl('https://example.com/page/')).toBe('example.com/page');
  });

  it('strips query params and hash', () => {
    expect(normalizeSearchUrl('https://example.com/page?q=test#section')).toBe('example.com/page');
  });

  it('lowercases hostname', () => {
    expect(normalizeSearchUrl('https://EXAMPLE.COM/Page')).toBe('example.com/Page');
  });

  it('handles root path', () => {
    expect(normalizeSearchUrl('https://example.com/')).toBe('example.com');
  });

  it('handles invalid URLs gracefully', () => {
    const result = normalizeSearchUrl('not-a-url');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── rankAndDeduplicate ───────────────

describe('rankAndDeduplicate', () => {
  it('returns empty array for empty input', () => {
    expect(rankAndDeduplicate([], 'test query')).toEqual([]);
  });

  it('returns single result unchanged', () => {
    const results = [makeResult({ score: 80 })];
    const ranked = rankAndDeduplicate(results, 'test');
    expect(ranked).toHaveLength(1);
    expect(ranked[0].url).toBe('https://example.com/page');
  });

  it('deduplicates results with same URL from different sources', () => {
    const results = [
      makeResult({ url: 'https://example.com/page', source: 'tavily', score: 70 }),
      makeResult({ url: 'https://www.example.com/page', source: 'serper', score: 60 }),
      makeResult({ url: 'https://example.com/page/', source: 'brave', score: 50 }),
    ];

    const ranked = rankAndDeduplicate(results, 'test');
    expect(ranked).toHaveLength(1);
    // Cross-source boost should increase score beyond 70
    expect(ranked[0].score).toBeGreaterThan(70);
    // Source should show all three
    expect(ranked[0].source).toContain('tavily');
    expect(ranked[0].source).toContain('serper');
    expect(ranked[0].source).toContain('brave');
  });

  it('keeps distinct URLs separate', () => {
    const results = [
      makeResult({ url: 'https://example.com/page1', source: 'tavily', score: 70 }),
      makeResult({ url: 'https://example.com/page2', source: 'serper', score: 60 }),
      makeResult({ url: 'https://example.com/page3', source: 'brave', score: 50 }),
    ];

    const ranked = rankAndDeduplicate(results, 'test');
    expect(ranked).toHaveLength(3);
  });

  it('sorts by score descending', () => {
    const results = [
      makeResult({ url: 'https://a.com', score: 30 }),
      makeResult({ url: 'https://b.com', score: 90 }),
      makeResult({ url: 'https://c.com', score: 60 }),
    ];

    const ranked = rankAndDeduplicate(results, 'test');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
  });

  it('respects maxResults limit', () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      makeResult({ url: `https://example.com/page${i}`, score: 100 - i }),
    );

    const ranked = rankAndDeduplicate(results, 'test', 5);
    expect(ranked).toHaveLength(5);
  });

  it('boosts results with query terms in title', () => {
    const results = [
      makeResult({
        url: 'https://a.com',
        title: 'Best Pizza Places in Mumbai',
        snippet: 'A list of pizza restaurants',
        score: 50,
      }),
      makeResult({
        url: 'https://b.com',
        title: 'Random Article',
        snippet: 'Something unrelated',
        score: 55,
      }),
    ];

    const ranked = rankAndDeduplicate(results, 'pizza mumbai');
    // The pizza result should be boosted above the higher-scoring random result
    expect(ranked[0].url).toBe('https://a.com');
  });

  it('uses longest snippet when merging duplicates', () => {
    const results = [
      makeResult({
        url: 'https://example.com/page',
        source: 'tavily',
        snippet: 'Short',
      }),
      makeResult({
        url: 'https://example.com/page',
        source: 'serper',
        snippet: 'This is a much longer and more detailed snippet with useful information',
      }),
    ];

    const ranked = rankAndDeduplicate(results, 'test');
    expect(ranked).toHaveLength(1);
    expect(ranked[0].snippet).toBe(
      'This is a much longer and more detailed snippet with useful information',
    );
  });

  it('preserves most recent published date when merging', () => {
    const results = [
      makeResult({
        url: 'https://example.com/page',
        source: 'tavily',
        publishedDate: '2024-01-01',
      }),
      makeResult({
        url: 'https://example.com/page',
        source: 'serper',
        publishedDate: '2025-06-15',
      }),
    ];

    const ranked = rankAndDeduplicate(results, 'test');
    expect(ranked[0].publishedDate).toBe('2025-06-15');
  });
});

// ─── normalizeScores ──────────────────

describe('normalizeScores', () => {
  it('normalizes scores to 0-100 range', () => {
    const results = [
      makeResult({ score: 10 }),
      makeResult({ score: 50 }),
      makeResult({ score: 100 }),
    ];

    const normalized = normalizeScores(results);
    expect(normalized[0].score).toBe(0);
    expect(normalized[1].score).toBe(44);
    expect(normalized[2].score).toBe(100);
  });

  it('returns 50 for all identical scores', () => {
    const results = [
      makeResult({ score: 42 }),
      makeResult({ score: 42 }),
      makeResult({ score: 42 }),
    ];

    const normalized = normalizeScores(results);
    expect(normalized.every((r) => r.score === 50)).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(normalizeScores([])).toEqual([]);
  });
});
