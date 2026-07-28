'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { getGodModeMetrics, getGodModeCostAnalysis, getGodModeMessageHistory, QUALITY_BUCKET_COLORS } from '@/lib/god-mode-metrics';
import { QualityDistributionBreakdown } from './quality-visualization';

// ─── GOD MODE Training Card ─────────────────────

export function GodModeTrainingCard() {
  // Refresh trigger — incrementing this forces all memos to recompute
  const [refreshTick, setRefreshTick] = useState(0);

  // Refresh function — reads fresh data from localStorage
  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  // Auto-refresh every 15 seconds while the card is mounted
  useEffect(() => {
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const metrics = useMemo(() => getGodModeMetrics(), [refreshTick]);
  const costAnalysis = useMemo(() => getGodModeCostAnalysis(), [refreshTick]);
  const messages = useMemo(() => getGodModeMessageHistory(), [refreshTick]);

  // Compute quality stats from messages with scores
  const qualityStats = useMemo(() => {
    const scored = messages.filter((m) => typeof m.qualityScore === 'number' && m.qualityScore > 0);
    const unscored = messages.filter((m) => typeof m.qualityScore !== 'number' || m.qualityScore === 0);
    const avgQuality = scored.length > 0
      ? scored.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / scored.length
      : 0;
    const highQuality = scored.filter((m) => (m.qualityScore || 0) >= 80).length;
    const lowQuality = scored.filter((m) => (m.qualityScore || 0) < 60).length;
    return { avgQuality, highQuality, lowQuality, scoredCount: scored.length, unscoredCount: unscored.length };
  }, [messages]);

  // ── Quality Trend Sparkline Data ──
  const qualitySparklineData = useMemo(() => {
    const scored = metrics.scoredMessages ?? [];
    if (scored.length < 2) return null;
    const last20 = scored.slice(-20);
    const width = 80;
    const height = 20;
    const points = last20.map((m, i) => {
      const x = (i / (last20.length - 1)) * width;
      const y = height - (m.qualityScore! * height);
      return { x, y };
    });
    // Note: when scoredMessages has exactly 2 entries, windowSize=1 making this
    // a simple last-two-point comparison rather than a 5-point moving average.
    const windowSize = Math.min(5, Math.floor(last20.length / 2));
    const recentSlice = last20.slice(-windowSize);
    const prevSlice = last20.slice(-windowSize * 2, -windowSize);
    const recentAvg = recentSlice.reduce((sum, m) => sum + m.qualityScore!, 0) / recentSlice.length;
    const prevAvg = prevSlice.length > 0
      ? prevSlice.reduce((sum, m) => sum + m.qualityScore!, 0) / prevSlice.length
      : recentAvg;
    const trend = recentAvg - prevAvg;
    const lastScore = last20[last20.length - 1].qualityScore!;
    return { points, lastScore, trend, width, height, pointsStr: points.map((p) => `${p.x},${p.y}`).join(' ') };
  }, [metrics]);

  // Compute success rate by agent
  const agentQualityData = useMemo(() => {
    const agentMap: Record<string, { total: number; success: number; tokens: number; scores: number[] }> = {};
    for (const msg of messages) {
      if (!agentMap[msg.agentType]) agentMap[msg.agentType] = { total: 0, success: 0, tokens: 0, scores: [] };
      agentMap[msg.agentType].total++;
      if (msg.wasSuccessful) agentMap[msg.agentType].success++;
      agentMap[msg.agentType].tokens += msg.tokensUsed;
      if (typeof msg.qualityScore === 'number' && msg.qualityScore > 0) {
        agentMap[msg.agentType].scores.push(msg.qualityScore);
      }
    }
    return Object.entries(agentMap)
      .map(([agent, data]) => ({
        agent,
        total: data.total,
        successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
        avgTokens: data.total > 0 ? Math.round(data.tokens / data.total) : 0,
        avgQuality: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [messages]);

  if (metrics.totalMessages === 0) {
    return (
      <div className="oracle-glass rounded-2xl p-5">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">⚡ GOD MODE Training Impact</h3>
        <p className="mt-2 text-[12px] text-[var(--oracle-text-muted)]">
          No GOD MODE usage yet. Toggle GOD MODE (Ctrl+Shift+G) and send messages to see how it affects agent training quality.
        </p>
      </div>
    );
  }

  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">⚡ GOD MODE Training Impact</h3>
          <p className="text-[11px] text-[var(--oracle-text-muted)]">How GOD MODE affects agent quality and token usage</p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full bg-red-500/10 text-red-400 font-semibold">GOD MODE</span>
      </div>

      {/* Quality Comparison Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4">
        <div className="rounded-xl bg-[var(--oracle-surface-2)]/50 p-3">
          <p className="text-[10px] text-[var(--oracle-text-muted)]">Avg Quality</p>
          <p className="text-[16px] font-bold text-[var(--oracle-text-1)]">
            {qualityStats.avgQuality > 0 ? qualityStats.avgQuality.toFixed(1) : '—'}
          </p>
          <p className="text-[9px] text-[var(--oracle-text-muted)]">{qualityStats.scoredCount} scored</p>
        </div>
        <div className="rounded-xl bg-[var(--oracle-surface-2)]/50 p-3">
          <p className="text-[10px] text-[var(--oracle-text-muted)]">High Quality (≥80)</p>
          <p className="text-[16px] font-bold" style={{ color: 'var(--oracle-success)' }}>
            {qualityStats.highQuality}
          </p>
          <p className="text-[9px] text-[var(--oracle-text-muted)]">
            {qualityStats.scoredCount > 0 ? Math.round((qualityStats.highQuality / qualityStats.scoredCount) * 100) : 0}%
          </p>
        </div>
        <div className="rounded-xl bg-[var(--oracle-surface-2)]/50 p-3">
          <p className="text-[10px] text-[var(--oracle-text-muted)]">Low Quality (&lt;60)</p>
          <p className="text-[16px] font-bold" style={{ color: qualityStats.lowQuality > 0 ? 'var(--oracle-error)' : 'var(--oracle-success)' }}>
            {qualityStats.lowQuality}
          </p>
          <p className="text-[9px] text-[var(--oracle-text-muted)]">
            {qualityStats.scoredCount > 0 ? Math.round((qualityStats.lowQuality / qualityStats.scoredCount) * 100) : 0}%
          </p>
        </div>
        <div className="rounded-xl bg-[var(--oracle-surface-2)]/50 p-3">
          <p className="text-[10px] text-[var(--oracle-text-muted)]">Token Overhead</p>
          <p className="text-[16px] font-bold" style={{ color: costAnalysis.overheadPercent !== null && costAnalysis.overheadPercent > 0 ? 'var(--oracle-warning)' : 'var(--oracle-success)' }}>
            {costAnalysis.overheadPercent !== null ? (costAnalysis.overheadPercent > 0 ? `+${costAnalysis.overheadPercent}%` : '0%') : '—'}
          </p>
          <p className="text-[9px] text-[var(--oracle-text-muted)]">vs normal</p>
        </div>
      </div>

      {/* Token Cost Breakdown */}
      <div className="mb-4 p-3 rounded-xl bg-[var(--oracle-surface-2)]/30 border border-[var(--oracle-border)]/30">
        <h4 className="text-[12px] font-semibold text-[var(--oracle-text-2)] mb-2">💰 Token Cost Impact</h4>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <span className="text-[var(--oracle-text-muted)]">GOD MODE avg:</span>{' '}
            <span className="font-semibold text-[var(--oracle-text-1)]">{costAnalysis.avgTokensGodMode.toLocaleString()} tok/msg</span>
          </div>
          <div>
            <span className="text-[var(--oracle-text-muted)]">Total GOD MODE:</span>{' '}
            <span className="font-semibold text-[var(--oracle-text-1)]">{costAnalysis.totalGodModeTokens.toLocaleString()} tok</span>
          </div>
        </div>
        {costAnalysis.overheadPercent !== null ? (
          <p className="text-[10px] text-[var(--oracle-text-muted)] mt-2">
            GOD MODE adds ~{costAnalysis.overheadPercent}% more tokens vs normal messages.
          </p>
        ) : (
          <p className="text-[10px] text-[var(--oracle-text-muted)] mt-2">
            Normal message baseline not yet available. Track token usage in chat history for overhead comparison.
          </p>
        )}
      </div>

      {/* Agent Quality Breakdown */}
      {agentQualityData.length > 0 && (
        <div>
          <h4 className="text-[12px] font-semibold text-[var(--oracle-text-2)] mb-2">🤖 Agent Quality with GOD MODE</h4>
          <div className="space-y-2">
            {agentQualityData.map((data) => (
              <div key={data.agent} className="flex items-center gap-3 rounded-lg border border-[var(--oracle-border)]/50 bg-[var(--oracle-surface-2)]/20 px-3 py-2 text-[11px]">
                <span className="min-w-[90px] font-semibold text-[var(--oracle-text-1)] capitalize">{data.agent}</span>
                <span className="text-[var(--oracle-text-muted)] min-w-[40px]">{data.total} msgs</span>
                <span className="min-w-[50px] font-semibold" style={{ color: data.successRate >= 80 ? 'var(--oracle-success)' : data.successRate >= 50 ? 'var(--oracle-warning)' : 'var(--oracle-error)' }}>
                  {data.successRate}%
                </span>
                <span className="text-[var(--oracle-text-muted)] min-w-[50px]">{data.avgTokens} tok</span>
                {data.avgQuality > 0 && (
                  <span className="min-w-[40px] font-semibold" style={{ color: data.avgQuality >= 80 ? 'var(--oracle-success)' : data.avgQuality >= 60 ? 'var(--oracle-warning)' : 'var(--oracle-error)' }}>
                    Q:{data.avgQuality}
                  </span>
                )}
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${data.successRate}%`,
                        backgroundColor: data.successRate >= 80 ? 'var(--oracle-success)' : data.successRate >= 50 ? 'var(--oracle-warning)' : 'var(--oracle-error)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality Trend Sparkline */}
      {qualitySparklineData && (
        <div className="mt-4">
          <h4 className="text-[12px] font-semibold text-[var(--oracle-text-2)] mb-2">📈 Quality Trend</h4>
          <svg
            width={qualitySparklineData.width}
            height={qualitySparklineData.height}
            role="img"
            aria-label={`Quality trend: ${(qualitySparklineData.lastScore * 100).toFixed(0)}% current, trend ${qualitySparklineData.trend > 0 ? 'improving' : qualitySparklineData.trend < 0 ? 'declining' : 'stable'}`}
            aria-roledescription="sparkline chart"
          >
            <title>{`Quality trend sparkline — current score ${(qualitySparklineData.lastScore * 100).toFixed(0)}%, trend: ${qualitySparklineData.trend > 0 ? 'improving' : qualitySparklineData.trend < 0 ? 'declining' : 'stable'}`}</title>
            <polyline
              points={qualitySparklineData.pointsStr}
              fill="none"
              stroke={qualitySparklineData.trend > 0 ? 'var(--oracle-success)' : qualitySparklineData.trend < 0 ? 'var(--oracle-error)' : 'var(--oracle-text-muted)'}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            />
            <circle
              cx={qualitySparklineData.width}
              cy={qualitySparklineData.height - qualitySparklineData.lastScore * qualitySparklineData.height}
              r={2.5}
              fill={qualitySparklineData.trend > 0 ? 'var(--oracle-success)' : qualitySparklineData.trend < 0 ? 'var(--oracle-error)' : 'var(--oracle-text-muted)'}
              aria-hidden="true"
            />
          </svg>
        </div>
      )}

      {/* Quality Distribution Histogram */}
      {(metrics.qualityDistribution ?? []).some((b) => b.count > 0) && (
        <div className="mt-4">
          <h4 id="god-mode-training-quality-dist-heading" className="text-[12px] font-semibold text-[var(--oracle-text-2)] mb-2">⭐ Quality Distribution</h4>
          <div className="flex items-end gap-2 h-[80px]" role="figure" aria-labelledby="god-mode-training-quality-dist-heading">
            {(metrics.qualityDistribution ?? []).map((b, bi) => {
              const maxCount = Math.max(...(metrics.qualityDistribution ?? []).map((x) => x.count), 1);
              const heightPercent = (b.count / maxCount) * 100;
              return (
                <div key={b.range} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[var(--oracle-text-muted)]">{b.count}</span>
                  <div className="w-full rounded-t bg-[var(--oracle-surface-2)] overflow-hidden" style={{ height: '60px' }}>
                    <div
                      data-testid="histogram-bar"
                      role="img"
                      aria-label={`${b.range}: ${b.count} score${b.count !== 1 ? 's' : ''}`}
                      className="w-full rounded-t transition-all duration-300"
                      style={{ height: `${heightPercent}%`, backgroundColor: QUALITY_BUCKET_COLORS[bi] }}
                    />
                  </div>
                  <span className="text-[9px] text-[var(--oracle-text-muted)]">{b.range}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Agent Quality Distribution */}
      <QualityDistributionBreakdown data={metrics.agentQualityDistribution ?? {}} label="📋 Per-Agent Distribution" />

      {/* Per-Provider Quality Distribution */}
      <QualityDistributionBreakdown data={metrics.providerQualityDistribution ?? {}} label="📡 Per-Provider Distribution" />
    </div>
  );
}
