'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TRAINING_SCENARIOS, getScenarioStats } from '@/lib/agents/training-scenarios-library';
import { TrainingScenarioRunner, type AgentExecutor } from '@/lib/agents/training-scenario-runner';
import { createRealAgentExecutor } from '@/lib/agents/real-agent-executor';
import type {
  BatchScenarioResult,
  ScenarioDifficulty,
} from '@/lib/agents/training-scenarios';
import { type AgentName } from '@/lib/agents/registry';
import { GodModeTrainingCard } from '@/components/oracle/GodModeTrainingCard';

// ─── Chart Theme ──────────────────────

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#0ea5e9'];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--oracle-surface-2)',
    border: '1px solid var(--oracle-border)',
    borderRadius: '12px',
    fontSize: '12px',
    color: 'var(--oracle-text-1)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
  } as React.CSSProperties,
  itemStyle: { color: 'var(--oracle-text-2)' } as React.CSSProperties,
  labelStyle: { color: 'var(--oracle-text-1)', fontWeight: 600 } as React.CSSProperties,
};

// ─── Difficulty Colors ─────────────────

const DIFFICULTY_COLORS: Record<ScenarioDifficulty, string> = {
  easy: '#10b981',
  medium: '#f59e0b',
  hard: '#ef4444',
  adversarial: '#ec4899',
};

const DIFFICULTY_EMOJI: Record<ScenarioDifficulty, string> = {
  easy: '🟢',
  medium: '🟡',
  hard: '🔴',
  adversarial: '🟣',
};

// ─── Agent Emojis ─────────────────────

const AGENT_EMOJIS: Record<string, string> = {
  researcher: '🔍', writer: '✍️', developer: '💻', analyst: '📈',
  strategist: '🎯', marketer: '📢', designer: '🎨', finance: '💰',
  voice: '🎙️', qa: '🛡️', coordinator: '📋', workflow: '⚙️',
  legal: '⚖️', 'security-auditor': '🔒', 'data-scientist': '📊',
  'competitor-intel': '🕵️', editor: '📝', localization: '🌐',
  'lead-hunter': '🎣', 'offer-strategist': '💼', 'video-specialist': '🎬',
  'web-designer': '🖥️', 'agent-builder': '🤖', 'agency-brain': '🧠',
  'seo-specialist': '🔎', 'content-strategist': '📝', 'conversion-optimizer': '📈',
  'community-manager': '👥',  'sales-optimizer': '💰', 'accessibility-auditor': '♿',
  'api-docs-writer': '📚', devops: '🔧', 'ux-researcher': '🧑‍💻', 'growth-hacker': '🚀',
};

// ─── Mock Executor ─────────────────────

function createMockExecutor(): AgentExecutor {
  return async (agentName: AgentName, taskPrompt: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
    return `Completed task for ${agentName}. The output includes comprehensive analysis with specific recommendations, INR pricing, and actionable next steps. Key findings show strong market potential in India with ₹50,000 Cr addressable market.`;
  };
}

// ─── Executor Mode ─────────────────────
type ExecutorMode = 'mock' | 'real';

// ─── Training Dashboard ───────────────

