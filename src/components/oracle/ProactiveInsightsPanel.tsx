'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import { detectRisks, detectOpportunities, saveInsights, getActiveInsights, dismissInsight, getInsights } from '@/lib/proactive-intelligence';
import type { ProactiveInsight } from '@/lib/proactive-intelligence';

// ─── Severity Styles ──────────────────

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; emoji: string }> = {
  critical: { color: 'var(--oracle-error)', bg: 'var(--oracle-error)', emoji: '🚨' },
  high: { color: 'var(--oracle-warning)', bg: 'var(--oracle-warning)', emoji: '⚠️' },
  medium: { color: 'var(--oracle-info)', bg: 'var(--oracle-info)', emoji: 'ℹ️' },
  low: { color: 'var(--oracle-success)', bg: 'var(--oracle-success)', emoji: '💡' },
};

// ─── ProactiveInsightsPanel ───────────

export function ProactiveInsightsPanel() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Sample client context for demo — in production this would come from the active project
  const [clientContext, setClientContext] = useState(JSON.stringify({
    hasWebsite: true,
    hasGSC: false,
    hasGA4: false,
    hasEmailMarketing: false,
    socialPlatforms: [],
    activeChannels: ['website'],
    googleRating: 3.2,
    overdueInvoiceCount: 1,
    clientType: 'business',
  }, null, 2));

  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey intentionally triggers recomputation after localStorage mutations
  const activeInsights = useMemo(() => getActiveInsights(), [refreshKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allInsights = useMemo(() => getInsights(), [refreshKey]);

  const runScan = useCallback(() => {
    setIsScanning(true);
    setScanComplete(false);

    // Parse context and run detection
    setTimeout(() => {
      try {
        const context = JSON.parse(clientContext);
        const risks = detectRisks(context);
        const opportunities = detectOpportunities(context);
        const allNew = [...risks, ...opportunities];

        // Save to storage
        if (allNew.length > 0) {
          const existing = getInsights();
          saveInsights([...allNew, ...existing]);
        }

        setScanComplete(true);
        setRefreshKey((k) => k + 1);
      } catch {
        // JSON parse error
      }
      setIsScanning(false);
    }, 800);
  }, [clientContext]);

  const handleDismiss = useCallback((id: string) => {
    dismissInsight(id);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🛡 Proactive Intelligence</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
              Automatically detect risks and opportunities for your clients
            </p>
          </motion.div>

          {/* Stats Row */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon="🚨" label="Active Risks" value={String(activeInsights.filter((i) => i.category === 'risk').length)} />
              <StatCard icon="💡" label="Opportunities" value={String(activeInsights.filter((i) => i.category === 'opportunity').length)} />
              <StatCard icon="✅" label="Dismissed" value={String(allInsights.filter((i) => i.dismissed).length)} />
              <StatCard icon="📊" label="Total Scans" value={String(allInsights.length)} />
            </div>
          </motion.div>

          {/* Context Input */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-5">
              <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Client Context</h3>
              <p className="mb-3 text-[12px] text-[var(--oracle-text-3)]">Edit the client context JSON and run a scan to detect risks and opportunities.</p>
              <textarea
                value={clientContext}
                onChange={(e) => setClientContext(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 font-mono text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-[var(--oracle-text-muted)]">
                  {scanComplete && <span className="text-[var(--oracle-success)]">✓ Scan complete</span>}
                </span>
                <motion.button
                  {...buttonTapProps}
                  onClick={runScan}
                  disabled={isScanning}
                  className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-6 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-40"
                >
                  {isScanning ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Scanning...</>
                  ) : '🔍 Run Scan'}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Insights List */}
          {activeInsights.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">Active Insights</h3>
                <div className="space-y-3">
                  <AnimatePresence>
                    {activeInsights.map((insight) => (
                      <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {activeInsights.length === 0 && !isScanning && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="py-8 text-center">
              <div className="mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-4xl">🛡</span>
              </div>
              <h3 className="mb-2 text-[18px] font-bold text-[var(--oracle-text-1)]">No Insights Yet</h3>
              <p className="max-w-md mx-auto text-[14px] text-[var(--oracle-text-3)]">
                Edit the client context above and click &quot;Run Scan&quot; to detect risks and opportunities.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Insight Card ─────────────────────

function InsightCard({ insight, onDismiss }: { insight: ProactiveInsight; onDismiss: (id: string) => void }) {
  const config = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.medium;
  const isRisk = insight.category === 'risk';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={transitions.smooth}
      className="rounded-xl border p-4 transition-all"
      style={{ borderColor: `${config.color}30`, backgroundColor: `${config.color}08` }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{config.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: config.color, backgroundColor: `${config.color}20` }}>
              {isRisk ? 'RISK' : 'OPPORTUNITY'} · {insight.severity.toUpperCase()}
            </span>
            <span className="text-[10px] text-[var(--oracle-text-muted)]">
              {new Date(insight.timestamp).toLocaleDateString('en-IN')}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{insight.title}</p>
          <p className="mt-1 text-[12px] text-[var(--oracle-text-3)]">{insight.description}</p>
          {insight.suggestedAction && (
            <div className="mt-2 rounded-lg bg-[var(--oracle-surface-2)] p-2">
              <p className="text-[11px] text-[var(--oracle-text-muted)]">
                <span className="font-semibold">Suggested:</span> {insight.suggestedAction}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => onDismiss(insight.id)}
          className="shrink-0 rounded-lg p-1.5 text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
          aria-label="Dismiss insight"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}

// ─── Stat Card ────────────────────────

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="oracle-glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className="text-[20px] font-bold text-[var(--oracle-text-1)]">{value}</p>
    </div>
  );
}
