// ═══════════════════════════════════════
// ORACLE — Provider Health Monitoring
// Track latency, error rates, and uptime per provider
// ═══════════════════════════════════════

import type { UsageRecord } from '@/types';

// ─── Types ─────────────────────────────

export interface ProviderHealthRecord {
  providerId: string;
  timestamp: number;
  latencyMs: number;
  success: boolean;
  model: string;
  tokensUsed: number;
  errorMessage?: string;
}

export interface ProviderHealthStats {
  providerId: string;
  providerName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  uptime: number;
  requestsPerDay: number;
  lastRequestAt: number | null;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
}

// ─── Storage ───────────────────────────

const HEALTH_KEY = 'oracle_provider_health';
const MAX_RECORDS = 2000;

export function recordProviderHealth(record: ProviderHealthRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(HEALTH_KEY);
    const records: ProviderHealthRecord[] = raw ? JSON.parse(raw) : [];
    records.unshift(record);
    localStorage.setItem(HEALTH_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    // Silently fail
  }
}

export function getProviderHealthRecords(): ProviderHealthRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HEALTH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearProviderHealth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HEALTH_KEY);
}

// ─── Analysis ──────────────────────────

export function getProviderHealthStats(
  records: ProviderHealthRecord[],
  timeRangeMs: number = 7 * 24 * 60 * 60 * 1000
): ProviderHealthStats[] {
  const now = Date.now();
  const filtered = records.filter((r) => now - r.timestamp < timeRangeMs);

  // Group by provider
  const grouped = new Map<string, ProviderHealthRecord[]>();
  for (const record of filtered) {
    const list = grouped.get(record.providerId) || [];
    list.push(record);
    grouped.set(record.providerId, list);
  }

  const stats: ProviderHealthStats[] = [];

  for (const [providerId, providerRecords] of Array.from(grouped.entries())) {
    const successful = providerRecords.filter((r) => r.success);
    const failed = providerRecords.filter((r) => !r.success);
    const latencies = successful.map((r) => r.latencyMs).sort((a, b) => a - b);

    const totalRequests = providerRecords.length;
    const errorRate = totalRequests > 0 ? (failed.length / totalRequests) * 100 : 0;
    const uptime = totalRequests > 0 ? ((totalRequests - failed.length) / totalRequests) * 100 : 100;

    const avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    const p50LatencyMs = percentile(latencies, 50);
    const p95LatencyMs = percentile(latencies, 95);
    const p99LatencyMs = percentile(latencies, 99);

    const daysInRange = Math.max(1, timeRangeMs / (24 * 60 * 60 * 1000));
    const requestsPerDay = Math.round(totalRequests / daysInRange);

    const lastRequestAt = providerRecords.length > 0
      ? Math.max(...providerRecords.map((r) => r.timestamp))
      : null;

    let status: ProviderHealthStats['status'] = 'unknown';
    if (errorRate >= 50) status = 'down';
    else if (errorRate >= 20 || avgLatencyMs > 5000) status = 'degraded';
    else if (totalRequests > 0) status = 'healthy';

    stats.push({
      providerId,
      providerName: providerId,
      totalRequests,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      avgLatencyMs,
      p50LatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      errorRate: Math.round(errorRate * 10) / 10,
      uptime: Math.round(uptime * 10) / 10,
      requestsPerDay,
      lastRequestAt,
      status,
    });
  }

  return stats.sort((a, b) => b.totalRequests - a.totalRequests);
}

export function getOverallHealth(records: ProviderHealthRecord[]): {
  totalRequests: number;
  overallErrorRate: number;
  overallAvgLatency: number;
  healthyProviders: number;
  totalProviders: number;
} {
  const stats = getProviderHealthStats(records, Infinity);
  const totalRequests = stats.reduce((s, p) => s + p.totalRequests, 0);
  const totalFailed = stats.reduce((s, p) => s + p.failedRequests, 0);
  const overallErrorRate = totalRequests > 0 ? (totalFailed / totalRequests) * 100 : 0;
  const allLatencies = records.filter((r) => r.success).map((r) => r.latencyMs);
  const overallAvgLatency = allLatencies.length > 0
    ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
    : 0;
  const healthyProviders = stats.filter((p) => p.status === 'healthy').length;

  return {
    totalRequests,
    overallErrorRate: Math.round(overallErrorRate * 10) / 10,
    overallAvgLatency,
    healthyProviders,
    totalProviders: stats.length,
  };
}

// ─── Helpers ───────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
