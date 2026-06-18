'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HallucinationCheckResult } from '@/types';

// ─── Types ─────────────────────────────

interface GuardStatsPanelProps {
  guardResults: Record<string, HallucinationCheckResult>;
}

interface AggregatedStats {
  totalChecked: number;
  avgConfidence: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  topFailedChecks: Array<{ name: string; count: number }>;
  totalSuggestions: number;
  confidenceTrend: 'improving' | 'stable' | 'declining' | 'insufficient';
  trendDelta: number;
  confidenceHistory: Array<{ index: number; confidence: number }>;
}

// ─── Helpers ───────────────────────────

export function aggregateStats(results: Record<string, HallucinationCheckResult>): AggregatedStats {
  const entries = Object.values(results);
  const totalChecked = entries.length;

  if (totalChecked === 0) {
    return {
      totalChecked: 0,
      avgConfidence: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      topFailedChecks: [],
      totalSuggestions: 0,
      confidenceTrend: 'insufficient',
      trendDelta: 0,
      confidenceHistory: [],
    };
  }

  const avgConfidence = entries.reduce((sum, r) => sum + r.confidence, 0) / totalChecked;

  const highConfidence = entries.filter((r) => r.confidence >= 70).length;
  const mediumConfidence = entries.filter((r) => r.confidence >= 50 && r.confidence < 70).length;
  const lowConfidence = entries.filter((r) => r.confidence < 50).length;

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  const failedCheckCounts: Record<string, number> = {};

  for (const r of entries) {
    for (const check of r.checks) {
      totalChecks++;
      if (check.passed) {
        passedChecks++;
      } else {
        failedChecks++;
        failedCheckCounts[check.name] = (failedCheckCounts[check.name] || 0) + 1;
      }
    }
  }

  const topFailedChecks = Object.entries(failedCheckCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalSuggestions = entries.reduce((sum, r) => sum + r.suggestions.length, 0);

  // Confidence trend: compare first half vs second half (insertion order = chronological)
  let confidenceTrend: AggregatedStats['confidenceTrend'] = 'insufficient';
  let trendDelta = 0;

  if (totalChecked >= 2) {
    const mid = Math.floor(totalChecked / 2);
    const firstHalf = entries.slice(0, mid);
    const secondHalf = entries.slice(mid);
    const firstAvg = firstHalf.reduce((s, r) => s + r.confidence, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + r.confidence, 0) / secondHalf.length;
    trendDelta = secondAvg - firstAvg;

    if (trendDelta > 3) confidenceTrend = 'improving';
    else if (trendDelta < -3) confidenceTrend = 'declining';
    else confidenceTrend = 'stable';
  }

  // Confidence history for sparkline (chronological order)
  const confidenceHistory = entries.map((r, i) => ({ index: i + 1, confidence: r.confidence }));

  return {
    totalChecked,
    avgConfidence: Math.round(avgConfidence),
    highConfidence,
    mediumConfidence,
    lowConfidence,
    totalChecks,
    passedChecks,
    failedChecks,
    topFailedChecks,
    totalSuggestions,
    confidenceTrend,
    trendDelta: Math.round(trendDelta),
    confidenceHistory,
  };
}

// ─── Guard Stats Panel ────────────────

export function GuardStatsPanel({ guardResults }: GuardStatsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const stats = useMemo(() => aggregateStats(guardResults), [guardResults]);

  if (stats.totalChecked === 0) return null;

  const trendEmoji = stats.confidenceTrend === 'improving' ? '📈' :
    stats.confidenceTrend === 'declining' ? '📉' : '➡️';
  const trendLabel = stats.confidenceTrend === 'improving' ? `+${stats.trendDelta}%` :
    stats.confidenceTrend === 'declining' ? `${stats.trendDelta}%` : 'Stable';

  const passRate = stats.totalChecks > 0
    ? Math.round((stats.passedChecks / stats.totalChecks) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-2">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/50 px-4 py-2.5 text-left transition-colors hover:bg-[var(--oracle-surface-2)]/50"
        aria-expanded={expanded}
        aria-label="Toggle guard statistics"
      >
        <span className="text-sm">🛡️</span>
        <span className="text-[12px] font-semibold text-[var(--oracle-text-2)]">
          Guard Stats
        </span>
        <span className="text-[11px] text-[var(--oracle-text-muted)]">
          {stats.totalChecked} {stats.totalChecked === 1 ? 'message' : 'messages'} checked
        </span>

        {/* Mini confidence bar */}
        <div className="flex-1 max-w-[120px] mx-2">
          <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${stats.avgConfidence}%`,
                backgroundColor: stats.avgConfidence >= 70
                  ? 'var(--oracle-success)'
                  : stats.avgConfidence >= 50
                  ? 'var(--oracle-warning)'
                  : 'var(--oracle-error)',
              }}
            />
          </div>
        </div>

        <span className="text-[11px] font-mono text-[var(--oracle-text-2)]">
          {stats.avgConfidence}% avg
        </span>

        <span className="text-[11px] text-[var(--oracle-text-muted)]">
          {trendEmoji} {trendLabel}
        </span>

        <span className="ml-auto text-[10px] text-[var(--oracle-text-muted)]">
          {expanded ? '▴' : '▾'}
        </span>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)]/30 p-4">
              {/* Top stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatCard
                  label="Avg Confidence"
                  value={`${stats.avgConfidence}%`}
                  color={stats.avgConfidence >= 70 ? 'success' : stats.avgConfidence >= 50 ? 'warning' : 'error'}
                />
                <StatCard
                  label="Pass Rate"
                  value={`${passRate}%`}
                  color={passRate >= 80 ? 'success' : passRate >= 60 ? 'warning' : 'error'}
                />
                <StatCard
                  label="Messages Checked"
                  value={String(stats.totalChecked)}
                  color="primary"
                />
                <StatCard
                  label="Checks Run"
                  value={String(stats.totalChecks)}
                  color="primary"
                />
              </div>

              {/* Confidence distribution */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-[var(--oracle-text-2)] mb-2">Confidence Distribution</p>
                <div className="flex gap-2">
                  <DistBar
                    label="High ≥70%"
                    count={stats.highConfidence}
                    total={stats.totalChecked}
                    color="var(--oracle-success)"
                  />
                  <DistBar
                    label="Med 50-69%"
                    count={stats.mediumConfidence}
                    total={stats.totalChecked}
                    color="var(--oracle-warning)"
                  />
                  <DistBar
                    label="Low <50%"
                    count={stats.lowConfidence}
                    total={stats.totalChecked}
                    color="var(--oracle-error)"
                  />
                </div>
              </div>

              {/* Confidence Trend Sparkline */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-[var(--oracle-text-2)] mb-2">Confidence Trend</p>
                <ConfidenceSparkline data={stats.confidenceHistory} />
              </div>

              {/* Top failed checks */}
              {stats.topFailedChecks.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-[var(--oracle-text-2)] mb-2">Most Common Issues</p>
                  <div className="space-y-1.5">
                    {stats.topFailedChecks.map((check) => (
                      <div key={check.name} className="flex items-center gap-2">
                        <span className="text-[10px]">❌</span>
                        <span className="text-[11px] text-[var(--oracle-text-3)] flex-1">
                          {check.name.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--oracle-text-muted)]">
                          {check.count}×
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions summary */}
              {stats.totalSuggestions > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-[var(--oracle-text-2)] mb-1">
                    💡 {stats.totalSuggestions} suggestion{stats.totalSuggestions !== 1 ? 's' : ''} flagged across conversation
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: 'success' | 'warning' | 'error' | 'primary' }) {
  const colorMap = {
    success: 'text-[var(--oracle-success)]',
    warning: 'text-[var(--oracle-warning)]',
    error: 'text-[var(--oracle-error)]',
    primary: 'text-[var(--oracle-primary-l)]',
  };
  return (
    <div className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/30 px-3 py-2">
      <p className="text-[10px] text-[var(--oracle-text-muted)] mb-0.5">{label}</p>
      <p className={`text-[16px] font-bold font-mono ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex-1">
      <div className="flex justify-between text-[9px] text-[var(--oracle-text-muted)] mb-1">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Confidence Sparkline ──────────────

function ConfidenceSparkline({ data }: { data: Array<{ index: number; confidence: number }> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const maxBars = Math.min(data.length, 20);
  const displayData = data.length > maxBars ? data.slice(-maxBars) : data;
  const barWidth = 100 / displayData.length;
  const minBarWidth = Math.max(barWidth * 0.6, 3);
  const gap = Math.min(barWidth * 0.2, 1.5);
  const chartHeight = 60;

  const getColor = (confidence: number) => {
    if (confidence >= 70) return 'var(--oracle-success)';
    if (confidence >= 50) return 'var(--oracle-warning)';
    return 'var(--oracle-error)';
  };

  return (
    <div className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/20 p-3">
      <svg
        viewBox="-3 0 103 70"
        className="w-full"
        style={{ height: `${chartHeight}px` }}
        role="img"
        aria-label="Confidence trend chart"
      >
        {/* Background grid lines */}
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            y1={70 - (y / 100) * 60}
            x2="100"
            y2={70 - (y / 100) * 60}
            stroke="var(--oracle-border)"
            strokeWidth="0.3"
            strokeDasharray="2,2"
          />
        ))}

        {/* Threshold lines */}
        <line
          x1="0" y1={70 - (70 / 100) * 60} x2="100" y2={70 - (70 / 100) * 60}
          stroke="var(--oracle-success)" strokeWidth="0.4" strokeDasharray="4,2" opacity="0.5"
        />
        <line
          x1="0" y1={70 - (50 / 100) * 60} x2="100" y2={70 - (50 / 100) * 60}
          stroke="var(--oracle-warning)" strokeWidth="0.4" strokeDasharray="4,2" opacity="0.5"
        />

        {/* Bars */}
        {displayData.map((d, i) => {
          const barH = (d.confidence / 100) * 55;
          const x = i * barWidth + gap / 2;
          const isHovered = hoveredIndex === i;

          return (
            <g key={d.index}>
              <rect
                x={x}
                y={70 - barH - 3}
                width={Math.max(minBarWidth, barWidth - gap)}
                height={barH}
                rx="1.5"
                fill={getColor(d.confidence)}
                opacity={isHovered ? 1 : 0.8}
                className="transition-opacity duration-150"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {/* Tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={x - 1}
                    y={70 - barH - 14}
                    width={Math.max(minBarWidth + 6, 10)}
                    height="8"
                    rx="1.5"
                    fill="var(--oracle-bg)"
                    stroke="var(--oracle-border)"
                    strokeWidth="0.3"
                  />
                  <text
                    x={x + Math.max(minBarWidth, barWidth - gap) / 2}
                    y={70 - barH - 8}
                    textAnchor="middle"
                    fontSize="3.5"
                    fill="var(--oracle-text-1)"
                    fontFamily="monospace"
                  >
                    {d.confidence}%
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((y) => (
          <text
            key={y}
            x="1"
            y={70 - (y / 100) * 60 + 1}
            fontSize="2.5"
            fill="var(--oracle-text-muted)"
            fontFamily="monospace"
            textAnchor="end"
          >
            {y}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[8px] text-[var(--oracle-text-muted)]">
          {displayData.length < data.length ? `Last ${displayData.length} of ${data.length} messages` : `${data.length} messages`}
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-[8px] text-[var(--oracle-text-muted)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--oracle-success)]" /> High
          </span>
          <span className="flex items-center gap-0.5 text-[8px] text-[var(--oracle-text-muted)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--oracle-warning)]" /> Med
          </span>
          <span className="flex items-center gap-0.5 text-[8px] text-[var(--oracle-text-muted)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--oracle-error)]" /> Low
          </span>
        </div>
      </div>
    </div>
  );
}
