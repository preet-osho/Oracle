import { describe, it, expect } from 'vitest';
import { formatSearchResults } from './search';
import type { SearchResult } from '@/types';

// ─── Tests ─────────────────────────────

describe('formatSearchResults', () => {
  it('returns empty string for empty results', () => {
    expect(formatSearchResults([])).toBe('');
  });

  it('formats results with header', () => {
    const results: SearchResult[] = [
      { title: 'Result 1', url: 'https://example.com', snippet: 'Snippet 1' },
    ];

    const formatted = formatSearchResults(results);
    expect(formatted).toContain('WEB SEARCH RESULTS:');
    expect(formatted).toContain('[1] Result 1');
    expect(formatted).toContain('URL: https://example.com');
    expect(formatted).toContain('Snippet: Snippet 1');
  });

  it('formats multiple results', () => {
    const results: SearchResult[] = [
      { title: 'Result 1', url: 'https://a.com', snippet: 'A' },
      { title: 'Result 2', url: 'https://b.com', snippet: 'B' },
    ];

    const formatted = formatSearchResults(results);
    expect(formatted).toContain('[1] Result 1');
    expect(formatted).toContain('[2] Result 2');
  });

  it('includes published date when available', () => {
    const results: SearchResult[] = [
      { title: 'Result', url: 'https://a.com', snippet: 'A', publishedDate: '2026-01-15' },
    ];

    const formatted = formatSearchResults(results);
    expect(formatted).toContain('Published: 2026-01-15');
  });

  it('omits published date when not available', () => {
    const results: SearchResult[] = [
      { title: 'Result', url: 'https://a.com', snippet: 'A' },
    ];

    const formatted = formatSearchResults(results);
    expect(formatted).not.toContain('Published:');
  });

  it('handles results with missing fields', () => {
    const results: SearchResult[] = [
      { title: 'Title Only', url: '', snippet: '' },
    ];

    const formatted = formatSearchResults(results);
    expect(formatted).toContain('[1] Title Only');
    expect(formatted).not.toContain('URL:');
    expect(formatted).not.toContain('Snippet:');
  });
});
