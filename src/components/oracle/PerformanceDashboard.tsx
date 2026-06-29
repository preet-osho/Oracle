'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import {
  getAgentPerformance,
  getTokenBudget,
  getPerformanceHistory,
  setBudgetDailyLimit,
  type AgentPerformance,
  type ModelTier,
  MODEL_TIERS,
} from '@/lib/model-selector';
import { PROVIDERS } from '@/data/providers';
import { exportToCSV } from '@/lib/export-utils';
import toast from 'react-hot-toast';

// ─── Time Range ──────────────────────

type TimeRange = '24h' | '7d' | '30d' | 'all';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '24h': '24 Hours',
  '7d': '7 Days',
  '30d': '30 Days',
  'all': 'All Time',
};

function filterByRange(records: AgentPerformance[], range: TimeRange): AgentPerformance[] {
  if (range === 'all') return records;
  const now = Date.now();
  const ms = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 };
  return records.filter((r) => now - r.lastUsed < ms[range]);
}

// ─── Chart Theme ──────────────────────

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#0ea5e9'];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--oracle-surface-2)',
    border: '1px solid var(--oracle-border)',
    borderRadius: '12px',
    fontSize: '12px',
    color: 'var(--oracle-text-1)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
  } as React.CSSProperties,
  itemStyle: { color: 'var(--oracle-text-2)' } as React.CSSProperties,
  labelStyle: { color: 'var(--oracle-text-1)', fontWeight: 600 } as React.CSSProperties,
};

// ─── Performance Dashboard ───────────

