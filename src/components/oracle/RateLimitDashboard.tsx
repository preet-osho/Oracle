'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { motionVariants, transitions } from '@/styles/design-tokens';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────

interface RateLimitSummary {
  totalBlocked: number;
  totalWarnings: number;
  uniqueUsers: number;
}

interface TopUser {
  userId: string;
  blockedCount: number;
  endpointsAffected: number;
  lastBlocked: string;
}

interface EndpointStat {
  endpoint: string;
  blocked: number;
  warnings: number;
  total: number;
}

interface HourlyBucket {
  hour: string;
  blocked: number;
  warning: number;
}

interface UserEvent {
  action: string;
  endpoint: string;
  remaining: number | null;
  timestamp: string;
}

interface UserDrilldownData {
  userId: string;
  range: string;
  events: UserEvent[];
  totalEvents: number;
}

interface AnalyticsData {
  range: string;
  summary: RateLimitSummary;
  topUsers: TopUser[];
  endpointSummary: EndpointStat[];
  hourlyDistribution: HourlyBucket[];
}

// ─── CSV Export Helpers ────────────────

function escapeCsv(val: string | number | null): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportDashboardCsv(data: AnalyticsData): void {
  const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  downloadCsv(`rate-limit-summary-${ts}.csv`, [
    ['Metric', 'Value'],
    ['Time Range', data.range],
    ['Total Blocked', String(data.summary.totalBlocked)],
    ['Total Warnings', String(data.summary.totalWarnings)],
    ['Unique Users', String(data.summary.uniqueUsers)],
  ]);
  setTimeout(() => {
    downloadCsv(`rate-limit-top-users-${ts}.csv`, [
      ['User ID', 'Blocked Count', 'Endpoints Affected', 'Last Blocked'],
      ...data.topUsers.map((u) => [u.userId, String(u.blockedCount), String(u.endpointsAffected), u.lastBlocked]),
    ]);
  }, 200);
  setTimeout(() => {
    downloadCsv(`rate-limit-endpoints-${ts}.csv`, [
      ['Endpoint', 'Blocked', 'Warnings', 'Total'],
      ...data.endpointSummary.map((e) => [e.endpoint, String(e.blocked), String(e.warnings), String(e.total)]),
    ]);
  }, 400);
  setTimeout(() => {
    downloadCsv(`rate-limit-hourly-${ts}.csv`, [
      ['Hour', 'Blocked', 'Warnings'],
      ...data.hourlyDistribution.map((h) => [h.hour, String(h.blocked), String(h.warning)]),
    ]);
  }, 600);
}

function exportUserEventsCsv(drilldown: UserDrilldownData): void {
  const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  downloadCsv(`rate-limit-user-${drilldown.userId.slice(0, 8)}-${ts}.csv`, [
    ['User ID', 'Timestamp', 'Type', 'Endpoint', 'Remaining'],
    ...drilldown.events.map((e) => [
      drilldown.userId,
      e.timestamp,
      e.action === 'security.rate_limit_exceeded' ? 'blocked' : 'warning',
      e.endpoint,
      String(e.remaining ?? ''),
    ]),
  ]);
}

// ─── Main Component ────────────────────