export function TrainingDashboard() {
  const [results, setResults] = useState<BatchScenarioResult | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<ScenarioDifficulty | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [executorMode, setExecutorMode] = useState<ExecutorMode>('mock');

  const stats = useMemo(() => getScenarioStats(), []);

  // ── Run All Scenarios ──
  const runAllScenarios = useCallback(async () => {
    setRunning(true);
    setProgress({ current: 0, total: TRAINING_SCENARIOS.length });

    const runner = new TrainingScenarioRunner({
      maxConcurrency: executorMode === 'real' ? 1 : 3,
      scenarioTimeoutMs: executorMode === 'real' ? 120000 : 30000,
    });

    const runWithExecutor = async (exec: AgentExecutor) => {
      const batchResult = await runner.runAll(exec);
      setResults(batchResult);
      setProgress({ current: batchResult.totalScenarios, total: batchResult.totalScenarios });
    };

    const isAuthError = (msg: string) =>
      msg.includes('401') || msg.includes('403') || msg.includes('No API key') || msg.includes('Failed to decrypt');

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => ({
        current: Math.min(prev.current + 1, prev.total),
        total: prev.total,
      }));
    }, 200);

    try {
      await runWithExecutor(executorMode === 'real' ? createRealAgentExecutor() : createMockExecutor());
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (executorMode === 'real' && isAuthError(msg)) {
        toast('No API keys configured — falling back to mock executor', { icon: '⚠️' });
        await runWithExecutor(createMockExecutor());
      } else {
        console.error('Failed to run scenarios:', error);
        toast.error('Failed to run training scenarios');
      }
    } finally {
      clearInterval(progressInterval);
      setRunning(false);
    }
  }, [executorMode]);

  // ── Computed Data ──
  const passFailData = useMemo(() => {
    if (!results) return [];
    return [
      { name: 'Passed', value: results.passedCount, color: '#10b981' },
      { name: 'Failed', value: results.failedCount, color: '#ef4444' },
    ];
  }, [results]);

  const difficultyData = useMemo(() => {
    const counts: Record<ScenarioDifficulty, { passed: number; failed: number }> = {
      easy: { passed: 0, failed: 0 },
      medium: { passed: 0, failed: 0 },
      hard: { passed: 0, failed: 0 },
      adversarial: { passed: 0, failed: 0 },
    };
    if (results) {
      for (const r of results.results) {
        const scenario = TRAINING_SCENARIOS.find(s => s.id === r.scenarioId);
        if (scenario) {
          if (r.passed) counts[scenario.difficulty].passed++;
          else counts[scenario.difficulty].failed++;
        }
      }
    }
    return Object.entries(counts).map(([difficulty, data]) => ({
      difficulty,
      passed: data.passed,
      failed: data.failed,
      total: data.passed + data.failed,
    }));
  }, [results]);

  const agentPerformanceData = useMemo(() => {
    if (!results) return [];
    return [...Object.entries(results.agentSummaries)]
      .map(([agent, summary]) => ({
        agent,
        emoji: AGENT_EMOJIS[agent] || '🤖',
        passed: summary.passed,
        failed: summary.failed,
        averageScore: summary.averageScore,
        totalTests: summary.totalTests,
        passRate: summary.totalTests > 0 ? (summary.passed / summary.totalTests) * 100 : 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [results]);

  const dimensionData = useMemo(() => {
    if (!results) return [];
    const dims = ['accuracy', 'completeness', 'specificity', 'actionability', 'clarity', 'professionalism'] as const;
    return dims.map(dim => {
      const scores = results.results
        .map(r => r.evaluationScores[dim])
        .filter((s): s is number => s !== undefined);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { dimension: dim, score: Math.round(avg), fullMark: 100 };
    });
  }, [results]);

  const filteredResults = useMemo(() => {
    if (!results) return [];
    let filtered = results.results;
    if (selectedAgent) filtered = filtered.filter(r => r.agentName === selectedAgent);
    if (selectedDifficulty) {
      filtered = filtered.filter(r => {
        const s = TRAINING_SCENARIOS.find(sc => sc.id === r.scenarioId);
        return s?.difficulty === selectedDifficulty;
      });
    }
    return filtered;
  }, [results, selectedAgent, selectedDifficulty]);

  const hasData = results !== null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* ── Header ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🧪 Training Scenarios</h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
                  Agent evaluation results and performance across {TRAINING_SCENARIOS.length} training scenarios
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Executor Mode Toggle */}
                <div className="flex items-center gap-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] p-0.5">
                  <button
                    onClick={() => setExecutorMode('mock')}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
                      executorMode === 'mock'
                        ? 'bg-[var(--oracle-surface-3)] text-[var(--oracle-text-1)]'
                        : 'text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-3)]'
                    }`}
                  >
                    🎭 Mock
                  </button>
                  <button
                    onClick={() => setExecutorMode('real')}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
                      executorMode === 'real'
                        ? 'bg-[var(--oracle-success)]/20 text-[var(--oracle-success)]'
                        : 'text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-3)]'
                    }`}
                  >
                    🤖 Real AI
                  </button>
                </div>
                <motion.button
                  {...buttonTapProps}
                  onClick={runAllScenarios}
                  disabled={running}
                  className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                >
                  {running ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Running... ({progress.current}/{progress.total})
                    </>
                  ) : (
                    <>▶️ Run All Scenarios</>
                  )}
                </motion.button>
                {hasData && (
                  <span className="text-[11px] text-[var(--oracle-text-muted)]">
                    Last run: {new Date(results!.executedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Progress Bar (when running) ── */}
          {running && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-[var(--oracle-text-1)]">Running scenarios...</span>
                  <span className="text-[11px] text-[var(--oracle-text-muted)]">{progress.current}/{progress.total}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[var(--oracle-primary)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Summary Stats ── */}
          {hasData && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  icon="📊"
                  label="Total Scenarios"
                  value={String(results!.totalScenarios)}
                  sub={`${stats.criticalCount} critical`}
                />
                <StatCard
                  icon="✅"
                  label="Pass Rate"
                  value={`${results!.passRate.toFixed(1)}%`}
                  accent
                  color={results!.passRate >= 80 ? 'var(--oracle-success)' : results!.passRate >= 50 ? 'var(--oracle-warning)' : 'var(--oracle-error)'}
                />
                <StatCard
                  icon="⭐"
                  label="Average Score"
                  value={results!.averageScore.toFixed(1)}
                  sub={`out of 100`}
                />
                <StatCard
                  icon="🎯"
                  label="Critical Pass"
                  value={(() => {
                    const critResults = results!.results.filter(r => TRAINING_SCENARIOS.find(s => s.id === r.scenarioId && s.isCritical));
                    const critPassed = critResults.filter(r => r.passed).length;
                    return critResults.length > 0 ? `${((critPassed / critResults.length) * 100).toFixed(0)}%` : 'N/A';
                  })()}
                  color="var(--oracle-primary)"
                />
              </div>
            </motion.div>
          )}

          {/* ── Charts Row: Pass/Fail Pie + Difficulty Bar ── */}
          {hasData && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Pass/Fail Distribution */}
              <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                <ChartCard title="Pass/Fail Distribution" subtitle="Overall scenario results">
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={passFailData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          innerRadius={45}
                          paddingAngle={3}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {passFailData.map((entry, i) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </motion.div>

              {/* Results by Difficulty */}
              <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                <ChartCard title="Results by Difficulty" subtitle="Pass/fail breakdown per difficulty level">
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={difficultyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                        <XAxis dataKey="difficulty" tick={{ fontSize: 11, fill: 'var(--oracle-text-muted)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                        <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="passed" name="Passed" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </motion.div>
            </div>
          )}

          {/* ── Agent Performance ── */}
          {hasData && agentPerformanceData.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <ChartCard title="Agent Performance" subtitle="Evaluation results by agent type">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentPerformanceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--oracle-border)" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                      <YAxis type="category" dataKey="agent" tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} width={100} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value: number) => [`${value.toFixed(1)}%`, 'Score']} />
                      <Bar dataKey="averageScore" name="Avg Score" radius={[0, 4, 4, 0]}>
                        {agentPerformanceData.map((entry) => (
                          <Cell
                            key={entry.agent}
                            fill={entry.averageScore >= 80 ? '#10b981' : entry.averageScore >= 50 ? '#f59e0b' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Agent Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--oracle-border)]">
                        <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Agent</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Tests</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Passed</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Failed</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Pass Rate</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentPerformanceData.map((row) => (
                        <tr key={row.agent} className="border-b border-[var(--oracle-border)] last:border-0 hover:bg-[var(--oracle-card-hover)]">
                          <td className="px-3 py-2 font-semibold text-[var(--oracle-text-1)]">
                            {row.emoji} {row.agent}
                          </td>
                          <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{row.totalTests}</td>
                          <td className="px-3 py-2 text-right text-[var(--oracle-success)]">{row.passed}</td>
                          <td className="px-3 py-2 text-right text-[var(--oracle-error)]">{row.failed}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-semibold ${row.passRate >= 80 ? 'text-[var(--oracle-success)]' : row.passRate >= 50 ? 'text-[var(--oracle-warning)]' : 'text-[var(--oracle-error)]'}`}>
                              {row.passRate.toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[var(--oracle-text-2)]">{row.averageScore.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </motion.div>
          )}

          {/* ── Dimension Scores Radar ── */}
          {hasData && dimensionData.some(d => d.score > 0) && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-1 text-[15px] font-bold text-[var(--oracle-text-1)]">🎯 Evaluation Dimensions</h3>
                <p className="mb-4 text-[11px] text-[var(--oracle-text-muted)]">Average scores across all evaluation dimensions</p>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={dimensionData}>
                      <PolarGrid stroke="var(--oracle-border)" />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'var(--oracle-text-muted)' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--oracle-text-muted)' }} />
                      <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value: number) => [`${value}/100`, 'Score']} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── GOD MODE Training Impact ── */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <GodModeTrainingCard />
          </motion.div>

          {/* ── Individual Scenario Results ── */}
          {hasData && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Scenario Results</h3>
                    <p className="text-[11px] text-[var(--oracle-text-muted)]">Click a scenario to view details</p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selectedAgent || ''}
                      onChange={(e) => setSelectedAgent(e.target.value || null)}
                      className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-2)] outline-none focus:border-[var(--oracle-primary)]"
                    >
                      <option value="">All Agents</option>
                      {Object.keys(results!.agentSummaries).map(agent => (
                        <option key={agent} value={agent}>{AGENT_EMOJIS[agent]} {agent}</option>
                      ))}
                    </select>
                    <select
                      value={selectedDifficulty || ''}
                      onChange={(e) => setSelectedDifficulty(e.target.value as ScenarioDifficulty || null)}
                      className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-2)] outline-none focus:border-[var(--oracle-primary)]"
                    >
                      <option value="">All Difficulties</option>
                      {(['easy', 'medium', 'hard', 'adversarial'] as const).map(d => (
                        <option key={d} value={d}>{DIFFICULTY_EMOJI[d]} {d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredResults.map((result) => {
                    const scenario = TRAINING_SCENARIOS.find(s => s.id === result.scenarioId);
                    if (!scenario) return null;
                    const isSelected = selectedScenario === result.scenarioId;

                    return (
                      <div key={result.scenarioId}>
                        <button
                          onClick={() => setSelectedScenario(isSelected ? null : result.scenarioId)}
                          className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                            result.passed
                              ? 'border-[var(--oracle-success)]/20 hover:bg-[var(--oracle-success)]/5'
                              : 'border-[var(--oracle-error)]/20 hover:bg-[var(--oracle-error)]/5'
                          }`}
                        >
                          <span className="text-lg">{result.passed ? '✅' : '❌'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{scenario.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: DIFFICULTY_COLORS[scenario.difficulty], color: '#fff' }}>{scenario.difficulty}</span>
                              {scenario.isCritical && <span className="text-[10px] text-[var(--oracle-warning)]">⚠️ Critical</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[var(--oracle-text-muted)]">
                              <span>{AGENT_EMOJIS[scenario.agentNames[0]]} {scenario.agentNames.join(', ')}</span>
                              <span>Score: {result.finalScore.toFixed(1)}</span>
                              <span>{result.executionTimeMs}ms</span>
                              <span>{result.contentChecks.wordCount} words</span>
                            </div>
                          </div>
                          <span className="text-[var(--oracle-text-muted)] text-sm">{isSelected ? '▲' : '▼'}</span>
                        </button>

                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={transitions.smooth}
                              className="overflow-hidden"
                            >
                              <div className="ml-8 mr-3 mb-2 space-y-2">
                                {/* Score Breakdown */}
                                <div className="flex items-center gap-4 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]/20 px-3 py-2 text-[11px]">
                                  <span className="font-semibold text-[var(--oracle-text-1)] min-w-[80px]">Score</span>
                                  <span className="text-[var(--oracle-text-3)]">Rubric: {result.weightedTotal.toFixed(1)}</span>
                                  <span className="text-[var(--oracle-success)]">Bonus: +{result.bonusPointsEarned.toFixed(1)}</span>
                                  <span className="text-[var(--oracle-error)]">Penalty: -{result.penaltyDeductions.toFixed(1)}</span>
                                  <span className="font-semibold text-[var(--oracle-text-1)]">Final: {result.finalScore.toFixed(1)}</span>
                                </div>

                                {/* Content Checks */}
                                {result.contentChecks.mustContainResults.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {result.contentChecks.mustContainResults.map((check) => (
                                      <span
                                        key={check.term}
                                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                                          check.found
                                            ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]'
                                            : 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]'
                                        }`}
                                      >
                                        {check.found ? '✓' : '✗'} {check.term}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Detected Flags */}
                                {result.detectedFlags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {result.detectedFlags.map((flag, i) => (
                                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)]">
                                        🚩 {flag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Feedback */}
                                {result.feedback.length > 0 && (
                                  <div className="text-[10px] text-[var(--oracle-text-muted)] space-y-0.5">
                                    {result.feedback.slice(0, 3).map((f, i) => (
                                      <p key={i}>• {f}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Empty State ── */}
          {!hasData && !running && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="py-8 text-center">
              <div className="mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-4xl">🧪</span>
              </div>
              <h3 className="mb-2 text-[18px] font-bold text-[var(--oracle-text-1)]">No Training Data</h3>
              <p className="max-w-md mx-auto text-[14px] text-[var(--oracle-text-3)]">
                Run training scenarios to evaluate agent performance across {TRAINING_SCENARIOS.length} test cases covering all agent types and difficulty levels.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <motion.button
                  {...buttonTapProps}
                  onClick={runAllScenarios}
                  className="rounded-xl oracle-gradient-bg px-6 py-3 text-[13px] font-semibold text-white transition-all"
                >
                  ▶️ Run All {TRAINING_SCENARIOS.length} Scenarios
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────

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

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="oracle-glass rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{title}</h3>
        <p className="text-[11px] text-[var(--oracle-text-muted)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