export function PerformanceDashboard() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('oracle-perf-range') as TimeRange) || 'all';
    }
    return 'all';
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedCompareAgents, setSelectedCompareAgents] = useState<string[]>([]);
  const [budgetLimitInput, setBudgetLimitInput] = useState('');
  const [budgetLimitEditing, setBudgetLimitEditing] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const performance = useMemo(() => getAgentPerformance(), []);
  const budget = useMemo(() => getTokenBudget(), []);

  const filtered = useMemo(() => filterByRange(performance, timeRange), [performance, timeRange]);

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        refresh();
      }, 30_000);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, refresh]);

  // Persist time range
  useEffect(() => {
    localStorage.setItem('oracle-perf-range', timeRange);
  }, [timeRange]);

  // ── Aggregate Stats ──
  const stats = useMemo(() => {
    const totalTokens = filtered.reduce((sum, p) => sum + p.totalTokens, 0);
    const totalCost = filtered.reduce((sum, p) => sum + p.totalCostUsd, 0);
    const totalSuccess = filtered.reduce((sum, p) => sum + p.successCount, 0);
    const totalFail = filtered.reduce((sum, p) => sum + p.failCount, 0);
    const avgQuality = filtered.length > 0
      ? filtered.reduce((sum, p) => sum + p.avgQuality, 0) / filtered.length
      : 0;
    const avgLatency = filtered.length > 0
      ? filtered.reduce((sum, p) => sum + p.avgLatency, 0) / filtered.length
      : 0;
    const uniqueAgents = new Set(filtered.map((p) => p.agent)).size;
    const successRate = totalSuccess + totalFail > 0
      ? (totalSuccess / (totalSuccess + totalFail)) * 100
      : 0;

    return { totalTokens, totalCost, totalSuccess, totalFail, avgQuality, avgLatency, uniqueAgents, successRate };
  }, [filtered]);

  // ── Group by Agent ──
  const agentGroups = useMemo(() => {
    const groups: Record<string, AgentPerformance[]> = {};
    for (const p of filtered) {
      if (!groups[p.agent]) groups[p.agent] = [];
      groups[p.agent].push(p);
    }
    return groups;
  }, [filtered]);

  // ── Group by Provider ──
  const providerGroups = useMemo(() => {
    const groups: Record<string, { tokens: number; cost: number; count: number; success: number; fail: number }> = {};
    for (const p of filtered) {
      if (!groups[p.provider]) groups[p.provider] = { tokens: 0, cost: 0, count: 0, success: 0, fail: 0 };
      groups[p.provider].tokens += p.totalTokens;
      groups[p.provider].cost += p.totalCostUsd;
      groups[p.provider].count += p.successCount + p.failCount;
      groups[p.provider].success += p.successCount;
      groups[p.provider].fail += p.failCount;
    }
    return groups;
  }, [filtered]);

  // ── Budget ──
  const budgetPercent = budget.dailyLimit > 0
    ? Math.min((budget.usedToday / budget.dailyLimit) * 100, 100)
    : 0;
  const budgetRemaining = budget.dailyLimit - budget.usedToday;

  // ── Tier Distribution ──
  const tierDistribution = useMemo(() => {
    const dist: Record<ModelTier, number> = { free: 0, budget: 0, standard: 0, premium: 0, elite: 0 };
    for (const p of filtered) {
      const provider = PROVIDERS.find((pr) => pr.id === p.provider);
      const model = provider?.models.find((m) => m.id === p.model);
      if (model) {
        const cost = model.costPer1k?.output ?? 0;
        if (cost === 0) dist.free++;
        else if (cost <= MODEL_TIERS.budget.maxCostPer1k) dist.budget++;
        else if (cost <= MODEL_TIERS.standard.maxCostPer1k) dist.standard++;
        else if (cost <= MODEL_TIERS.premium.maxCostPer1k) dist.premium++;
        else dist.elite++;
      }
    }
    return dist;
  }, [filtered]);

  // ── Cost Optimization Insights ──
  const insights = useMemo(() => {
    const tips: Array<{ icon: string; title: string; description: string; severity: 'info' | 'warning' | 'success' }> = [];

    // Check for high-cost models with low quality
    for (const p of filtered) {
      const provider = PROVIDERS.find((pr) => pr.id === p.provider);
      const model = provider?.models.find((m) => m.id === p.model);
      if (model && (model.costPer1k?.output ?? 0) > 0.02 && p.avgQuality < 0.6) {
        tips.push({
          icon: '💡',
          title: `${p.model} has low quality (${(p.avgQuality * 100).toFixed(0)}%)`,
          description: `Consider switching to a cheaper model — quality doesn't justify the premium cost.`,
          severity: 'warning',
        });
      }
    }

    // Check for high failure rates
    for (const p of filtered) {
      const total = p.successCount + p.failCount;
      if (total > 5 && p.failCount / total > 0.3) {
        tips.push({
          icon: '⚠️',
          title: `${p.agent}/${p.model} has ${((p.failCount / total) * 100).toFixed(0)}% failure rate`,
          description: `High failure rate wastes tokens. Consider using a more reliable model.`,
          severity: 'warning',
        });
      }
    }

    // Free model usage is good
    const freeModels = filtered.filter((p) => {
      const provider = PROVIDERS.find((pr) => pr.id === p.provider);
      const model = provider?.models.find((m) => m.id === p.model);
      return model?.isFree;
    });
    if (freeModels.length > 0) {
      const freeTokens = freeModels.reduce((s, p) => s + p.totalTokens, 0);
      tips.push({
        icon: '🎉',
        title: `${freeModels.length} free model(s) saving tokens`,
        description: `${formatNumber(freeTokens)} tokens used on free models — great cost optimization!`,
        severity: 'success',
      });
    }

    // Budget warning
    if (budgetPercent > 80) {
      tips.push({
        icon: '🚨',
        title: 'Budget nearly exhausted',
        description: `${budgetPercent.toFixed(0)}% of daily token budget used. Consider enabling auto-downgrade.`,
        severity: 'warning',
      });
    } else if (budgetPercent < 20) {
      tips.push({
        icon: '✅',
        title: 'Budget on track',
        description: `Only ${budgetPercent.toFixed(0)}% of daily budget used. Plenty of headroom.`,
        severity: 'success',
      });
    }

    return tips.slice(0, 5);
  }, [filtered, budgetPercent]);

  // ── Provider Pie Data ──
  const providerPieData = useMemo(() => {
    return Object.entries(providerGroups)
      .map(([provider, data]) => {
        const info = PROVIDERS.find((p) => p.id === provider);
        return { name: info?.name || provider, value: data.cost, tokens: data.tokens, count: data.count };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [providerGroups]);

  // ── Agent Aggregate Data (for charts) ──
  const agentAggregateData = useMemo(() => {
    const byAgent: Record<string, Array<{ name: string; quality: number; successRate: number; cost: number; latency: number }>> = {};
    for (const [agent, records] of Object.entries(agentGroups)) {
      const totalSuccess = records.reduce((s, r) => s + r.successCount, 0);
      const totalFail = records.reduce((s, r) => s + r.failCount, 0);
      const avgQuality = records.reduce((s, r) => s + r.avgQuality, 0) / records.length;
      const avgLatency = records.reduce((s, r) => s + r.avgLatency, 0) / records.length;
      const totalCost = records.reduce((s, r) => s + r.totalCostUsd, 0);
      const successRate = totalSuccess + totalFail > 0 ? (totalSuccess / (totalSuccess + totalFail)) * 100 : 0;
      byAgent[agent] = [{ name: agent, quality: parseFloat((avgQuality * 100).toFixed(1)), successRate: parseFloat(successRate.toFixed(1)), cost: parseFloat(totalCost.toFixed(6)), latency: parseFloat(avgLatency.toFixed(0)) }];
    }
    return Object.values(byAgent).flat();
  }, [agentGroups]);

  // ── Export ──
  const handleExport = useCallback(() => {
    if (filtered.length === 0) {
      toast.error('No data to export');
      return;
    }
    exportToCSV({
      headers: ['Agent', 'Model', 'Provider', 'Success Count', 'Fail Count', 'Avg Quality', 'Avg Latency (ms)', 'Total Tokens', 'Total Cost (USD)', 'Last Used'],
      rows: filtered.map((p) => [
        p.agent,
        p.model,
        p.provider,
        String(p.successCount),
        String(p.failCount),
        p.avgQuality.toFixed(3),
        p.avgLatency.toFixed(0),
        String(p.totalTokens),
        p.totalCostUsd.toFixed(6),
        new Date(p.lastUsed).toISOString(),
      ]),
      fileName: 'oracle-agent-performance',
    });
    toast.success('Performance data exported as CSV');
  }, [filtered]);

  // ── Compare toggle ──
  const toggleCompareAgent = useCallback((agent: string) => {
    setSelectedCompareAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent].slice(0, 4)
    );
  }, []);

  const compareData = useMemo(() => {
    if (selectedCompareAgents.length < 2) return [];
    return selectedCompareAgents.map((agent) => {
      const records = agentGroups[agent] || [];
      const totalSuccess = records.reduce((s, r) => s + r.successCount, 0);
      const totalFail = records.reduce((s, r) => s + r.failCount, 0);
      const avgQuality = records.length > 0 ? records.reduce((s, r) => s + r.avgQuality, 0) / records.length : 0;
      const avgLatency = records.length > 0 ? records.reduce((s, r) => s + r.avgLatency, 0) / records.length : 0;
      const totalTokens = records.reduce((s, r) => s + r.totalTokens, 0);
      const totalCost = records.reduce((s, r) => s + r.totalCostUsd, 0);
      return {
        agent,
        quality: parseFloat((avgQuality * 100).toFixed(1)),
        successRate: totalSuccess + totalFail > 0 ? parseFloat(((totalSuccess / (totalSuccess + totalFail)) * 100).toFixed(1)) : 0,
        latency: parseFloat(avgLatency.toFixed(0)),
        tokens: totalTokens,
        cost: parseFloat(totalCost.toFixed(6)),
      };
    });
  }, [selectedCompareAgents, agentGroups]);

  // ── Performance History (time-series) ──
  const historyData = useMemo(() => getPerformanceHistory(), []);

  // Shared time-range helpers
  const historyFilter = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const rangeMs: Record<TimeRange, number> = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000, 'all': Infinity };
    const bucketMs: Record<TimeRange, number> = { '24h': 60 * 60 * 1000, '7d': 6 * 60 * 60 * 1000, '30d': 24 * 60 * 60 * 1000, 'all': 24 * 60 * 60 * 1000 };
    const cutoff = now - rangeMs[timeRange];
    const bucket = bucketMs[timeRange];
    const filtered = historyData.filter((h) => h.timestamp >= cutoff);
    return { filtered, bucket };
  }, [historyData, timeRange]);

  // Group history by time buckets and aggregate quality + latency
  const trendData = useMemo(() => {
    if (historyFilter.filtered.length === 0) return [];
    const { filtered, bucket } = historyFilter;

    // Group entries into buckets
    const buckets: Record<number, { quality: number[]; latency: number[]; cost: number; count: number; success: number }> = {};
    for (const entry of filtered) {
      const bucketKey = Math.floor(entry.timestamp / bucket) * bucket;
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = { quality: [], latency: [], cost: 0, count: 0, success: 0 };
      }
      const b = buckets[bucketKey];
      b.quality.push(entry.quality);
      b.latency.push(entry.latencyMs);
      b.cost += entry.costUsd;
      b.count += 1;
      b.success += entry.success ? 1 : 0;
    }

    // Convert to chart data sorted by time
    return Object.entries(buckets)
      .map(([ts, data]) => ({
        timestamp: Number(ts),
        label: formatTimestamp(Number(ts), timeRange),
        quality: parseFloat((data.quality.reduce((s, v) => s + v, 0) / data.quality.length * 100).toFixed(1)),
        latency: parseFloat((data.latency.reduce((s, v) => s + v, 0) / data.latency.length).toFixed(0)),
        cost: parseFloat(data.cost.toFixed(6)),
        runs: data.count,
        successRate: data.count > 0 ? parseFloat(((data.success / data.count) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [historyFilter, timeRange]);

  // Unique agents in history for per-agent trend lines
  const uniqueHistoryAgents = useMemo(() => {
    return Array.from(new Set(historyData.map((h) => h.agent))).sort();
  }, [historyData]);

  // Per-agent trend data — merged into a single dataset for correct recharts rendering
  const agentTrendData = useMemo(() => {
    if (uniqueHistoryAgents.length === 0 || historyFilter.filtered.length === 0) return [];
    const { filtered, bucket } = historyFilter;

    // Build per-agent quality by bucket
    const agentBuckets: Record<string, Record<number, number[]>> = {};
    for (const agent of uniqueHistoryAgents) {
      agentBuckets[agent] = {};
    }
    for (const entry of filtered) {
      const key = Math.floor(entry.timestamp / bucket) * bucket;
      if (!agentBuckets[entry.agent]) agentBuckets[entry.agent] = {};
      if (!agentBuckets[entry.agent][key]) agentBuckets[entry.agent][key] = [];
      agentBuckets[entry.agent][key].push(entry.quality);
    }

    // Collect all unique timestamps across all agents
    const allTimestamps = new Set<number>();
    for (const agent of uniqueHistoryAgents) {
      for (const ts of Object.keys(agentBuckets[agent])) allTimestamps.add(Number(ts));
    }
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Build merged dataset: { label, [agent1]: quality, [agent2]: quality, ... }
    return sortedTimestamps.map((ts) => {
      const row: Record<string, string | number> = { label: formatTimestamp(ts, timeRange), timestamp: ts };
      for (const agent of uniqueHistoryAgents) {
        const qualities = agentBuckets[agent][ts];
        if (qualities && qualities.length > 0) {
          row[agent] = parseFloat((qualities.reduce((s, v) => s + v, 0) / qualities.length * 100).toFixed(1));
        }
      }
      return row;
    });
  }, [historyFilter, uniqueHistoryAgents, timeRange]);

  // Budget limit save handler
  const saveBudgetLimit = useCallback(() => {
    const parsed = parseInt(budgetLimitInput, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setBudgetDailyLimit(parsed);
      refresh();
      toast.success(`Budget limit set to ${formatNumber(parsed)} tokens`);
    } else {
      toast.error('Please enter a valid number');
    }
    setBudgetLimitEditing(false);
  }, [budgetLimitInput, refresh]);

  const hasData = filtered.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* ── Header ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">📊 Agent Performance</h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
                  Monitor agent success rates, token usage, and cost breakdown
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--oracle-text-muted)]">
                  Last updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Time Range */}
                {(['24h', '7d', '30d', 'all'] as const).map((range) => (
                  <motion.button
                    key={range}
                    {...buttonTapProps}
                    onClick={() => setTimeRange(range)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                      timeRange === range
                        ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)] border border-[var(--oracle-primary)]/30'
                        : 'text-[var(--oracle-text-muted)] border border-transparent hover:text-[var(--oracle-text-3)]'
                    }`}
                  >
                    {TIME_RANGE_LABELS[range]}
                  </motion.button>
                ))}

                {/* Auto-refresh */}
                <button
                  onClick={() => setAutoRefresh((p) => !p)}
                  aria-label={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all border ${
                    autoRefresh
                      ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)] border-[var(--oracle-success)]/30'
                      : 'text-[var(--oracle-text-muted)] border-transparent hover:text-[var(--oracle-text-3)]'
                  }`}
                >
                  {autoRefresh && <span className="h-1.5 w-1.5 rounded-full bg-[var(--oracle-success)] animate-pulse" />}
                  Auto
                </button>

                {/* Export */}
                <motion.button
                  {...buttonTapProps}
                  onClick={handleExport}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--oracle-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--oracle-text-3)] transition-colors hover:bg-[var(--oracle-card-hover)]"
                >
                  📥 Export CSV
                </motion.button>

                {/* Refresh */}
                <motion.button
                  {...buttonTapProps}
                  onClick={refresh}
                  className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2.5 text-[13px] font-semibold text-white transition-all"
                >
                  🔄 Refresh
                </motion.button>
              </div>
            </div>

            {/* ── Budget Limit Inline Editor ── */}
            <div className="mt-3 flex items-center gap-2 text-[12px]">
              <span className="text-[var(--oracle-text-muted)]">Daily limit:</span>
              {budgetLimitEditing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={budgetLimitInput}
                    onChange={(e) => setBudgetLimitInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveBudgetLimit();
                      if (e.key === 'Escape') setBudgetLimitEditing(false);
                    }}
                    onBlur={saveBudgetLimit}
                    autoFocus
                    className="w-28 rounded-lg border border-[var(--oracle-primary)]/40 bg-[var(--oracle-surface-2)] px-2 py-1 font-mono text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]"
                    aria-label="Edit daily token budget limit"
                  />
                  <span className="text-[var(--oracle-text-muted)]">tokens</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setBudgetLimitInput(String(budget.dailyLimit));
                    setBudgetLimitEditing(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-card)] px-2.5 py-1 font-mono text-[12px] text-[var(--oracle-text-2)] transition-colors hover:border-[var(--oracle-primary)]/30 hover:bg-[var(--oracle-card-hover)]"
                  aria-label="Click to edit daily token budget limit"
                >
                  {formatNumber(budget.dailyLimit)} tokens
                  <span className="text-[10px] text-[var(--oracle-text-muted)]">✏️</span>
                </button>
              )}
            </div>
          </motion.div>

          {/* ── Summary Stats ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon="🤖" label="Active Agents" value={String(stats.uniqueAgents)} sub={`${filtered.length} records`} />
              <StatCard icon="✅" label="Success Rate" value={`${stats.successRate.toFixed(1)}%`} accent color={stats.successRate >= 80 ? 'var(--oracle-success)' : stats.successRate >= 50 ? 'var(--oracle-warning)' : 'var(--oracle-error)'} />
              <StatCard icon="🪙" label="Total Tokens" value={formatNumber(stats.totalTokens)} sub={`${stats.totalSuccess + stats.totalFail} total runs`} />
              <StatCard icon="💰" label="Total Cost" value={`$${stats.totalCost.toFixed(4)}`} sub={`₹${(stats.totalCost * 84).toFixed(2)}`} />
            </div>
          </motion.div>

          {/* ── Charts Row: Provider Pie + Agent Bar ── */}
          {hasData && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Provider Cost Pie */}
              {providerPieData.length > 0 && (
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Cost by Provider" subtitle="Distribution of spend across AI providers">
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={providerPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={85}
                            innerRadius={45}
                            paddingAngle={3}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {providerPieData.map((entry, i) => (
                              <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle.contentStyle}
                            itemStyle={tooltipStyle.itemStyle}
                            labelStyle={tooltipStyle.labelStyle}
                            formatter={(value: number) => [`$${value.toFixed(6)}`, 'Cost']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {providerPieData.map((p, i) => (
                        <span key={p.name} className="flex items-center gap-1.5 rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-3)]">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          {p.name} ({p.count} calls)
                        </span>
                      ))}
                    </div>
                  </ChartCard>
                </motion.div>
              )}

              {/* Agent Performance Bar */}
              {agentAggregateData.length > 0 && (
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Agent Quality Scores" subtitle="Average quality rating by agent">
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={agentAggregateData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} width={90} />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value: number) => [`${value}%`, 'Quality']} />
                          <Bar dataKey="quality" name="Quality" radius={[0, 4, 4, 0]}>
                            {agentAggregateData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={entry.quality >= 80 ? '#10b981' : entry.quality >= 50 ? '#f59e0b' : '#ef4444'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </motion.div>
              )}
            </div>
          )}

          {/* ── Charts Row 2: Tier Distribution + Latency Scatter ── */}
          {hasData && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Tier Distribution */}
              {Object.values(tierDistribution).some((v) => v > 0) && (
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Model Tier Distribution" subtitle="Usage breakdown by cost tier">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(tierDistribution).map(([tier, count]) => ({ tier, count }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                          <XAxis dataKey="tier" tick={{ fontSize: 11, fill: 'var(--oracle-text-muted)' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value: number) => [`${value} models`, 'Count']} />
                          <Bar dataKey="count" name="Models" radius={[4, 4, 0, 0]}>
                            {Object.keys(tierDistribution).map((tier, i) => {
                              const tierColors: Record<string, string> = {
                                free: '#10b981', budget: '#818cf8', standard: '#6366f1', premium: '#f59e0b', elite: '#ef4444',
                              };
                              return <Cell key={tier} fill={tierColors[tier] || CHART_COLORS[i]} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </motion.div>
              )}

              {/* Cost Optimization Insights */}
              {insights.length > 0 && (
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="💡 Cost Optimization Tips" subtitle="Actionable insights to reduce spend">
                    <div className="space-y-2.5 max-h-[240px] overflow-y-auto">
                      {insights.map((tip, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-3 rounded-xl border p-3 ${
                            tip.severity === 'warning'
                              ? 'border-[var(--oracle-warning)]/20 bg-[var(--oracle-warning)]/5'
                              : tip.severity === 'success'
                              ? 'border-[var(--oracle-success)]/20 bg-[var(--oracle-success)]/5'
                              : 'border-[var(--oracle-border)] bg-[var(--oracle-card)]'
                          }`}
                        >
                          <span className="text-lg mt-0.5">{tip.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{tip.title}</p>
                            <p className="text-[11px] text-[var(--oracle-text-3)] mt-0.5">{tip.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </motion.div>
              )}
            </div>
          )}

          {/* ── Historical Performance Trend ── */}
          {trendData.length >= 2 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-1 text-[15px] font-bold text-[var(--oracle-text-1)]">📈 Performance Trend</h3>
                <p className="mb-4 text-[11px] text-[var(--oracle-text-muted)]">Quality and latency over time — each point is a time bucket average</p>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <defs>
                        <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} angle={-30} textAnchor="end" height={50} />
                      <YAxis yAxisId="quality" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} label={{ value: 'Quality %', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'var(--oracle-text-muted)' } }} />
                      <YAxis yAxisId="latency" orientation="right" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} label={{ value: 'Latency ms', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: 'var(--oracle-text-muted)' } }} />
                      <Tooltip
                        contentStyle={tooltipStyle.contentStyle}
                        itemStyle={tooltipStyle.itemStyle}
                        labelStyle={tooltipStyle.labelStyle}
                        formatter={(value: number, name: string) => [
                          name === 'quality' ? `${value}%` : name === 'latency' ? `${value}ms` : name === 'cost' ? `$${value.toFixed(4)}` : String(value),
                          name === 'quality' ? 'Quality' : name === 'latency' ? 'Latency' : name === 'successRate' ? 'Success %' : name,
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line yAxisId="quality" type="monotone" dataKey="quality" name="quality" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                      <Line yAxisId="latency" type="monotone" dataKey="latency" name="latency" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Per-Agent Trend Lines ── */}
          {agentTrendData.length >= 2 && uniqueHistoryAgents.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-1 text-[15px] font-bold text-[var(--oracle-text-1)]">🔬 Quality by Agent Over Time</h3>
                <p className="mb-4 text-[11px] text-[var(--oracle-text-muted)]">Compare quality trends across individual agents</p>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={agentTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }}
                        angle={-30}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                      <Tooltip
                        contentStyle={tooltipStyle.contentStyle}
                        itemStyle={tooltipStyle.itemStyle}
                        labelStyle={tooltipStyle.labelStyle}
                        formatter={(value: number) => [`${value}%`, 'Quality']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {uniqueHistoryAgents.map((agent, i) => (
                        <Line
                          key={agent}
                          dataKey={agent}
                          name={agent}
                          type="monotone"
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Token Budget ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">⏱️ Token Budget (Today)</h3>
                <span className="text-[12px] font-mono text-[var(--oracle-text-muted)]">
                  {formatNumber(budget.usedToday)} / {formatNumber(budget.dailyLimit)}
                </span>
              </div>
              <div className="h-3 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden" role="progressbar" aria-valuenow={Math.round(budgetPercent)} aria-valuemin={0} aria-valuemax={100} aria-label="Token budget usage">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${budgetPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    backgroundColor: budgetPercent > 80 ? 'var(--oracle-error)' : budgetPercent > 50 ? 'var(--oracle-warning)' : 'var(--oracle-primary)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[11px] text-[var(--oracle-text-muted)]">
                <span>{budgetPercent.toFixed(1)}% used</span>
                <span>{formatNumber(budgetRemaining)} remaining</span>
              </div>
            </div>
          </motion.div>

          {/* ── Agent Performance Table ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">🤖 Agent Performance</h3>
                {Object.keys(agentGroups).length >= 2 && (
                  <span className="text-[11px] text-[var(--oracle-text-muted)]">
                    {selectedCompareAgents.length}/4 selected to compare
                  </span>
                )}
              </div>
              {!hasData ? (
                <EmptyState />
              ) : (
                <div className="space-y-2">
                  {Object.entries(agentGroups).map(([agent, records]) => {
                    const totalSuccess = records.reduce((sum, r) => sum + r.successCount, 0);
                    const totalFail = records.reduce((sum, r) => sum + r.failCount, 0);
                    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
                    const totalCost = records.reduce((sum, r) => sum + r.totalCostUsd, 0);
                    const avgQuality = records.reduce((sum, r) => sum + r.avgQuality, 0) / records.length;
                    const avgLatency = records.reduce((sum, r) => sum + r.avgLatency, 0) / records.length;
                    const successRate = totalSuccess + totalFail > 0 ? (totalSuccess / (totalSuccess + totalFail)) * 100 : 0;
                    const isSelected = selectedAgent === agent;
                    const isComparing = selectedCompareAgents.includes(agent);

                    return (
                      <div key={agent}>
                        <div className="flex items-center gap-1">
                          {/* Compare checkbox */}
                          <button
                            onClick={() => toggleCompareAgent(agent)}
                            aria-label={`Select ${agent} for comparison`}
                            className={`flex h-6 w-6 items-center justify-center rounded-md border text-[10px] transition-all shrink-0 ${
                              isComparing
                                ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]'
                                : 'border-[var(--oracle-border)] text-transparent hover:border-[var(--oracle-primary)]/30'
                            }`}
                          >
                            {isComparing ? '✓' : ''}
                          </button>
                          <button
                            onClick={() => setSelectedAgent(isSelected ? null : agent)}
                            aria-expanded={isSelected}
                            aria-label={`Toggle details for ${agent} agent`}
                            className="flex-1 flex items-center gap-3 rounded-xl border border-[var(--oracle-border)] p-3 hover:bg-[var(--oracle-surface-2)]/50 transition-colors text-left"
                          >
                            <span className="text-lg">{getAgentEmoji(agent)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-[var(--oracle-text-1)] capitalize">{agent}</span>
                                <span className="text-[11px] text-[var(--oracle-text-muted)]">{records.length} model(s)</span>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-[11px] text-[var(--oracle-text-muted)]">
                                <span className={`font-semibold ${successRate >= 80 ? 'text-[var(--oracle-success)]' : successRate >= 50 ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-error)]'}`}>
                                  {successRate.toFixed(0)}% success
                                </span>
                                <span>{formatNumber(totalTokens)} tokens</span>
                                <span>${totalCost.toFixed(4)}</span>
                                <span>q:{avgQuality.toFixed(2)}</span>
                                <span>{avgLatency.toFixed(0)}ms</span>
                              </div>
                            </div>
                            <span className="text-[var(--oracle-text-muted)] text-sm">{isSelected ? '▲' : '▼'}</span>
                          </button>
                        </div>

                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={transitions.smooth}
                              className="overflow-hidden"
                            >
                              <div className="ml-8 mr-3 mb-2 space-y-1">
                                {/* Agent summary row */}
                                <div className="flex items-center gap-3 rounded-lg border border-[var(--oracle-primary)]/20 bg-[var(--oracle-primary)]/5 px-3 py-2 text-[11px]">
                                  <span className="font-semibold text-[var(--oracle-text-1)] min-w-[80px]">Summary</span>
                                  <div className="flex-1 flex items-center gap-4">
                                    <span className="text-[var(--oracle-text-3)]">{totalSuccess + totalFail} total runs</span>
                                    <span className="text-[var(--oracle-text-3)]">{formatNumber(totalTokens)} tokens</span>
                                    <span className="text-[var(--oracle-text-3)]">${totalCost.toFixed(4)} cost</span>
                                    <span className="text-[var(--oracle-text-3)]">{avgLatency.toFixed(0)}ms avg</span>
                                  </div>
                                </div>
                                {/* Individual models */}
                                {records.map((r, i) => (
                                  <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--oracle-border)]/50 bg-[var(--oracle-surface-2)]/20 px-3 py-2 text-[11px]">
                                    <span className="font-mono text-[var(--oracle-text-2)] min-w-[120px] truncate">{r.model}</span>
                                    <span className="text-[var(--oracle-text-muted)] min-w-[60px]">{r.provider}</span>
                                    <span className={`font-semibold min-w-[40px] ${r.successCount > r.failCount ? 'text-[var(--oracle-success)]' : 'text-[var(--oracle-error)]'}`}>
                                      {r.successCount}/{r.successCount + r.failCount}
                                    </span>
                                    <span className="text-[var(--oracle-text-muted)] min-w-[60px]">{formatNumber(r.totalTokens)} tok</span>
                                    <span className="text-[var(--oracle-text-muted)] min-w-[50px]">${r.totalCostUsd.toFixed(4)}</span>
                                    <span className="text-[var(--oracle-text-muted)] min-w-[50px]">{r.avgLatency.toFixed(0)}ms</span>
                                    <span className="text-[var(--oracle-text-muted)] min-w-[50px]">q:{r.avgQuality.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Model Comparison (when 2+ agents selected) ── */}
          {compareData.length >= 2 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">⚖️ Agent Comparison</h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compareData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                      <XAxis dataKey="agent" tick={{ fontSize: 11, fill: 'var(--oracle-text-muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="quality" name="Quality %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="successRate" name="Success %" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Comparison Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--oracle-border)]">
                        <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Agent</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Quality</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Success</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Latency</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Tokens</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareData.map((row) => (
                        <tr key={row.agent} className="border-b border-[var(--oracle-border)] last:border-0 hover:bg-[var(--oracle-card-hover)]">
                          <td className="px-3 py-2 font-semibold text-[var(--oracle-text-1)] capitalize">{row.agent}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-semibold ${row.quality >= 80 ? 'text-[var(--oracle-success)]' : row.quality >= 50 ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-error)]'}`}>
                              {row.quality}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-semibold ${row.successRate >= 80 ? 'text-[var(--oracle-success)]' : row.successRate >= 50 ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-error)]'}`}>
                              {row.successRate}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{row.latency}ms</td>
                          <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{formatNumber(row.tokens)}</td>
                          <td className="px-3 py-2 text-right font-mono text-[var(--oracle-text-muted)]">${row.cost.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Provider Reliability ── */}
          {Object.keys(providerGroups).length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">🏥 Provider Reliability</h3>
                <div className="space-y-3">
                  {Object.entries(providerGroups)
                    .sort(([, a], [, b]) => {
                      const srA = a.success + a.fail > 0 ? a.success / (a.success + a.fail) : 0;
                      const srB = b.success + b.fail > 0 ? b.success / (b.success + b.fail) : 0;
                      return srB - srA;
                    })
                    .map(([provider, data]) => {
                      const providerInfo = PROVIDERS.find((p) => p.id === provider);
                      const total = data.success + data.fail;
                      const successRate = total > 0 ? (data.success / total) * 100 : 0;

                      return (
                        <div key={provider} className="flex items-center gap-3">
                          <span className="text-sm min-w-[24px] text-center">{providerInfo?.logo ? '🔹' : '⚪'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] font-medium text-[var(--oracle-text-1)] capitalize">{provider}</span>
                              <span className="text-[11px] text-[var(--oracle-text-muted)] font-mono">
                                {successRate.toFixed(0)}% success · {total} calls · {formatNumber(data.tokens)} tok
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(successRate, 1)}%`,
                                  backgroundColor: successRate >= 80 ? 'var(--oracle-success)' : successRate >= 50 ? 'var(--oracle-warning)' : 'var(--oracle-error)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Quality & Latency ── */}
          {(stats.avgQuality > 0 || stats.avgLatency > 0) && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="grid grid-cols-2 gap-3">
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">⭐ Avg Quality</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[32px] font-bold oracle-gradient-text">{stats.avgQuality.toFixed(2)}</span>
                    <span className="text-[12px] text-[var(--oracle-text-muted)]">/ 1.00</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--oracle-primary)] transition-all"
                      style={{ width: `${stats.avgQuality * 100}%` }}
                    />
                  </div>
                </div>
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">⚡ Avg Latency</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[32px] font-bold oracle-gradient-text">{stats.avgLatency.toFixed(0)}</span>
                    <span className="text-[12px] text-[var(--oracle-text-muted)]">ms</span>
                  </div>
                  <div className="mt-3 flex gap-1">
                    {[100, 300, 500, 1000, 2000].map((threshold) => (
                      <div
                        key={threshold}
                        className="flex-1 h-1.5 rounded-full"
                        style={{
                          backgroundColor: stats.avgLatency <= threshold
                            ? 'var(--oracle-success)'
                            : 'var(--oracle-surface-2)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 text-[8px] text-[var(--oracle-text-muted)]">
                    <span>100ms</span>
                    <span>2s</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Empty State ── */}
          {!hasData && performance.length === 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="py-8 text-center">
              <div className="mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-4xl">📊</span>
              </div>
              <h3 className="mb-2 text-[18px] font-bold text-[var(--oracle-text-1)]">No Performance Data</h3>
              <p className="max-w-md mx-auto text-[14px] text-[var(--oracle-text-3)]">
                Agent performance data will appear here as tasks are executed. Data is stored locally and persists across sessions.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <div className="rounded-xl bg-[var(--oracle-surface-2)] px-4 py-3 text-center">
                  <p className="text-[11px] text-[var(--oracle-text-muted)]">Tip</p>
                  <p className="text-[12px] text-[var(--oracle-text-3)]">Use the Agent tab to run tasks and generate data</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Filtered Empty State ── */}
          {!hasData && performance.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="py-8 text-center">
              <div className="mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-4xl">🔍</span>
              </div>
              <h3 className="mb-2 text-[18px] font-bold text-[var(--oracle-text-1)]">No Data in This Range</h3>
              <p className="max-w-md mx-auto text-[14px] text-[var(--oracle-text-3)]">
                No performance records found for the selected time range. Try switching to &quot;All Time&quot; or run more tasks.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────

function StatCard({ icon, label, value, sub, accent, color }: { icon: string; label: string; value: string; sub?: string; accent?: boolean; color?: string }) {
  return (
    <div className={`oracle-glass rounded-xl p-4 ${accent ? 'ring-1 ring-[var(--oracle-primary)]/20' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className={`text-[20px] font-bold ${accent ? 'oracle-gradient-text' : 'text-[var(--oracle-text-1)]'}`} style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--oracle-text-muted)]">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{title}</h3>
        <p className="text-[11px] text-[var(--oracle-text-muted)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-6 text-center">
      <p className="text-[13px] text-[var(--oracle-text-muted)]">No agent runs recorded yet.</p>
    </div>
  );
}

// ─── Helpers ───────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTimestamp(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  if (range === '24h') return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (range === '7d') return d.toLocaleString('en-IN', { day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getAgentEmoji(agent: string): string {
  const emojis: Record<string, string> = {
    researcher: '🔍',
    writer: '✍️',
    developer: '💻',
    analyst: '📈',
    strategist: '🎯',
    marketer: '📢',
    designer: '🎨',
    finance: '💰',
    voice: '🎙️',
    qa: '🛡️',
    coordinator: '📋',
    workflow: '⚙️',
    synthesizer: '🧬',
  };
  return emojis[agent] || '🤖';
}
