import { describe, it, expect, beforeEach } from 'vitest';
import {
  recogniseTaskPatterns,
  getKnowledgeHints,
  getTaskMeta,
  getMostFrequentTasks,
  getPatternStats,
  recordTask,
  getTaskHistory,
} from './pattern-recognition';
import type { TaskCategory } from './pattern-recognition';

describe('recogniseTaskPatterns', () => {
  it('detects SEO-related tasks', () => {
    const results = recogniseTaskPatterns('Run a complete SEO audit for my website');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('seo-audit');
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].matchedKeywords.length).toBeGreaterThan(0);
  });

  it('detects ad copy tasks', () => {
    const results = recogniseTaskPatterns('Write Google Ads copy for a restaurant');
    expect(results.some((r) => r.category === 'ad-copy')).toBe(true);
  });

  it('detects email sequence tasks', () => {
    const results = recogniseTaskPatterns('Create a nurture email sequence for new leads');
    expect(results.some((r) => r.category === 'email-sequence')).toBe(true);
  });

  it('detects proposal tasks', () => {
    const results = recogniseTaskPatterns('Generate a client proposal with pricing');
    expect(results.some((r) => r.category === 'proposal')).toBe(true);
  });

  it('detects code tasks', () => {
    const results = recogniseTaskPatterns('Build a React component for the dashboard');
    expect(results.some((r) => r.category === 'code')).toBe(true);
  });

  it('returns empty for unrelated text', () => {
    const results = recogniseTaskPatterns('xyzzy plugh 12345');
    expect(results).toEqual([]);
  });

  it('returns top N results', () => {
    const results = recogniseTaskPatterns('SEO audit with Google Ads and email marketing', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns results sorted by confidence', () => {
    const results = recogniseTaskPatterns('SEO audit and keyword research with backlink analysis');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });
});

describe('getKnowledgeHints', () => {
  it('returns hints for known categories', () => {
    const hints = getKnowledgeHints('seo-audit');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((h) => h.toLowerCase().includes('seo'))).toBe(true);
  });

  it('returns empty for unknown categories', () => {
    const hints = getKnowledgeHints('nonexistent' as TaskCategory);
    expect(hints).toEqual([]);
  });
});

describe('getTaskMeta', () => {
  it('returns meta for known categories', () => {
    const meta = getTaskMeta('seo-audit');
    expect(meta).not.toBeNull();
    expect(meta!.complexity).toBeDefined();
    expect(meta!.tools.length).toBeGreaterThan(0);
    expect(meta!.estimatedTime).toBeDefined();
  });

  it('returns null for unknown categories', () => {
    const meta = getTaskMeta('nonexistent' as TaskCategory);
    expect(meta).toBeNull();
  });
});

describe('getMostFrequentTasks', () => {
  it('returns empty for empty history', () => {
    const result = getMostFrequentTasks([]);
    expect(result).toEqual([]);
  });

  it('counts categories correctly', () => {
    const history = [
      { category: 'seo-audit' as TaskCategory, timestamp: 1000 },
      { category: 'seo-audit' as TaskCategory, timestamp: 2000 },
      { category: 'ad-copy' as TaskCategory, timestamp: 3000 },
    ];
    const result = getMostFrequentTasks(history);
    expect(result[0].category).toBe('seo-audit');
    expect(result[0].count).toBe(2);
    expect(result[1].category).toBe('ad-copy');
    expect(result[1].count).toBe(1);
  });

  it('sorts by count descending', () => {
    const history = [
      { category: 'code' as TaskCategory, timestamp: 1000 },
      { category: 'seo-audit' as TaskCategory, timestamp: 2000 },
      { category: 'seo-audit' as TaskCategory, timestamp: 3000 },
      { category: 'seo-audit' as TaskCategory, timestamp: 4000 },
    ];
    const result = getMostFrequentTasks(history);
    expect(result[0].count).toBeGreaterThanOrEqual(result[1].count);
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('recordTask persists and getTaskHistory retrieves', () => {
    recordTask('seo-audit');
    const history = getTaskHistory();
    expect(history).toHaveLength(1);
    expect(history[0].category).toBe('seo-audit');
  });

  it('getTaskHistory returns empty when no data', () => {
    expect(getTaskHistory()).toEqual([]);
  });

  it('getPatternStats returns correct stats', () => {
    recordTask('seo-audit');
    recordTask('seo-audit');
    recordTask('ad-copy');
    const stats = getPatternStats();
    expect(stats.totalTasks).toBe(3);
    expect(stats.topCategories.length).toBeGreaterThan(0);
    expect(stats.topCategories[0].category).toBe('seo-audit');
    expect(typeof stats.avgConfidence).toBe('number');
  });
});
