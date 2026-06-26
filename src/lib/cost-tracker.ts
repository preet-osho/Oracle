// ═══════════════════════════════════════
// ORACLE — Server-Side Cost Tracker
// Records every AI request to Supabase for persistent cost tracking
// Replaces localStorage-only token-budget.ts for production use
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('CostTracker');

// ─── Singleton Client ─────────────────

let trackerClient: SupabaseClient | null = null;

function getTrackerClient(): SupabaseClient | null {
  if (trackerClient) return trackerClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  trackerClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return trackerClient;
}

// ─── Types ────────────────────────────

export interface CostRecord {
  userId: string;
  providerId: string;
  modelId: string;
  agentType?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costInr: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface DailyCostSummary {
  day: string;
  providerId: string;
  modelId: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  totalCostInr: number;
  avgLatencyMs: number;
  successRate: number;
}

export interface CostOverview {
  todayCostUsd: number;
  todayCostInr: number;
  weekCostUsd: number;
  weekCostInr: number;
  monthCostUsd: number;
  monthCostInr: number;
  todayRequests: number;
  weekRequests: number;
  monthRequests: number;
  topProvider: string;
  topModel: string;
}

// ─── Record Cost ──────────────────────

/**
 * Record an AI request's cost data to Supabase.
 * Fire-and-forget: errors are logged but never block the caller.
 */
export async function recordCost(record: CostRecord): Promise<void> {
  try {
    const supabase = getTrackerClient();
    if (!supabase) {
      log.warn('Cost tracking skipped — Supabase not configured');
      return;
    }

    const { error } = await supabase.from('ai_usage_records').insert({
      user_id: record.userId,
      provider_id: record.providerId,
      model_id: record.modelId,
      agent_type: record.agentType || 'general',
      input_tokens: record.inputTokens,
      output_tokens: record.outputTokens,
      cost_usd: record.costUsd,
      cost_inr: record.costInr,
      latency_ms: record.latencyMs,
      success: record.success,
      error_message: record.errorMessage || null,
      metadata: record.metadata || {},
      created_at: Date.now(),
    });

    if (error) {
      log.error('Failed to record cost', { error: error.message, providerId: record.providerId });
    }
  } catch (err) {
    log.error('Cost recording exception', {
      error: err instanceof Error ? err.message : 'Unknown',
      providerId: record.providerId,
    });
  }
}

// ─── Query Cost Summaries ─────────────

/**
 * Get cost overview for a user (today, week, month).
 */
export async function getCostOverview(userId: string): Promise<CostOverview> {
  try {
    const supabase = getTrackerClient();
    if (!supabase) return emptyOverview();

    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = now - 30 * 24 * 60 * 60 * 1000;

    // Query today's costs
    const { data: todayData } = await supabase
      .from('ai_usage_records')
      .select('cost_usd, cost_inr, provider_id, model_id')
      .eq('user_id', userId)
      .gte('created_at', dayStart.getTime());

    // Query this week's costs
    const { data: weekData } = await supabase
      .from('ai_usage_records')
      .select('cost_usd, cost_inr, provider_id, model_id')
      .eq('user_id', userId)
      .gte('created_at', weekStart);

    // Query this month's costs
    const { data: monthData } = await supabase
      .from('ai_usage_records')
      .select('cost_usd, cost_inr, provider_id, model_id')
      .eq('user_id', userId)
      .gte('created_at', monthStart);

    const today = todayData || [];
    const week = weekData || [];
    const month = monthData || [];

    // Find top provider by request count
    const providerCounts = new Map<string, number>();
    const modelCounts = new Map<string, number>();
    for (const r of month) {
      providerCounts.set(r.provider_id, (providerCounts.get(r.provider_id) || 0) + 1);
      modelCounts.set(`${r.provider_id}/${r.model_id}`, (modelCounts.get(`${r.provider_id}/${r.model_id}`) || 0) + 1);
    }

    let topProvider = 'none';
    let topCount = 0;
    for (const [p, c] of providerCounts) {
      if (c > topCount) { topProvider = p; topCount = c; }
    }

    let topModel = 'none';
    let topModelCount = 0;
    for (const [m, c] of modelCounts) {
      if (c > topModelCount) { topModel = m; topModelCount = c; }
    }

    return {
      todayCostUsd: round4(today.reduce((s, r) => s + r.cost_usd, 0)),
      todayCostInr: round2(today.reduce((s, r) => s + r.cost_inr, 0)),
      weekCostUsd: round4(week.reduce((s, r) => s + r.cost_usd, 0)),
      weekCostInr: round2(week.reduce((s, r) => s + r.cost_inr, 0)),
      monthCostUsd: round4(month.reduce((s, r) => s + r.cost_usd, 0)),
      monthCostInr: round2(month.reduce((s, r) => s + r.cost_inr, 0)),
      todayRequests: today.length,
      weekRequests: week.length,
      monthRequests: month.length,
      topProvider,
      topModel,
    };
  } catch (err) {
    log.error('Failed to get cost overview', { error: err instanceof Error ? err.message : 'Unknown' });
    return emptyOverview();
  }
}

/**
 * Get daily cost breakdown for a user (last N days).
 */
export async function getDailyCosts(
  userId: string,
  days: number = 30
): Promise<DailyCostSummary[]> {
  try {
    const supabase = getTrackerClient();
    if (!supabase) return [];

    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const { data, error } = await supabase
      .from('ai_usage_records')
      .select('provider_id, model_id, cost_usd, cost_inr, input_tokens, output_tokens, latency_ms, success, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    // Group by day + provider + model
    const grouped = new Map<string, {
      day: string;
      providerId: string;
      modelId: string;
      records: typeof data;
    }>();

    for (const record of data) {
      const day = new Date(record.created_at).toISOString().split('T')[0];
      const key = `${day}:${record.provider_id}:${record.model_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          day,
          providerId: record.provider_id,
          modelId: record.model_id,
          records: [],
        });
      }
      grouped.get(key)!.records.push(record);
    }

    return Array.from(grouped.values()).map(({ day, providerId, modelId, records }) => {
      const successCount = records.filter((r) => r.success).length;
      return {
        day,
        providerId,
        modelId,
        requestCount: records.length,
        totalInputTokens: records.reduce((s, r) => s + r.input_tokens, 0),
        totalOutputTokens: records.reduce((s, r) => s + r.output_tokens, 0),
        totalCostUsd: round4(records.reduce((s, r) => s + r.cost_usd, 0)),
        totalCostInr: round2(records.reduce((s, r) => s + r.cost_inr, 0)),
        avgLatencyMs: Math.round(records.reduce((s, r) => s + r.latency_ms, 0) / records.length),
        successRate: round2((successCount / records.length) * 100),
      };
    });
  } catch (err) {
    log.error('Failed to get daily costs', { error: err instanceof Error ? err.message : 'Unknown' });
    return [];
  }
}

/**
 * Get cost breakdown by provider for a user.
 */
export async function getCostByProvider(
  userId: string,
  days: number = 30
): Promise<Array<{
  providerId: string;
  requestCount: number;
  totalCostUsd: number;
  totalCostInr: number;
  avgLatencyMs: number;
  successRate: number;
}>> {
  try {
    const supabase = getTrackerClient();
    if (!supabase) return [];

    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const { data, error } = await supabase
      .from('ai_usage_records')
      .select('provider_id, cost_usd, cost_inr, latency_ms, success')
      .eq('user_id', userId)
      .gte('created_at', since);

    if (error || !data) return [];

    const grouped = new Map<string, typeof data>();
    for (const record of data) {
      const list = grouped.get(record.provider_id) || [];
      list.push(record);
      grouped.set(record.provider_id, list);
    }

    return Array.from(grouped.entries()).map(([providerId, records]) => {
      const successCount = records.filter((r) => r.success).length;
      return {
        providerId,
        requestCount: records.length,
        totalCostUsd: round4(records.reduce((s, r) => s + r.cost_usd, 0)),
        totalCostInr: round2(records.reduce((s, r) => s + r.cost_inr, 0)),
        avgLatencyMs: Math.round(records.reduce((s, r) => s + r.latency_ms, 0) / records.length),
        successRate: round2((successCount / records.length) * 100),
      };
    }).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  } catch (err) {
    log.error('Failed to get cost by provider', { error: err instanceof Error ? err.message : 'Unknown' });
    return [];
  }
}

// ─── Helpers ──────────────────────────

function emptyOverview(): CostOverview {
  return {
    todayCostUsd: 0, todayCostInr: 0,
    weekCostUsd: 0, weekCostInr: 0,
    monthCostUsd: 0, monthCostInr: 0,
    todayRequests: 0, weekRequests: 0, monthRequests: 0,
    topProvider: 'none', topModel: 'none',
  };
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
