import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProviderHealthRecord } from './provider-health';

// Import after vi.hoisted mocks if needed
import {
  recordProviderHealth,
  getProviderHealthRecords,
  clearProviderHealth,
  getProviderHealthStats,
  getOverallHealth,
} from './provider-health';

// ─── Helpers ─────────────────────────────

function makeRecord(overrides: Partial<ProviderHealthRecord> = {}): ProviderHealthRecord {
  return {
    providerId: 'groq',
    timestamp: Date.now(),
    latencyMs: 200,
    success: true,
    model: 'llama-3.3-70b',
    tokensUsed: 500,
    ...overrides,
  };
}

// ─── Storage Tests ──────────────────────

describe('recordProviderHealth', () => {
  it('stores a record in localStorage', () => {
    const record = makeRecord();
    recordProviderHealth(record);

    const records = getProviderHealthRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(record);
  });

  it('prepends new records (newest first)', () => {
    recordProviderHealth(makeRecord({ timestamp: 1000 }));
    recordProviderHealth(makeRecord({ timestamp: 2000 }));

    const records = getProviderHealthRecords();
    expect(records).toHaveLength(2);
    expect(records[0].timestamp).toBe(2000);
    expect(records[1].timestamp).toBe(1000);
  });

  it('caps at MAX_RECORDS (2000)', () => {
    // Fill with 2001 records
    for (let i = 0; i < 2001; i++) {
      recordProviderHealth(makeRecord({ timestamp: i }));
    }

    const records = getProviderHealthRecords();
    expect(records).toHaveLength(2000);
    // Newest record should be first
    expect(records[0].timestamp).toBe(2000);
    // Oldest should be trimmed (timestamp 0 is gone)
    expect(records[records.length - 1].timestamp).toBe(1);
  });

  it('does not throw when localStorage.setItem fails', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => recordProviderHealth(makeRecord())).not.toThrow();
    spy.mockRestore();
  });
});

describe('getProviderHealthRecords', () => {
  it('returns empty array when no records exist', () => {
    expect(getProviderHealthRecords()).toEqual([]);
  });

  it('returns all stored records', () => {
    recordProviderHealth(makeRecord({ timestamp: 100 }));
    recordProviderHealth(makeRecord({ timestamp: 200 }));

    const records = getProviderHealthRecords();
    expect(records).toHaveLength(2);
  });

  it('returns empty array when localStorage has malformed JSON', () => {
    window.localStorage.setItem('oracle_provider_health', '{invalid json');
    expect(getProviderHealthRecords()).toEqual([]);
  });
});

describe('clearProviderHealth', () => {
  it('removes all records', () => {
    recordProviderHealth(makeRecord());
    recordProviderHealth(makeRecord());
    expect(getProviderHealthRecords()).toHaveLength(2);

    clearProviderHealth();
    expect(getProviderHealthRecords()).toHaveLength(0);
  });
});

// ─── Server-Side Regression Test ────────

describe('server-side guard', () => {
  it('recordProviderHealth is a no-op when window is undefined (server-side)', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    // Simulate server-side: window is undefined
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true, writable: true });

    // Should not throw
    expect(() => recordProviderHealth(makeRecord())).not.toThrow();

    // Restore
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'window', originalDescriptor);
    }
  });

  it('getProviderHealthRecords returns [] when window is undefined (server-side)', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true, writable: true });

    expect(getProviderHealthRecords()).toEqual([]);

    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'window', originalDescriptor);
    }
  });

  it('clearProviderHealth is a no-op when window is undefined (server-side)', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true, writable: true });

    expect(() => clearProviderHealth()).not.toThrow();

    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'window', originalDescriptor);
    }
  });
});

// ─── Stats Calculation Tests ────────────

