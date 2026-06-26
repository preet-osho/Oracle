'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import {
  loadQualityScores,
  analyzeQualityScores,
  getScoreColor,
  getScoreLabel,
  getScoreGrade,
  saveQualityScore,
  scoreResponse,
} from '@/lib/quality';
import { getOverallSatisfaction, getSatisfactionEntries, getNPSCategoryColor } from '@/lib/satisfaction-tracker';
import type { QualityScore } from '@/types';

// ─── QualityTab ────────────────────────

export function QualityTab() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-load scores after manual scoring
  const refreshedScores = useMemo(() => loadQualityScores(), [refreshKey]);
  const refreshedAnalysis = useMemo(() => analyzeQualityScores(refreshedScores), [refreshedScores]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* ── Header ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">✅ Quality Scoring</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
              Response quality analysis across 5 dimensions
            </p>
          </motion.div>

          {/* ── Stats Row ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon="📊" label="Total Scored" value={String(refreshedAnalysis.totalScored)} sub="responses" />
              <StatCard
                icon="🎯"
                label="Average Score"
                value={`${refreshedAnalysis.averageScore}/100`}
                sub={getScoreLabel(refreshedAnalysis.averageScore)}
                accent
              />
              <StatCard icon="🏆" label="Best Score" value={`${refreshedAnalysis.bestScore}/100`} sub="peak performance" />
              <StatCard
                icon={refreshedAnalysis.trend === 'improving' ? '📈' : refreshedAnalysis.trend === 'declining' ? '📉' : '➡️'}
                label="Trend"
                value={refreshedAnalysis.trend.charAt(0).toUpperCase() + refreshedAnalysis.trend.slice(1)}
                sub={`${refreshedAnalysis.trend === 'improving' ? 'Getting better' : refreshedAnalysis.trend === 'declining' ? 'Needs attention' : 'Holding steady'}`}
              />
            </div>
          </motion.div>

          {/* ── Manual Quality Scorer ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <ManualQualityScorer onScoreSaved={() => setRefreshKey((k) => k + 1)} />
          </motion.div>

          {/* ── Client Satisfaction Tracker ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <SatisfactionTrackerSection />
          </motion.div>

          {refreshedAnalysis.totalScored > 0 ? (
            <>
              {/* ── Rubric Card ── */}
              <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">Scoring Rubric</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--oracle-border)]">
                          <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Dimension</th>
                          <th className="px-3 py-2 text-center font-semibold text-[var(--oracle-text-1)]">Max</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Average</th>
                          <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'Completeness', max: 25, avg: refreshedAnalysis.dimensionAverages.completeness, desc: 'Full scope coverage, no gaps' },
                          { name: 'Specificity', max: 25, avg: refreshedAnalysis.dimensionAverages.specificity, desc: 'Real tool names, INR prices, timelines' },
                          { name: 'Actionability', max: 25, avg: refreshedAnalysis.dimensionAverages.actionability, desc: 'Copy-paste ready, numbered steps' },
                          { name: 'India Context', max: 15, avg: refreshedAnalysis.dimensionAverages.indiaContext, desc: 'INR, Indian platforms, local events' },
                          { name: 'Client Ready', max: 10, avg: refreshedAnalysis.dimensionAverages.clientReady, desc: 'Professional formatting' },
                        ].map((dim) => (
                          <tr key={dim.name} className="border-b border-[var(--oracle-border)] last:border-0">
                            <td className="px-3 py-3">
                              <p className="font-medium text-[var(--oracle-text-1)]">{dim.name}</p>
                              <p className="text-[10px] text-[var(--oracle-text-muted)]">{dim.desc}</p>
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-[var(--oracle-text-3)]">{dim.max}</td>
                            <td className="px-3 py-3 text-right font-mono" style={{ color: getScoreColor(dim.avg / dim.max * 100) }}>
                              {dim.avg.toFixed(1)}
                            </td>
                            <td className="px-3 py-3">
                              <div className="h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-[var(--oracle-surface-2)]">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${(dim.avg / dim.max) * 100}%`,
                                    backgroundColor: getScoreColor(dim.avg / dim.max * 100),
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>

              {/* ── Analysis & Suggestions ── */}
              <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">📈 Analysis</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-[var(--oracle-surface-2)] p-3">
                      <span className="text-lg">💪</span>
                      <div>
                        <p className="text-[12px] font-medium text-[var(--oracle-text-1)]">
                          Strongest: {refreshedAnalysis.strongestDimension.charAt(0).toUpperCase() + refreshedAnalysis.strongestDimension.slice(1)}
                        </p>
                        <p className="text-[11px] text-[var(--oracle-text-muted)]">Keep this up — it&apos;s your highest-performing area</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-[var(--oracle-surface-2)] p-3">
                      <span className="text-lg">🎯</span>
                      <div>
                        <p className="text-[12px] font-medium text-[var(--oracle-text-1)]">
                          Focus Area: {refreshedAnalysis.weakestDimension.charAt(0).toUpperCase() + refreshedAnalysis.weakestDimension.slice(1)}
                        </p>
                        <p className="text-[11px] text-[var(--oracle-text-muted)]">This dimension needs the most improvement</p>
                      </div>
                    </div>
                  </div>

                  {refreshedAnalysis.suggestions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-[13px] font-semibold text-[var(--oracle-text-1)]">💡 Improvement Suggestions</h4>
                      <div className="space-y-2">
                        {refreshedAnalysis.suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-xl border border-[var(--oracle-border)] p-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full oracle-gradient-bg text-[10px] font-bold text-white">
                              {i + 1}
                            </span>
                            <p className="text-[12px] text-[var(--oracle-text-2)]">{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ── Score History ── */}
              <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Score History</h3>
                  <div className="space-y-2">
                    {refreshedScores.slice(0, 20).map((score, i) => (
                      <ScoreHistoryRow key={i} score={score} index={i} />
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          ) : (
            /* ── Empty State (no manual scores either) ── */
            refreshedAnalysis.totalScored === 0 && (
              <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="py-8 text-center">
                <div className="mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                  <span className="text-4xl">✅</span>
                </div>
                <h3 className="mb-2 text-[18px] font-bold text-[var(--oracle-text-1)]">No Scores Yet</h3>
                <p className="mb-6 max-w-md mx-auto text-[14px] text-[var(--oracle-text-3)]">
                  Use the Manual Scorer above to score any AI response, or start chatting with ORACLE to see automatic scoring data here.
                </p>
              </motion.div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manual Quality Scorer ────────────

function ManualQualityScorer({ onScoreSaved }: { onScoreSaved?: () => void }) {
  const [responseText, setResponseText] = useState('');
  const [isScoring, setIsScoring] = useState(false);
  const [result, setResult] = useState<QualityScore | null>(null);
  const [error, setError] = useState('');

  const scoreResponseText = useCallback(async () => {
    if (!responseText.trim()) return;
    setIsScoring(true);
    setResult(null);
    setError('');

    try {
      const { NeverStopRouter } = await import('@/lib/router');
      const score = await scoreResponse(responseText, async (prompt) => {
        const apiResult = await NeverStopRouter.callSync(
          [{ id: 'quality', role: 'user', content: prompt, timestamp: Date.now() }],
          { messages: [{ role: 'user', content: prompt }], maxTokens: 800 }
        );
        return apiResult.text;
      });

      if (score) {
        setResult(score);
        saveQualityScore(score);
        onScoreSaved?.();
      } else {
        setError('Failed to parse scoring response. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scoring failed');
    } finally {
      setIsScoring(false);
    }
  }, [responseText, onScoreSaved]);

  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">🎯 Manual Quality Scorer</h3>
      <p className="mb-4 text-[12px] text-[var(--oracle-text-3)]">Paste an AI response to score it on 5 dimensions using ORACLE&apos;s quality engine.</p>
      <textarea
        value={responseText}
        onChange={(e) => setResponseText(e.target.value)}
        placeholder="Paste an AI-generated response here to score its quality..."
        rows={4}
        className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-[var(--oracle-text-muted)]">
          {responseText.length > 0 ? `${responseText.length} chars` : 'Paste response to score'}
        </span>
        <motion.button
          {...buttonTapProps}
          onClick={scoreResponseText}
          disabled={!responseText.trim() || isScoring}
          className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-6 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isScoring ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Scoring...
            </>
          ) : (
            '🎯 Score Response'
          )}
        </motion.button>
      </div>
      {error && (
        <div className="mt-3 rounded-xl bg-[var(--oracle-error)]/10 p-3 text-[12px] text-[var(--oracle-error)]">
          {error}
        </div>
      )}
      {result && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-[var(--oracle-border)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ backgroundColor: `${getScoreColor(result.total)}20`, color: getScoreColor(result.total) }}>
              {result.total}/100 {getScoreGrade(result.total)}
            </span>
            <span className="text-[11px] text-[var(--oracle-text-muted)]">{getScoreLabel(result.total)}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Complete', value: result.completeness, max: 25 },
              { label: 'Specific', value: result.specificity, max: 25 },
              { label: 'Actionable', value: result.actionability, max: 25 },
              { label: 'India', value: result.indiaContext, max: 15 },
              { label: 'Ready', value: result.clientReady, max: 10 },
            ].map((d) => (
              <div key={d.label} className="text-center">
                <p className="text-[10px] text-[var(--oracle-text-muted)]">{d.label}</p>
                <p className="text-[14px] font-bold" style={{ color: getScoreColor((d.value / d.max) * 100) }}>{d.value}/{d.max}</p>
              </div>
            ))}
          </div>
          {result.notes && (
            <p className="mt-3 text-[11px] text-[var(--oracle-text-3)] leading-relaxed">{result.notes}</p>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────

function StatCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`oracle-glass rounded-xl p-4 ${accent ? 'ring-1 ring-[var(--oracle-primary)]/20' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className={`text-[20px] font-bold ${accent ? 'oracle-gradient-text' : 'text-[var(--oracle-text-1)]'}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--oracle-text-muted)]">{sub}</p>
    </div>
  );
}

// ─── Score History Row ─────────────────

function ScoreHistoryRow({ score, index }: { score: QualityScore; index: number }) {
  const dims = [
    { label: 'Complete', value: score.completeness, max: 25 },
    { label: 'Specific', value: score.specificity, max: 25 },
    { label: 'Actionable', value: score.actionability, max: 25 },
    { label: 'India', value: score.indiaContext, max: 15 },
    { label: 'Ready', value: score.clientReady, max: 10 },
  ];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--oracle-border)] p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--oracle-surface-2)] text-[11px] font-bold text-[var(--oracle-text-muted)]">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${getScoreColor(score.total)}20`, color: getScoreColor(score.total) }}
          >
            {score.total}/100 {getScoreGrade(score.total)}
          </span>
          {score.scoredAt && (
            <span className="text-[10px] text-[var(--oracle-text-muted)]">
              {new Date(score.scoredAt).toLocaleDateString('en-IN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dims.map((d) => (
            <div key={d.label} className="flex items-center gap-1">
              <span className="text-[9px] text-[var(--oracle-text-muted)]">{d.label}</span>
              <div className="h-1.5 w-8 overflow-hidden rounded-full bg-[var(--oracle-surface-2)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(d.value / d.max) * 100}%`, backgroundColor: getScoreColor(d.value / d.max * 100) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Client Satisfaction Tracker Section ───────────

function SatisfactionTrackerSection() {
  const satisfaction = useMemo(() => getOverallSatisfaction(), []);
  const entries = useMemo(() => getSatisfactionEntries().slice(0, 10), []);

  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">📊 Client Satisfaction (NPS)</h3>
      {satisfaction.totalResponses === 0 ? (
        <p className="text-[12px] text-[var(--oracle-text-muted)]">No satisfaction data yet. Use the Satisfaction tab to log client feedback.</p>
      ) : (
        <>
          {/* NPS Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
            <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
              <p className="text-[10px] text-[var(--oracle-text-muted)]">NPS SCORE</p>
              <p className="text-[18px] font-bold" style={{ color: satisfaction.avgNPS >= 50 ? 'var(--oracle-success)' : satisfaction.avgNPS >= 0 ? 'var(--oracle-warning)' : 'var(--oracle-error)' }}>{satisfaction.avgNPS}</p>
            </div>
            <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
              <p className="text-[10px] text-[var(--oracle-text-muted)]">AVG RATING</p>
              <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{satisfaction.avgRating}/5</p>
            </div>
            <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
              <p className="text-[10px] text-[var(--oracle-text-muted)]">PROMOTERS</p>
              <p className="text-[18px] font-bold text-[var(--oracle-success)]">{satisfaction.promoterPercent}%</p>
            </div>
            <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
              <p className="text-[10px] text-[var(--oracle-text-muted)]">TOTAL RESPONSES</p>
              <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{satisfaction.totalResponses}</p>
            </div>
          </div>
          {/* Dimension Highlights */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2">
              <span className="text-[var(--oracle-text-muted)]">Top: </span>
              <span className="font-medium text-[var(--oracle-text-1)]">{satisfaction.topDimension}</span>
            </div>
            <div className="rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2">
              <span className="text-[var(--oracle-text-muted)]">Focus: </span>
              <span className="font-medium text-[var(--oracle-text-1)]">{satisfaction.bottomDimension}</span>
            </div>
          </div>
          {/* Recent Entries */}
          {entries.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold text-[var(--oracle-text-muted)]">RECENT FEEDBACK</p>
              <div className="space-y-1.5">
                {entries.slice(0, 3).map((e) => (
                  <div key={e.id} className="rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2 text-[11px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[var(--oracle-text-1)]">{e.clientName}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${getNPSCategoryColor(e.nps >= 9 ? 'promoter' : e.nps >= 7 ? 'passive' : 'detractor')}20`, color: getNPSCategoryColor(e.nps >= 9 ? 'promoter' : e.nps >= 7 ? 'passive' : 'detractor') }}>
                        NPS: {e.nps}
                      </span>
                    </div>
                    {e.feedback && <p className="text-[10px] text-[var(--oracle-text-muted)] truncate">{e.feedback}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
