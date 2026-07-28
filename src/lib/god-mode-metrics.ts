// ═══════════════════════════════════════
// ORACLE — GOD MODE Metrics Tracking
// Track toggle frequency, agent usage, and message counts when GOD MODE is active
// ═══════════════════════════════════════

import { getTrainingEntries } from '@/lib/self-training';

const GOD_MODE_METRICS_KEY = 'oracle_god_mode_metrics';
const GOD_MODE_HISTORY_KEY = 'oracle_god_mode_history';
const NORMAL_MSG_HISTORY_KEY = 'oracle_normal_msg_history';
const MAX_HISTORY_ENTRIES = 500;

// ─── Quality Bucket Constants (UI-free, data-only) ───
export const QUALITY_BUCKET_RANGES: [number, number][] = [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1.01]];
export const QUALITY_BUCKET_LABELS = ['0-25%', '25-50%', '50-75%', '75-100%'] as const;
export const QUALITY_BUCKET_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4'] as const;

// ─── Types ─────────────────────────────

export interface GodModeToggleEntry {
  id: string;
  timestamp: number;
  enabled: boolean;
  agentType: string;
}

export interface GodModeMessageEntry {
  id: string;
  timestamp: number;
  agentType: string;
  provider: string;
  model: string;
  tokensUsed: number;
  wasSuccessful: boolean;
  qualityScore?: number;
}

export interface GodModeMetrics {
  /** Total number of times GOD MODE was toggled on */
  totalToggles: number;
  /** Number of messages sent while GOD MODE was active */
  totalMessages: number;
  /** Number of successful messages while GOD MODE was active */
  successfulMessages: number;
  /** Total tokens consumed while GOD MODE was active */
  totalTokens: number;
  /** Average quality score across GOD MODE messages (0 if no scores recorded) */
  avgQuality: number;
  /** Breakdown by agent: how many messages each agent sent with GOD MODE */
  agentBreakdown: Record<string, { count: number; successCount: number; totalTokens: number; avgQuality: number }>;
  /** Breakdown by provider: how many messages each provider handled with GOD MODE */
  providerBreakdown: Record<string, { count: number; successCount: number; totalTokens: number; avgQuality: number }>;
  /** Timestamp of first GOD MODE toggle */
  firstToggleAt: number | null;
  /** Timestamp of most recent GOD MODE message */
  lastMessageAt: number | null;
  /** Percentage of total messages that were GOD MODE (approximate) */
  godModeMessageRatio: number;
  /** Messages with quality scores, for sparkline/histogram (avoids redundant localStorage reads) */
  scoredMessages: GodModeMessageEntry[];
  /** Quality score distribution across 4 buckets: 0-25%, 25-50%, 50-75%, 75-100% */
  qualityDistribution: { range: string; count: number }[];
  /** Per-agent quality score distribution */
  agentQualityDistribution: Record<string, { range: string; count: number }[]>;
  /** Per-provider quality score distribution */
  providerQualityDistribution: Record<string, { range: string; count: number }[]>;
}

// ─── Storage Helpers ────────────────────

function getToggleHistory(): GodModeToggleEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GOD_MODE_METRICS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getMessageHistory(): GodModeMessageEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GOD_MODE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Normal Message Tracking ───────────────────

export interface NormalMessageEntry {
  id: string;
  timestamp: number;
  tokensUsed: number;
  agentType: string;
  wasSuccessful: boolean;
}

function getNormalMessageHistoryInternal(): NormalMessageEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NORMAL_MSG_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Record a normal (non-GOD MODE) message token count for baseline comparison */
export function recordNormalMessageTokens(tokensUsed: number, agentType: string, wasSuccessful: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = getNormalMessageHistoryInternal();
    entries.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      tokensUsed,
      agentType,
      wasSuccessful,
    });
    const trimmed = entries.length > MAX_HISTORY_ENTRIES
      ? entries.slice(entries.length - MAX_HISTORY_ENTRIES)
      : entries;
    localStorage.setItem(NORMAL_MSG_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently fail
  }
}

// ─── Recording Functions ────────────────

