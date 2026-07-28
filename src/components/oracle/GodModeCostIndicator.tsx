'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { getGodModeCostAnalysis, type GodModeCostAnalysis } from '@/lib/god-mode-metrics';

// ─── GOD MODE Cost Indicator ─────────────────────
// Compact indicator shown in chat UI when GOD MODE is active
// Shows token overhead vs normal messages

interface GodModeCostIndicatorProps {
  /** Whether GOD MODE is currently enabled */
  enabled: boolean;
  /** Optional size variant */
  size?: 'sm' | 'md';
}

export function GodModeCostIndicator({ enabled, size = 'sm' }: GodModeCostIndicatorProps) {
  // Refresh trigger — incrementing this forces all memos to recompute
  const [refreshTick, setRefreshTick] = useState(0);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => setRefreshTick((t) => t + 1), 15_000);
    return () => clearInterval(interval);
  }, []);

  const costAnalysis = useMemo(() => getGodModeCostAnalysis(), [refreshTick]);

  // Don't show if GOD MODE is disabled or no data
  if (!enabled) return null;

  // Show compact badge with cost info
  return (
    <CostBadge analysis={costAnalysis} size={size} />
  );
}

// ─── Cost Badge Component ────────────────────────

function CostBadge({ analysis, size }: { analysis: GodModeCostAnalysis; size: 'sm' | 'md' }) {
  const [expanded, setExpanded] = useState(false);

  // Don't show badge if no GOD MODE messages yet
  if (analysis.godModeMessageCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--oracle-error)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-error)]">
        ⚡ GOD MODE
      </span>
    );
  }

  const hasBaseline = analysis.avgTokensNormal !== null;
  const overhead = hasBaseline ? analysis.overheadPercent : null;
  const isEfficient = overhead !== null && overhead === 0;
  const isHighOverhead = overhead !== null && overhead > 50;

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1 rounded-full transition-colors ${
          isHighOverhead
            ? 'bg-[var(--oracle-error)]/10 hover:bg-[var(--oracle-error)]/20'
            : isEfficient
            ? 'bg-[var(--oracle-success)]/10 hover:bg-[var(--oracle-success)]/20'
            : 'bg-[var(--oracle-warning)]/10 hover:bg-[var(--oracle-warning)]/20'
        } px-2 py-0.5 text-[10px] font-medium ${
          isHighOverhead
            ? 'text-[var(--oracle-error)]'
            : isEfficient
            ? 'text-[var(--oracle-success)]'
            : 'text-[var(--oracle-warning)]'
        }`}
        title="GOD MODE cost analysis — click to expand"
      >
        <span>⚡</span>
        <span className="font-semibold">
          {analysis.godModeMessageCount}
        </span>
        <span className="text-[9px] opacity-70">msg</span>
        {hasBaseline && (
          <>
            <span className="mx-0.5">·</span>
            <span>{overhead! > 0 ? '+' : ''}{overhead}%</span>
          </>
        )}
        <span className="text-[8px]">▾</span>
      </button>

      {/* Expanded tooltip */}
      {expanded && (
        <ExpandedCostPanel analysis={analysis} onClose={() => setExpanded(false)} />
      )}
    </div>
  );
}

// ─── Expanded Cost Panel ─────────────────────────

function ExpandedCostPanel({ analysis, onClose }: { analysis: GodModeCostAnalysis; onClose: () => void }) {
  const hasBaseline = analysis.avgTokensNormal !== null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 bottom-full z-50 mb-2 w-64 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-[var(--oracle-text-1)]">⚡ GOD MODE Cost Analysis</p>
          <button onClick={onClose} className="text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)] text-[10px]">✕</button>
        </div>

        {/* Token Usage */}
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-[10px]">
            <span className="text-[var(--oracle-text-muted)]">Avg Tokens/Msg</span>
            <span className="font-mono text-[var(--oracle-text-2)]">{analysis.avgTokensGodMode.toLocaleString()}</span>
          </div>
          {hasBaseline && (
            <div className="flex justify-between text-[10px]">
              <span className="text-[var(--oracle-text-muted)]">Normal Avg</span>
              <span className="font-mono text-[var(--oracle-text-2)]">{analysis.avgTokensNormal!.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-[10px]">
            <span className="text-[var(--oracle-text-muted)]">Total GOD MODE Tokens</span>
            <span className="font-mono text-[var(--oracle-text-2)]">{analysis.totalGodModeTokens.toLocaleString()}</span>
          </div>
        </div>

        {/* Overhead */}
        {hasBaseline && (
          <div className={`rounded-lg p-2 mb-2 ${
            analysis.overheadPercent! > 0
              ? 'bg-[var(--oracle-error)]/10'
              : 'bg-[var(--oracle-success)]/10'
          }`}>
            <div className="flex justify-between text-[10px]">
              <span className={
                analysis.overheadPercent! > 0
                  ? 'text-[var(--oracle-error)]'
                  : 'text-[var(--oracle-success)]'
              }>Token Overhead</span>
              <span className={`font-semibold ${
                analysis.overheadPercent! > 0
                  ? 'text-[var(--oracle-error)]'
                  : 'text-[var(--oracle-success)]'
              }`}>
                {analysis.overheadPercent! > 0 ? '+' : ''}{analysis.overheadPercent}%
              </span>
            </div>
            <p className="text-[9px] text-[var(--oracle-text-muted)] mt-1">
              {analysis.overheadPercent! > 0
                ? `GOD MODE uses ${analysis.overheadPercent}% more tokens per message`
                : 'GOD MODE uses same or fewer tokens than normal mode'}
            </p>
          </div>
        )}

        {!hasBaseline && (
          <div className="rounded-lg bg-[var(--oracle-surface-2)]/50 p-2 mb-2">
            <p className="text-[10px] text-[var(--oracle-text-muted)]">
              💡 Send some normal messages to enable cost comparison
            </p>
          </div>
        )}

        {/* Messages count */}
        <div className="flex justify-between text-[10px] border-t border-[var(--oracle-border)] pt-2">
          <span className="text-[var(--oracle-text-muted)]">GOD MODE Messages</span>
          <span className="text-[var(--oracle-text-2)]">{analysis.godModeMessageCount}</span>
        </div>
      </div>
    </>
  );
}

// ─── GOD MODE Message Cost Badge ─────────────────
// Shown in MessageBubble for GOD MODE messages

interface GodModeMessageCostProps {
  /** Token count for this specific message */
  tokensUsed?: number;
}

export function GodModeMessageCost({ tokensUsed }: GodModeMessageCostProps) {
  if (!tokensUsed || tokensUsed === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--oracle-error)]/5 px-1.5 py-0.5 text-[9px] font-medium text-[var(--oracle-error)]/70" title="GOD MODE message — enhanced verification enabled">
      ⚡ {Math.round(tokensUsed / 1000)}k tok
    </span>
  );
}
