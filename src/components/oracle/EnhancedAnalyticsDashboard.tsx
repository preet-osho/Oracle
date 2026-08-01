'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import { useRouterStore } from '@/stores/router.store';
import { PROVIDERS } from '@/data/providers';
import { getAgentPerformance, type AgentPerformance } from '@/lib/model-selector';
import { getGodModeMetrics, getGodModeCostAnalysis } from '@/lib/god-mode-metrics';
import { exportToCSV } from '@/lib/export-utils';
import toast from 'react-hot-toast';
import type { UsageRecord } from '@/types';

// ─── Types ────────────────────────────

type TimeRange = '24h' | '7d' | '30d' | 'all';
type ViewMode = 'overview' | 'agents' | 'costs' | 'quality';

interface AgentStats {
  agent: string;
  totalTokens: number;
  totalCost: number;
  requests: number;
  successRate: number;
  avgQuality: number;
  avgLatency: number;
}

// ─── Helpers ──────────────────────────

function getDayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function filterUsageByRange(records: UsageRecord[], range: TimeRange): UsageRecord[] {
  const now = Date.now();
  const ms = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000, 'all': Infinity };
  return records.filter((r) => now - r.timestamp <= ms[range]);
}

function filterPerfByRange(records: AgentPerformance[], range: TimeRange): AgentPerformance[] {
  const now = Date.now();
  const ms = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000, 'all': Infinity };
  return records.filter((r) => now - r.lastUsed <= ms[range]);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#0ea5e9', '#f97316', '#14b8a6'];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--oracle-surface-2)',
    border: '1px solid var(--oracle-border)',
    borderRadius: '12px',
    fontSize: '12px',
    color: 'var(--oracle-text-1)',
  } as React.CSSProperties,
};

// ─── EnhancedAnalyticsDashboard ──────

