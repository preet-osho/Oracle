'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OperatingLoopResult, OperatingStep } from '@/lib/agency-operations';

// ─── Step Metadata ─────────────────────

const STEP_META: Record<OperatingStep, { emoji: string; label: string; description: string; color: string }> = {
  understand: { emoji: '🔍', label: 'Understand', description: 'What is the business? Who is the buyer? What is the bottleneck?', color: 'var(--oracle-info)' },
  diagnose:   { emoji: '🩺', label: 'Diagnose',   description: 'Root cause: lead flow, conversion, traffic, trust, or retention?', color: 'var(--oracle-warning)' },
  plan:       { emoji: '📋', label: 'Plan',       description: 'Channel mix, funnel, agent assignment, deliverables, KPIs.', color: 'var(--oracle-primary)' },
  execute:    { emoji: '⚡', label: 'Execute',    description: 'Tactical outputs, assets, copy, workflows, outreach.', color: 'var(--oracle-success)' },
  qa:         { emoji: '✅', label: 'QA Check',   description: 'Accuracy, clarity, consistency, completeness, risk points.', color: 'var(--oracle-cyan)' },
  improve:    { emoji: '📈', label: 'Improve',    description: 'Lessons learned, optimization opportunities, next experiments.', color: 'var(--oracle-violet)' },
};

const ALL_STEPS: OperatingStep[] = ['understand', 'diagnose', 'plan', 'execute', 'qa', 'improve'];

// ─── Full Dashboard ────────────────────

interface DashboardProps {
  results: OperatingLoopResult[];
  totalSteps?: number;
  isActive?: boolean;
  task?: string;
}

