'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {motion} from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import { generateMonthlyReport, saveReport, getReports } from '@/lib/monthly-intelligence-report';
import {getFreeTools, getEmergingTrends, getDiscoveryStats} from '@/lib/weekly-web-scan';
import { getPatternStats } from '@/lib/pattern-recognition';
import { getUpsellStats } from '@/lib/upsell-detection';

// ─── IntelligenceReportsPanel ─────────

export function IntelligenceReportsPanel() {
  const [activeSection, setActiveSection] = useState<'reports' | 'tools' | 'trends'>('reports');
  const [generating, setGenerating] = useState(false);

  const reports = useMemo(() => getReports(), []);
  const toolStats = useMemo(() => getDiscoveryStats(), []);
  const patternStats = useMemo(() => getPatternStats(), []);
  const upsellStats = useMemo(() => getUpsellStats(), []);
  const freeTools = useMemo(() => getFreeTools(), []);
  const trends = useMemo(() => getEmergingTrends(70), []);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const generateReport = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      const report = generateMonthlyReport(currentMonth);
      saveReport(report);
      setGenerating(false);
    }, 1000);
  }, [currentMonth]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">📊 Intelligence Hub</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
              Tool discoveries, trend alerts, pattern analysis, and monthly intelligence reports
            </p>
          </motion.div>

          {/* Section Tabs */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="flex items-center gap-2">
              {[
                { id: 'reports' as const, label: '📋 Reports', count: reports.length },
                { id: 'tools' as const, label: '🛠 Tools', count: freeTools.length },
                { id: 'trends' as const, label: '📈 Trends', count: trends.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`rounded-full px-4 py-2 text-[12px] font-medium transition-colors ${activeSection === tab.id ? 'oracle-gradient-bg text-white' : 'border border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'}`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon="📋" label="Reports" value={String(reports.length)} />
              <StatCard icon="🛠" label="Free Tools" value={String(toolStats.freeCount || freeTools.length)} />
              <StatCard icon="🔍" label="Patterns Detected" value={String(patternStats.totalTasks)} />
              <StatCard icon="💰" label="Upsell Offers" value={String(upsellStats.totalSuggestions)} />
            </div>
          </motion.div>

          {/* Reports Section */}
          {activeSection === 'reports' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">Monthly Reports</h3>
                  <motion.button
                    {...buttonTapProps}
                    onClick={generateReport}
                    disabled={generating}
                    className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white transition-all disabled:opacity-40"
                  >
                    {generating ? (
                      <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Generating...</>
                    ) : `📊 Generate ${currentMonth} Report`}
                  </motion.button>
                </div>

                {reports.length > 0 ? (
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <div key={report.id} className="rounded-xl border border-[var(--oracle-border)] p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-bold text-[var(--oracle-text-1)]">{report.month}</span>
                          <span className="text-[10px] text-[var(--oracle-text-muted)]">
                            {new Date(report.generatedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="text-center">
                            <p className="text-[16px] font-bold text-[var(--oracle-text-1)]">{report.summary.totalTasks}</p>
                            <p className="text-[10px] text-[var(--oracle-text-muted)]">Tasks</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[16px] font-bold text-[var(--oracle-text-1)]">{report.summary.avgQualityScore}/100</p>
                            <p className="text-[10px] text-[var(--oracle-text-muted)]">Avg Quality</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[16px] font-bold text-[var(--oracle-text-1)]">₹{report.summary.totalCostINR.toFixed(2)}</p>
                            <p className="text-[10px] text-[var(--oracle-text-muted)]">Total Cost</p>
                          </div>
                        </div>
                        {report.learnings.keyInsights.length > 0 && (
                          <div className="space-y-1">
                            {report.learnings.keyInsights.slice(0, 3).map((insight: string, i: number) => (
                              <p key={i} className="text-[11px] text-[var(--oracle-text-3)]">• {insight}</p>
                            ))}
                          </div>
                        )}
                        {report.trends.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {report.trends.map((trend, i) => (
                              <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${trend.impact === 'positive' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : trend.impact === 'negative' ? 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>
                                {trend.trend}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-[13px] text-[var(--oracle-text-3)]">No reports yet. Generate your first monthly report above.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Tools Section */}
          {activeSection === 'tools' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">🛠 Free Tools Arsenal</h3>
                <div className="space-y-2">
                  {freeTools.map((tool) => (
                    <a
                      key={tool.id}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-[var(--oracle-border)] p-3 transition-all hover:bg-[var(--oracle-card-hover)] hover:border-[var(--oracle-primary)]/30"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg oracle-gradient-bg">
                        <span className="text-[11px] font-bold text-white">{tool.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{tool.name}</span>
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]">FREE</span>
                        </div>
                        <p className="text-[11px] text-[var(--oracle-text-3)] truncate">{tool.description}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {tool.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">{tag}</span>
                        ))}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Trends Section */}
          {activeSection === 'trends' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📈 Trend Alerts</h3>
                <div className="space-y-3">
                  {trends.map((trend) => {
                    const momentumColors: Record<string, string> = {
                      emerging: 'var(--oracle-info)',
                      growing: 'var(--oracle-success)',
                      mainstream: 'var(--oracle-warning)',
                      declining: 'var(--oracle-error)',
                    };
                    return (
                      <div key={trend.id} className="rounded-xl border border-[var(--oracle-border)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: momentumColors[trend.momentum], backgroundColor: `${momentumColors[trend.momentum]}20` }}>
                            {trend.momentum.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-[var(--oracle-text-muted)]">{trend.category}</span>
                          <span className="ml-auto text-[10px] text-[var(--oracle-text-muted)]">Relevance: {trend.relevance}%</span>
                        </div>
                        <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{trend.trend}</p>
                        <p className="mt-1 text-[12px] text-[var(--oracle-text-3)]">{trend.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
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