export function recordGodModeToggle(enabled: boolean, agentType: string): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = getToggleHistory();
    entries.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      enabled,
      agentType,
    });
    // Keep last 200 toggle entries
    const trimmed = entries.length > 200 ? entries.slice(entries.length - 200) : entries;
    localStorage.setItem(GOD_MODE_METRICS_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently fail
  }
}

export function recordGodModeMessage(entry: Omit<GodModeMessageEntry, 'id' | 'timestamp'>): string {
  const id = crypto.randomUUID();
  if (typeof window === 'undefined') return id;
  try {
    const entries = getMessageHistory();
    entries.push({
      ...entry,
      id,
      timestamp: Date.now(),
    });
    const trimmed = entries.length > MAX_HISTORY_ENTRIES
      ? entries.slice(entries.length - MAX_HISTORY_ENTRIES)
      : entries;
    localStorage.setItem(GOD_MODE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently fail
  }
  return id;
}

/** Update the quality score for a GOD MODE message after scoring completes */
export function updateGodModeMessageQuality(messageId: string, qualityScore: number): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = getMessageHistory();
    const idx = entries.findIndex((e) => e.id === messageId);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], qualityScore };
      localStorage.setItem(GOD_MODE_HISTORY_KEY, JSON.stringify(entries));
    }
  } catch {
    // Silently fail
  }
}

// ─── Query Functions ────────────────────