export function EnhancedAnalyticsDashboard() {
  const { usageHistory, totalCostINR } = useRouterStore();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  const performance = useMemo(() => getAgentPerformance(), []);
  const godModeMetrics = useMemo(() => getGodModeMetrics(), []);
  const godModeCost = useMemo(() => getGodModeCostAnalysis(), []);

  const filteredUsage = useMemo(() => filterUsageByRange(usageHistory, timeRange), [usageHistory, timeRange]);
  const filteredPerf = useMemo(() => filterPerfByRange(performance, timeRange), [performance, timeRange]);

  // ── Agent Aggregate Stats ──
  const agentStats = useMemo(() => {
    const groups: Record<string, AgentStats> = {};
    for (const p of filteredPerf) {
      if (!groups[p.agent]) {
        groups[p.agent] = { agent: p.agent, totalTokens: 0, totalCost: 0, requests: 0, successRate: 0, avgQuality: 0, avgLatency: 0 };
      }
      const g = groups[p.agent];
      g.totalTokens += p.totalTokens;
      g.totalCost += p.totalCostUsd;
      g.requests += p.successCount + p.failCount;
      g.successRate += p.successCount;
      g.avgQuality += p.avgQuality;
      g.avgLatency += p.avgLatency;
    }
    return Object.values(groups).map((g) => ({
      ...g,
      successRate: g.requests > 0 ? (g.successRate / g.requests) * 100 : 0,
      avgQuality: g.requests > 0 ? g.avgQuality / Math.max(1, filteredPerf.filter((p) => p.agent === g.agent).length) : 0,
      avgLatency: g.requests > 0 ? g.avgLatency / Math.max(1, filteredPerf.filter((p) => p.agent === g.agent).length) : 0,
    })).sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredPerf]);

  // ── Cost by Agent (Pie) ──
  const costByAgent = useMemo(() => {
    return agentStats.map((a, i) => ({
      name: a.agent,
      value: a.totalCost,
      tokens: a.totalTokens,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })).filter((d) => d.value > 0);
  }, [agentStats]);

  // ── Daily Cost Trend ──
  const dailyCostTrend = useMemo(() => {
    const grouped: Record<string, { cost: number; tokens: number; requests: number }> = {};
    for (const r of filteredUsage) {
      const key = getDayLabel(r.timestamp);
      if (!grouped[key]) grouped[key] = { cost: 0, tokens: 0, requests: 0 };
      grouped[key].cost += r.costINR;
      grouped[key].tokens += r.inputTokens + r.outputTokens;
      grouped[key].requests += 1;
    }
    let cumulative = 0;
    return Object.entries(grouped).map(([date, data]) => {
      cumulative += data.cost;
      return { date, daily: parseFloat(data.cost.toFixed(4)), cumulative: parseFloat(cumulative.toFixed(4)), tokens: data.tokens, requests: data.requests };
    });
  }, [filteredUsage]);

  // ── Token Usage by Provider ──
  const providerTokenData = useMemo(() => {
    const grouped: Record<string, { input: number; output: number }> = {};
    for (const r of filteredUsage) {
      if (!grouped[r.provider]) grouped[r.provider] = { input: 0, output: 0 };
      grouped[r.provider].input += r.inputTokens;
      grouped[r.provider].output += r.outputTokens;
    }
    return Object.entries(grouped).map(([provider, data]) => {
      const info = PROVIDERS.find((p) => p.id === provider);
      return { name: info?.name || provider, input: data.input, output: data.output, total: data.input + data.output };
    }).sort((a, b) => b.total - a.total);
  }, [filteredUsage]);

  // ── Quality Trend ──
  const qualityTrend = useMemo(() => {
    if (godModeMetrics.scoredMessages.length === 0) return [];
    const grouped: Record<string, number[]> = {};
    for (const m of godModeMetrics.scoredMessages) {
      const key = getDayLabel(m.timestamp);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m.qualityScore || 0);
    }
    return Object.entries(grouped).map(([date, scores]) => ({
      date,
      avgQuality: parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length * 100).toFixed(1)),
      count: scores.length,
    }));
  }, [godModeMetrics]);

  // ── Agent Performance Bar Data ──
  const agentPerfBarData = useMemo(() => {
    return agentStats.slice(0, 10).map((a) => ({
      name: a.agent.length > 12 ? a.agent.slice(0, 12) + '…' : a.agent,
      quality: parseFloat((a.avgQuality * 100).toFixed(1)),
      successRate: parseFloat(a.successRate.toFixed(1)),
      latency: parseFloat(a.avgLatency.toFixed(0)),
    }));
  }, [agentStats]);

  // ── Summary Stats ──
  const summaryStats = useMemo(() => {
    const totalTokens = filteredUsage.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
    const totalCost = filteredUsage.reduce((s, r) => s + r.costINR, 0);
    const totalRequests = filteredUsage.length;
    const avgQuality = godModeMetrics.avgQuality > 0 ? godModeMetrics.avgQuality * 100 : 0;
    const successRate = godModeMetrics.totalMessages > 0
      ? (godModeMetrics.successfulMessages / godModeMetrics.totalMessages) * 100
      : 0;
    return { totalTokens, totalCost, totalRequests, avgQuality, successRate, uniqueAgents: agentStats.length };
  }, [filteredUsage, agentStats, godModeMetrics]);

  const handleExport = useCallback(() => {
    exportToCSV({
      headers: ['Agent', 'Tokens', 'Cost (INR)', 'Requests', 'Success Rate', 'Avg Quality', 'Avg Latency'],
      rows: agentStats.map((a) => [
        a.agent, String(a.totalTokens), a.totalCost.toFixed(4), String(a.requests),
        a.successRate.toFixed(1), (a.avgQuality * 100).toFixed(1), a.avgLatency.toFixed(0),
      ]),
      fileName: 'oracle-analytics-export',
    });
    toast.success('Analytics exported as CSV');
  }, [agentStats]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">📊 Analytics Dashboard</h1>
              <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Agent performance, cost breakdowns, and quality trends</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-[var(--oracle-border)] p-0.5">
                {(['overview', 'agents', 'costs', 'quality'] as const).map((mode) => (
                  <button key={mode} onClick={() => setViewMode(mode)} className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${viewMode === mode ? 'oracle-gradient-bg text-white' : 'text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-3)]'}`}>
                    {mode === 'overview' ? '📋 Overview' : mode === 'agents' ? '🤖 Agents' : mode === 'costs' ? '💰 Costs' : '⭐ Quality'}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-[var(--oracle-border)] p-0.5">
                {(['24h', '7d', '30d', 'all'] as const).map((range) => (
                  <button key={range} onClick={() => setTimeRange(range)} className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${timeRange === range ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'text-[var(--oracle-text-muted)]'}`}>
                    {range === '24h' ? '24h' : range === '7d' ? '7D' : range === '30d' ? '30D' : 'All'}
                  </button>
                ))}
              </div>
              <button onClick={handleExport} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors">📥 Export</button>
            </div>
          </motion.div>

          {/* Summary Stats */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <StatCard icon="📨" label="Requests" value={summaryStats.totalRequests.toLocaleString()} />
              <StatCard icon="🔤" label="Tokens" value={formatTokens(summaryStats.totalTokens)} />
              <StatCard icon="💰" label="Cost" value={`₹${summaryStats.totalCost.toFixed(2)}`} accent />
              <StatCard icon="🤖" label="Agents" value={String(summaryStats.uniqueAgents)} />
              <StatCard icon="⭐" label="Avg Quality" value={summaryStats.avgQuality > 0 ? `${summaryStats.avgQuality.toFixed(0)}%` : 'N/A'} />
              <StatCard icon="✅" label="Success" value={summaryStats.successRate > 0 ? `${summaryStats.successRate.toFixed(0)}%` : 'N/A'} />
            </div>
          </motion.div>

          {/* Overview View */}
          {viewMode === 'overview' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Cost Trend */}
              <ChartCard title="Cost Trend" subtitle="Daily and cumulative spend">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCostTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                      <YAxis yAxisId="daily" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} tickFormatter={(v) => `₹${v}`} />
                      <YAxis yAxisId="cumulative" orientation="right" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(v, name) => [`₹${Number(v).toFixed(4)}`, name === 'daily' ? 'Daily' : 'Cumulative']} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line yAxisId="daily" type="monotone" dataKey="daily" name="Daily" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="cumulative" type="monotone" dataKey="cumulative" name="Cumulative" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Token Usage by Provider */}
              <ChartCard title="Token Usage by Provider" subtitle="Input vs Output tokens">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={providerTokenData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} tickFormatter={(v) => formatTokens(v)} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(v) => [formatTokens(Number(v)), '']} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="input" name="Input" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="output" name="Output" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          )}

          {/* Agents View */}
          {viewMode === 'agents' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Agent Performance Bar */}
              <ChartCard title="Agent Performance" subtitle="Quality and success rate by agent">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentPerfBarData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} width={100} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(v) => [`${v}%`, '']} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="quality" name="Quality %" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="successRate" name="Success %" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Agent Cost Breakdown */}
              <ChartCard title="Cost by Agent" subtitle="Spending distribution across agents">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={costByAgent} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {costByAgent.map((entry, i) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(v) => [`₹${Number(v).toFixed(4)}`, 'Cost']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Agent Stats Table */}
              <div className="lg:col-span-2">
                <ChartCard title="Agent Details" subtitle="Comprehensive agent metrics">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--oracle-border)]">
                          <th className="px-3 py-2 text-left font-semibold">Agent</th>
                          <th className="px-3 py-2 text-right font-semibold">Tokens</th>
                          <th className="px-3 py-2 text-right font-semibold">Cost</th>
                          <th className="px-3 py-2 text-right font-semibold">Requests</th>
                          <th className="px-3 py-2 text-right font-semibold">Success %</th>
                          <th className="px-3 py-2 text-right font-semibold">Quality</th>
                          <th className="px-3 py-2 text-right font-semibold">Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentStats.map((a) => (
                          <tr key={a.agent} className="border-b border-[var(--oracle-border)] last:border-0 hover:bg-[var(--oracle-card-hover)]">
                            <td className="px-3 py-2 font-medium">{a.agent}</td>
                            <td className="px-3 py-2 text-right">{formatTokens(a.totalTokens)}</td>
                            <td className="px-3 py-2 text-right font-mono">₹{a.totalCost.toFixed(4)}</td>
                            <td className="px-3 py-2 text-right">{a.requests}</td>
                            <td className="px-3 py-2 text-right">{a.successRate.toFixed(1)}%</td>
                            <td className="px-3 py-2 text-right">{(a.avgQuality * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 text-right">{a.avgLatency.toFixed(0)}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {/* Costs View */}
          {viewMode === 'costs' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Cost by Provider" subtitle="Provider spending breakdown">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={costByAgent} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3}>
                        {costByAgent.map((entry, i) => (
                          <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(v) => [`₹${Number(v).toFixed(4)}`, 'Cost']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="GOD MODE Cost Analysis" subtitle="Overhead comparison">
                <div className="space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
                      <p className="text-[11px] text-[var(--oracle-text-muted)]">GOD MODE Tokens</p>
                      <p className="text-[20px] font-bold text-[var(--oracle-text-1)]">{formatTokens(godModeMetrics.totalTokens)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
                      <p className="text-[11px] text-[var(--oracle-text-muted)]">Overhead</p>
                      <p className="text-[20px] font-bold text-[var(--oracle-text-1)]">{godModeCost.overheadPercent != null ? `+${godModeCost.overheadPercent.toFixed(1)}%` : 'N/A'}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
                      <p className="text-[11px] text-[var(--oracle-text-muted)]">Total Toggles</p>
                      <p className="text-[20px] font-bold text-[var(--oracle-text-1)]">{godModeMetrics.totalToggles}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
                      <p className="text-[11px] text-[var(--oracle-text-muted)]">Messages</p>
                      <p className="text-[20px] font-bold text-[var(--oracle-text-1)]">{godModeMetrics.totalMessages}</p>
                    </div>
                  </div>
                </div>
              </ChartCard>
            </div>
          )}

          {/* Quality View */}
          {viewMode === 'quality' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Quality Trend" subtitle="Average quality score over time">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={qualityTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} domain={[0, 100]} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(v) => [`${v}%`, 'Quality']} />
                      <Line type="monotone" dataKey="avgQuality" name="Avg Quality" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Quality Distribution" subtitle="Score distribution across messages">
                <div className="space-y-3 p-4">
                  {godModeMetrics.qualityDistribution.map((bucket, i) => {
                    const total = godModeMetrics.qualityDistribution.reduce((s, b) => s + b.count, 0);
                    const pct = total > 0 ? (bucket.count / total) * 100 : 0;
                    return (
                      <div key={bucket.range} className="flex items-center gap-3">
                        <span className="text-[11px] text-[var(--oracle-text-3)] w-20">{bucket.range}</span>
                        <div className="flex-1 h-6 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i] }} />
                        </div>
                        <span className="text-[11px] text-[var(--oracle-text-muted)] w-12 text-right">{bucket.count}</span>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`oracle-glass rounded-xl p-3 ${accent ? 'ring-1 ring-[var(--oracle-primary)]/20' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className={`text-[16px] font-bold ${accent ? 'oracle-gradient-text' : 'text-[var(--oracle-text-1)]'}`}>{value}</p>
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
