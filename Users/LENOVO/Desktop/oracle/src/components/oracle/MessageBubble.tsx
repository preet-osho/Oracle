'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { motionVariants, transitions } from '@/styles/design-tokens';
import { loadGuardConfig, recordLearning } from '@/lib/hallucination-guard';
import { recordGuardVerdict } from '@/lib/feedback-bridge';
import { mdComponents } from './MarkdownComponents';
import { AGENT_TYPES, type AgentType } from './agent-config';
import type { QualityScore, HallucinationCheckResult } from '@/types';

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
  feedback?: 'good' | 'bad';
  isStarred?: boolean;
  onRegenerate?: () => void;
  onBranch?: () => void;
  onStar?: () => void;
  onGood?: () => void;
  onBad?: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  message, qualityScore, guardResult, feedback, isStarred,
  onRegenerate, onBranch, onStar, onGood, onBad,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
