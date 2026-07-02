// ═══════════════════════════════════════
// ORACLE — Cost Dashboard
// Server-side cost tracking with daily/monthly breakdowns
// ═══════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchWithTimeout, TIMEOUT_QUICK_MS } from '@/lib/fetch-utils';

// ─── Types ────────────────────────────

interface CostOverview {
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

interface DailyCost {
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

interface ProviderCost {
  providerId: string;
  requestCount: number;
  totalCostUsd: number;
  totalCostInr: number;
  avgLatencyMs: number;
  successRate: number;
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

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10b981',
  anthropic: '#8b5cf6',
  groq: '#f59e0b',
  google: '#3b82f6',
  openrouter: '#ef4444',
  together: '#06b6d4',
  cerebras: '#ec4899',
  mistral: '#f97316',
  cohere: '#14b8a6',
  perplexity: '#6366f1',
};

// ─── Component ────────────────────────

export default function CostDashboard() {
  const [overview, setOverview] = useState<CostOverview | null>(null);
  const [daily, setDaily] = useState<DailyCost[]>([]);
  const [byProvider, setByProvider] = useState<ProviderCost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, dailyRes, providerRes] = await Promise.all([
        fetchWithTimeout('/api/analytics/costs?view=overview', { timeoutMs: TIMEOUT_QUICK_MS }),
        fetchWithTimeout('/api/analytics/costs?view=daily&days=30', { timeoutMs: TIMEOUT_QUICK_MS }),
        fetchWithTimeout('/api/analytics/costs?view=by-provider&days=30', { timeoutMs: TIMEOUT_QUICK_MS }),
      ]);

       
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (dailyRes.ok) {
        const data = await dailyRes.json();
         
        setDaily(data.daily || []);
      }
      if (providerRes.ok) {
        const data = await providerRes.json();
         
        setByProvider(data.byProvider || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const interval = setInterval(fetchData, 60_000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-zinc-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
            Loading cost data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!overview) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-6 text-zinc-500">
          No cost data available yet. Make some AI requests to start tracking costs.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Cost Overview Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <CostCard
          label="Today"
          costUsd={overview.todayCostUsd}
          costInr={overview.todayCostInr}
          requests={overview.todayRequests}
          color="text-emerald-400"
        />
        <CostCard
          label="This Week"
          costUsd={overview.weekCostUsd}
          costInr={overview.weekCostInr}
          requests={overview.weekRequests}
          color="text-blue-400"
        />
        <CostCard
          label="This Month"
          costUsd={overview.monthCostUsd}
          costInr={overview.monthCostInr}
          requests={overview.monthRequests}
          color="text-purple-400"
        />
      </div>

      {/* ── Top Provider & Model ── */}
      {(overview.topProvider !== 'none' || overview.topModel !== 'none') && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex items-center gap-6 p-4">
            {overview.topProvider !== 'none' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Top Provider:</span>
                <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                  {PROVIDER_NAMES[overview.topProvider] || overview.topProvider}
                </Badge>
              </div>
            )}
            {overview.topModel !== 'none' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Top Model:</span>
                <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                  {overview.topModel.split('/').pop()}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Daily Cost Chart ── */}
      {daily.length > 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Daily Cost (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyCostChart data={daily} />
          </CardContent>
        </Card>
      )}

      {/* ── Cost by Provider ── */}
      {byProvider.length > 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Cost by Provider (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byProvider.map((provider) => (
              <ProviderCostRow key={provider.providerId} provider={provider} maxCost={byProvider[0]?.totalCostUsd || 1} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-Components ───────────────────

function CostCard({
  label,
  costUsd,
  costInr,
  requests,
  color,
}: {
  label: string;
  costUsd: number;
  costInr: number;
  requests: number;
  color: string;
}) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="p-4">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>
          ${costUsd.toFixed(4)}
        </p>
        <p className="text-xs text-zinc-500">₹{costInr.toFixed(2)} · {requests} req</p>
      </CardContent>
    </Card>
  );
}

function ProviderCostRow({
  provider,
  maxCost,
}: {
  provider: ProviderCost;
  maxCost: number;
}) {
  const name = PROVIDER_NAMES[provider.providerId] || provider.providerId;
  const color = PROVIDER_COLORS[provider.providerId] || '#6b7280';
  const barWidth = (provider.totalCostUsd / maxCost) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-zinc-300">{name}</span>
          <span className="text-xs text-zinc-500">{provider.requestCount} req</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>${provider.totalCostUsd.toFixed(4)}</span>
          <span>₹{provider.totalCostInr.toFixed(2)}</span>
          <span>{provider.avgLatencyMs}ms</span>
          <span className={provider.successRate >= 95 ? 'text-emerald-400' : provider.successRate >= 80 ? 'text-amber-400' : 'text-red-400'}>
            {provider.successRate}%
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barWidth}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function DailyCostChart({ data }: { data: DailyCost[] }) {
  // Aggregate by day
  const dayMap = new Map<string, number>();
  for (const d of data) {
    dayMap.set(d.day, (dayMap.get(d.day) || 0) + d.totalCostUsd);
  }
  const days = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const maxCost = Math.max(...days.map(([, c]) => c), 0.0001);

  return (
    <div className="flex items-end gap-0.5" style={{ height: 140 }}>
      {days.map(([day, cost]) => {
        const height = (cost / maxCost) * 100;
        return (
          <div key={day} className="group relative flex-1" style={{ height: '100%' }}>
            <div
              className="absolute bottom-0 w-full rounded-t bg-gradient-to-t from-blue-600/60 to-blue-400/40 transition-colors group-hover:from-blue-600/80 group-hover:to-blue-400/60"
              style={{ height: `${Math.max(height, 2)}%` }}
            />
            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 shadow-lg group-hover:block">
              <div>{day}</div>
              <div>${cost.toFixed(4)} · ₹{(cost * 84).toFixed(2)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