export function OperatingLoopDashboard({ results, totalSteps = 6, isActive = false, task }: DashboardProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const completedCount = results.length;
  const failedCount = results.filter(r => r.output.startsWith('[Failed')).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const allDone = completedCount >= totalSteps;

  return (
    <div className="oracle-glass rounded-2xl overflow-hidden border border-[var(--oracle-border)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--oracle-border)]">
        <div className="flex items-center gap-2">
          <span className="text-base">🔄</span>
          <h3 className="text-[13px] font-bold text-[var(--oracle-text-1)]">Agency Brain — Operating Loop</h3>
          {isActive && !allDone && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--oracle-primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-primary-l)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--oracle-primary)] animate-pulse" />
              Running
            </span>
          )}
          {allDone && !isActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--oracle-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-success)]">
              ✓ Complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[var(--oracle-text-muted)] font-mono">
          <span>{completedCount}/{totalSteps} steps</span>
          {totalTime > 0 && <span>{totalTime}ms</span>}
          {failedCount > 0 && <span className="text-[var(--oracle-error)]">{failedCount} failed</span>}
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div className="px-4 py-2">
        <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: failedCount > 0
                ? 'linear-gradient(90deg, var(--oracle-success), var(--oracle-error))'
                : 'linear-gradient(90deg, var(--oracle-primary), var(--oracle-cyan))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* ── Task ── */}
      {task && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-[var(--oracle-text-muted)] truncate" title={task}>Task: {task}</p>
        </div>
      )}

      {/* ── Steps Timeline ── */}
      <div className="px-4 pb-4 space-y-2">
        {ALL_STEPS.map((stepKey, index) => {
          const meta = STEP_META[stepKey];
          const result = results.find(r => r.step === stepKey);
          const isCompleted = !!result;
          const isFailed = !!result && result.output.startsWith('[Failed');
          const isCurrent = isActive && !isCompleted && index === completedCount;
          const isExpanded = expandedStep === stepKey;

          return (
            <motion.div
              key={stepKey}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, duration: 0.3 }}
            >
              <button
                onClick={() => isCompleted && setExpandedStep(isExpanded ? null : stepKey)}
                className={`w-full rounded-xl p-3 text-left transition-all ${
                  isCurrent
                    ? 'bg-[var(--oracle-primary)]/10 border border-[var(--oracle-primary)]/30'
                    : isCompleted && !isFailed
                    ? 'bg-[var(--oracle-surface-2)]/50 border border-[var(--oracle-border)] hover:border-[var(--oracle-border-strong)]'
                    : isFailed
                    ? 'bg-[var(--oracle-error)]/5 border border-[var(--oracle-error)]/20'
                    : 'border border-transparent opacity-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Step icon */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
                    isCompleted && !isFailed
                      ? 'bg-[var(--oracle-success)]/10'
                      : isFailed
                      ? 'bg-[var(--oracle-error)]/10'
                      : isCurrent
                      ? 'bg-[var(--oracle-primary)]/10'
                      : 'bg-[var(--oracle-surface-2)]'
                  }`}>
                    {isCompleted && !isFailed ? <span className="text-[var(--oracle-success)]">✓</span>
                     : isFailed ? <span className="text-[var(--oracle-error)]">✗</span>
                     : isCurrent ? <div className="oracle-spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} />
                     : <span style={{ color: meta.color }}>{meta.emoji}</span>}
                  </div>

                  {/* Step info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">
                        {index + 1}. {meta.label}
                      </span>
                      {isCompleted && result && (
                        <span className="text-[9px] font-mono text-[var(--oracle-text-muted)]">{result.duration}ms</span>
                      )}
                      {isCurrent && (
                        <span className="text-[9px] text-[var(--oracle-primary-l)] animate-pulse">Processing…</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--oracle-text-muted)] mt-0.5">{meta.description}</p>
                  </div>

                  {/* Expand arrow */}
                  {isCompleted && (
                    <span className="text-[10px] text-[var(--oracle-text-muted)] shrink-0">
                      {isExpanded ? '▾' : '▸'}
                    </span>
                  )}
                </div>

                {/* Expanded output */}
                <AnimatePresence>
                  {isExpanded && result && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-lg bg-[var(--oracle-bg)] p-3 border border-[var(--oracle-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-medium text-[var(--oracle-text-muted)]">
                            Output via {result.agentUsed}
                          </span>
                          <span className="text-[9px] font-mono text-[var(--oracle-text-muted)]">
                            {result.duration}ms
                          </span>
                        </div>
                        <p className={`text-[11px] whitespace-pre-wrap line-clamp-6 ${isFailed ? 'text-[var(--oracle-error)]' : 'text-[var(--oracle-text-2)]'}`}>
                          {result.output}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Compact Step Dots ─────────────────

export function OperatingLoopStepDots({ results, totalSteps = 6, isActive }: {
  results: OperatingLoopResult[];
  totalSteps: number;
  isActive: boolean;
}) {
  const completedCount = results.length;
  const failedCount = results.filter(r => r.output.startsWith('[Failed')).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  const allDone = completedCount >= totalSteps;
  const currentStep = !allDone && completedCount < ALL_STEPS.length ? ALL_STEPS[completedCount] : null;

  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--oracle-surface-2)]/70 px-3 py-2">
      <span className="text-sm">🔄</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--oracle-text-2)]">
            {allDone ? 'Loop Complete' : currentStep ? `${STEP_META[currentStep].emoji} ${STEP_META[currentStep].label}…` : 'Operating Loop'}
          </span>
          {isActive && !allDone && (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--oracle-primary)] animate-pulse" />
          )}
        </div>
        {/* Step dots */}
        <div className="flex items-center gap-1 mt-1">
          {ALL_STEPS.map((stepKey, i) => {
            const result = results.find(r => r.step === stepKey);
            const isCompleted = !!result;
            const isFailed = !!result && result.output.startsWith('[Failed');
            const isCurrentStep = isActive && !isCompleted && i === completedCount;

            return (
              <div
                key={stepKey}
                title={STEP_META[stepKey].label}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isFailed
                    ? 'w-1.5 bg-[var(--oracle-error)]'
                    : isCompleted
                    ? 'w-1.5 bg-[var(--oracle-success)]'
                    : isCurrentStep
                    ? 'w-3 bg-[var(--oracle-primary)] animate-pulse'
                    : 'w-1.5 bg-[var(--oracle-surface-3)]'
                }`}
              />
            );
          })}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-[10px] font-mono text-[var(--oracle-text-muted)]">{completedCount}/{totalSteps}</span>
        {totalTime > 0 && <p className="text-[9px] font-mono text-[var(--oracle-text-muted)]">{totalTime}ms</p>}
      </div>
      {failedCount > 0 && <span className="text-[10px] text-[var(--oracle-error)]">⚠</span>}
    </div>
  );
}

// ─── Floating Progress Indicator ───────

export function OperatingLoopFloatingProgress({ results, totalSteps = 6, isActive, task }: {
  results: OperatingLoopResult[];
  totalSteps: number;
  isActive: boolean;
  task?: string;
}) {
  if (!isActive && results.length === 0) return null;

  const completedCount = results.length;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const currentStep = ALL_STEPS[completedCount] || ALL_STEPS[ALL_STEPS.length - 1];
  const meta = STEP_META[currentStep];
  const allDone = completedCount >= totalSteps;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 oracle-glass oracle-card-shadow rounded-2xl px-5 py-3 min-w-[340px]"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{isActive && !allDone ? meta.emoji : '✓'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">
              {isActive && !allDone ? `${meta.label}…` : 'Loop Complete'}
            </span>
            <span className="text-[10px] font-mono text-[var(--oracle-text-muted)]">{completedCount}/{totalSteps}</span>
          </div>
          {isActive && !allDone && (
            <p className="text-[10px] text-[var(--oracle-text-muted)] mt-0.5">{meta.description}</p>
          )}
          {task && (
            <p className="text-[9px] text-[var(--oracle-text-muted)] mt-0.5 truncate">{task}</p>
          )}
        </div>
      </div>
      <div className="mt-2 h-1 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--oracle-primary)] to-[var(--oracle-cyan)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}
