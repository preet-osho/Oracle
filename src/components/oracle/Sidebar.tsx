'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouterStore } from '@/stores/router.store';
import { PROVIDERS } from '@/data/providers';
import { QUICK_ACTIONS } from '@/styles/design-tokens';
import { transitions } from '@/styles/design-tokens';
import { processDocument, indexDocument } from '@/lib/rag';
import { useSubscriptionState, UpgradeModal, getRequiredPlanForFeature } from './FeatureGate';
import type { PlanId } from '@/lib/subscription';
import { OperatingLoopDashboard } from '@/components/oracle/OperatingLoopDashboard';
import type { OperatingLoopResult } from '@/lib/agency-operations';
import { on } from '@/lib/events';

// ─── Sidebar ───────────────────────────

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickAction?: (prompt: string) => void;
  selectedProjectId?: string | null;
  projects?: Array<{ id: string; clientName: string; industry: string; service: string; status: string; memoryCount: number }>;
  qualityScore?: number;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: () => void;
}

export function Sidebar({ isOpen, onClose, onQuickAction, selectedProjectId, projects = [], qualityScore = 0, webSearchEnabled = false, onWebSearchToggle }: SidebarProps) {
  // ── Last completed operating loop state ──
  const [lastLoopResults, setLastLoopResults] = useState<OperatingLoopResult[]>([]);
  const [lastLoopTask, setLastLoopTask] = useState('');
  const [showLoopDashboard, setShowLoopDashboard] = useState(false);

  // Listen for oracle-loop-complete events from ChatPanel
  useEffect(() => {
    return on('oracle-loop-complete', (e) => {
      if (e.detail?.results) {
        setLastLoopResults(e.detail.results);
        setLastLoopTask(e.detail.task || '');
        setShowLoopDashboard(true);
      }
    });
  }, []);
  const {
    selectedModel,
    setSelectedModel,
    autoRoute,
    toggleAutoRoute,
    byokKeys,
  } = useRouterStore();

  const configuredProviders = Object.keys(byokKeys);
  const { plan } = useSubscriptionState();
  const webSearchRequiredPlan = getRequiredPlanForFeature('webSearch');
  const webSearchAllowed = plan === 'pro' || plan === 'agency';
  const [featureModal, setFeatureModal] = useState<{ open: boolean; feature: string; requiredPlan: PlanId }>({
    open: false,
    feature: '',
    requiredPlan: 'pro',
  });

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Mobile Overlay ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.snappy}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* ── Sidebar Panel ── */}
          <motion.aside
            initial={{ x: 280 }}
            animate={{ x: 0 }}
            exit={{ x: 280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-40 flex h-full w-[280px] flex-col border-l border-[var(--oracle-border)] bg-[var(--oracle-bg)] lg:relative lg:z-auto"
            role="complementary"
            aria-label="Sidebar"
          >
            {/* ── Close button (mobile) ── */}
            <div className="flex items-center justify-between p-4 pb-2 lg:hidden">
              <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">Sidebar</span>
              <button
                onClick={onClose}
                aria-label="Close sidebar"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

              {/* ── Quick Actions ── */}
              <Section title="⚡ Quick Actions">
                <div className="space-y-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      aria-label={action.label}
                      onClick={() => onQuickAction?.(action.prompt)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] text-[var(--oracle-text-2)] transition-colors hover:bg-[var(--oracle-card-hover)] min-h-[44px]"
                    >
                      <span className="text-base" aria-hidden="true">{action.emoji}</span>
                      <span className="font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </Section>

              {/* ── Active Project ── */}
              <Section title="📁 Active Project">
                {(() => {
                  const selectedProject = projects.find((p) => p.id === selectedProjectId);
                  if (!selectedProject) {
                    return (
                      <div className="oracle-glass rounded-xl p-3 text-center">
                        <p className="text-[12px] text-[var(--oracle-text-muted)]">
                          No active project
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--oracle-text-muted)]">
                          Select a project from the Projects tab
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="oracle-glass rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📁</span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--oracle-text-1)] truncate">{selectedProject.clientName}</p>
                          <p className="text-[10px] text-[var(--oracle-text-muted)]">{selectedProject.industry} · {selectedProject.service}</p>
                        </div>
                      </div>
                      {selectedProject.memoryCount > 0 && (
                        <p className="mt-2 text-[10px] text-[var(--oracle-success)]">✓ {selectedProject.memoryCount} memories loaded into context</p>
                      )}
                    </div>
                  );
                })()}
              </Section>

              {/* ── RAG Documents ── */}
              <Section title="📄 Documents">
                <RAGDocumentManager />
              </Section>

              {/* ── Web Search ── */}
              <Section title="🌐 Web Search">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[var(--oracle-text-2)]">
                      Enable web search
                    </span>
                    {!webSearchAllowed && (
                      <span className="text-[10px]">🔒</span>
                    )}
                  </div>
                  <ToggleSwitch
                    checked={webSearchEnabled}
                    onChange={() => {
                      if (webSearchAllowed) {
                        onWebSearchToggle?.();
                      } else {
                        setFeatureModal({ open: true, feature: 'Web Search', requiredPlan: webSearchRequiredPlan });
                      }
                    }}
                  />
                </div>
                {!webSearchAllowed && (
                  <p className="mt-1.5 text-[10px] text-[var(--oracle-text-muted)]">
                    Requires {webSearchRequiredPlan === 'agency' ? 'Agency' : 'Pro'} plan · <a href="/pricing" className="text-[var(--oracle-primary)] hover:underline">Upgrade</a>
                  </p>
                )}
              </Section>

              {/* ── Model Selector ── */}
              <Section title="🤖 Model">
                <ModelSelector
                  configuredProviders={configuredProviders}
                  selectedModel={selectedModel}
                  autoRoute={autoRoute}
                  onAutoRouteToggle={toggleAutoRoute}
                  onModelSelect={setSelectedModel}
                />
              </Section>

              {/* ── Last Operating Loop ── */}
              {lastLoopResults.length > 0 && (
                <Section title="🔄 Last Operating Loop">
                  {showLoopDashboard ? (
                    <div className="space-y-2">
                      <OperatingLoopDashboard
                        results={lastLoopResults}
                        totalSteps={6}
                        isActive={false}
                        task={lastLoopTask}
                      />
                      <button
                        onClick={() => setShowLoopDashboard(false)}
                        className="w-full rounded-xl px-3 py-2 text-center text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
                      >
                        Collapse
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowLoopDashboard(true)}
                      className="w-full rounded-xl p-3 text-left transition-colors hover:bg-[var(--oracle-card-hover)] oracle-glass"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔄</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-[var(--oracle-text-2)]">
                            {lastLoopResults.filter(r => !r.output.startsWith('[Failed')).length}/6 steps complete
                          </p>
                          <p className="text-[10px] text-[var(--oracle-text-muted)] truncate">
                            {lastLoopTask.slice(0, 50)}{lastLoopTask.length > 50 ? '…' : ''}
                          </p>
                        </div>
                        <span className="text-[10px] text-[var(--oracle-text-muted)] shrink-0">▸</span>
                      </div>
                    </button>
                  )}
                </Section>
              )}

              {/* ── Quality Average ── */}
              <Section title="📊 Quality Average">
                <QualityBar score={qualityScore} />
              </Section>
            </div>

          </motion.aside>
        </>
      )}
    </AnimatePresence>

    {/* ── Upgrade Modal (outside AnimatePresence so it persists when sidebar closes) ── */}
    <UpgradeModal
      open={featureModal.open}
      onOpenChange={(open) => setFeatureModal((prev) => ({ ...prev, open }))}
      requiredPlan={featureModal.requiredPlan}
      featureLabel={featureModal.feature}
    />
    </>
  );
}

