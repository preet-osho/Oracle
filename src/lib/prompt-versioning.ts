// ═══════════════════════════════════════
// ORACLE — Prompt Versioning & A/B Testing
// ═══════════════════════════════════════

import type { PromptVersion, PromptABTest, PromptVersionLog } from '@/types';
import { ORACLE_SYSTEM } from '@/lib/system-prompt';

// ─── Hash Function ─────────────────────

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ─── PromptRegistry Class ──────────────

export class PromptRegistry {
  private static readonly STORAGE_KEY = 'oracle_prompt_versions';
  private static readonly LOG_KEY = 'oracle_prompt_logs';
  private static readonly TEST_KEY = 'oracle_prompt_tests';

  // ── Version Management ──

  static getVersions(): PromptVersion[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[PromptRegistry] Failed to read versions:', e);
      return [];
    }
  }

  static saveVersions(versions: PromptVersion[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(versions));
    } catch (e) {
      console.warn('[PromptRegistry] Failed to save versions:', e);
    }
  }

  static createVersion(
    name: string,
    content: string,
    description: string = '',
    tags: string[] = []
  ): PromptVersion {
    const version: PromptVersion = {
      id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      content,
      hash: hashContent(content),
      createdAt: Date.now(),
      tags,
    };

    const versions = this.getVersions();
    versions.push(version);
    this.saveVersions(versions);

    return version;
  }

  static getVersion(id: string): PromptVersion | undefined {
    return this.getVersions().find((v) => v.id === id);
  }

  static deleteVersion(id: string): boolean {
    const versions = this.getVersions();
    const filtered = versions.filter((v) => v.id !== id);
    if (filtered.length === versions.length) return false;
    this.saveVersions(filtered);
    return true;
  }

  // ── Bootstrap Default Version ──

  static bootstrapDefault(): PromptVersion {
    const versions = this.getVersions();
    if (versions.length > 0) return versions[0];

    return this.createVersion(
      'ORACLE System v2.1',
      ORACLE_SYSTEM,
      'Default system prompt with AI Operating System v2.1 framework',
      ['default', 'production']
    );
  }

  // ── A/B Test Management ──

  static getTests(): PromptABTest[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.TEST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[PromptRegistry] Failed to read tests:', e);
      return [];
    }
  }

  static saveTests(tests: PromptABTest[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.TEST_KEY, JSON.stringify(tests));
    } catch (e) {
      console.warn('[PromptRegistry] Failed to save tests:', e);
    }
  }

  static createTest(
    name: string,
    versionIds: string[],
    trafficSplit: number[]
  ): PromptABTest {
    if (versionIds.length !== trafficSplit.length) {
      throw new Error('versionIds and trafficSplit must have the same length');
    }
    if (Math.abs(trafficSplit.reduce((a, b) => a + b, 0) - 100) > 0.01) {
      throw new Error('trafficSplit must sum to 100');
    }

    const test: PromptABTest = {
      id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      versions: versionIds,
      trafficSplit,
      isActive: true,
      createdAt: Date.now(),
      results: versionIds.map((versionId) => ({
        versionId,
        requestCount: 0,
        avgQualityScore: 0,
        avgCostUSD: 0,
      })),
    };

    const tests = this.getTests();
    tests.push(test);
    this.saveTests(tests);

    return test;
  }

  static getActiveTest(): PromptABTest | undefined {
    return this.getTests().find((t) => t.isActive);
  }

  // ── Version Selection for A/B Testing ──

  static selectVersion(testId?: string): PromptVersion {
    const versions = this.getVersions();
    if (versions.length === 0) return this.bootstrapDefault();

    // If no test, return the first version (default)
    if (!testId) return versions[0];

    const test = this.getTests().find((t) => t.id === testId);
    if (!test || !test.isActive) return versions[0];

    // Weighted random selection based on traffic split
    const random = Math.random() * 100;
    let cumulative = 0;

    for (let i = 0; i < test.versions.length; i++) {
      cumulative += test.trafficSplit[i];
      if (random <= cumulative) {
        const version = versions.find((v) => v.id === test.versions[i]);
        if (version) return version;
      }
    }

    // Fallback to first version
    return versions[0];
  }

  // ── Logging ──

  static logRequest(entry: Omit<PromptVersionLog, 'id'>): void {
    const log: PromptVersionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...entry,
    };

    const logs = this.getLogs();
    logs.unshift(log);

    // Keep last 500 logs
    if (logs.length > 500) logs.length = 500;

    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[PromptRegistry] Failed to save logs:', e);
    }
  }

  static getLogs(): PromptVersionLog[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[PromptRegistry] Failed to read logs:', e);
      return [];
    }
  }

  static getLogsByVersion(versionId: string): PromptVersionLog[] {
    return this.getLogs().filter((l) => l.versionId === versionId);
  }

  static getLogsByTest(testId: string): PromptVersionLog[] {
    return this.getLogs().filter((l) => l.testId === testId);
  }

  // ── Analytics ──

  static getVersionStats(versionId: string): {
    totalRequests: number;
    avgQualityScore: number;
    avgCostUSD: number;
    totalCostUSD: number;
  } {
    const logs = this.getLogsByVersion(versionId);
    if (logs.length === 0) {
      return { totalRequests: 0, avgQualityScore: 0, avgCostUSD: 0, totalCostUSD: 0 };
    }

    const totalRequests = logs.length;
    const totalCostUSD = logs.reduce((sum, l) => sum + l.costUSD, 0);
    const avgCostUSD = totalCostUSD / totalRequests;

    const scoredLogs = logs.filter((l) => l.qualityScore !== undefined);
    const avgQualityScore = scoredLogs.length > 0
      ? scoredLogs.reduce((sum, l) => sum + (l.qualityScore || 0), 0) / scoredLogs.length
      : 0;

    return {
      totalRequests,
      avgQualityScore: Math.round(avgQualityScore * 100) / 100,
      avgCostUSD: Math.round(avgCostUSD * 10000) / 10000,
      totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    };
  }

  static getTestSummary(testId: string): {
    test: PromptABTest | undefined;
    versionStats: Array<{
      versionId: string;
      versionName: string;
      stats: ReturnType<typeof PromptRegistry.getVersionStats>;
    }>;
  } {
    const test = this.getTests().find((t) => t.id === testId);
    const versions = this.getVersions();

    const versionStats = test?.versions.map((versionId) => ({
      versionId,
      versionName: versions.find((v) => v.id === versionId)?.name || 'Unknown',
      stats: this.getVersionStats(versionId),
    })) || [];

    return { test, versionStats };
  }
}
