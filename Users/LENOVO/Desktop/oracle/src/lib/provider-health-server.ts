// ═══════════════════════════════════════
// ORACLE — Server-Side Provider Health
// Records provider health to Supabase for real-time dashboard
// Replaces localStorage-only provider-health.ts for production use
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProviderHealthServer');

// ─── Singleton Client ─────────────────

let healthClient: SupabaseClient | null = null;

function getHealthClient(): SupabaseClient | null {
  if (healthClient) return healthClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  healthClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return healthClient;
}

// ─── Types ────────────────────────────

export interface HealthRecord {
  userId?: string;
  providerId: string;
  modelId: string;
  latencyMs: number;
  success: boolean;
  tokensUsed: number;
  errorMessage?: string;
}

export interface ProviderHealthStats {
  providerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  uptimePct: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgSuccessLatencyMs: number;
  avgTokens: number;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
}

export interface HealthOverview {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  downProviders: number;
  overallUptime: number;
  overallAvgLatency: number;
  totalRequests24h: number;
  providers: ProviderHealthStats[];
}

// ─── Record Health ────────────────────

/**
 * Record a provider health event to Supabase.
 * Fire-and-forget: never blocks the caller.
 */
export async function recordProviderHealth(record: HealthRecord): Promise<void> {
  try {
    const supabase = getHealthClient();
    if (!supabase) {
      log.warn('Provider health recording skipped — Supabase not configured');
      return;
    }

    const { error } = await supabase.from('provider_health_records').insert({
      user_id: record.userId || null,
      provider_id: record.providerId,
      model_id: record.modelId,
      latency_ms: record.latencyMs,
      success: record.success,
      tokens_used: record.tokensUsed,
      error_message: record.errorMessage || null,
      created_at: Date.now(),
    });

    if (error) {
      log.error('Failed to record provider health', {
        error: error.message,
        providerId: record.providerId,
      });
    }
  } catch (err) {
    log.error('Provider health recording exception', {
      error: err instanceof Error ? err.message : 'Unknown',
      providerId: record.providerId,
    });
  }
}

// ─── Query Health Stats ───────────────

/**
 * Get the full health overview for the real-time dashboard.
 * Fetches data from the last 24 hours.
 */
export async function getHealthOverview(): Promise<HealthOverview> {
  try {
    const supabase = getHealthClient();
    if (!supabase) return emptyOverview();

    const since = Date.now() - 24 * 60 * 60 * 1000;

    const { data, error } = await supabase
      .from('provider_health_records')
      .select('provider_id, latency_ms, success, tokens_used, model_id')
      .gte('created_at', since);

    if (error || !data) return emptyOverview();

    // Group by provider
    const grouped = new Map<string, typeof data>();
    for (const record of data) {
      const list = grouped.get(record.provider_id) || [];
      list.push(record);
      grouped.set(record.provider_id, list);
    }

    const providers: ProviderHealthStats[] = [];
    let totalUptime = 0;
    let totalLatency = 0;
    let totalRequests = 0;

    for (const [providerId, records] of Array.from(grouped.entries())) {
      const successful = records.filter((r) => r.success);
      const failed = records.filter((r) => !r.success);
      const successLatencies = successful.map((r) => r.latency_ms).sort((a, b) => a - b);
      const allLatencies = records.map((r) => r.latency_ms).sort((a, b) => a - b);

      const total = records.length;
      const successCount = successful.length;
      const uptimePct = total > 0 ? round1((successCount / total) * 100) : 100;
      const avgLatencyMs = total > 0 ? Math.round(records.reduce((s, r) => s + r.latency_ms, 0) / total) : 0;
      const avgSuccessLatencyMs = successLatencies.length > 0 ? Math.round(successLatencies.reduce((a, b) => a + b, 0) / successLatencies.length) : 0;

      let status: ProviderHealthStats['status'] = 'unknown';
      if (uptimePct >= 95) status = 'healthy';
      else if (uptimePct >= 70 || avgLatencyMs > 5000) status = 'degraded';
      else if (total > 0) status = 'down';

      const stats: ProviderHealthStats = {
        providerId,
        totalRequests: total,
        successfulRequests: successCount,
        failedRequests: failed.length,
        uptimePct,
        avgLatencyMs,
        p50LatencyMs: percentile(allLatencies, 50),
        p95LatencyMs: percentile(allLatencies, 95),
        avgSuccessLatencyMs,
        avgTokens: total > 0 ? Math.round(records.reduce((s, r) => s + r.tokens_used, 0) / total) : 0,
        status,
      };

      providers.push(stats);
      totalUptime += uptimePct;
      totalLatency += avgLatencyMs * total;
      totalRequests += total;
    }

    // Sort by request count descending
    providers.sort((a, b) => b.totalRequests - a.totalRequests);

    const providerCount = providers.length;

    return {
      totalProviders: providerCount,
      healthyProviders: providers.filter((p) => p.status === 'healthy').length,
      degradedProviders: providers.filter((p) => p.status === 'degraded').length,
      downProviders: providers.filter((p) => p.status === 'down').length,
      overallUptime: providerCount > 0 ? round1(totalUptime / providerCount) : 100,
      overallAvgLatency: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
      totalRequests24h: totalRequests,
      providers,
    };
  } catch (err) {
    log.error('Failed to get health overview', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return emptyOverview();
  }
}

/**
 * Get health stats for a specific provider over time (hourly buckets).
 */
export async function getProviderHealthTimeline(
  providerId: string,
  hours: number = 24
): Promise<Array<{
  hour: string;
  requests: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  uptimePct: number;
}>> {
  try {
    const supabase = getHealthClient();
    if (!supabase) return [];

    const since = Date.now() - hours * 60 * 60 * 1000;

    const { data, error } = await supabase
      .from('provider_health_records')
      .select('latency_ms, success, created_at')
      .eq('provider_id', providerId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    // Group by hour
    const hourly = new Map<string, typeof data>();
    for (const record of data) {
      const hour = new Date(record.created_at).toISOString().slice(0, 13); // "2024-01-15T14"
      const list = hourly.get(hour) || [];
      list.push(record);
      hourly.set(hour, list);
    }

    return Array.from(hourly.entries()).map(([hour, records]) => {
      const successes = records.filter((r) => r.success).length;
      const successLatencies = records.filter((r) => r.success).map((r) => r.latency_ms);
      return {
        hour,
        requests: records.length,
        successes,
        failures: records.length - successes,
        avgLatencyMs: successLatencies.length > 0
          ? Math.round(successLatencies.reduce((a, b) => a + b, 0) / successLatencies.length)
          : 0,
        uptimePct: round1((successes / records.length) * 100),
      };
    });
  } catch (err) {
    log.error('Failed to get provider timeline', {
      error: err instanceof Error ? err.message : 'Unknown',
      providerId,
    });
    return [];
  }
}

// ─── Helpers ──────────────────────────

function emptyOverview(): HealthOverview {
  return {
    totalProviders: 0,
    healthyProviders: 0,
    degradedProviders: 0,
    downProviders: 0,
    overallUptime: 100,
    overallAvgLatency: 0,
    totalRequests24h: 0,
    providers: [],
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
