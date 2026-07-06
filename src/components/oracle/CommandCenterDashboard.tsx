'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { loadQualityScores, analyzeQualityScores } from '@/lib/quality';
import { getProviderHealthRecords, getProviderHealthStats } from '@/lib/provider-health';
import { getProgressTasks } from '@/lib/progress-tracker';
import { getTrainingSummary } from '@/lib/self-training';
import { isEmergencyStopActive } from '@/lib/emergency-stop';
import { getPaymentRecords } from '@/lib/razorpay';

// ─── Types ────────────────────────────

interface DashboardMetrics {
  revenue: { total: number; pending: number; collected: number; recentPayments: number };
  quality: { averageScore: number; trend: 'up' | 'down' | 'stable'; totalScored: number };
  agents: { healthy: number; degraded: number; down: number; total: number };
  tasks: { total: number; inProgress: number; completed: number; paused: number };
  training: { totalTasks: number; successRate: number; avgQuality: number };
  systemHealth: { emergencyStop: boolean; uptime: string };
}

type TimeRange = '24h' | '7d' | '30d' | 'all';

// ─── Helpers ──────────────────────────

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function getTimeRangeMs(range: TimeRange): number {
  switch (range) {
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    case 'all': return Infinity;
  }
}

function getUptime(): string {
  if (typeof window !== 'undefined') {
    const elapsed = performance.now();
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
  return 'Active';
}

// ─── Sub-Components ───────────────────

function MetricCard({
  title, value, subtitle, icon, trend, color = 'text-zinc-100',
}: {
  title: string; value: string | number; subtitle?: string; icon: string;
  trend?: 'up' | 'down' | 'stable'; color?: string;
}) {
  const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
  return (
    <Card className="border-white/10 bg-white/5 hover:bg-white/8 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
          </div>
          <div className="text-right">
            <span className="text-lg">{icon}</span>
            {trend && <span className="text-xs ml-1">{trendIcon}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthBadge({ status }: { status: 'healthy' | 'degraded' | 'down' }) {
  const config = {
    healthy: { label: 'Healthy', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    degraded: { label: 'Degraded', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    down: { label: 'Down', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  };
  const { label, color } = config[status];
  return <Badge className={`text-[10px] ${color}`}>{label}</Badge>;
}

function StatusRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-medium text-zinc-300">{count}</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = 'bg-indigo-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function AgentHealthCard({ agents }: { agents: DashboardMetrics['agents'] }) {
  const statuses: Array<{ label: string; count: number; color: string }> = [
    { label: 'Healthy', count: agents.healthy, color: 'bg-emerald-500' },
    { label: 'Degraded', count: agents.degraded, color: 'bg-amber-500' },
    { label: 'Down', count: agents.down, color: 'bg-red-500' },
  ];
  const overallStatus = agents.down > 0 ? 'down' : agents.degraded > 0 ? 'degraded' : 'healthy';

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          🤖 Agent Health
          <HealthBadge status={overallStatus} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {statuses.map((s) => (
            <StatusRow key={s.label} label={s.label} count={s.count} color={s.color} />
          ))}
        </div>
        <div className="mt-3">
          <ProgressBar value={agents.healthy} max={agents.total} color="bg-emerald-500" />
          <p className="text-[10px] text-zinc-600 mt-1">{agents.healthy}/{agents.total} agents operational</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingCard({ training }: { training: DashboardMetrics['training'] }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">🧠 Self-Training</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-zinc-500">Tasks Trained</span>
            <span className="text-sm font-medium text-zinc-300">{training.totalTasks}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-zinc-500">Success Rate</span>
            <span className="text-sm font-medium text-emerald-400">{training.successRate}%</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-zinc-500">Avg Quality</span>
            <span className="text-sm font-medium text-amber-400">{training.avgQuality}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueCard({ revenue }: { revenue: DashboardMetrics['revenue'] }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">💰 Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-zinc-500">Total</span>
            <span className="text-lg font-bold text-emerald-400">{formatINR(revenue.total)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-zinc-500">Collected</span>
            <span className="text-sm font-medium text-zinc-300">{formatINR(revenue.collected)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-zinc-500">Pending</span>
            <span className="text-sm font-medium text-amber-400">{formatINR(revenue.pending)}</span>
          </div>
          <ProgressBar value={revenue.collected} max={Math.max(revenue.total, 1)} color="bg-emerald-500" />
        </div>
      </CardContent>
    </Card>
  );
}

function QualityCard({ quality }: { quality: DashboardMetrics['quality'] }) {
  const scoreColor = quality.averageScore >= 80 ? 'text-emerald-400' : quality.averageScore >= 60 ? 'text-amber-400' : 'text-red-400';
  const trendIcon = quality.trend === 'up' ? '📈' : quality.trend === 'down' ? '📉' : '➡️';
  const barColor = quality.averageScore >= 80 ? 'bg-emerald-500' : quality.averageScore >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">✅ Quality Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${scoreColor}`}>{quality.averageScore}%</span>
          <span className="text-sm">{trendIcon}</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={quality.averageScore} max={100} color={barColor} />
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">{quality.totalScored} responses scored</p>
      </CardContent>
    </Card>
  );
}

function TaskStatusCard({ tasks }: { tasks: DashboardMetrics['tasks'] }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">📋 Active Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-zinc-100">{tasks.inProgress}</p>
            <p className="text-[10px] text-zinc-500">In Progress</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-emerald-400">{tasks.completed}</p>
            <p className="text-[10px] text-zinc-500">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-amber-400">{tasks.paused}</p>
            <p className="text-[10px] text-zinc-500">Paused</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-zinc-400">{tasks.total}</p>
            <p className="text-[10px] text-zinc-500">Total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemHealthCard({ system }: { system: DashboardMetrics['systemHealth'] }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">🏥 System Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Emergency Stop</span>
            <Badge className={system.emergencyStop ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}>
              {system.emergencyStop ? '🔴 Active' : '🟢 Inactive'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Uptime</span>
            <span className="text-xs text-zinc-300">{system.uptime}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────

export function CommandCenterDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = Date.now();
      const rangeMs = getTimeRangeMs(timeRange);
      const cutoff = now - rangeMs;

      // ── Quality scores (localStorage) ──
      const allScores = loadQualityScores();
      const filteredScores = timeRange === 'all' ? allScores : allScores.filter((s) => s.scoredAt >= cutoff);
      const qualityAnalysis = analyzeQualityScores(filteredScores);

      // ── Provider health (localStorage) ──
      const healthRecords = getProviderHealthRecords();
      const providerStats = getProviderHealthStats(healthRecords, timeRange === 'all' ? Infinity : rangeMs);
      let healthyCount = 0;
      let degradedCount = 0;
      let downCount = 0;
      for (const stat of providerStats) {
        if (stat.status === 'healthy') healthyCount++;
        else if (stat.status === 'degraded') degradedCount++;
        else if (stat.status === 'down') downCount++;
      }
      const totalProviders = providerStats.length || 1;

      // ── Progress tasks (localStorage) ──
      const allTasks = getProgressTasks();
      const filteredTasks = timeRange === 'all' ? allTasks : allTasks.filter((t) => t.createdAt >= cutoff);
      const inProgressTasks = filteredTasks.filter((t) => t.status === 'in-progress').length;
      const completedTasks = filteredTasks.filter((t) => t.status === 'completed').length;
      const pausedTasks = filteredTasks.filter((t) => t.status === 'paused').length;

      // ── Training summary (localStorage) ──
      const trainingSummary = getTrainingSummary();

      // ── Emergency stop ──
      const emergencyStopActive = isEmergencyStopActive();

      // ── Revenue (localStorage) ──
      const payments = getPaymentRecords();
      const filteredPayments = timeRange === 'all' ? payments : payments.filter((p) => p.createdAt >= cutoff);
      const totalRevenue = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const collectedRevenue = filteredPayments.filter((p) => p.status === 'captured').reduce((sum, p) => sum + (p.amount || 0), 0);
      const pendingRevenue = totalRevenue - collectedRevenue;      setMetrics({
        revenue: {
          total: totalRevenue,
          pending: pendingRevenue,
          collected: collectedRevenue,
          recentPayments: filteredPayments.length,
        },
        quality: {
          averageScore: qualityAnalysis.averageScore,
          trend: qualityAnalysis.trend === 'improving' ? 'up' : qualityAnalysis.trend === 'declining' ? 'down' : 'stable',
          totalScored: qualityAnalysis.totalScored,
        },
        agents: {
          healthy: healthyCount,
          degraded: degradedCount,
          down: downCount,
          total: totalProviders,
        },
        tasks: {
          total: filteredTasks.length,
          inProgress: inProgressTasks,
          completed: completedTasks,
          paused: pausedTasks,
        },
        training: {
          totalTasks: trainingSummary.totalTasks,
          successRate: trainingSummary.successRate,
          avgQuality: trainingSummary.avgQuality,
        },
        systemHealth: {
          emergencyStop: emergencyStopActive,
          uptime: getUptime(),
        },
      });

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadMetrics, 60_000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  if (loading && !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="border-red-500/20 bg-red-500/5 max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-red-400 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={loadMetrics}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              🏢 Agency Command Center
            </h2>
            <p className="text-sm text-zinc-500">
              Real-time overview of your agency operations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
              {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                    timeRange === range
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={loadMetrics} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* ── Top Row: Key Metrics ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title="Active Tasks"
            value={metrics.tasks.inProgress}
            subtitle={`${metrics.tasks.total} total`}
            icon="📋"
            color="text-indigo-400"
          />
          <MetricCard
            title="Training Tasks"
            value={metrics.training.totalTasks}
            subtitle={`${metrics.training.successRate}% success rate`}
            icon="🧠"
            color="text-cyan-400"
          />
          <MetricCard
            title="Revenue"
            value={formatINR(metrics.revenue.total)}
            subtitle={`${metrics.revenue.recentPayments} payments`}
            icon="💰"
            trend={metrics.revenue.collected > metrics.revenue.pending ? 'up' : 'stable'}
            color="text-emerald-400"
          />
          <MetricCard
            title="Quality Score"
            value={`${metrics.quality.averageScore}%`}
            subtitle={`${metrics.quality.totalScored} scored`}
            icon="✅"
            trend={metrics.quality.trend}
            color={metrics.quality.averageScore >= 80 ? 'text-emerald-400' : metrics.quality.averageScore >= 60 ? 'text-amber-400' : 'text-red-400'}
          />
        </div>

        {/* ── Middle Row: Detailed Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AgentHealthCard agents={metrics.agents} />
          <TrainingCard training={metrics.training} />
          <RevenueCard revenue={metrics.revenue} />
        </div>

        {/* ── Bottom Row: Status Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QualityCard quality={metrics.quality} />
          <TaskStatusCard tasks={metrics.tasks} />
          <SystemHealthCard system={metrics.systemHealth} />
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-4">
          <p className="text-[10px] text-zinc-600">
            Last refreshed: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 60s
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
