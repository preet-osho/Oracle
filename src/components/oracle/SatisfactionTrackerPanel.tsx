'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import {
  addSatisfactionEntry,
  getSatisfactionEntries,
  calculateNPS,
  getNPSCategoryLabel,
  getNPSCategoryColor,
  getOverallSatisfaction,
  getDimensionLabel,
  getDimensionEmoji,
  getRatingLabel,
} from '@/lib/satisfaction-tracker';
import type { SatisfactionDimension } from '@/lib/satisfaction-tracker';

// ─── SatisfactionTrackerPanel ─────────

export function SatisfactionTrackerPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const overall = useMemo(() => getOverallSatisfaction(), [refreshKey]);
  const entries = useMemo(() => getSatisfactionEntries(), [refreshKey]);

  const handleSubmit = useCallback((data: { projectId: string; clientName: string; nps: number; dimension: SatisfactionDimension; rating: number; feedback: string }) => {
    addSatisfactionEntry({
      ...data,
      surveySentAt: Date.now(),
    });
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">😊 Client Satisfaction</h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
                  Track NPS and satisfaction scores across all clients
                </p>
              </div>
              <motion.button
                {...buttonTapProps}
                onClick={() => setShowForm(!showForm)}
                className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2.5 text-[13px] font-semibold text-white transition-all"
              >
                {showForm ? '✕ Close' : '+ Add Entry'}
              </motion.button>
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                icon="🎯"
                label="Overall NPS"
                value={`${overall.avgNPS}`}
                accent
                color={getNPSCategoryColor(overall.avgNPS >= 50 ? 'promoter' : overall.avgNPS >= 0 ? 'passive' : 'detractor')}
              />
              <StatCard icon="⭐" label="Avg Rating" value={`${overall.avgRating}/5`} sub={getRatingLabel(overall.avgRating)} />
              <StatCard icon="📊" label="Total Responses" value={String(overall.totalResponses)} />
              <StatCard
                icon="📈"
                label="Promoters"
                value={`${overall.promoterPercent}%`}
                sub={`${overall.detractorPercent}% detractors`}
              />
            </div>
          </motion.div>

          {/* Add Entry Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={transitions.smooth}>
                <SatisfactionForm onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dimension Breakdown */}
          {overall.totalResponses > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📊 Dimension Scores</h3>
                <div className="space-y-3">
                  {(['quality', 'communication', 'timeliness', 'value', 'overall'] as SatisfactionDimension[]).map((dim) => {
                    const score = entries
                      .filter((e) => e.dimension === dim)
                      .reduce((acc, e, _, arr) => acc + e.rating / arr.length, 0);
                    const hasData = entries.some((e) => e.dimension === dim);
                    return (
                      <div key={dim} className="flex items-center gap-4">
                        <span className="w-8 text-center">{getDimensionEmoji(dim)}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] text-[var(--oracle-text-2)]">{getDimensionLabel(dim)}</span>
                            <span className="text-[12px] font-mono" style={{ color: hasData ? 'var(--oracle-primary-l)' : 'var(--oracle-text-muted)' }}>
                              {hasData ? `${score.toFixed(1)}/5` : 'No data'}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${(score / 5) * 100}%`, backgroundColor: 'var(--oracle-primary)' }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Recent Entries */}
          {entries.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Recent Feedback</h3>
                <div className="space-y-2">
                  {entries.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-[var(--oracle-border)] p-3">
                      <span className="text-lg">{getDimensionEmoji(entry.dimension)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{entry.clientName}</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: getNPSCategoryColor(entry.nps >= 9 ? 'promoter' : entry.nps >= 7 ? 'passive' : 'detractor'), backgroundColor: `${getNPSCategoryColor(entry.nps >= 9 ? 'promoter' : entry.nps >= 7 ? 'passive' : 'detractor')}20` }}>
                            NPS {entry.nps}
                          </span>
                          <span className="text-[11px] text-[var(--oracle-text-muted)]">{entry.rating}/5</span>
                        </div>
                        {entry.feedback && (
                          <p className="text-[12px] text-[var(--oracle-text-3)]">{entry.feedback}</p>
                        )}
                        <span className="text-[10px] text-[var(--oracle-text-muted)]">
                          {getDimensionLabel(entry.dimension)} · {new Date(entry.timestamp).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {entries.length === 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="py-8 text-center">
              <div className="mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-4xl">😊</span>
              </div>
              <h3 className="mb-2 text-[18px] font-bold text-[var(--oracle-text-1)]">No Satisfaction Data</h3>
              <p className="max-w-md mx-auto text-[14px] text-[var(--oracle-text-3)]">
                Click "Add Entry" to record your first client satisfaction survey response.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Satisfaction Form ────────────────

function SatisfactionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: { projectId: string; clientName: string; nps: number; dimension: SatisfactionDimension; rating: number; feedback: string }) => void;
  onCancel: () => void;
}) {
  const [clientName, setClientName] = useState('');
  const [nps, setNps] = useState(7);
  const [dimension, setDimension] = useState<SatisfactionDimension>('overall');
  const [rating, setRating] = useState(4);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    if (!clientName.trim()) return;
    onSubmit({
      projectId: 'manual',
      clientName: clientName.trim(),
      nps,
      dimension,
      rating,
      feedback: feedback.trim(),
    });
  };

  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📝 Add Satisfaction Entry</h3>
      <div className="space-y-4">
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Client name"
          className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]"
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12px] text-[var(--oracle-text-2)]">NPS Score (0-10)</label>
            <span className="text-[12px] font-mono font-bold" style={{ color: getNPSCategoryColor(nps >= 9 ? 'promoter' : nps >= 7 ? 'passive' : 'detractor') }}>{nps}</span>
          </div>
          <input type="range" min={0} max={10} value={nps} onChange={(e) => setNps(Number(e.target.value))} className="w-full accent-[var(--oracle-primary)]" />
          <div className="flex justify-between text-[10px] text-[var(--oracle-text-muted)] mt-1">
            <span>0 Detractor</span>
            <span>7 Passive</span>
            <span>10 Promoter</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[12px] text-[var(--oracle-text-2)]">Dimension</label>
            <select value={dimension} onChange={(e) => setDimension(e.target.value as SatisfactionDimension)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-2)] outline-none">
              {(['quality', 'communication', 'timeliness', 'value', 'overall'] as SatisfactionDimension[]).map((d) => (
                <option key={d} value={d}>{getDimensionLabel(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] text-[var(--oracle-text-2)]">Rating</label>
              <span className="text-[12px] font-mono text-[var(--oracle-primary-l)]">{rating}/5</span>
            </div>
            <input type="range" min={1} max={5} step={0.5} value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full accent-[var(--oracle-primary)]" />
          </div>
        </div>

        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Optional feedback comments..."
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]"
        />

        <div className="flex items-center justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onCancel} className="rounded-xl border border-[var(--oracle-border)] px-4 py-2 text-[12px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
            Cancel
          </motion.button>
          <motion.button {...buttonTapProps} onClick={handleSubmit} disabled={!clientName.trim()} className="rounded-xl oracle-gradient-bg px-6 py-2 text-[12px] font-semibold text-white transition-all disabled:opacity-40">
            Save Entry
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────

function StatCard({ icon, label, value, sub, accent, color }: { icon: string; label: string; value: string; sub?: string; accent?: boolean; color?: string }) {
  return (
    <div className={`oracle-glass rounded-xl p-4 ${accent ? 'ring-1 ring-[var(--oracle-primary)]/20' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className={`text-[20px] font-bold ${accent ? 'oracle-gradient-text' : 'text-[var(--oracle-text-1)]'}`} style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--oracle-text-muted)]">{sub}</p>}
    </div>
  );
}
