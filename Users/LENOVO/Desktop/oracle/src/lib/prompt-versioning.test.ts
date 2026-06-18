import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PromptRegistry } from './prompt-versioning';

describe('PromptRegistry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Version Management', () => {
    it('returns empty array when no versions', () => {
      expect(PromptRegistry.getVersions()).toEqual([]);
    });

    it('creates and retrieves a version', () => {
      const v = PromptRegistry.createVersion('Test v1', 'content', 'desc', ['tag1']);
      expect(v.name).toBe('Test v1');
      expect(v.content).toBe('content');
      expect(v.hash).toBeDefined();
      expect(v.tags).toEqual(['tag1']);

      const versions = PromptRegistry.getVersions();
      expect(versions).toHaveLength(1);
      expect(versions[0].id).toBe(v.id);
    });

    it('getVersion returns correct version by id', () => {
      const v = PromptRegistry.createVersion('V1', 'c1');
      expect(PromptRegistry.getVersion(v.id)).toBeDefined();
      expect(PromptRegistry.getVersion('nonexistent')).toBeUndefined();
    });

    it('deleteVersion removes version', () => {
      const v = PromptRegistry.createVersion('V1', 'c1');
      expect(PromptRegistry.deleteVersion(v.id)).toBe(true);
      expect(PromptRegistry.getVersions()).toHaveLength(0);
    });

    it('deleteVersion returns false for nonexistent id', () => {
      expect(PromptRegistry.deleteVersion('nonexistent')).toBe(false);
    });

    it('different content produces different hashes', () => {
      const v1 = PromptRegistry.createVersion('V1', 'content A');
      const v2 = PromptRegistry.createVersion('V2', 'content B');
      expect(v1.hash).not.toBe(v2.hash);
    });
  });

  describe('Bootstrap', () => {
    it('bootstrapDefault creates a version when none exist', () => {
      const v = PromptRegistry.bootstrapDefault();
      expect(v.name).toBe('ORACLE System v2.1');
      expect(v.tags).toContain('default');
      expect(PromptRegistry.getVersions()).toHaveLength(1);
    });

    it('bootstrapDefault returns existing version if present', () => {
      const existing = PromptRegistry.createVersion('Custom', 'content');
      const bootstrapped = PromptRegistry.bootstrapDefault();
      expect(bootstrapped.id).toBe(existing.id);
      expect(PromptRegistry.getVersions()).toHaveLength(1);
    });
  });

  describe('A/B Testing', () => {
    it('creates an A/B test', () => {
      const v1 = PromptRegistry.createVersion('V1', 'c1');
      const v2 = PromptRegistry.createVersion('V2', 'c2');
      const test = PromptRegistry.createTest('Test 1', [v1.id, v2.id], [50, 50]);
      expect(test.name).toBe('Test 1');
      expect(test.isActive).toBe(true);
      expect(test.versions).toEqual([v1.id, v2.id]);
      expect(test.trafficSplit).toEqual([50, 50]);
    });

    it('throws when versionIds and trafficSplit length mismatch', () => {
      expect(() => PromptRegistry.createTest('T', ['v1'], [50, 50])).toThrow();
    });

    it('throws when trafficSplit does not sum to 100', () => {
      expect(() => PromptRegistry.createTest('T', ['v1', 'v2'], [60, 30])).toThrow();
    });

    it('getActiveTest returns active test', () => {
      const v1 = PromptRegistry.createVersion('V1', 'c1');
      const v2 = PromptRegistry.createVersion('V2', 'c2');
      PromptRegistry.createTest('T1', [v1.id, v2.id], [50, 50]);
      expect(PromptRegistry.getActiveTest()).toBeDefined();
    });
  });

  describe('Version Selection', () => {
    it('selectVersion without testId returns first version', () => {
      const v1 = PromptRegistry.createVersion('V1', 'c1');
      PromptRegistry.createVersion('V2', 'c2');
      const selected = PromptRegistry.selectVersion();
      expect(selected.id).toBe(v1.id);
    });

    it('selectVersion bootstraps when no versions exist', () => {
      const selected = PromptRegistry.selectVersion();
      expect(selected.name).toBe('ORACLE System v2.1');
    });
  });

  describe('Logging', () => {
    it('logRequest adds entry', () => {
      PromptRegistry.logRequest({ versionId: 'v1', costUSD: 0.001, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      const logs = PromptRegistry.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].versionId).toBe('v1');
    });

    it('getLogsByVersion filters correctly', () => {
      PromptRegistry.logRequest({ versionId: 'v1', costUSD: 0.001, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      PromptRegistry.logRequest({ versionId: 'v2', costUSD: 0.002, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      expect(PromptRegistry.getLogsByVersion('v1')).toHaveLength(1);
      expect(PromptRegistry.getLogsByVersion('v2')).toHaveLength(1);
      expect(PromptRegistry.getLogsByVersion('v3')).toHaveLength(0);
    });

    it('getLogsByTest filters correctly', () => {
      PromptRegistry.logRequest({ versionId: 'v1', testId: 't1', costUSD: 0.001, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      PromptRegistry.logRequest({ versionId: 'v2', costUSD: 0.002, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      expect(PromptRegistry.getLogsByTest('t1')).toHaveLength(1);
    });
  });

  describe('Analytics', () => {
    
    it('getVersionStats returns zeros for empty logs', () => {
      const stats = PromptRegistry.getVersionStats('v1');
      expect(stats.totalRequests).toBe(0);
      expect(stats.avgQualityScore).toBe(0);
    });

    it('getVersionStats calculates correctly', () => {
      PromptRegistry.logRequest({ versionId: 'v1', costUSD: 0.001, qualityScore: 0.8, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      PromptRegistry.logRequest({ versionId: 'v1', costUSD: 0.003, qualityScore: 0.6, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      const stats = PromptRegistry.getVersionStats('v1');
      expect(stats.totalRequests).toBe(2);
      expect(stats.avgCostUSD).toBe(0.002);
      expect(stats.avgQualityScore).toBe(0.7);
    });

    it('getTestSummary returns test and version stats', () => {
      const v1 = PromptRegistry.createVersion('V1', 'c1');
      const v2 = PromptRegistry.createVersion('V2', 'c2');
      const test = PromptRegistry.createTest('T1', [v1.id, v2.id], [50, 50]);
      PromptRegistry.logRequest({ versionId: v1.id, costUSD: 0.001, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      const summary = PromptRegistry.getTestSummary(test.id);
      expect(summary.test).toBeDefined();
      expect(summary.versionStats).toHaveLength(2);
      expect(summary.versionStats[0].stats.totalRequests).toBe(1);
    });

    it('logRequest caps at 500 entries', () => {
      for (let i = 0; i < 510; i++) {
        PromptRegistry.logRequest({ versionId: 'v1', costUSD: 0.001, provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, timestamp: Date.now() });
      }
      expect(PromptRegistry.getLogs()).toHaveLength(500);
    });
  });
});
