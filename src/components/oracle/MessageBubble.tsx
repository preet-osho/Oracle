'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { motionVariants, transitions } from '@/styles/design-tokens';
import { copyToClipboard } from '@/lib/utils';
import { loadGuardConfig, recordLearning } from '@/lib/hallucination-guard';
import { recordGuardVerdict } from '@/lib/feedback-bridge';
import { mdComponents } from './MarkdownComponents';
import { AGENT_TYPES, type AgentType } from './agent-config';
import type { QualityScore, HallucinationCheckResult } from '@/types';
import type { EvalResult } from '@/lib/output-quality-evaluator';
import type { EditorGateResult } from '@/lib/editor-gate';
import type { QualityGateResult, OperatingLoopResult } from '@/lib/agency-operations';
import type { ToolResult as SocialToolResult } from '@/lib/mcp/social-media-executor';

// ─── ChatMessage Type ──────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  costUSD?: number;
  qualityScore?: QualityScore;
  isStreaming?: boolean;
  agentType?: AgentType;
  searchUsed?: boolean;
}

// ─── Message Bubble (Memoized + Markdown) ──

import { memo } from 'react';

interface MessageBubbleProps {
  message: ChatMessage;
  qualityScore?: QualityScore;
  guardResult?: HallucinationCheckResult;
  evalResult?: EvalResult;
  editorResult?: EditorGateResult;
  qualityGateResult?: QualityGateResult;
  operatingLoopResult?: OperatingLoopResult[];
  toolResults?: SocialToolResult[];
  feedback?: 'good' | 'bad';
  isStarred?: boolean;
  onRegenerate?: () => void;
  onBranch?: () => void;
  onStar?: () => void;
  onGood?: () => void;
  onBad?: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  message, qualityScore, guardResult, evalResult, editorResult, qualityGateResult, operatingLoopResult, toolResults, feedback, isStarred,
  onRegenerate, onBranch, onStar, onGood, onBad,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    copyToClipboard(message.content).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  };

  return (
    <motion.div
      layout
      variants={motionVariants.fadeUp}
      initial="initial"
      animate="animate"
      transition={transitions.smooth}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'oracle-msg-user rounded-br-md'
            : 'oracle-msg-agent rounded-bl-md'
        }`}
      >
        {/* Message Content — Markdown for AI, plain text for user */}
        <div
          className={`text-[14px] leading-relaxed ${
            isUser ? 'text-[var(--oracle-text-1)] whitespace-pre-wrap' : 'oracle-markdown text-[var(--oracle-text-2)]'
          } ${message.isStreaming ? 'oracle-cursor' : ''}`}
          aria-label={`${isUser ? 'You' : 'ORACLE'} said`}
        >
          {isUser ? (
            message.content
          ) : message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={mdComponents}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            '...'
          )}
        </div>

        {/* Agent Meta Row */}
        {!isUser && message.content && !message.isStreaming && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--oracle-border)] pt-2">
            {message.agentType && message.agentType !== 'orchestrator' && (
              <Badge label={AGENT_TYPES.find((a) => a.id === message.agentType)?.label || message.agentType} color="primary" />
            )}
            {message.provider && (
              <Badge label={message.provider} color="primary" />
            )}
            {message.model && (
              <Badge label={message.model} color="muted" />
            )}
            {message.tokensUsed && (
              <span className="text-[10px] text-[var(--oracle-text-muted)] font-mono">
                {Math.round(message.tokensUsed / 1000)}k tokens
              </span>
            )}
            {message.costUSD !== undefined && message.costUSD > 0 && (
              <span className="text-[10px] text-[var(--oracle-text-muted)] font-mono">
                ₹{((message.costUSD || 0) * 84).toFixed(2)}
              </span>
            )}
            {message.searchUsed && (
              <Badge label="🔍 Web search" color="primary" />
            )}
            {qualityScore && (
              <Badge
                label={`${qualityScore.total}/100`}
                color={
                  qualityScore.total >= 80
                    ? 'success'
                    : qualityScore.total >= 60
                    ? 'warning'
                    : 'error'
                }
              />
            )}
            {guardResult && (
              <ConfidenceBadge result={guardResult} originalOutput={message.content} provider={message.provider} model={message.model} agentType={message.agentType} />
            )}
            {evalResult && (
              <EvalBadge result={evalResult} />
            )}
            {editorResult && (
              <EditorBadge result={editorResult} />
            )}
            {toolResults && toolResults.length > 0 && (
              <ToolInvocationBadge results={toolResults} />
            )}
            {operatingLoopResult && operatingLoopResult.length > 0 && (
              <OperatingLoopBadge results={operatingLoopResult} />
            )}
            {qualityGateResult && (
              <QualityGateBadge result={qualityGateResult} />
            )}
            <div className="ml-auto flex items-center gap-1">
              <MetaButton
                icon={copied ? '✓' : '📋'}
                label="Copy"
                onClick={handleCopy}
              />
              {onRegenerate && (
                <MetaButton icon="🔄" label="Regenerate" onClick={onRegenerate} />
              )}
              {onBranch && (
                <MetaButton icon="🔀" label="Branch" onClick={onBranch} />
              )}
              {onStar && (
                <MetaButton icon={isStarred ? '⭐' : '☆'} label="Star" onClick={onStar} active={isStarred} />
              )}
              <MetaButton
                icon={feedback === 'good' ? '👍✓' : '👍'}
                label="Good"
                onClick={onGood}
                active={feedback === 'good'}
              />
              <MetaButton
                icon={feedback === 'bad' ? '👎✓' : '👎'}
                label="Bad"
                onClick={onBad}
                active={feedback === 'bad'}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ─── Confidence Badge ──────────────────

function ConfidenceBadge({ result, originalOutput, provider, model, agentType }: { result: HallucinationCheckResult; originalOutput: string; provider?: string; model?: string; agentType?: string }) {
  const [expanded, setExpanded] = useState(false);
  const confidence = result.confidence;
  const guardConfig = loadGuardConfig();
  const passThreshold = guardConfig.thresholds.passThreshold;
  const warnThreshold = guardConfig.thresholds.warnThreshold;
  const color = confidence >= passThreshold ? 'success' : confidence >= warnThreshold ? 'warning' : 'error';
  const emoji = confidence >= passThreshold ? '✅' : confidence >= warnThreshold ? '⚠️' : '🚨';

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 rounded-full border border-[var(--oracle-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
        title={result.assessment}
      >
        {emoji} {confidence}% confidence
        <span className="text-[8px]">▾</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl p-3"
          >
            <p className="text-[12px] font-semibold text-[var(--oracle-text-1)] mb-2">🛡️ Hallucination Guard</p>
            <p className="text-[11px] text-[var(--oracle-text-3)] mb-2">{result.assessment}</p>

            {/* Confidence bar */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-[var(--oracle-text-muted)] mb-1">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${confidence}%`,
                    backgroundColor: color === 'success' ? 'var(--oracle-success)' : color === 'warning' ? 'var(--oracle-warning)' : 'var(--oracle-error)',
                  }}
                />
              </div>
            </div>

            {/* Checks summary */}
            {result.checks.length > 0 && (
              <div className="mb-2 space-y-1">
                {result.checks.slice(0, 5).map((check) => (
                  <div key={check.name} className="flex items-center gap-2 text-[10px]">
                    <span>{check.passed ? '✅' : '❌'}</span>
                    <span className="text-[var(--oracle-text-3)]">{check.name.replace(/_/g, ' ')}</span>
                    <span className="ml-auto text-[var(--oracle-text-muted)]">{check.score}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="border-t border-[var(--oracle-border)] pt-2">
                <p className="text-[10px] font-medium text-[var(--oracle-text-muted)] mb-1">Suggestions:</p>
                {result.suggestions.slice(0, 3).map((s, i) => (
                  <p key={i} className="text-[10px] text-[var(--oracle-text-3)] mb-0.5">• {s}</p>
                ))}
              </div>
            )}

            {/* Learn button */}
            <div className="border-t border-[var(--oracle-border)] pt-2 mt-2 flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); recordLearning({ originalOutput, userVerdict: 'accepted', patternType: 'general', domain: 'general', confidenceAtCheck: confidence }); recordGuardVerdict(provider || 'unknown', model || 'unknown', agentType || 'orchestrator', originalOutput, 'accepted', confidence); setExpanded(false); }}
                className="rounded-md bg-[var(--oracle-success)]/10 px-2 py-1 text-[10px] text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20 transition-colors"
              >
                👍 Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); recordLearning({ originalOutput, userVerdict: 'rejected', patternType: 'general', domain: 'general', confidenceAtCheck: confidence }); recordGuardVerdict(provider || 'unknown', model || 'unknown', agentType || 'orchestrator', originalOutput, 'rejected', confidence); setExpanded(false); }}
                className="rounded-md bg-[var(--oracle-error)]/10 px-2 py-1 text-[10px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/20 transition-colors"
              >
                👎 Reject
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Eval Badge ────────────────────────