export function getGodModeMetrics(): GodModeMetrics {
  const toggles = getToggleHistory();
  const messages = getMessageHistory();

  const godModeToggles = toggles.filter((t) => t.enabled);

  const agentBreakdown: Record<string, { count: number; successCount: number; totalTokens: number; qualitySum: number }> = {};
  const providerBreakdown: Record<string, { count: number; successCount: number; totalTokens: number; qualitySum: number }> = {};

  let totalTokens = 0;
  let successfulMessages = 0;

  for (const msg of messages) {
    totalTokens += msg.tokensUsed;
    if (msg.wasSuccessful) successfulMessages++;

    // Agent breakdown
    if (!agentBreakdown[msg.agentType]) {
      agentBreakdown[msg.agentType] = { count: 0, successCount: 0, totalTokens: 0, qualitySum: 0 };
    }
    agentBreakdown[msg.agentType].count++;
    if (msg.wasSuccessful) agentBreakdown[msg.agentType].successCount++;
    agentBreakdown[msg.agentType].totalTokens += msg.tokensUsed;
    if (typeof msg.qualityScore === 'number' && msg.qualityScore > 0) {
      agentBreakdown[msg.agentType].qualitySum += msg.qualityScore;
    }

    // Provider breakdown
    if (!providerBreakdown[msg.provider]) {
      providerBreakdown[msg.provider] = { count: 0, successCount: 0, totalTokens: 0, qualitySum: 0 };
    }
    providerBreakdown[msg.provider].count++;
    if (msg.wasSuccessful) providerBreakdown[msg.provider].successCount++;
    providerBreakdown[msg.provider].totalTokens += msg.tokensUsed;
    if (typeof msg.qualityScore === 'number' && msg.qualityScore > 0) {
      providerBreakdown[msg.provider].qualitySum += msg.qualityScore;
    }
  }

  // Calculate toggle count (count only "on" toggles)
  const totalToggles = godModeToggles.length;

  // Calculate average quality score from messages that have scores
  const scoredMessages = messages.filter((m) => typeof m.qualityScore === 'number' && m.qualityScore > 0);
  const avgQuality = scoredMessages.length > 0
    ? scoredMessages.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / scoredMessages.length
    : 0;

  // Calculate message ratio (approximate: GOD MODE messages / total training entries)
  // Note: Training entries may not map 1:1 to chat messages (e.g., operating loop steps)
  let godModeMessageRatio = 0;
  try {
    const allTasks = getTrainingEntries();
    if (allTasks.length > 0) {
      godModeMessageRatio = messages.length / allTasks.length;
    }
  } catch {
    // Non-critical
  }

  // Convert agentBreakdown to final format (compute avgQuality, remove qualitySum)
  const finalAgentBreakdown: Record<string, { count: number; successCount: number; totalTokens: number; avgQuality: number }> = {};
  for (const [agent, data] of Object.entries(agentBreakdown)) {
    const agentScoredMessages = messages.filter((m) => m.agentType === agent && typeof m.qualityScore === 'number' && m.qualityScore > 0);
    finalAgentBreakdown[agent] = {
      count: data.count,
      successCount: data.successCount,
      totalTokens: data.totalTokens,
      avgQuality: agentScoredMessages.length > 0 ? data.qualitySum / agentScoredMessages.length : 0,
    };
  }

  // Convert providerBreakdown to final format (compute avgQuality, remove qualitySum)
  const finalProviderBreakdown: Record<string, { count: number; successCount: number; totalTokens: number; avgQuality: number }> = {};
  for (const [provider, data] of Object.entries(providerBreakdown)) {
    const providerScoredMessages = messages.filter((m) => m.provider === provider && typeof m.qualityScore === 'number' && m.qualityScore > 0);
    finalProviderBreakdown[provider] = {
      count: data.count,
      successCount: data.successCount,
      totalTokens: data.totalTokens,
      avgQuality: providerScoredMessages.length > 0 ? data.qualitySum / providerScoredMessages.length : 0,
    };
  }

  // Quality score distribution (data-only, no colors in interface)
  const qualityDistribution = QUALITY_BUCKET_LABELS.map((range) => ({ range, count: 0 }));
  for (const msg of scoredMessages) {
    for (let i = 0; i < QUALITY_BUCKET_RANGES.length; i++) {
      if (msg.qualityScore! >= QUALITY_BUCKET_RANGES[i][0] && msg.qualityScore! < QUALITY_BUCKET_RANGES[i][1]) {
        qualityDistribution[i].count++;
        break;
      }
    }
  }

  // Per-agent quality distribution
  const agentQualityDistribution: Record<string, { range: string; count: number }[]> = {};
  for (const msg of scoredMessages) {
    if (!agentQualityDistribution[msg.agentType]) {
      agentQualityDistribution[msg.agentType] = QUALITY_BUCKET_LABELS.map((range) => ({ range, count: 0 }));
    }
    const buckets = agentQualityDistribution[msg.agentType];
    for (let i = 0; i < QUALITY_BUCKET_RANGES.length; i++) {
      if (msg.qualityScore! >= QUALITY_BUCKET_RANGES[i][0] && msg.qualityScore! < QUALITY_BUCKET_RANGES[i][1]) {
        buckets[i].count++;
        break;
      }
    }
  }

  // Per-provider quality distribution
  const providerQualityDistribution: Record<string, { range: string; count: number }[]> = {};
  for (const msg of scoredMessages) {
    if (!providerQualityDistribution[msg.provider]) {
      providerQualityDistribution[msg.provider] = QUALITY_BUCKET_LABELS.map((range) => ({ range, count: 0 }));
    }
    const buckets = providerQualityDistribution[msg.provider];
    for (let i = 0; i < QUALITY_BUCKET_RANGES.length; i++) {
      if (msg.qualityScore! >= QUALITY_BUCKET_RANGES[i][0] && msg.qualityScore! < QUALITY_BUCKET_RANGES[i][1]) {
        buckets[i].count++;
        break;
      }
    }
  }

  return {
    totalToggles,
    totalMessages: messages.length,
    successfulMessages,
    totalTokens,
    avgQuality,
    agentBreakdown: finalAgentBreakdown,
    providerBreakdown: finalProviderBreakdown,
    firstToggleAt: godModeToggles.length > 0 ? godModeToggles[0].timestamp : null,
    lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
    godModeMessageRatio: Math.min(godModeMessageRatio, 1),
    scoredMessages,
    qualityDistribution,
    agentQualityDistribution,
    providerQualityDistribution,
  };
}

// ─── Cost Analysis ─────────────────────

export interface GodModeCostAnalysis {
  /** Average tokens per GOD MODE message */
  avgTokensGodMode: number;
  /** Average tokens per non-GOD MODE message (from training entries, null if no baseline) */
  avgTokensNormal: number | null;
  /** Token overhead percentage (how much more GOD MODE uses, null if no baseline) */
  overheadPercent: number | null;
  /** Total GOD MODE tokens consumed */
  totalGodModeTokens: number;
  /** Total GOD MODE messages */
  godModeMessageCount: number;
}

