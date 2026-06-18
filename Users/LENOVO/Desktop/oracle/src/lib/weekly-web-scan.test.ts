import { describe, it, expect, beforeEach } from 'vitest';
import {
  getKnownTools,
  getFreeTools,
  getToolsByRelevance,
  getEmergingTrends,
  addDiscovery,
  getDiscoveries,
  getDiscoveryStats,
} from './weekly-web-scan';

describe('getKnownTools', () => {
  it('returns all tools when no category', () => {
    const tools = getKnownTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('filters by category', () => {
    const aiTools = getKnownTools('ai-model');
    expect(aiTools.length).toBeGreaterThan(0);
    expect(aiTools.every((t) => t.category === 'ai-model')).toBe(true);
  });
});

describe('getFreeTools', () => {
  it('returns only free tools', () => {
    const tools = getFreeTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((t) => t.free)).toBe(true);
  });
});

describe('getToolsByRelevance', () => {
  it('filters by minimum relevance', () => {
    const tools = getToolsByRelevance(90);
    expect(tools.every((t) => t.relevance >= 90)).toBe(true);
  });

  it('sorts by relevance descending', () => {
    const tools = getToolsByRelevance();
    for (let i = 1; i < tools.length; i++) {
      expect(tools[i - 1].relevance).toBeGreaterThanOrEqual(tools[i].relevance);
    }
  });
});

describe('getEmergingTrends', () => {
  it('returns trends above threshold', () => {
    const trends = getEmergingTrends(70);
    expect(trends.length).toBeGreaterThan(0);
    expect(trends.every((t) => t.relevance >= 70)).toBe(true);
  });

  it('returns all trends when threshold is 0', () => {
    const trends = getEmergingTrends(0);
    expect(trends.length).toBeGreaterThan(0);
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('addDiscovery and getDiscoveries round-trip', () => {
    const discovery = addDiscovery({
      name: 'Test Tool',
      category: 'ai-model',
      url: 'https://example.com',
      description: 'A test tool',
      free: true,
      pricing: 'Free',
      relevance: 80,
      tags: ['test'],
    });
    const discoveries = getDiscoveries();
    expect(discoveries).toHaveLength(1);
    expect(discoveries[0].name).toBe('Test Tool');
    expect(discoveries[0].verified).toBe(false);
  });

  it('getDiscoveryStats returns correct stats', () => {
    addDiscovery({ name: 'Tool 1', category: 'ai-model', url: '', description: '', free: true, pricing: '', relevance: 80, tags: [] });
    addDiscovery({ name: 'Tool 2', category: 'design', url: '', description: '', free: false, pricing: '', relevance: 70, tags: [] });
    const stats = getDiscoveryStats();
    expect(stats.totalDiscoveries).toBe(2);
    expect(stats.freeCount).toBe(1);
    expect(stats.byCategory['ai-model']).toBe(1);
    expect(stats.byCategory['design']).toBe(1);
  });

  it('getDiscoveryStats returns defaults when empty', () => {
    const stats = getDiscoveryStats();
    expect(stats.totalDiscoveries).toBe(0);
    expect(stats.lastScanDate).toBeNull();
  });
});