describe('getProviderHealthStats', () => {
  it('returns empty array for empty records', () => {
    expect(getProviderHealthStats([])).toEqual([]);
  });

  it('groups records by provider', () => {
    const records = [
      makeRecord({ providerId: 'groq', timestamp: Date.now() }),
      makeRecord({ providerId: 'openai', timestamp: Date.now() }),
      makeRecord({ providerId: 'groq', timestamp: Date.now() }),
    ];

    const stats = getProviderHealthStats(records);
    expect(stats).toHaveLength(2);

    const groqStats = stats.find((s) => s.providerId === 'groq');
    expect(groqStats?.totalRequests).toBe(2);

    const openaiStats = stats.find((s) => s.providerId === 'openai');
    expect(openaiStats?.totalRequests).toBe(1);
  });

  it('calculates uptime correctly (success rate)', () => {
    const now = Date.now();
    const records = [
      makeRecord({ providerId: 'groq', success: true, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, timestamp: now }),
      makeRecord({ providerId: 'groq', success: false, timestamp: now }),
    ];

    const stats = getProviderHealthStats(records);
    const groq = stats.find((s) => s.providerId === 'groq')!;
    expect(groq.uptime).toBe(66.7); // 2/3 = 66.7%
    expect(groq.errorRate).toBe(33.3);
    expect(groq.successfulRequests).toBe(2);
    expect(groq.failedRequests).toBe(1);
  });

  it('calculates average latency from successful requests only', () => {
    const now = Date.now();
    const records = [
      makeRecord({ providerId: 'groq', success: true, latencyMs: 100, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 300, timestamp: now }),
      makeRecord({ providerId: 'groq', success: false, latencyMs: 9999, timestamp: now }),
    ];

    const stats = getProviderHealthStats(records);
    const groq = stats.find((s) => s.providerId === 'groq')!;
    // Avg of 100 and 300 = 200
    expect(groq.avgLatencyMs).toBe(200);
  });

  it('calculates percentile latencies', () => {
    const now = Date.now();
    // 10 records with latencies 10-100ms
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord({ providerId: 'groq', success: true, latencyMs: (i + 1) * 10, timestamp: now })
    );

    const stats = getProviderHealthStats(records);
    const groq = stats.find((s) => s.providerId === 'groq')!;
    expect(groq.p50LatencyMs).toBe(50);
    expect(groq.p95LatencyMs).toBe(100);
    expect(groq.p99LatencyMs).toBe(100);
  });

  it('filters records by time range', () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

    const records = [
      makeRecord({ providerId: 'groq', timestamp: now }),
      makeRecord({ providerId: 'groq', timestamp: oneHourAgo }),
      makeRecord({ providerId: 'groq', timestamp: twoDaysAgo }),
    ];

    // 24h filter
    const stats24h = getProviderHealthStats(records, 24 * 60 * 60 * 1000);
    const groq24h = stats24h.find((s) => s.providerId === 'groq')!;
    expect(groq24h.totalRequests).toBe(2);

    // 7d filter includes all
    const stats7d = getProviderHealthStats(records, 7 * 24 * 60 * 60 * 1000);
    const groq7d = stats7d.find((s) => s.providerId === 'groq')!;
    expect(groq7d.totalRequests).toBe(3);
  });

  it('sets status to healthy when error rate < 20%', () => {
    const now = Date.now();
    // 9 successes, 1 failure = 10% error rate (< 20%)
    const records = [
      makeRecord({ providerId: 'groq', success: true, latencyMs: 100, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 200, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 150, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 180, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 120, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 160, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 140, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 130, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 110, timestamp: now }),
      makeRecord({ providerId: 'groq', success: false, timestamp: now }),
    ];

    const stats = getProviderHealthStats(records);
    expect(stats[0].status).toBe('healthy');
  });

  it('sets status to degraded when error rate >= 20% but < 50%', () => {
    const now = Date.now();
    // 3 success, 1 failure = 25% error rate (between 20% and 50%)
    const records = [
      makeRecord({ providerId: 'groq', success: true, latencyMs: 100, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 200, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 150, timestamp: now }),
      makeRecord({ providerId: 'groq', success: false, timestamp: now }),
    ];

    const stats = getProviderHealthStats(records);
    expect(stats[0].status).toBe('degraded');
  });

  it('sets status to degraded when avg latency > 5000ms', () => {
    const now = Date.now();
    const records = [
      makeRecord({ providerId: 'groq', success: true, latencyMs: 6000, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 7000, timestamp: now }),
    ];

    const stats = getProviderHealthStats(records);
    expect(stats[0].status).toBe('degraded');
  });

  it('sets status to down when error rate >= 50%', () => {
    const now = Date.now();
    const records = [
      makeRecord({ providerId: 'groq', success: true, timestamp: now }),
      makeRecord({ providerId: 'groq', success: false, timestamp: now }),
      makeRecord({ providerId: 'groq', success: false, timestamp: now }),
    ];

    const stats = getProviderHealthStats(records);
    expect(stats[0].status).toBe('down');
  });

  it('sorts by totalRequests descending', () => {
    const now = Date.now();
    const records = [
      makeRecord({ providerId: 'openai', timestamp: now }),
      makeRecord({ providerId: 'groq', timestamp: now }),
      makeRecord({ providerId: 'groq', timestamp: now }),
      makeRecord({ providerId: 'groq', timestamp: now }),
    ];

    const stats = getProviderHealthStats(records);
    expect(stats[0].providerId).toBe('groq');
    expect(stats[1].providerId).toBe('openai');
  });

  it('tracks lastRequestAt per provider', () => {
    const now = Date.now();
    const records = [
      makeRecord({ providerId: 'groq', timestamp: now - 1000 }),
      makeRecord({ providerId: 'groq', timestamp: now }),
    ];

    const stats = getProviderHealthStats(records);
    expect(stats[0].lastRequestAt).toBe(now);
  });
});

// ─── Overall Health Tests ───────────────

describe('getOverallHealth', () => {
  it('returns zeros for empty records', () => {
    const overall = getOverallHealth([]);
    expect(overall.totalRequests).toBe(0);
    expect(overall.overallErrorRate).toBe(0);
    expect(overall.overallAvgLatency).toBe(0);
    expect(overall.healthyProviders).toBe(0);
    expect(overall.totalProviders).toBe(0);
  });

  it('aggregates across multiple providers', () => {
    const now = Date.now();
    const records = [
      makeRecord({ providerId: 'groq', success: true, latencyMs: 100, timestamp: now }),
      makeRecord({ providerId: 'groq', success: true, latencyMs: 200, timestamp: now }),
      makeRecord({ providerId: 'openai', success: false, latencyMs: 0, timestamp: now }),
    ];

    const overall = getOverallHealth(records);
    expect(overall.totalRequests).toBe(3);
    expect(overall.totalProviders).toBe(2);
    expect(overall.overallErrorRate).toBe(33.3);
    // Avg latency of successful: (100 + 200) / 2 = 150
    expect(overall.overallAvgLatency).toBe(150);
    expect(overall.healthyProviders).toBe(1); // groq is healthy, openai is down
  });

  it('counts healthy providers correctly', () => {
    const now = Date.now();
    const records = [
      makeRecord({ providerId: 'groq', success: true, latencyMs: 100, timestamp: now }),
      makeRecord({ providerId: 'openai', success: true, latencyMs: 200, timestamp: now }),
      makeRecord({ providerId: 'anthropic', success: true, latencyMs: 300, timestamp: now }),
    ];

    const overall = getOverallHealth(records);
    expect(overall.healthyProviders).toBe(3);
    expect(overall.totalProviders).toBe(3);
  });
});
