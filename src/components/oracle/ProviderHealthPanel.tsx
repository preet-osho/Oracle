'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {motionVariants, transitions} from '@/styles/design-tokens';
import { getProviderHealthStats, getOverallHealth, getProviderHealthRecords, type ProviderHealthStats } from '@/lib/provider-health';
import { PROVIDERS } from '@/data/providers';

// ─── Provider Health Panel ─────────────

export function ProviderHealthPanel() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  const records = getProviderHealthRecords();
  const timeRangeMs = timeRange === '24h' ? 24 * 60 * 60 * 1000
    : timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000
    : timeRange === '30d' ? 30 * 24 * 60 * 60 * 1000
    : Infinity;

  const stats = useMemo(() => getProviderHealthStats(records, timeRangeMs), [records, timeRangeMs]);
  const overall = useMemo(() => getOverallHealth(records), [records]);

  return (
    <div className="space-y-4">
      {/* Overall Health Summary */}
      <div className="oracle-glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">🏥 Provider Health Overview</h3>
          <div className="flex gap-1">
            {(['24h', '7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                  timeRange === range
                    ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]'
                    : 'text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-3)]'
                }`}
              >
                {range === '24h' ? '24h' : range === '7d' ? '7d' : range === '30d' ? '30d' : 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Total Requests" value={String(overall.totalRequests)} icon="📨" />
          <MiniStat label="Error Rate" value={`${overall.overallErrorRate}%`} icon="⚠️" color={overall.overallErrorRate < 5 ? 'success' : overall.overallErrorRate < 20 ? 'warning' : 'error'} />
          <MiniStat label="Avg Latency" value={`${overall.overallAvgLatency}ms`} icon="⚡" color={overall.overallAvgLatency < 1000 ? 'success' : overall.overallAvgLatency < 3000 ? 'warning' : 'error'} />
          <MiniStat label="Healthy Providers" value={`${overall.healthyProviders}/${overall.totalProviders}`} icon="✅" color={overall.healthyProviders === overall.totalProviders ? 'success' : 'warning'} />
        </div>
      </div>

      {/* Per-Provider Stats */}
      {stats.length === 0 ? (
        <div className="oracle-glass rounded-xl p-8 text-center">
          <span className="text-3xl">🏥</span>
          <p className="mt-2 text-[14px] text-[var(--oracle-text-3)]">No provider health data yet</p>
          <p className="text-[12px] text-[var(--oracle-text-muted)]">Make API requests to start tracking provider health</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((stat) => (
            <ProviderCard key={stat.providerId} stats={stat} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Provider Card ─────────────────────

function ProviderCard({ stats }: { stats: ProviderHealthStats }) {
  const provider = PROVIDERS.find((p) => p.id === stats.providerId);
  const statusColor = stats.status === 'healthy' ? 'var(--oracle-success)'
    : stats.status === 'degraded' ? 'var(--oracle-warning)'
    : stats.status === 'down' ? 'var(--oracle-error)'
    : 'var(--oracle-text-muted)';
  const statusLabel = stats.status === 'healthy' ? 'Healthy'
    : stats.status === 'degraded' ? 'Degraded'
    : stats.status === 'down' ? 'Down'
    : 'Unknown';

  return (
    <motion.div
      variants={motionVariants.fadeUp}
      initial="initial"
      animate="animate"
      transition={transitions.smooth}
      className="oracle-glass rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${provider?.color || '#6366f1'}20` }}>
            <span className="text-[11px] font-bold" style={{ color: provider?.color || '#6366f1' }}>
              {provider?.name.charAt(0) || stats.providerId.charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{provider?.name || stats.providerId}</p>
            <p className="text-[10px] text-[var(--oracle-text-muted)]">{stats.totalRequests} requests</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
          <span className="text-[11px] font-medium" style={{ color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Uptime" value={`${stats.uptime}%`} icon="📊" color={stats.uptime >= 99 ? 'success' : stats.uptime >= 90 ? 'warning' : 'error'} />
        <MiniStat label="Avg Latency" value={`${stats.avgLatencyMs}ms`} icon="⚡" />
        <MiniStat label="P95 Latency" value={`${stats.p95LatencyMs}ms`} icon="📈" />
        <MiniStat label="Errors" value={`${stats.errorRate}%`} icon="❌" color={stats.errorRate < 5 ? 'success' : stats.errorRate < 20 ? 'warning' : 'error'} />
      </div>

      {/* Uptime Bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-[var(--oracle-text-muted)] mb-1">
          <span>Success Rate</span>
          <span>{stats.uptime}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${stats.uptime}%`, backgroundColor: statusColor }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Mini Stat ─────────────────────────

function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: string; color?: 'success' | 'warning' | 'error' }) {
  const textColor = color === 'success' ? 'text-[var(--oracle-success)]'
    : color === 'warning' ? 'text-[var(--oracle-warning)]'
    : color === 'error' ? 'text-[var(--oracle-error)]'
    : 'text-[var(--oracle-text-1)]';

  return (
    <div className="rounded-lg bg-[var(--oracle-surface-2)]/60 px-2.5 py-2">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px]">{icon}</span>
        <span className="text-[10px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className={`text-[13px] font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
