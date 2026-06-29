// ═══════════════════════════════════════
// ORACLE — Provider Health Dashboard
// Real-time provider status, latency, uptime, and error rates
// ═══════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// ─── Types ────────────────────────────

interface ProviderHealthStats {
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

interface HealthOverview {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  downProviders: number;
  overallUptime: number;
  overallAvgLatency: number;
  totalRequests24h: number;
  providers: ProviderHealthStats[];
}

interface TimelinePoint {
  hour: string;
  requests: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  uptimePct: number;
}

// ─── Provider Display Names ────────────

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
  google: 'Google',
  openrouter: 'OpenRouter',
  together: 'Together',
  cerebras: 'Cerebras',
  mistral: 'Mistral',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
};

const STATUS_COLORS: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
};

// ─── Component ────────────────────────

export default function ProviderHealthDashboard() {
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/health');
      if (res.ok) setOverview(await res.json());
    } catch {
      // Silently fail — will retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTimeline = useCallback(async (providerId: string) => {
    try {
      const res = await fetch(`/api/analytics/health?provider=${providerId}&hours=24`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline || []);
      }
    } catch {
      // Silently fail
    }
  }, []);      // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from API
    fetchOverview();
    if (!autoRefresh) return;

    const interval = setInterval(fetchOverview, 30_000);
    return () => clearInterval(interval);
  }, [fetchOverview, autoRefresh]);      // Fetch timeline when provider selected
  useEffect(() => {
    if (selectedProvider) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load timeline data from API
      fetchTimeline(selectedProvider);
    }
  }, [selectedProvider, fetchTimeline]);

  if (loading) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-zinc-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
            Loading provider health...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!overview) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-6 text-zinc-500">
          No provider health data available yet. Make some AI requests to start tracking.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard
          label="Overall Uptime"
          value={`${overview.overallUptime}%`}
          color={overview.overallUptime >= 95 ? 'text-emerald-400' : overview.overallUptime >= 80 ? 'text-amber-400' : 'text-red-400'}
        />
        <SummaryCard
          label="Avg Latency"
          value={`${overview.overallAvgLatency}ms`}
          color={overview.overallAvgLatency < 1000 ? 'text-emerald-400' : overview.overallAvgLatency < 3000 ? 'text-amber-400' : 'text-red-400'}
        />
        <SummaryCard
          label="Requests (24h)"
          value={overview.totalRequests24h.toLocaleString()}
          color="text-blue-400"
        />
        <SummaryCard
          label="Providers"
          value={`${overview.healthyProviders}/${overview.totalProviders} healthy`}
          color={overview.downProviders === 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* ── Provider Status Grid ── */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-300">Provider Status</CardTitle>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {autoRefresh ? '● Live' : '○ Paused'}
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.providers.map((provider) => (
            <ProviderRow
              key={provider.providerId}
              provider={provider}
              isSelected={selectedProvider === provider.providerId}
              onSelect={() => setSelectedProvider(
                selectedProvider === provider.providerId ? null : provider.providerId
              )}
            />
          ))}
          {overview.providers.length === 0 && (
            <p className="text-sm text-zinc-500">No providers tracked yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Timeline Chart (when provider selected) ── */}
      {selectedProvider && timeline.length > 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">
              {PROVIDER_NAMES[selectedProvider] || selectedProvider} — Last 24h Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimelineChart data={timeline} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-Components ───────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="p-4">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ProviderRow({
  provider,
  isSelected,
  onSelect,
}: {
  provider: ProviderHealthStats;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const name = PROVIDER_NAMES[provider.providerId] || provider.providerId;
  const latencyColor =
    provider.avgLatencyMs < 1000 ? 'text-emerald-400' :
    provider.avgLatencyMs < 3000 ? 'text-amber-400' : 'text-red-400';

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-all ${
        isSelected
          ? 'border-blue-500/50 bg-blue-500/10'
          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[provider.status]}`} />
          <span className="text-sm font-medium text-zinc-200">{name}</span>
          <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
            {STATUS_LABELS[provider.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span>{provider.totalRequests} req</span>
          <span className={latencyColor}>{provider.avgLatencyMs}ms</span>
          <span>{provider.uptimePct}% up</span>
        </div>
      </div>

      {/* Uptime bar */}
      <div className="mt-2">
        <Progress value={provider.uptimePct} className="h-1" />
      </div>

      {/* Expanded details */}
      {isSelected && (
        <div className="mt-3 grid grid-cols-4 gap-3 border-t border-white/5 pt-3 text-xs">
          <div>
            <span className="text-zinc-500">P50 Latency</span>
            <p className="text-zinc-300">{provider.p50LatencyMs}ms</p>
          </div>
          <div>
            <span className="text-zinc-500">P95 Latency</span>
            <p className="text-zinc-300">{provider.p95LatencyMs}ms</p>
          </div>
          <div>
            <span className="text-zinc-500">Avg Tokens</span>
            <p className="text-zinc-300">{provider.avgTokens.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-zinc-500">Errors</span>
            <p className="text-zinc-300">{provider.failedRequests}</p>
          </div>
        </div>
      )}
    </button>
  );
}

function TimelineChart({ data }: { data: TimelinePoint[] }) {
  const maxRequests = Math.max(...data.map((d) => d.requests), 1);

  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {data.map((point) => {
        const height = (point.requests / maxRequests) * 100;
        const failHeight = (point.failures / Math.max(point.requests, 1)) * height;
        const successHeight = height - failHeight;

        return (
          <div
            key={point.hour}
            className="group relative flex-1"
            style={{ height: '100%' }}
          >
            {/* Success portion */}
            <div
              className="absolute bottom-0 w-full rounded-t bg-emerald-500/60 transition-colors group-hover:bg-emerald-500/80"
              style={{ height: `${successHeight}%` }}
            />
            {/* Failure portion */}
            {failHeight > 0 && (
              <div
                className="absolute bottom-0 w-full rounded-t bg-red-500/60 transition-colors group-hover:bg-red-500/80"
                style={{ height: `${failHeight}%` }}
              />
            )}

            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 shadow-lg group-hover:block">
              <div>{point.hour.split('T')[1]}:00</div>
              <div>{point.requests} reqs · {point.avgLatencyMs}ms</div>
              <div>{point.uptimePct}% uptime</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
