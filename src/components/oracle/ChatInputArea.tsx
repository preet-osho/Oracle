'use client';

import React, { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { estimateTokens } from '@/lib/utils';
import { AGENT_TYPES, type AgentType } from './agent-config';
import { DailyUsageIndicator, useSubscriptionState } from './FeatureGate';
import { hasAgentAccess } from '@/lib/subscription';
import { GodModeCostIndicator } from './GodModeCostIndicator';


// ─── Chat Input Area ───────────────────

interface ChatInputAreaProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isStreaming: boolean;
  agentType: AgentType;
  setAgentType: (type: AgentType) => void;
  attachments: Array<{ name: string; content: string }>;
  setAttachments: React.Dispatch<React.SetStateAction<Array<{ name: string; content: string }>>>;
  estimatedCost: { inr: number; usd: number; isFree: boolean } | null;
  detectedPatterns: Array<{ category: string; confidence: number; matchedKeywords: string[] }>;
  crossDomainSuggestions: Array<{ service: string; relevance: number; rationale: string; value: string }>;
  dailyUsage?: { used: number; limit: number } | null;
  onSend: (overrideContent?: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onFileAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSidebarToggle?: () => void;
  sidebarOpen?: boolean;
  godModeEnabled?: boolean;
  setGodModeEnabled?: (enabled: boolean) => void;
}

export function ChatInputArea({
  input, setInput, isStreaming, agentType, setAgentType,
  attachments, setAttachments, estimatedCost,
  detectedPatterns, crossDomainSuggestions, dailyUsage,
  onSend, onPaste, onFileAttach,
  onSidebarToggle, sidebarOpen,
  godModeEnabled = false, setGodModeEnabled,
}: ChatInputAreaProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { plan } = useSubscriptionState();
  const agentAllowed = hasAgentAccess(plan, agentType);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }, [onSend]);

  return (
    <div className="border-t border-[var(--oracle-border)] bg-[var(--oracle-bg)]/80 backdrop-blur-xl p-3 sm:p-4">
      {/* Sidebar Toggle */}
      {onSidebarToggle && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={onSidebarToggle}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            className="rounded-lg border border-[var(--oracle-border)] px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:border-[var(--oracle-border-strong)] hover:text-[var(--oracle-text-3)] transition-colors min-h-[36px]"
          >
            {sidebarOpen ? '→ Hide sidebar' : '← Show sidebar'}
          </button>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        {/* Agent Badge + GOD MODE Toggle */}
        {(() => {
          const agentInfo = AGENT_TYPES.find((a) => a.id === agentType);
          if (!agentInfo) return null;
          const isOrchestrator = agentType === 'orchestrator';
          const locked = !agentAllowed;
          return (
            <div className={`mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 ${
              godModeEnabled
                ? 'bg-[var(--oracle-error)]/5 border-[var(--oracle-error)]/20'
                : locked
                  ? 'bg-[var(--oracle-warning)]/5 border-[var(--oracle-warning)]/20'
                  : isOrchestrator
                    ? 'bg-[var(--oracle-surface-2)]/60 border-[var(--oracle-border)]'
                    : 'bg-[var(--oracle-primary)]/5 border-[var(--oracle-primary)]/15'
            }`}>
              {godModeEnabled ? (
                <span className="text-sm">⚡</span>
              ) : locked ? (
                <span className="text-sm">🔒</span>
              ) : (
                <span className="text-sm">{agentInfo.emoji}</span>
              )}
              <span className={`text-[11px] font-semibold ${
                godModeEnabled
                  ? 'text-[var(--oracle-error)]'
                  : locked
                    ? 'text-[var(--oracle-warning)]'
                    : isOrchestrator
                      ? 'text-[var(--oracle-text-3)]'
                      : 'text-[var(--oracle-primary-l)]'
              }`}>{agentInfo.label} Agent{godModeEnabled ? ' · ⚡ GOD MODE' : ''}</span>
              {locked ? (
                <span className="text-[10px] text-[var(--oracle-warning)] hidden sm:inline">· Requires {plan === 'starter' ? 'Pro' : 'Agency'} plan</span>
              ) : !godModeEnabled ? (
                <span className="text-[10px] text-[var(--oracle-text-muted)] hidden sm:inline">· {isOrchestrator ? 'Multi-agent orchestrator mode' : 'Specialized system prompt loaded'}</span>
              ) : (
                <span className="text-[10px] text-[var(--oracle-error)] hidden sm:inline">· High-stakes verification enabled</span>
              )}
              {locked ? (
                <a
                  href="/pricing"
                  className="oracle-cta-pulse ml-auto rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-primary)] hover:bg-[var(--oracle-card-hover)] transition-colors"
                >
                  Upgrade →
                </a>
              ) : (
                <div className="ml-auto flex items-center gap-2">
                  {!isOrchestrator && !godModeEnabled ? (
                    <button
                      onClick={() => setAgentType('orchestrator')}
                      className="rounded-md px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-text-3)] transition-colors"
                    >
                      Switch to Orchestrator
                    </button>
                  ) : null}
                  <GodModeCostIndicator enabled={godModeEnabled} size="sm" />
                  {setGodModeEnabled && (
                <button
                  onClick={() => setGodModeEnabled(!godModeEnabled)}
                  aria-pressed={godModeEnabled}
                  aria-label={godModeEnabled ? 'Toggle GOD MODE: currently on' : 'Toggle GOD MODE: currently off'}
                  aria-describedby="god-mode-description"
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${
                    godModeEnabled
                      ? 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/20'
                      : 'text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-text-3)]'
                  }`}
                  title={godModeEnabled ? 'Disable GOD MODE for this conversation' : 'Enable GOD MODE for high-stakes tasks'}
                >
                  ⚡ {godModeEnabled ? 'GOD MODE ON' : 'Enable GOD MODE'}
                </button>
                  )}
                  {/* Description for aria-describedby — hidden but available to screen readers */}
                  <p id="god-mode-description" className="sr-only">
                    Activates enhanced system prompts with high-stakes verification and stricter quality gates. May incur additional token cost.
                  </p>
                  {/* Live region for screen reader announcements */}
                  <div
                    aria-live="polite"
                    aria-atomic="true"
                    className="sr-only"
                    role="status"
                  >
                    {godModeEnabled ? 'GOD MODE enabled' : 'GOD MODE disabled'}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Attachment Pills */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-full bg-[var(--oracle-surface-2)] px-3 py-1 text-[12px] text-[var(--oracle-text-2)]"
              >
                📎 {a.name}
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] min-h-[44px] min-w-[44px] flex items-center justify-center -m-3"
                  aria-label={`Remove attachment ${a.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Daily Usage Indicator */}
        {dailyUsage && dailyUsage.limit > 0 && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-[var(--oracle-surface-2)]/60 px-3 py-1.5">
            <span className="text-[10px] text-[var(--oracle-text-muted)]">📊 Today:</span>
            <DailyUsageIndicator used={dailyUsage.used} limit={dailyUsage.limit} />
            {dailyUsage.used >= dailyUsage.limit && (
              <a href="/pricing" className="text-[10px] font-medium text-[var(--oracle-primary)] hover:underline">Upgrade →</a>
            )}
          </div>
        )}

        {/* Cost Estimate */}
        {estimatedCost && input.trim() && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-[var(--oracle-surface-2)]/60 px-3 py-1.5">
            <span className="text-[10px] text-[var(--oracle-text-muted)]">💰 Est. cost:</span>
            {estimatedCost.isFree ? (
              <span className="text-[10px] font-medium text-[var(--oracle-success)]">FREE (free tier model)</span>
            ) : (
              <span className="text-[10px] font-mono text-[var(--oracle-text-muted)]">
                ₹{estimatedCost.inr.toFixed(2)} (${estimatedCost.usd.toFixed(4)})
              </span>
            )}
            <span className="text-[10px] text-[var(--oracle-text-muted)]">·</span>
            <span className="text-[10px] text-[var(--oracle-text-muted)]">{estimateTokens(input)} tokens</span>
          </div>
        )}

        {/* Pattern Recognition & Cross-Domain Suggestions */}
        {(detectedPatterns.length > 0 || crossDomainSuggestions.length > 0) && input.length > 10 && (
          <div className="mb-2 space-y-1.5">
            {detectedPatterns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-[var(--oracle-surface-2)]/60 px-3 py-1.5">
                <span className="text-[10px] text-[var(--oracle-text-muted)]">🏷️ Detected:</span>
                {detectedPatterns.map((p, i) => (
                  <span key={i} className="rounded-full bg-[var(--oracle-primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-primary-l)]">
                    {p.category.replace(/-/g, ' ')} ({p.confidence}%)
                  </span>
                ))}
              </div>
            )}
            {crossDomainSuggestions.length > 0 && (
              <div className="rounded-lg bg-[var(--oracle-surface-2)]/60 px-3 py-2">
                <p className="mb-1 text-[10px] text-[var(--oracle-text-muted)]">🔗 Adjacent services to consider:</p>
                <div className="flex flex-wrap gap-1.5">
                  {crossDomainSuggestions.map((s, i) => (
                    <span key={i} className="rounded-full bg-[var(--oracle-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-success)]" title={s.rationale}>
                      + {s.service} ({s.value})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Container */}
        <div className="oracle-glass rounded-2xl border border-[var(--oracle-border-strong)] p-2">
          <div className="flex items-end gap-2">
            {/* Action Buttons */}
            <div className="flex items-center gap-1 pb-1.5">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => document.getElementById('file-input')?.click()}
                aria-label="Attach document"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-text-3)] transition-colors"
              >
                <span className="text-base" aria-hidden="true">📎</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition || (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition;
                    const recognition = new (SpeechRecognition as new () => { lang: string; continuous: boolean; onresult: (e: { results: Array<{ isFinal: boolean; length: number; item: (i: number) => { transcript: string } }> }) => void; start: () => void; stop: () => void })();
                    recognition.lang = 'en-IN';
                    recognition.continuous = false;
                    recognition.onresult = (e: { results: Array<{ isFinal: boolean; length: number; item: (i: number) => { transcript: string } }> }) => {
                      if (e.results[0]?.isFinal) {
                        setInput((prev) => prev + ' ' + e.results[0].item(0).transcript);
                      }
                    };
                    recognition.start();
                  }
                }}
                aria-label="Voice input"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-text-3)] transition-colors"
              >
                <span className="text-base" aria-hidden="true">🎙</span>
              </motion.button>
            </div>

            {/* Textarea */}
            <textarea
              ref={inputRef}
              data-chat-input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={onPaste}
              placeholder="Describe any agency task... (Ctrl+V to paste images)"
              rows={1}
              aria-label="Chat input"
              className="flex-1 resize-none bg-transparent py-2 text-[15px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none min-h-[48px] max-h-[120px]"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />

            {/* Send Button */}
            <button
              onClick={() => onSend()}
              disabled={!input.trim() || isStreaming}
              aria-label="Send message"
              className="flex h-11 w-11 items-center justify-center rounded-xl oracle-gradient-bg text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 mb-0.5"
            >
              {isStreaming ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={onFileAttach}
        />
      </div>
    </div>
  );
}
