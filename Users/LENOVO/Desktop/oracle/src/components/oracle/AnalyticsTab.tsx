'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie,
  LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell,
} from 'recharts';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import { useRouterStore } from '@/stores/router.store';
import { PROVIDERS } from '@/data/providers';
import type { UsageRecord } from '@/types';

// ─── Date Helpers ──────────────────────

function getDayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getHourLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

type TimeRange = '24h' | '7d' | '30d' | 'all';

function filterByRange(records: UsageRecord[], range: TimeRange): UsageRecord[] {
  const now = Date.now();
  switch (range) {
    case '24h': return records.filter((r) => now - r.timestamp < 24 * 60 * 60 * 1000);
    case '7d': return records.filter((r) => now - r.timestamp < 7 * 24 * 60 * 60 * 1000);
    case '30d': return records.filter((r) => now - r.timestamp < 30 * 24 * 60 * 60 * 1000);
    default: return records;
  }
}

// ─── Chart Theme ───────────────────────

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#0ea5e9', '#f97316', '#14b8a6'];

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

// ─── AnalyticsTab ─────────────────────

export function AnalyticsTab() {
  const { usageHistory, totalCostINR, resetCosts } = useRouterStore();
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('oracle-analytics-range') as TimeRange) || '7d';
    }
    return '7d';
  });
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const filtered = useMemo(() => filterByRange(usageHistory, timeRange), [usageHistory, timeRange]);

  // ── Aggregated Stats ──
  const stats = useMemo(() => {
    const totalRequests = filtered.length;
    const totalInputTokens = filtered.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutputTokens = filtered.reduce((s, r) => s + r.outputTokens, 0);
    const totalTokens = totalInputTokens + totalOutputTokens;
    const cost = filtered.reduce((s, r) => s + r.costINR, 0);
    const avgTokensPerReq = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;
    const avgCostPerReq = totalRequests > 0 ? cost / totalRequests : 0;
    return { totalRequests, totalInputTokens, totalOutputTokens, totalTokens, cost, avgTokensPerReq, avgCostPerReq };
  }, [filtered]);

  // ── Daily Token Usage Data ──
  const dailyTokenData = useMemo(() => {
    const grouped: Record<string, { input: number; output: number; total: number; cost: number; requests: number }> = {};
    for (const r of filtered) {
      const key = getDayLabel(r.timestamp);
      if (!grouped[key]) grouped[key] = { input: 0, output: 0, total: 0, cost: 0, requests: 0 };
      grouped[key].input += r.inputTokens;
      grouped[key].output += r.outputTokens;
      grouped[key].total += r.inputTokens + r.outputTokens;
      grouped[key].cost += r.costINR;
      grouped[key].requests += 1;
    }
    return Object.entries(grouped).map(([date, data]) => ({ date, ...data }));
  }, [filtered]);

  // ── Hourly Request Distribution (24h) ──
  const hourlyData = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (let h = 0; h < 24; h++) {
      const key = `${String(h).padStart(2, '0')}:00`;
      grouped[key] = 0;
    }
    for (const r of filtered) {
      const d = new Date(r.timestamp);
      const key = `${String(d.getHours()).padStart(2, '0')}:00`;
      grouped[key] = (grouped[key] || 0) + 1;
    }
    return Object.entries(grouped).map(([hour, requests]) => ({ hour, requests }));
  }, [filtered]);

  // ── Provider Breakdown ──
  const providerData = useMemo(() => {
    const grouped: Record<string, { cost: number; tokens: number; requests: number }> = {};
    for (const r of filtered) {
      if (!grouped[r.provider]) grouped[r.provider] = { cost: 0, tokens: 0, requests: 0 };
      grouped[r.provider].cost += r.costINR;
      grouped[r.provider].tokens += r.inputTokens + r.outputTokens;
      grouped[r.provider].requests += 1;
    }
    return Object.entries(grouped)
      .map(([provider, data]) => {
        const info = PROVIDERS.find((p) => p.id === provider);
        return { name: info?.name || provider, color: info?.color || '#6366f1', ...data };
      })
      .sort((a, b) => b.cost - a.cost);
  }, [filtered]);

  // ── Model Distribution ──
  const modelData = useMemo(() => {
    const grouped: Record<string, { tokens: number; requests: number; cost: number }> = {};
    for (const r of filtered) {
      const key = r.model || 'unknown';
      if (!grouped[key]) grouped[key] = { tokens: 0, requests: 0, cost: 0 };
      grouped[key].tokens += r.inputTokens + r.outputTokens;
      grouped[key].requests += 1;
      grouped[key].cost += r.costINR;
    }
    return Object.entries(grouped)
      .map(([model, data]) => ({ name: model, ...data }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);
  }, [filtered]);

  // ── Cost Trend ──
  const costTrendData = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const r of filtered) {
      const key = getDayLabel(r.timestamp);
      grouped[key] = (grouped[key] || 0) + r.costINR;
    }
    let cumulative = 0;
    return Object.entries(grouped).map(([date, cost]) => {
      cumulative += cost;
      return { date, daily: parseFloat(cost.toFixed(4)), cumulative: parseFloat(cumulative.toFixed(4)) };
    });
  }, [filtered]);

  // ── Token Efficiency (input vs output ratio) ──
  const efficiencyData = useMemo(() => {
    const grouped: Record<string, { input: number; output: number }> = {};
    for (const r of filtered) {
      const key = getDayLabel(r.timestamp);
      if (!grouped[key]) grouped[key] = { input: 0, output: 0 };
      grouped[key].input += r.inputTokens;
      grouped[key].output += r.outputTokens;
    }
    return Object.entries(grouped).map(([date, data]) => ({
      date,
      input: data.input,
      output: data.output,
      ratio: data.input > 0 ? parseFloat((data.output / data.input).toFixed(2)) : 0,
    }));
  }, [filtered]);

  const hasData = filtered.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* ── Header ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">📊 Usage Analytics</h1>
              <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Token usage, cost trends, and provider performance</p>
            </div>
            <div className="flex items-center gap-2">
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
                  {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* ── Stat Cards ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon="📨" label="Total Requests" value={stats.totalRequests.toLocaleString()} sub={`${timeRange === '24h' ? 'today' : 'in range'}`} />
              <StatCard icon="🔤" label="Total Tokens" value={formatTokens(stats.totalTokens)} sub={`${formatTokens(stats.totalInputTokens)} in / ${formatTokens(stats.totalOutputTokens)} out`} />
              <StatCard icon="💰" label="Total Cost" value={`₹${stats.cost.toFixed(2)}`} sub={`$${(stats.cost / 84).toFixed(4)}`} accent />
              <StatCard icon="⚡" label="Avg per Request" value={formatTokens(stats.avgTokensPerReq)} sub={`₹${stats.avgCostPerReq.toFixed(4)} avg cost`} />
            </div>
          </motion.div>

          {hasData ? (
            <>
              {/* ── Charts Row 1: Token Usage + Cost Trend ── */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Token Usage Over Time */}
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Token Usage Over Time" subtitle="Input vs Output tokens by day" ariaLabel="Token usage over time chart showing input and output tokens by day">
                    <div className="flex items-center gap-2 mb-3">
                      {(['area', 'bar'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setChartType(t)}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${chartType === t ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'text-[var(--oracle-text-muted)]'}`}
                        >
                          {t === 'area' ? '📈 Area' : '📊 Bar'}
                        </button>
                      ))}
                    </div>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'area' ? (
                          <AreaChart data={dailyTokenData}>
                            <defs>
                              <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} tickFormatter={(v) => formatTokens(v)} />
                            <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value) => [formatTokens(Number(value)), '']} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--oracle-text-3)' }} />
                            <Area type="monotone" dataKey="input" name="Input" stroke="#6366f1" fill="url(#colorInput)" strokeWidth={2} />
                            <Area type="monotone" dataKey="output" name="Output" stroke="#10b981" fill="url(#colorOutput)" strokeWidth={2} />
                          </AreaChart>
                        ) : (
                          <BarChart data={dailyTokenData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} tickFormatter={(v) => formatTokens(v)} />
                            <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value) => [formatTokens(Number(value)), '']} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--oracle-text-3)' }} />
                            <Bar dataKey="input" name="Input" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="output" name="Output" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </motion.div>

                {/* Cost Trend */}
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Cost Trend" subtitle="Daily and cumulative spend in INR" ariaLabel="Cost trend chart showing daily and cumulative spending in INR">
                    <div className="h-[290px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={costTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                          <YAxis yAxisId="daily" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} tickFormatter={(v) => `\u20B9${v}`} />
                          <YAxis yAxisId="cumulative" orientation="right" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} tickFormatter={(v) => `\u20B9${v}`} />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value, name) => [`\u20B9${Number(value).toFixed(4)}`, name === 'daily' ? 'Daily' : 'Cumulative']} />
                          <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--oracle-text-3)' }} />
                          <Line yAxisId="daily" type="monotone" dataKey="daily" name="Daily" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                          <Line yAxisId="cumulative" type="monotone" dataKey="cumulative" name="Cumulative" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </motion.div>
              </div>

              {/* ── Charts Row 2: Provider Breakdown + Model Distribution ── */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Provider Breakdown (Pie) */}
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Provider Breakdown" subtitle="Cost distribution by AI provider" ariaLabel="Provider breakdown pie chart showing cost distribution by AI provider">
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={providerData}
                            dataKey="cost"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            innerRadius={45}
                            paddingAngle={3}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {providerData.map((entry, i) => (
                              <Cell key={entry.name} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value) => [`\u20B9${Number(value).toFixed(4)}`, 'Cost']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Provider Legend */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {providerData.map((p) => (
                        <span key={p.name} className="flex items-center gap-1.5 rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-3)]">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name} ({p.requests} reqs)
                        </span>
                      ))}
                    </div>
                  </ChartCard>
                </motion.div>

                {/* Model Distribution (Bar) */}
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Model Distribution" subtitle="Token usage by model (top 10)" ariaLabel="Model distribution chart showing token usage by model">
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={modelData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} tickFormatter={(v) => formatTokens(v)} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} width={120} />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value) => [formatTokens(Number(value)), 'Tokens']} />
                          <Bar dataKey="tokens" name="Tokens" radius={[0, 4, 4, 0]}>
                            {modelData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </motion.div>
              </div>

              {/* ── Charts Row 3: Hourly Distribution + Token Efficiency ── */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Hourly Request Distribution */}
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Hourly Request Distribution" subtitle="Request volume by hour of day" ariaLabel="Hourly request distribution chart showing request volume by hour of day">
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                          <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--oracle-text-muted)' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value) => [`${value} requests`, 'Requests']} />
                          <Bar dataKey="requests" name="Requests" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </motion.div>

                {/* Token Efficiency (Input/Output Ratio) */}
                <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <ChartCard title="Token Efficiency" subtitle="Input vs Output token ratio by day" ariaLabel="Token efficiency chart showing input vs output token ratio by day">
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={efficiencyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} />
                          <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--oracle-text-3)' }} />
                          <Line type="monotone" dataKey="input" name="Input Tokens" stroke="#6366f1" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="output" name="Output Tokens" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </motion.div>
              </div>

              {/* ── Recent Usage Table ── */}
              <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                <ChartCard title="Recent Requests" subtitle={`Last ${Math.min(filtered.length, 20)} of ${filtered.length} requests`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--oracle-border)]">
                          <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Time</th>
                          <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Provider</th>
                          <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Model</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Input</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Output</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Total</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Cost</th>
                          <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Task</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 20).map((r) => {
                          const info = PROVIDERS.find((p) => p.id === r.provider);
                          return (
                            <tr key={r.id} className="border-b border-[var(--oracle-border)] last:border-0 hover:bg-[var(--oracle-card-hover)] transition-colors">
                              <td className="px-3 py-2 text-[var(--oracle-text-3)]">
                                {new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                {' '}
                                {getHourLabel(r.timestamp)}
                              </td>
                              <td className="px-3 py-2">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: info?.color || '#6366f1' }} />
                                  <span className="text-[var(--oracle-text-2)]">{info?.name || r.provider}</span>
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[var(--oracle-text-3)] font-mono text-[11px]">{r.model}</td>
                              <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{formatTokens(r.inputTokens)}</td>
                              <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{formatTokens(r.outputTokens)}</td>
                              <td className="px-3 py-2 text-right font-medium text-[var(--oracle-text-2)]">{formatTokens(r.inputTokens + r.outputTokens)}</td>
                              <td className="px-3 py-2 text-right font-mono text-[var(--oracle-text-muted)]">
                                {r.costINR > 0 ? `₹${r.costINR.toFixed(4)}` : 'Free'}
                              </td>
                              <td className="px-3 py-2 text-[var(--oracle-text-muted)]">{r.taskType || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              </motion.div>
            </>
          ) : (
            /* ── Empty State ── */
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="py-16 text-center">
              <div className="mb-4 flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-4xl">📊</span>
              </div>
              <h3 className="mb-2 text-[18px] font-bold text-[var(--oracle-text-1)]">No Usage Data Yet</h3>
              <p className="mb-6 max-w-md mx-auto text-[14px] text-[var(--oracle-text-3)]">
                Start a conversation with ORACLE to generate usage data. Token usage, costs, and provider performance will appear here automatically.
              </p>
              <div className="flex justify-center gap-3">
                <div className="rounded-xl bg-[var(--oracle-surface-2)] px-4 py-3 text-center">
                  <p className="text-[11px] text-[var(--oracle-text-muted)]">Total All Time</p>
                  <p className="text-[16px] font-bold text-[var(--oracle-text-1)]">₹{totalCostINR.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-[var(--oracle-surface-2)] px-4 py-3 text-center">
                  <p className="text-[11px] text-[var(--oracle-text-muted)]">All Requests</p>
                  <p className="text-[16px] font-bold text-[var(--oracle-text-1)]">{usageHistory.length}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Reset Button ── */}
          {hasData && (
            <div className="flex justify-end pb-4">
              <motion.button
                {...buttonTapProps}
                onClick={resetCosts}
                className="rounded-lg border border-[var(--oracle-error)]/30 px-3 py-1.5 text-[11px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10 transition-colors"
              >
                Reset All Costs
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────

function StatCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`oracle-glass rounded-xl p-4 ${accent ? 'ring-1 ring-[var(--oracle-primary)]/20' : ''}`} role="status" aria-label={`${label}: ${value}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className={`text-[20px] font-bold ${accent ? 'oracle-gradient-text' : 'text-[var(--oracle-text-1)]'}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--oracle-text-muted)] font-mono">{sub}</p>
    </div>
  );
}

// ─── Chart Card ───────────────────────

function ChartCard({ title, subtitle, children, ariaLabel }: { title: string; subtitle: string; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <div className="oracle-glass rounded-2xl p-5" role="figure" aria-label={ariaLabel || title}>
      <div className="mb-4">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{title}</h3>
        <p className="text-[11px] text-[var(--oracle-text-muted)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Helpers ──────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