export function RateLimitDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const consecutiveFailures = useRef(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDrilldown, setUserDrilldown] = useState<UserDrilldownData | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const fetchUserDrilldown = useCallback(async (uid: string) => {
    setDrilldownLoading(true);
    try {
      const res = await fetch(`/api/analytics/rate-limits?range=${range}&userId=${uid}`);
      if (!res.ok) throw new Error('Failed to load user events');
      setUserDrilldown(await res.json());
    } catch {
      toast.error('Failed to load user events', { duration: 3000 });
    } finally {
      setDrilldownLoading(false);
    }
  }, [range]);

  const handleUserClick = useCallback((uid: string) => {
    setSelectedUserId(uid);
    fetchUserDrilldown(uid);
  }, [fetchUserDrilldown]);

  const fetchData = useCallback(async (isPoll = false) => {
    if (isPoll) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/analytics/rate-limits?range=${range}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
      setLastUpdated(new Date());
      consecutiveFailures.current = 0;
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics';
      consecutiveFailures.current++;
      if (!isPoll) {
        // Initial load failure: always show inline error
        setError(msg);
      } else if (consecutiveFailures.current >= 2) {
        // Persistent poll failure: show inline error after 2 consecutive failures
        setError(`Connection lost — last successful update was ${lastUpdated ? lastUpdated.toLocaleTimeString() : 'unknown'}`);
      } else {
        // Transient poll failure: show toast, keep existing data visible
        toast.error(`Refresh failed: ${msg}`, { duration: 3000 });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [range, lastUpdated]);

  // Initial fetch
  useEffect(() => { fetchData(false); }, [fetchData]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;
    const ms = refreshInterval * 1000;
    const id = setInterval(() => fetchData(true), ms);
    return () => clearInterval(id);
  }, [autoRefresh, refreshInterval, fetchData]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-bold text-[var(--oracle-text-1)]">
                🛡️ Rate Limit Analytics
              </h1>
              <p className="text-[13px] text-[var(--oracle-text-muted)] mt-1">
                Abuse pattern monitoring from audit_logs
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Live indicator + last updated */}
              <div className="flex items-center gap-2 text-[11px] text-[var(--oracle-text-muted)]">
                <span className="relative flex h-2 w-2">
                  {autoRefresh && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--oracle-success)] opacity-75" />
                  )}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${autoRefresh ? 'bg-[var(--oracle-success)]' : 'bg-[var(--oracle-text-muted)]'}`} />
                </span>
                {autoRefresh && lastUpdated && (
                  <span className="font-mono">
                    {isRefreshing ? 'updating…' : `Updated ${lastUpdated.toLocaleTimeString()}`}
                  </span>
                )}
              </div>

              {/* Refresh interval selector */}
              {autoRefresh && (
                <div className="flex gap-0.5 rounded-md border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)] p-0.5">
                  {[15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setRefreshInterval(sec)}
                      className={`rounded px-2 py-1 text-[10px] font-mono transition-colors ${
                        refreshInterval === sec
                          ? 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-1)]'
                          : 'text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-3)]'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              )}

              {/* Auto-refresh toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  autoRefresh
                    ? 'border-[var(--oracle-success)]/30 bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]'
                    : 'border-[var(--oracle-border)] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-2)]'
                }`}
              >
                {autoRefresh ? '⏸ Pause' : '▶ Live'}
              </button>

              {/* Rate Limit Config */}
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  configOpen
                    ? 'border-[var(--oracle-primary)]/30 bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]'
                    : 'border-[var(--oracle-border)] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-2)] hover:bg-[var(--oracle-surface-2)]'
                }`}
              >
                ⚙ Limits
              </button>

              {/* Export CSV */}
              {data && (
                <button
                  onClick={() => {
                    exportDashboardCsv(data);
                    toast.success('CSV files exported', { duration: 2000 });
                  }}
                  className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-2)] hover:bg-[var(--oracle-surface-2)] transition-colors"
                >
                  📥 Export CSV
                </button>
              )}

              {/* Time range selector */}
              <div className="flex gap-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)] p-0.5">
                {(['1h', '24h', '7d'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      range === r
                        ? 'bg-[var(--oracle-primary)] text-white'
                        : 'text-[var(--oracle-text-3)] hover:text-[var(--oracle-text-2)] hover:bg-[var(--oracle-surface-2)]'
                    }`}
                  >
                    {r === '1h' ? '1 Hour' : r === '24h' ? '24 Hours' : '7 Days'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading / Error */}
          {loading && <LoadingSkeleton />}
          {error && (
            <div className="rounded-xl border border-[var(--oracle-error)]/30 bg-[var(--oracle-error)]/10 px-4 py-3 text-[13px] text-[var(--oracle-error)]">
              ⚠️ {error}
            </div>
          )}

          {/* Content */}
          {data && !loading && (
            <motion.div
              variants={motionVariants.fadeUp}
              initial="initial"
              animate="animate"
              className={`space-y-6 transition-opacity duration-300 ${isRefreshing ? 'opacity-60' : 'opacity-100'}`}
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <SummaryCard
                  label="Blocked Requests"
                  value={data.summary.totalBlocked}
                  icon="🚫"
                  color="var(--oracle-error)"
                />
                <SummaryCard
                  label="Near-Limit Warnings"
                  value={data.summary.totalWarnings}
                  icon="⚠️"
                  color="var(--oracle-warning)"
                />
                <SummaryCard
                  label="Unique Users Affected"
                  value={data.summary.uniqueUsers}
                  icon="👤"
                  color="var(--oracle-primary-l)"
                />
              </div>

              {/* Hourly Distribution Chart */}
              {data.hourlyDistribution.length > 0 && (
                <div className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/50 p-5">
                  <h2 className="text-[14px] font-semibold text-[var(--oracle-text-1)] mb-4">
                    📈 Hourly Distribution (Last 7 Days)
                  </h2>
                  <HourlyChart data={data.hourlyDistribution} />
                </div>
              )}

              {/* Endpoint Summary */}
              {data.endpointSummary.length > 0 && (
                <div className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/50 p-5">
                  <h2 className="text-[14px] font-semibold text-[var(--oracle-text-1)] mb-4">
                    🔌 Abuse by Endpoint
                  </h2>
                  <div className="space-y-3">
                    {data.endpointSummary.map((ep) => (
                      <EndpointRow key={ep.endpoint} stat={ep} maxTotal={Math.max(...data.endpointSummary.map(e => e.total))} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top Blocked Users */}
              {data.topUsers.length > 0 && (
                <div className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/50 p-5">
                  <h2 className="text-[14px] font-semibold text-[var(--oracle-text-1)] mb-4">
                    🚨 Top Blocked Users
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--oracle-border)]">
                          <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-2)]">User ID</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-2)]">Blocked</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-2)]">Endpoints</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-2)]">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topUsers.map((user) => (
                          <tr
                            key={user.userId}
                            className="border-b border-[var(--oracle-border)]/50 hover:bg-[var(--oracle-surface-2)]/30 transition-colors cursor-pointer"
                            onClick={() => handleUserClick(user.userId)}
                          >
                            <td className="px-3 py-2.5 font-mono text-[var(--oracle-text-2)] hover:text-[var(--oracle-primary-l)]">
                              {user.userId.slice(0, 8)}…
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  user.blockedCount >= 10
                                    ? 'bg-[var(--oracle-error)]/20 text-[var(--oracle-error)]'
                                    : 'bg-[var(--oracle-warning)]/20 text-[var(--oracle-warning)]'
                                }`}
                              >
                                {user.blockedCount}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-[var(--oracle-text-3)]">
                              {user.endpointsAffected}
                            </td>
                            <td className="px-3 py-2.5 text-right text-[var(--oracle-text-muted)]">
                              {new Date(user.lastBlocked).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* User Drill-down Panel */}
              {selectedUserId && (
                <UserDrilldownPanel
                  key={selectedUserId}
                  userId={selectedUserId}
                  data={userDrilldown}
                  loading={drilldownLoading}
                  onClose={() => { setSelectedUserId(null); setUserDrilldown(null); }}
                />
              )}

              {/* Rate Limit Configuration Panel */}
              {configOpen && (
                <RateLimitConfigPanel onClose={() => setConfigOpen(false)} />
              )}

              {/* Empty State */}
              {data.summary.totalBlocked === 0 && data.summary.totalWarnings === 0 && (
                <div className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/30 p-12 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-[15px] font-semibold text-[var(--oracle-text-1)]">No Rate Limit Events</p>
                  <p className="text-[12px] text-[var(--oracle-text-muted)] mt-1">
                    No blocked requests or warnings in the selected time range.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/50 px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[18px]">{icon}</span>
        <span className="text-[11px] font-medium text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className="text-[28px] font-bold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}

function HourlyChart({ data }: { data: HourlyBucket[] }) {
  const maxVal = Math.max(...data.map((d) => d.blocked + d.warning), 1);
  const chartHeight = 120;

  // Show last 48 buckets max for readability
  const displayData = data.length > 48 ? data.slice(-48) : data;

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: chartHeight }}>
        {displayData.map((d, i) => {
          const total = d.blocked + d.warning;
          const blockedH = maxVal > 0 ? (d.blocked / maxVal) * (chartHeight - 20) : 0;
          const warningH = maxVal > 0 ? (d.warning / maxVal) * (chartHeight - 20) : 0;
          return (
            <div
              key={i}
              className="group relative flex-1 min-w-[3px] flex flex-col justify-end"
              title={`${d.hour}\nBlocked: ${d.blocked}\nWarnings: ${d.warning}`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-1 text-[10px] whitespace-nowrap shadow-lg">
                  <div className="font-mono text-[var(--oracle-text-2)]">{d.hour.slice(5, 13)}</div>
                  <div className="text-[var(--oracle-error)]">🚫 {d.blocked}</div>
                  <div className="text-[var(--oracle-warning)]">⚠️ {d.warning}</div>
                </div>
              </div>
              {/* Warning segment */}
              {warningH > 0 && (
                <div
                  className="w-full rounded-t-sm bg-[var(--oracle-warning)]/70"
                  style={{ height: warningH }}
                />
              )}
              {/* Blocked segment */}
              {blockedH > 0 && (
                <div
                  className="w-full bg-[var(--oracle-error)]/80"
                  style={{ height: blockedH, borderRadius: warningH > 0 ? '0' : '2px 2px 0 0' }}
                />
              )}
              {/* Empty placeholder */}
              {total === 0 && (
                <div className="w-full h-[1px] bg-[var(--oracle-border)]" />
              )}
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex justify-between mt-2">
        <span className="text-[9px] text-[var(--oracle-text-muted)] font-mono">
          {displayData[0]?.hour?.slice(5, 13) || ''}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-[var(--oracle-text-muted)]">
            <span className="inline-block h-2 w-2 rounded-sm bg-[var(--oracle-error)]/80" /> Blocked
          </span>
          <span className="flex items-center gap-1 text-[9px] text-[var(--oracle-text-muted)]">
            <span className="inline-block h-2 w-2 rounded-sm bg-[var(--oracle-warning)]/70" /> Warnings
          </span>
        </div>
        <span className="text-[9px] text-[var(--oracle-text-muted)] font-mono">
          {displayData[displayData.length - 1]?.hour?.slice(5, 13) || ''}
        </span>
      </div>
    </div>
  );
}

function EndpointRow({ stat, maxTotal }: { stat: EndpointStat; maxTotal: number }) {
  const pct = maxTotal > 0 ? (stat.total / maxTotal) * 100 : 0;
  const blockedPct = stat.total > 0 ? (stat.blocked / stat.total) * 100 : 0;

  const endpointLabels: Record<string, { label: string; emoji: string }> = {
    ai_chat: { label: 'AI Chat', emoji: '🤖' },
    web_search: { label: 'Web Search', emoji: '🔍' },
  };

  const info = endpointLabels[stat.endpoint] || { label: stat.endpoint, emoji: '📡' };

  return (
    <div className="flex items-center gap-3">
      <span className="text-[14px]">{info.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium text-[var(--oracle-text-1)]">{info.label}</span>
          <span className="text-[11px] text-[var(--oracle-text-muted)] font-mono">
            {stat.blocked} blocked · {stat.warnings} warnings
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden flex">
          <div
            className="h-full bg-[var(--oracle-error)]/80 transition-all"
            style={{ width: `${pct * (blockedPct / 100)}%` }}
          />
          <div
            className="h-full bg-[var(--oracle-warning)]/60 transition-all"
            style={{ width: `${pct * ((100 - blockedPct) / 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function UserDrilldownPanel({ userId, data, loading, onClose }: { userId: string; data: UserDrilldownData | null; loading: boolean; onClose: () => void }) {
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const endpointLabels: Record<string, { label: string; emoji: string }> = {
    ai_chat: { label: 'AI Chat', emoji: '🤖' },
    web_search: { label: 'Web Search', emoji: '🔍' },
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/analytics/rate-limits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Reset failed');
      const result = await res.json();
      toast.success(`Cleared ${result.deletedKeys} rate limit key(s) for this user`, { duration: 4000 });
      setConfirmReset(false);
    } catch {
      toast.error('Failed to reset rate limits', { duration: 3000 });
    } finally {
      setResetting(false);
    }
  };

  const cancelReset = () => setConfirmReset(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-xl border border-[var(--oracle-primary)]/30 bg-[var(--oracle-surface-1)]/50 p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--oracle-text-1)]">
            👤 User Drill-down
          </h2>
          <p className="text-[11px] text-[var(--oracle-text-muted)] font-mono mt-0.5">
            {userId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confirmReset ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--oracle-error)]/40 bg-[var(--oracle-error)]/10 px-3 py-1.5">
              <span className="text-[11px] text-[var(--oracle-error)] font-medium">
                ⚠️ Confirm reset?
              </span>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="rounded px-2 py-0.5 text-[11px] font-semibold bg-[var(--oracle-error)] text-white hover:bg-[var(--oracle-error)]/80 transition-colors disabled:opacity-50"
              >
                {resetting ? '⏳…' : 'Yes, Reset'}
              </button>
              <button
                onClick={cancelReset}
                disabled={resetting}
                className="rounded px-2 py-0.5 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleReset}
              disabled={resetting}
              className="rounded-lg border border-[var(--oracle-error)]/30 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🔓 Reset Limits
            </button>
          )}
          {data && data.events.length > 0 && (
            <button
              onClick={() => {
                exportUserEventsCsv(data);
                toast.success('User events CSV exported', { duration: 2000 });
              }}
              className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-2)] hover:bg-[var(--oracle-surface-2)] transition-colors"
            >
              📥 Export
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-[var(--oracle-surface-2)] animate-pulse" />
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && data && (
        <>
          <div className="flex gap-4 mb-4">
            <div className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/30 px-3 py-2">
              <p className="text-[10px] text-[var(--oracle-text-muted)]">Total Events</p>
              <p className="text-[18px] font-bold font-mono text-[var(--oracle-text-1)]">{data.totalEvents}</p>
            </div>
            <div className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/30 px-3 py-2">
              <p className="text-[10px] text-[var(--oracle-text-muted)]">Blocked</p>
              <p className="text-[18px] font-bold font-mono text-[var(--oracle-error)]">
                {data.events.filter((e) => e.action === 'security.rate_limit_exceeded').length}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/30 px-3 py-2">
              <p className="text-[10px] text-[var(--oracle-text-muted)]">Warnings</p>
              <p className="text-[18px] font-bold font-mono text-[var(--oracle-warning)]">
                {data.events.filter((e) => e.action === 'security.rate_limit_warning').length}
              </p>
            </div>
          </div>

          {/* Event Timeline */}
          {data.events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--oracle-border)]">
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--oracle-text-2)]">Time</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--oracle-text-2)]">Type</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--oracle-text-2)]">Endpoint</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-[var(--oracle-text-2)]">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event, i) => {
                    const ep = endpointLabels[event.endpoint] || { label: event.endpoint, emoji: '📡' };
                    const isBlocked = event.action === 'security.rate_limit_exceeded';
                    return (
                      <tr key={i} className="border-b border-[var(--oracle-border)]/30 hover:bg-[var(--oracle-surface-2)]/20 transition-colors">
                        <td className="px-2 py-2 font-mono text-[var(--oracle-text-muted)] whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleString()}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isBlocked
                              ? 'bg-[var(--oracle-error)]/20 text-[var(--oracle-error)]'
                              : 'bg-[var(--oracle-warning)]/20 text-[var(--oracle-warning)]'
                          }`}>
                            {isBlocked ? '🚫 Blocked' : '⚠️ Warning'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-[var(--oracle-text-2)]">
                          {ep.emoji} {ep.label}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--oracle-text-muted)]">
                          {event.remaining !== null ? event.remaining : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--oracle-text-muted)] text-center py-4">No events found for this user.</p>
          )}
        </>
      )}
    </motion.div>
  );
}

function RateLimitConfigPanel({ onClose }: { onClose: () => void }) {
  const [configs, setConfigs] = useState<Array<{ id: string; endpoint: string; max_requests: number; window_seconds: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { maxRequests: number; windowSeconds: number }>>({});
  const [redisConfigured, setRedisConfigured] = useState<boolean | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Array<{ userId: string; endpoint: string; changes: Record<string, unknown>; timestamp: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const endpointLabels: Record<string, { label: string; emoji: string }> = {
    ai_chat: { label: 'AI Chat', emoji: '🤖' },
    web_search: { label: 'Web Search', emoji: '🔍' },
    api_write: { label: 'API Write (POST/PUT)', emoji: '✏️' },
    api_read: { label: 'API Read (GET)', emoji: '📖' },
  };

  useEffect(() => {
    fetch('/api/admin/rate-limit-config')
      .then((r) => r.json())
      .then((d) => {
        setConfigs(d.configs || []);
        setRedisConfigured(d.redisConfigured ?? false);
        const vals: Record<string, { maxRequests: number; windowSeconds: number }> = {};
        for (const c of d.configs || []) {
          vals[c.endpoint] = { maxRequests: c.max_requests, windowSeconds: c.window_seconds };
        }
        setEditValues(vals);
      })
      .catch(() => toast.error('Failed to load config'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (endpoint: string) => {
    const v = editValues[endpoint];
    if (!v) return;
    setSaving(endpoint);
    try {
      const res = await fetch('/api/admin/rate-limit-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, maxRequests: v.maxRequests, windowSeconds: v.windowSeconds }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json();
      setConfigs((prev) => prev.map((c) => c.endpoint === endpoint ? { ...c, max_requests: updated.config.max_requests, window_seconds: updated.config.window_seconds } : c));
      toast.success(`Updated ${endpointLabels[endpoint]?.label || endpoint}`, { duration: 2000 });
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSaving(null);
    }
  };

  const fetchHistory = useCallback(async () => {
    if (historyOpen && history.length === 0) {
      setHistoryLoading(true);
      try {
        const res = await fetch('/api/admin/rate-limit-config?history=true');
        const d = await res.json();
        setHistory(d.history || []);
      } catch {
        toast.error('Failed to load change history', { duration: 3000 });
      } finally {
        setHistoryLoading(false);
      }
    }
  }, [historyOpen, history.length]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-xl border border-[var(--oracle-primary)]/30 bg-[var(--oracle-surface-1)]/50 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[14px] font-semibold text-[var(--oracle-text-1)]">
              ⚙ Rate Limit Configuration
            </h2>
            {redisConfigured !== null && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                redisConfigured
                  ? 'bg-[var(--oracle-success)]/15 text-[var(--oracle-success)] border border-[var(--oracle-success)]/20'
                  : 'bg-[var(--oracle-warning)]/15 text-[var(--oracle-warning)] border border-[var(--oracle-warning)]/20'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${redisConfigured ? 'bg-[var(--oracle-success)]' : 'bg-[var(--oracle-warning)]'}`} />
                {redisConfigured ? 'Redis (Production)' : 'In-Memory (Development)'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--oracle-text-muted)] mt-0.5">
            Adjust limits per endpoint. Changes take effect within 30 seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              historyOpen
                ? 'border-[var(--oracle-primary)]/30 bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]'
                : 'border-[var(--oracle-border)] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-2)] hover:bg-[var(--oracle-surface-2)]'
            }`}
          >
            📋 History
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-[var(--oracle-surface-2)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => {
            const info = endpointLabels[cfg.endpoint] || { label: cfg.endpoint, emoji: '📡' };
            const vals = editValues[cfg.endpoint];
            const isChanged = vals && (vals.maxRequests !== cfg.max_requests || vals.windowSeconds !== cfg.window_seconds);
            return (
              <div key={cfg.id} className="flex items-center gap-4 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/20 px-4 py-3">
                <span className="text-[16px] min-w-[24px]">{info.emoji}</span>
                <span className="text-[12px] font-medium text-[var(--oracle-text-1)] min-w-[100px]">
                  {info.label}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-[var(--oracle-text-muted)]">Max</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={vals?.maxRequests ?? cfg.max_requests}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1;
                      setEditValues((prev) => ({
                        ...prev,
                        [cfg.endpoint]: { ...prev[cfg.endpoint], maxRequests: v, windowSeconds: prev[cfg.endpoint]?.windowSeconds ?? cfg.window_seconds },
                      }));
                    }}
                    className="w-16 rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)] px-2 py-1 text-[11px] font-mono text-[var(--oracle-text-1)] text-center focus:outline-none focus:border-[var(--oracle-primary)]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-[var(--oracle-text-muted)]">Window</label>
                  <input
                    type="number"
                    min={1}
                    max={86400}
                    value={vals?.windowSeconds ?? cfg.window_seconds}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1;
                      setEditValues((prev) => ({
                        ...prev,
                        [cfg.endpoint]: { maxRequests: prev[cfg.endpoint]?.maxRequests ?? cfg.max_requests, windowSeconds: v },
                      }));
                    }}
                    className="w-16 rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)] px-2 py-1 text-[11px] font-mono text-[var(--oracle-text-1)] text-center focus:outline-none focus:border-[var(--oracle-primary)]"
                  />
                  <span className="text-[10px] text-[var(--oracle-text-muted)]">sec</span>
                </div>
                <span className="text-[10px] text-[var(--oracle-text-muted)] font-mono ml-1">
                  = {vals?.maxRequests ?? cfg.max_requests} / {vals?.windowSeconds ?? cfg.window_seconds}s
                </span>
                <div className="ml-auto">
                  <button
                    onClick={() => handleSave(cfg.endpoint)}
                    disabled={saving === cfg.endpoint || !isChanged}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      isChanged
                        ? 'bg-[var(--oracle-primary)] text-white hover:bg-[var(--oracle-primary-l)]'
                        : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)] cursor-not-allowed'
                    } ${saving === cfg.endpoint ? 'opacity-50' : ''}`}
                  >
                    {saving === cfg.endpoint ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Config Change History */}
      {historyOpen && (
        <div className="mt-4 border-t border-[var(--oracle-border)] pt-4">
          <h3 className="text-[12px] font-semibold text-[var(--oracle-text-2)] mb-3">
            📋 Recent Config Changes
          </h3>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded bg-[var(--oracle-surface-2)] animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-[11px] text-[var(--oracle-text-muted)] text-center py-3">No config changes recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {history.map((entry, i) => {
                const info = endpointLabels[entry.endpoint] || { label: entry.endpoint, emoji: '📡' };
                const changes = entry.changes as Record<string, unknown>;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--oracle-border)]/50 bg-[var(--oracle-surface-2)]/20 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-[var(--oracle-primary)] shrink-0" />
                    <span className="text-[11px] text-[var(--oracle-text-2)]">
                      {info.emoji} <span className="font-medium">{info.label}</span>
                    </span>
                    <span className="text-[10px] text-[var(--oracle-text-muted)] font-mono">
                      {typeof changes.maxRequests === 'number' ? `${changes.maxRequests} req` : ''}
                      {typeof changes.windowSeconds === 'number' ? ` / ${changes.windowSeconds}s` : ''}
                    </span>
                    <span className="text-[10px] text-[var(--oracle-text-muted)] font-mono ml-auto">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[var(--oracle-text-muted)]">
                      by {entry.userId?.slice(0, 8) || 'system'}…
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/50 px-5 py-4 animate-pulse">
            <div className="h-3 w-24 rounded bg-[var(--oracle-surface-2)] mb-3" />
            <div className="h-8 w-16 rounded bg-[var(--oracle-surface-2)]" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/50 p-5 animate-pulse">
        <div className="h-4 w-48 rounded bg-[var(--oracle-surface-2)] mb-4" />
        <div className="h-32 rounded bg-[var(--oracle-surface-2)]" />
      </div>
    </div>
  );
}