function EvalBadge({ result }: { result: EvalResult }) {
  const [expanded, setExpanded] = useState(false);
  const score = result.overallScore;
  const color = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';
  const emoji = result.passed ? '✅' : '⚠️';

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 rounded-full border border-[var(--oracle-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
        title={result.passed ? 'Output quality passed' : 'Output quality below threshold'}
      >
        {emoji} {score}/100 quality
        <span className="text-[8px]">▾</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl p-3"
          >
            <p className="text-[12px] font-semibold text-[var(--oracle-text-1)] mb-2">📊 Output Quality Evaluator</p>

            {/* Score bar */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-[var(--oracle-text-muted)] mb-1">
                <span>Overall Score</span>
                <span>{score}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${score}%`,
                    backgroundColor: color === 'success' ? 'var(--oracle-success)' : color === 'warning' ? 'var(--oracle-warning)' : 'var(--oracle-error)',
                  }}
                />
              </div>
            </div>

            {/* Check results */}
            {result.checks.length > 0 && (
              <div className="mb-2 space-y-1">
                {result.checks.map((check) => (
                  <div key={check.name} className="flex items-center gap-2 text-[10px]">
                    <span>{check.passed ? '✅' : '❌'}</span>
                    <span className="text-[var(--oracle-text-3)]">{check.name.replace(/_/g, ' ')}</span>
                    <span className="ml-auto text-[var(--oracle-text-muted)]">{check.score}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="border-t border-[var(--oracle-border)] pt-2">
                <p className="text-[10px] font-medium text-[var(--oracle-text-muted)] mb-1">Suggestions:</p>
                {result.suggestions.slice(0, 3).map((s, i) => (
                  <p key={i} className="text-[10px] text-[var(--oracle-text-3)] mb-0.5">• {s}</p>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Editor Gate Badge ─────────────────

function EditorBadge({ result }: { result: EditorGateResult }) {
  const [expanded, setExpanded] = useState(false);
  const confidence = result.confidence;
  const color = result.passed ? 'success' : confidence >= 50 ? 'warning' : 'error';
  const emoji = result.passed ? '✅' : '⚠️';

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 rounded-full border border-[var(--oracle-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
        title={result.assessment}
      >
        {emoji} editor {confidence}%
        <span className="text-[8px]">▾</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl p-3"
          >
            <p className="text-[12px] font-semibold text-[var(--oracle-text-1)] mb-2">✏️ Editor Gate</p>
            <p className="text-[11px] text-[var(--oracle-text-3)] mb-2">{result.assessment}</p>

            {/* Confidence bar */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-[var(--oracle-text-muted)] mb-1">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${confidence}%`,
                    backgroundColor: color === 'success' ? 'var(--oracle-success)' : color === 'warning' ? 'var(--oracle-warning)' : 'var(--oracle-error)',
                  }}
                />
              </div>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="border-t border-[var(--oracle-border)] pt-2">
                <p className="text-[10px] font-medium text-[var(--oracle-text-muted)] mb-1">Issues Found:</p>
                {result.issues.slice(0, 5).map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] mb-1">
                    <span>{issue.severity === 'critical' ? '🚨' : issue.severity === 'high' ? '❌' : '⚠️'}</span>
                    <span className="text-[var(--oracle-text-3)]">{issue.description}</span>
                  </div>
                ))}
              </div>
            )}

            {result.passed && result.issues.length === 0 && (
              <p className="text-[10px] text-[var(--oracle-success)]">✅ No issues found — output is client-ready</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Agency Quality Gate Badge ────────

function QualityGateBadge({ result }: { result: QualityGateResult }) {
  const [expanded, setExpanded] = useState(false);
  const color = result.passed ? 'success' : result.score >= 60 ? 'warning' : 'error';
  const emoji = result.passed ? '✅' : '⚠️';

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 rounded-full border border-[var(--oracle-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
        title={result.passed ? 'Agency quality gate passed' : 'Agency quality gate issues found'}
      >
        {emoji} agency QA {result.score}%
        <span className="text-[8px]">▾</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl p-3"
          >
            <p className="text-[12px] font-semibold text-[var(--oracle-text-1)] mb-2">🏢 Agency Quality Gate</p>

            {/* Score bar */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-[var(--oracle-text-muted)] mb-1">
                <span>Score</span>
                <span>{result.score}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${result.score}%`,
                    backgroundColor: color === 'success' ? 'var(--oracle-success)' : color === 'warning' ? 'var(--oracle-warning)' : 'var(--oracle-error)',
                  }}
                />
              </div>
            </div>

            {/* Check results */}
            <div className="mb-2 space-y-1">
              {result.checks.map((check) => (
                <div key={check.name} className="flex items-center gap-2 text-[10px]">
                  <span>{check.passed ? '✅' : '❌'}</span>
                  <span className="text-[var(--oracle-text-3)]">{check.name}</span>
                  <span className="ml-auto text-[var(--oracle-text-muted)] text-[9px]">{check.message}</span>
                </div>
              ))}
            </div>

            {!result.passed && (
              <p className="text-[10px] text-[var(--oracle-warning)] border-t border-[var(--oracle-border)] pt-2">
                ⚡ Review failed checks above before delivering to client
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Operating Loop Badge ───────────────

function OperatingLoopBadge({ results }: { results: OperatingLoopResult[] }) {
  const [expanded, setExpanded] = useState(false);
  const completedSteps = results.filter(r => !r.output.startsWith('[Failed'));
  const failedSteps = results.filter(r => r.output.startsWith('[Failed'));
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  const allPassed = failedSteps.length === 0;
  const emoji = allPassed ? '🔄' : '⚠️';

  const stepEmojis: Record<string, string> = {
    understand: '🔍',
    diagnose: '🩺',
    plan: '📋',
    execute: '⚡',
    qa: '✅',
    improve: '📈',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 rounded-full border border-[var(--oracle-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
        title={`${completedSteps.length}/${results.length} operating loop steps completed in ${totalTime}ms`}
      >
        {emoji} {completedSteps.length}/{results.length} loop · {totalTime}ms
        <span className="text-[8px]">▾</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-96 max-h-80 overflow-y-auto rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl p-3"
          >
            <p className="text-[12px] font-semibold text-[var(--oracle-text-1)] mb-2">🔄 Operating Loop (6-Step)</p>
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.step} className="border-t border-[var(--oracle-border)] pt-2 first:border-0 first:pt-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{stepEmojis[r.step] || '•'}</span>
                    <span className="text-[11px] font-medium text-[var(--oracle-text-1)] capitalize">{r.step}</span>
                    <span className="text-[9px] text-[var(--oracle-text-muted)]">via {r.agentUsed}</span>
                    <span className="ml-auto text-[9px] text-[var(--oracle-text-muted)]">{r.duration}ms</span>
                  </div>
                  <p className="text-[10px] text-[var(--oracle-text-3)] line-clamp-3 ml-5">
                    {r.output.startsWith('[Failed') ? (
                      <span className="text-[var(--oracle-error)]">{r.output}</span>
                    ) : (
                      r.output.slice(0, 300) + (r.output.length > 300 ? '...' : '')
                    )}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tool Invocation Badge ─────────────

function ToolInvocationBadge({ results }: { results: SocialToolResult[] }) {
  const [expanded, setExpanded] = useState(false);
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;
  const emoji = failCount > 0 ? '⚠️' : '📱';

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 rounded-full border border-[var(--oracle-primary)]/20 bg-[var(--oracle-primary)]/5 px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/10 transition-colors"
        title={`${results.length} social media action(s) executed`}
      >
        {emoji} {results.length} social action{results.length > 1 ? 's' : ''}{failCount > 0 ? ` · ${failCount} failed` : ''}
        <span className="text-[8px]">▾</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-80 max-h-72 overflow-y-auto rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl p-3"
          >
            <p className="text-[12px] font-semibold text-[var(--oracle-text-1)] mb-2">📱 Social Media Actions</p>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="border-t border-[var(--oracle-border)] pt-2 first:border-0 first:pt-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{r.success ? '✅' : '❌'}</span>
                    <span className="text-[11px] font-medium text-[var(--oracle-text-1)]">
                      {r.tool.replace('social_', '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--oracle-text-3)] line-clamp-3 ml-5 whitespace-pre-wrap">
                    {r.output.slice(0, 300)}{r.output.length > 300 ? '...' : ''}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Badge ─────────────────────────────

export function Badge({ label, color }: { label: string; color: 'primary' | 'muted' | 'success' | 'warning' | 'error' }) {
  const colorMap = {
    primary: 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)] border-[var(--oracle-primary)]/20',
    muted: 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)] border-[var(--oracle-border)]',
    success: 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)] border-[var(--oracle-success)]/20',
    warning: 'bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)] border-[var(--oracle-warning)]/20',
    error: 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)] border-[var(--oracle-error)]/20',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorMap[color]}`}>
      {label}
    </span>
  );
}

// ─── Meta Button ───────────────────────

export function MetaButton({ icon, label, onClick, active }: { icon: string; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label={label}
      className={`flex h-8 items-center gap-1 rounded-md px-1.5 text-[10px] transition-colors ${
        active
          ? 'text-[var(--oracle-primary-l)] bg-[var(--oracle-primary)]/10'
          : 'text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-text-3)]'
      }`}
    >
      {icon} <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}