// ─── Section Component ─────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── RAG Document Manager ──────────────

function RAGDocumentManager() {
  const [docs, setDocs] = useState<Array<{ name: string; enabled: boolean }>>([]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const doc = await processDocument(file);
      indexDocument(doc).catch(() => {}); // fire-and-forget embedding indexing
      setDocs((prev) => [...prev, { name: file.name, enabled: true }]);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => document.getElementById('rag-file-input')?.click()}
        aria-label="Upload document for RAG"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--oracle-border-strong)] bg-[var(--oracle-card)] px-3 py-3 text-[12px] font-medium text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-primary)] hover:text-[var(--oracle-primary-l)] min-h-[44px]"
      >
        + Upload document
      </button>
      <input
        id="rag-file-input"
        type="file"
        className="hidden"
        accept=".pdf,.docx,.xlsx,.txt,.md,.csv"
        multiple
        onChange={handleUpload}
      />
      {docs.length > 0 && (
        <div className="space-y-1">
          {docs.map((doc, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--oracle-card-hover)]"
            >
              <span className="text-sm" aria-hidden="true">📄</span>
              <span className="flex-1 truncate text-[12px] text-[var(--oracle-text-2)]">
                {doc.name}
              </span>
              <ToggleSwitch checked={doc.enabled} onChange={() => {
                setDocs((prev) => prev.map((d, j) => j === i ? { ...d, enabled: !d.enabled } : d));
              }} />
              <button
                onClick={() => setDocs((prev) => prev.filter((_, j) => j !== i))}
                className="text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] text-[12px] min-h-[44px] min-w-[44px] flex items-center justify-center -m-3"
                aria-label={`Remove ${doc.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Model Selector ────────────────────

function ModelSelector({
  configuredProviders,
  selectedModel,
  autoRoute,
  onAutoRouteToggle,
  onModelSelect,
}: {
  configuredProviders: string[];
  selectedModel: { providerId: string; modelId: string };
  autoRoute: boolean;
  onAutoRouteToggle: () => void;
  onModelSelect: (provider: string, model: string) => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState(selectedModel.providerId);

  const provider = PROVIDERS.find((p) => p.id === selectedProvider);

  return (
    <div className="space-y-2">
      {/* Auto Route Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[var(--oracle-text-2)]">Auto-route</span>
        <ToggleSwitch checked={autoRoute} onChange={onAutoRouteToggle} />
      </div>

      {!autoRoute && (
        <>
          {/* Provider Dropdown */}
          <select
            value={selectedProvider}
            aria-label="Select AI provider"
            onChange={(e) => {
              setSelectedProvider(e.target.value);
              const p = PROVIDERS.find((p) => p.id === e.target.value);
              if (p && p.models.length > 0) {
                onModelSelect(e.target.value, p.models[0].id);
              }
            }}
            className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-2)] outline-none focus:border-[var(--oracle-primary)] min-h-[44px]"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} disabled={!configuredProviders.includes(p.id)}>
                {p.name} {configuredProviders.includes(p.id) ? '✓' : '(no key)'}
              </option>
            ))}
          </select>

          {/* Model Dropdown */}
          {provider && (
            <select
              value={selectedModel.modelId}
              aria-label="Select AI model"
              onChange={(e) => onModelSelect(selectedProvider, e.target.value)}
              className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-2)] outline-none focus:border-[var(--oracle-primary)] min-h-[44px]"
            >
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.isFree ? '(Free)' : ''}
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  );
}

// ─── Quality Bar ───────────────────────

function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function getGradeLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

function QualityBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'var(--oracle-success)' :
    score >= 60 ? 'var(--oracle-warning)' :
    'var(--oracle-error)';
  const grade = getGrade(score);
  const label = getGradeLabel(score);
  // SVG circle params for the gauge
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      {/* Circular gauge */}
      <div className="relative flex-shrink-0">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle
            cx="34" cy="34" r={radius}
            fill="none"
            stroke="var(--oracle-surface-2)"
            strokeWidth="5"
          />
          <circle
            cx="34" cy="34" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 34 34)"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[14px] font-bold" style={{ color }}>{score > 0 ? grade : '—'}</span>
          <span className="text-[8px] text-[var(--oracle-text-muted)] leading-none">{score > 0 ? `${score}` : ''}</span>
        </div>
      </div>
      {/* Label + bar */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-[var(--oracle-text-2)]">
            {score > 0 ? label : 'No scores yet'}
          </span>
          {score > 0 && (
            <span className="text-[10px] text-[var(--oracle-text-muted)]">{score}/100</span>
          )}
        </div>
        <div className="h-1 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${score}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Toggle Switch ─────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-label={checked ? 'Toggle off' : 'Toggle on'}
      aria-pressed={checked}
      className={`relative h-5 w-9 rounded-full transition-colors ${
        checked ? 'bg-[var(--oracle-primary)]' : 'bg-[var(--oracle-surface-3)]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