/** Calculate cost overhead of GOD MODE vs normal messages.
 *  Returns null for baseline-dependent fields if no normal message data exists.
 */
export function getGodModeCostAnalysis(): GodModeCostAnalysis {
  const messages = getMessageHistory();
  const normalMessages = getNormalMessageHistoryInternal();
  const godModeTokens = messages.reduce((sum, m) => sum + m.tokensUsed, 0);
  const godModeCount = messages.length;
  const avgTokensGodMode = godModeCount > 0 ? Math.round(godModeTokens / godModeCount) : 0;

  // Calculate normal message baseline from recorded normal messages
  if (normalMessages.length > 0) {
    const normalTokens = normalMessages.reduce((sum, m) => sum + m.tokensUsed, 0);
    const avgTokensNormal = Math.round(normalTokens / normalMessages.length);
    const overheadPercent = avgTokensNormal > 0
      ? Math.round(((avgTokensGodMode - avgTokensNormal) / avgTokensNormal) * 100)
      : 0;
    return {
      avgTokensGodMode,
      avgTokensNormal,
      overheadPercent: Math.max(0, overheadPercent),
      totalGodModeTokens: godModeTokens,
      godModeMessageCount: godModeCount,
    };
  }

  // No baseline available yet
  return {
    avgTokensGodMode,
    avgTokensNormal: null,
    overheadPercent: null,
    totalGodModeTokens: godModeTokens,
    godModeMessageCount: godModeCount,
  };
}

// ─── History Export ─────────────────────

/** Get raw toggle history for export */
export function getGodModeToggleHistory(): GodModeToggleEntry[] {
  return getToggleHistory();
}

/** Get raw message history for export */
export function getGodModeMessageHistory(): GodModeMessageEntry[] {
  return getMessageHistory();
}

/** Get raw normal message history for export */
export function getNormalMessageHistory(): NormalMessageEntry[] {
  return getNormalMessageHistoryInternal();
}

// ─── Timeline Computation ──────────────────────

export interface GodModeTimelineEntry {
  date: string;
  godModeMessages: number;
  godModeTokens: number;
  normalMessages: number;
  normalTokens: number;
  toggles: number;
}

/**
 * Compute GOD MODE vs Normal token usage timeline grouped by day.
 * Returns the last N days (default 14).
 */
export function getGodModeTimelineData(maxDays: number = 14): GodModeTimelineEntry[] {
  const messages = getMessageHistory();
  const toggles = getToggleHistory();
  const normalMessages = getNormalMessageHistoryInternal();
  if (messages.length === 0 && toggles.length === 0 && normalMessages.length === 0) return [];

  // Group by day
  const dayMap = new Map<string, GodModeTimelineEntry>();
  for (const msg of messages) {
    const day = new Date(msg.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const existing = dayMap.get(day) || { date: day, godModeMessages: 0, godModeTokens: 0, normalMessages: 0, normalTokens: 0, toggles: 0 };
    existing.godModeMessages++;
    existing.godModeTokens += msg.tokensUsed;
    dayMap.set(day, existing);
  }
  for (const msg of normalMessages) {
    const day = new Date(msg.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const existing = dayMap.get(day) || { date: day, godModeMessages: 0, godModeTokens: 0, normalMessages: 0, normalTokens: 0, toggles: 0 };
    existing.normalMessages++;
    existing.normalTokens += msg.tokensUsed;
    dayMap.set(day, existing);
  }
  for (const toggle of toggles) {
    if (!toggle.enabled) continue;
    const day = new Date(toggle.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const existing = dayMap.get(day) || { date: day, godModeMessages: 0, godModeTokens: 0, normalMessages: 0, normalTokens: 0, toggles: 0 };
    existing.toggles++;
    dayMap.set(day, existing);
  }
  return Array.from(dayMap.values()).slice(-maxDays);
}

// ─── Clear Data ─────────────────────────

export function clearGodModeMetrics(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GOD_MODE_METRICS_KEY);
  localStorage.removeItem(GOD_MODE_HISTORY_KEY);
  localStorage.removeItem(NORMAL_MSG_HISTORY_KEY);
}
