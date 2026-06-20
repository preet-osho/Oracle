'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, cardHoverProps, buttonTapProps } from '@/styles/design-tokens';
import { PROVIDERS, MCP_SERVERS } from '@/data/providers';
import { useRouterStore } from '@/stores/router.store';

import { csrfHeaders } from '@/lib/csrf';
import { loadGuardConfig, saveGuardConfig, DEFAULT_GUARD_CONFIG } from '@/lib/hallucination-guard';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import type { GuardConfig } from '@/types';


// ─── API Helpers ──────────────────────
import { knowledgeDocsApi } from '@/lib/api';

function getAgencyProfile() {
  if (typeof window === 'undefined') return { agencyName: '', ownerName: '', city: '', services: '' };
  try { return JSON.parse(localStorage.getItem('oracle-agency-profile') || '{}');   } catch (err) { console.warn('[ConfigTab] Failed to parse agency profile from localStorage:', err); return { agencyName: '', ownerName: '', city: '', services: '' }; }
}
function saveAgencyProfile(p: { agencyName: string; ownerName: string; city: string; services: string }) {
  localStorage.setItem('oracle-agency-profile', JSON.stringify(p));
}

// ─── ConfigTab ────────────────────────
export function ConfigTab() {
  const { byokKeys, setByokKey, removeByokKey, autoRoute, toggleAutoRoute, selectedModel, setSelectedModel, streamingEnabled, toggleStreaming, mcpEnabled, toggleMcp, totalCostUSD, totalCostINR, resetCosts, resetOnboarding } = useRouterStore();
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, 'success' | 'error' | null>>({});
  const [agencyProfile, setAgencyProfile] = useState(getAgencyProfile());
  const [knowledgeDocs, setKnowledgeDocs] = useState<Array<{ id?: string; name: string; content: string }>>([]);
  const [reindexing, setReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<{ done: number; total: number } | null>(null);
  const [reindexingDocId, setReindexingDocId] = useState<string | null>(null);
  const [indexedDocIds, setIndexedDocIds] = useState<Set<string>>(new Set());
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKeyFor, setShowKeyFor] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [responseLanguage, setResponseLanguage] = useState('English');
  const [autoScore, setAutoScore] = useState(false);
  const [autoMemory, setAutoMemory] = useState(false);
  const { temperature, setTemperature } = useRouterStore();
  const [guardConfig, setGuardConfig] = useState<GuardConfig>(loadGuardConfig);

  // webSearch and webSearchKey are local to ConfigTab
  const [webSearch, setWebSearch] = useState(false);
  const [webSearchKey, setWebSearchKey] = useState('');
  const { usageHistory } = useRouterStore();
  const costHistory = usageHistory.map((u) => ({ date: new Date(u.timestamp).toISOString().slice(0, 10), provider: u.provider, cost: u.costINR }));

  const fetchIndexedIds = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge-docs/indexed');
      const data = await res.json();
      if (res.ok && Array.isArray(data.indexedIds)) {
        setIndexedDocIds(new Set(data.indexedIds));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    knowledgeDocsApi.list().then((docs) => {
      setKnowledgeDocs(docs.map((d) => ({ id: d.id, name: d.name, content: d.content })));
    }).catch(() => {});
    fetchIndexedIds();
    setAgencyProfile(getAgencyProfile());
  }, [fetchIndexedIds]);

  const handleTestKey = useCallback(async (providerId: string) => {
    const key = keyInputs[providerId] || byokKeys[providerId];
    if (!key) return;
    setTestingProvider(providerId);
    try {
      // Step 1: Save key to server-side storage
      await setByokKey(providerId, key);
      // Step 2: Test the key through the server proxy
      const proxyResponse = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-oracle-provider-id': providerId,
          ...csrfHeaders(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
          stream: false,
          maxTokens: 10,
        }),
      });
      if (!proxyResponse.ok) {
        const err = await proxyResponse.json().catch(() => ({ error: 'Test failed' }));
        // Rollback: remove the key if test fails
        await removeByokKey(providerId).catch(() => {});
        throw new Error(err.error || `HTTP ${proxyResponse.status}`);
      }
      setTestResult((prev) => ({ ...prev, [providerId]: 'success' }));
      toast.success('✅ API key verified and saved securely', TOAST_DEFAULTS);
    } catch (err) {
      toast.error(`Provider test failed: ${err instanceof Error ? err.message : 'Unknown error'}`, TOAST_DEFAULTS);
      setTestResult((prev) => ({ ...prev, [providerId]: 'error' }));
    } finally {
      setTestingProvider(null);
    }
  }, [keyInputs, setByokKey, removeByokKey]);

  const saveProfile = useCallback(() => {
    saveAgencyProfile(agencyProfile);
    toast.success('✅ Agency profile saved', TOAST_DEFAULTS);
  }, [agencyProfile]);

  const updateGuardConfig = useCallback((patch: Partial<GuardConfig>) => {
    setGuardConfig((prev) => {
      const next = { ...prev, ...patch };
      saveGuardConfig(next);
      return next;
    });
  }, []);

  const handleExportGuardConfig = useCallback(() => {
    const blob = new Blob([JSON.stringify(guardConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oracle-guard-config.json';
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('✅ Guard config exported', TOAST_DEFAULTS);
  }, [guardConfig]);

  const handleImportGuardConfig = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as Partial<GuardConfig>;
        // Validate and merge with defaults
        const merged: GuardConfig = {
          ...DEFAULT_GUARD_CONFIG,
          ...parsed,
          thresholds: { ...DEFAULT_GUARD_CONFIG.thresholds, ...parsed.thresholds },
        };
        // Enforce threshold ordering
        if (merged.thresholds.warnThreshold >= merged.thresholds.passThreshold) {
          merged.thresholds.warnThreshold = Math.max(10, merged.thresholds.passThreshold - 5);
        }
        if (merged.thresholds.blockThreshold >= merged.thresholds.warnThreshold) {
          merged.thresholds.blockThreshold = Math.max(5, merged.thresholds.warnThreshold - 5);
        }
        setGuardConfig(merged);
        saveGuardConfig(merged);
        toast.success('✅ Guard config imported', TOAST_DEFAULTS);
      } catch {
        toast.error('Failed to import config: invalid JSON file', TOAST_DEFAULTS);
      }
    }).catch(() => {});
    e.target.value = '';
  }, []);

  const handleResetGuardConfig = useCallback(() => {
    setGuardConfig(DEFAULT_GUARD_CONFIG);
    saveGuardConfig(DEFAULT_GUARD_CONFIG);
    toast.success('✅ Guard config reset to defaults', TOAST_DEFAULTS);
  }, []);

  const updateGuardThresholds = useCallback((patch: Partial<GuardConfig['thresholds']>) => {
    setGuardConfig((prev) => {
      const next = { ...prev, thresholds: { ...prev.thresholds, ...patch } };
      const warnings: string[] = [];
      // Enforce ordering: pass > warn > block
      if (next.thresholds.warnThreshold >= next.thresholds.passThreshold) {
        warnings.push(`Warn threshold clamped to ${Math.max(10, next.thresholds.passThreshold - 5)}% (must be below pass threshold ${next.thresholds.passThreshold}%)`);
        next.thresholds.warnThreshold = Math.max(10, next.thresholds.passThreshold - 5);
      }
      if (next.thresholds.blockThreshold >= next.thresholds.warnThreshold) {
        warnings.push(`Block threshold clamped to ${Math.max(5, next.thresholds.warnThreshold - 5)}% (must be below warn threshold ${next.thresholds.warnThreshold}%)`);
        next.thresholds.blockThreshold = Math.max(5, next.thresholds.warnThreshold - 5);
      }
      if (warnings.length > 0) {
        toast(warnings.join('. '), { ...TOAST_DEFAULTS, duration: 4000 });
      }
      saveGuardConfig(next);
      return next;
    });
  }, []);

  const handleDocUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(async (file) => {
      const text = await file.text().catch(() => '');
      try {
        const created = await knowledgeDocsApi.create({ name: file.name, content: text });
        setKnowledgeDocs((prev) => [...prev, { id: created.id, name: created.name, content: created.content }]);
        toast.success(`✅ Uploaded "${file.name}"`, TOAST_DEFAULTS);
       } catch (err) { toast.error(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, TOAST_DEFAULTS); }
    });
    e.target.value = '';
  }, []);

  const removeDoc = useCallback(async (index: number) => {
    const doc = knowledgeDocs[index];
    setKnowledgeDocs((prev) => prev.filter((_, i) => i !== index));
    if (doc?.id) {       try { await knowledgeDocsApi.delete(doc.id); } catch (err) { toast.error(`Failed to delete ${doc.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, TOAST_DEFAULTS); }
    }
  }, [knowledgeDocs]);

  const handleReindexDoc = useCallback(async (docId: string, docName: string) => {
    if (reindexingDocId) return;
    setReindexingDocId(docId);
    try {
      const res = await fetch(`/api/knowledge-docs/${docId}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-indexing failed');
      toast.success(`✅ ${data.message}`, TOAST_DEFAULTS);
      if (data.indexed) setIndexedDocIds((prev) => new Set(prev).add(docId));
    } catch (err) {
      toast.error(`❌ ${err instanceof Error ? err.message : 'Re-indexing failed'}`, TOAST_DEFAULTS);
    } finally {
      setReindexingDocId(null);
    }
  }, [reindexingDocId]);

  const handleReindexAll = useCallback(async () => {
    if (reindexing || knowledgeDocs.length === 0) return;
    setReindexing(true);
    setReindexProgress({ done: 0, total: knowledgeDocs.length });
    try {
      const res = await fetch('/api/knowledge-docs/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-indexing failed');
      setReindexProgress({ done: data.indexed, total: data.total });
      toast.success(`✅ ${data.message}`, TOAST_DEFAULTS);
      fetchIndexedIds(); // Refresh indexed status
    } catch (err) {
      toast.error(`❌ ${err instanceof Error ? err.message : 'Re-indexing failed'}`, TOAST_DEFAULTS);
    } finally {
      setReindexing(false);
      setReindexProgress(null);
    }
  }, [knowledgeDocs, reindexing, fetchIndexedIds]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">⚙ Settings</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Configure ORACLE to match your agency workflow</p>
          </motion.div>

          {/* ── Section 1: BYOK API Keys ── */}
          <Section title="🔑 API Keys (BYOK)">
            <div className="space-y-3">
              {PROVIDERS.map((provider) => {
                const hasKey = !!byokKeys[provider.id];
                const isTesting = testingProvider === provider.id;
                const result = testResult[provider.id];
                const isShowing = showKeyFor === provider.id;
                return (
                  <motion.div key={provider.id} {...cardHoverProps} className="oracle-glass rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${provider.color}20` }}>
                          <span className="text-[11px] font-bold" style={{ color: provider.color }}>{provider.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{provider.name}</p>
                          <p className="text-[10px] text-[var(--oracle-text-muted)]">{provider.freeLimit || 'Paid tier'}</p>
                        </div>
                        <span className={`oracle-status-dot ${hasKey ? (result === 'error' ? 'oracle-status-fail' : 'oracle-status-ok') : 'oracle-status-idle'}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={provider.signupUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--oracle-info)] underline">Get Free Key</a>
                        <motion.button {...buttonTapProps} onClick={() => setShowKeyFor(isShowing ? null : provider.id)} className="rounded-lg border border-[var(--oracle-border)] px-2 py-1 text-[10px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]">
                          {hasKey ? '✓ Set' : 'Set Key'}
                        </motion.button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isShowing && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="mt-3 flex gap-2">
                            <input
                              type="password"
                              value={keyInputs[provider.id] || ''}
                              onChange={(e) => setKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                              placeholder={provider.keyLabel}
                              className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 font-mono text-[11px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]"
                            />
                            <motion.button {...buttonTapProps} onClick={() => handleTestKey(provider.id)} disabled={isTesting} className="rounded-lg bg-[var(--oracle-success)]/10 px-3 py-2 text-[11px] font-medium text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20 disabled:opacity-50">
                              {isTesting ? '⟳' : 'Test'}
                            </motion.button>
                            {hasKey && <motion.button {...buttonTapProps} onClick={() => { removeByokKey(provider.id).then(() => { setTestResult((prev) => ({ ...prev, [provider.id]: null })); }); }} className="rounded-lg px-3 py-2 text-[11px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10">Remove</motion.button>}
                          </div>
                          {result && (
                            <p className={`mt-2 text-[11px] ${result === 'success' ? 'text-[var(--oracle-success)]' : 'text-[var(--oracle-error)]'}`}>
                              {result === 'success' ? '✓ Key works!' : '✗ Invalid key or connection failed'}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-[var(--oracle-text-muted)]">
                            Est. cost: {provider.models.some((m) => m.isFree) ? '₹0 (free models available)' : `₹${((provider.costPer1kTokens?.input || 0) * 1000 * 84).toFixed(2)}/1K input tokens`}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </Section>

          {/* ── Section 2: Model Selection ── */}
          <Section title="🤖 Model Selection">
            <div className="oracle-glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-[var(--oracle-text-1)]">Auto-route (Recommended)</p>
                  <p className="text-[11px] text-[var(--oracle-text-muted)]">ORACLE picks the best model for each task</p>
                </div>
                <ToggleSwitch checked={autoRoute} onChange={toggleAutoRoute} />
              </div>
              {!autoRoute && (
                <div className="flex gap-3">
                  <select value={selectedModel.providerId} onChange={(e) => { const p = PROVIDERS.find((x) => x.id === e.target.value); if (p?.models[0]) setSelectedModel(e.target.value, p.models[0].id); }} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                    {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={selectedModel.modelId} onChange={(e) => setSelectedModel(selectedModel.providerId, e.target.value)} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                    {PROVIDERS.find((p) => p.id === selectedModel.providerId)?.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <p className="text-[11px] text-[var(--oracle-text-muted)]">
                Currently using: <span className="font-medium text-[var(--oracle-text-2)]">{PROVIDERS.find((p) => p.id === selectedModel.providerId)?.name || '—'} — {selectedModel.modelId}</span>
              </p>
            </div>
          </Section>

          {/* ── Section 3: MCP Tools ── */}
          <Section title="🔌 MCP Tools">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['gmail', 'calendar', 'drive'] as const).map((service) => {
                const enabled = mcpEnabled[service];
                const info = MCP_SERVERS[service];
                return (
                  <motion.div key={service} {...cardHoverProps} className="oracle-glass rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{service === 'gmail' ? '📧' : service === 'calendar' ? '📅' : '📁'}</span>
                        <div>
                          <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{info?.name || service}</p>
                          <p className="text-[10px] text-[var(--oracle-text-muted)]">{enabled ? 'Connected' : 'Not connected'}</p>
                        </div>
                      </div>
                      <span className={`oracle-status-dot ${enabled ? 'oracle-status-ok' : 'oracle-status-idle'}`} />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <ToggleSwitch checked={enabled} onChange={() => toggleMcp(service)} />
                      {!enabled && <button className="text-[10px] text-[var(--oracle-info)] underline">Set up</button>}
                    </div>                    </motion.div>
                );
              })}
            </div>
          </Section>

          {/* ── Section 4: Advanced Settings ── */}
          <Section title="🔧 Advanced Settings">
            <div className="oracle-glass rounded-xl p-4 space-y-4">
              <ToggleRow label="Streaming responses" description="Stream tokens as they arrive" checked={streamingEnabled} onChange={toggleStreaming} />
              <ToggleRow label="Auto-score responses" description="Score every response on quality metrics" checked={autoScore} onChange={() => setAutoScore(!autoScore)} />
              <ToggleRow label="Auto-extract memories" description="Save key facts from conversations" checked={autoMemory} onChange={() => setAutoMemory(!autoMemory)} />
              <ToggleRow label="Web search" description="Enable real-time web research" checked={webSearch} onChange={() => setWebSearch(!webSearch)} />
              {webSearch && (
                <div className="flex gap-2 pl-[140px]">
                  <input value={webSearchKey} onChange={(e) => setWebSearchKey(e.target.value)} placeholder="Tavily/Serper API key" className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 font-mono text-[11px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
                </div>
              )}
              {/* Temperature Control */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--oracle-text-1)]">Temperature</p>
                    <p className="text-[11px] text-[var(--oracle-text-muted)]">Lower = precise, Higher = creative</p>
                  </div>
                  <span className="text-[12px] font-mono text-[var(--oracle-primary-l)]">{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-[var(--oracle-primary)]"
                />
                <div className="flex justify-between text-[10px] text-[var(--oracle-text-muted)] mt-1">
                  <span>🎯 Precise</span>
                  <span>⚖ Balanced</span>
                  <span>🎨 Creative</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-[var(--oracle-text-1)]">Dark/Light mode</p>
                  <p className="text-[11px] text-[var(--oracle-text-muted)]">Syncs with system default</p>
                </div>
                <ToggleSwitch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-[var(--oracle-text-1)]">Response language</p>
                  <p className="text-[11px] text-[var(--oracle-text-muted)]">Language for client-facing content</p>
                </div>
                <select value={responseLanguage} onChange={(e) => setResponseLanguage(e.target.value)} className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-1.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                  <option>English</option>
                  <option>Hinglish</option>
                  <option>Hindi</option>
                </select>
              </div>
            </div>
          </Section>

          {/* ── Section 5: Hallucination Guard ── */}
          <Section title="🛡 Hallucination Guard">
            <div className="oracle-glass rounded-xl p-4 space-y-4">
              <ToggleRow
                label="Enable hallucination guard"
                description="Automatically verify AI responses for accuracy and grounding"
                checked={guardConfig.enabled}
                onChange={() => updateGuardConfig({ enabled: !guardConfig.enabled })}
              />

              {/* Threshold sliders */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-medium text-[var(--oracle-text-1)]">Pass threshold</p>
                    <span className="text-[12px] font-mono text-[var(--oracle-success)]">{guardConfig.thresholds.passThreshold}%</span>
                  </div>
                  <p className="text-[11px] text-[var(--oracle-text-muted)] mb-2">Confidence above this = passed</p>
                  <input
                    type="range"
                    min={30}
                    max={95}
                    step={5}
                    value={guardConfig.thresholds.passThreshold}
                    onChange={(e) => updateGuardThresholds({ passThreshold: Number(e.target.value) })}
                    className="w-full accent-[var(--oracle-success)]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-medium text-[var(--oracle-text-1)]">Warn threshold</p>
                    <span className="text-[12px] font-mono text-[var(--oracle-warning)]">{guardConfig.thresholds.warnThreshold}%</span>
                  </div>
                  <p className="text-[11px] text-[var(--oracle-text-muted)] mb-2">Below this = flagged for review</p>
                  <input
                    type="range"
                    min={15}
                    max={70}
                    step={5}
                    value={guardConfig.thresholds.warnThreshold}
                    onChange={(e) => updateGuardThresholds({ warnThreshold: Number(e.target.value) })}
                    className="w-full accent-[var(--oracle-warning)]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-medium text-[var(--oracle-text-1)]">Block threshold</p>
                    <span className="text-[12px] font-mono text-[var(--oracle-error)]">{guardConfig.thresholds.blockThreshold}%</span>
                  </div>
                  <p className="text-[11px] text-[var(--oracle-text-muted)] mb-2">Below this = output blocked</p>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={5}
                    value={guardConfig.thresholds.blockThreshold}
                    onChange={(e) => updateGuardThresholds({ blockThreshold: Number(e.target.value) })}
                    className="w-full accent-[var(--oracle-error)]"
                  />
                </div>
              </div>

              {/* Detection toggles */}
              <div className="border-t border-[var(--oracle-border)] pt-3 space-y-3">
                <ToggleRow
                  label="Self-verification"
                  description="AI reviews its own output for accuracy"
                  checked={guardConfig.selfVerification}
                  onChange={() => updateGuardConfig({ selfVerification: !guardConfig.selfVerification })}
                />
                <ToggleRow
                  label="Fact grounding"
                  description="Verify claims against knowledge base and context"
                  checked={guardConfig.factGrounding}
                  onChange={() => updateGuardConfig({ factGrounding: !guardConfig.factGrounding })}
                />
                <ToggleRow
                  label="Pattern detection"
                  description="Detect hallucination patterns (overconfidence, vague claims)"
                  checked={guardConfig.patternDetection}
                  onChange={() => updateGuardConfig({ patternDetection: !guardConfig.patternDetection })}
                />
              </div>

              {/* Config preview */}
              <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">Config Preview</p>
                <p className="mt-1 text-[11px] text-[var(--oracle-text-3)]">
                  Guard {guardConfig.enabled ? '✅ enabled' : '⛔ disabled'} · Pass {'>='}{guardConfig.thresholds.passThreshold}% · Warn {'<' }{guardConfig.thresholds.warnThreshold}% · Block {'<'}{guardConfig.thresholds.blockThreshold}%
                </p>
              </div>

              {/* Export / Import / Reset */}
              <div className="flex items-center gap-2 border-t border-[var(--oracle-border)] pt-3">
                <motion.button {...buttonTapProps} onClick={handleExportGuardConfig} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
                  📥 Export JSON
                </motion.button>
                <label className="cursor-pointer rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
                  📤 Import JSON
                  <input type="file" accept=".json" className="hidden" onChange={handleImportGuardConfig} />
                </label>
                <motion.button {...buttonTapProps} onClick={handleResetGuardConfig} className="rounded-lg border border-[var(--oracle-error)]/30 px-3 py-1.5 text-[11px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10 transition-colors">
                  ↺ Reset to Defaults
                </motion.button>
              </div>
            </div>
          </Section>

          {/* ── Section 6: Agency Profile ── */}
          <Section title="🏢 Agency Profile">
            <div className="oracle-glass rounded-xl p-4 space-y-3">
              <p className="text-[11px] text-[var(--oracle-text-muted)]">This context is appended to the system prompt automatically.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={agencyProfile.agencyName} onChange={(e) => setAgencyProfile({ ...agencyProfile, agencyName: e.target.value })} placeholder="Agency name" className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
                <input value={agencyProfile.ownerName} onChange={(e) => setAgencyProfile({ ...agencyProfile, ownerName: e.target.value })} placeholder="Owner name" className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
                <input value={agencyProfile.city} onChange={(e) => setAgencyProfile({ ...agencyProfile, city: e.target.value })} placeholder="City" className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
                <input value={agencyProfile.services} onChange={(e) => setAgencyProfile({ ...agencyProfile, services: e.target.value })} placeholder="Services (SEO, Web Dev, Ads...)" className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
              </div>
              {agencyProfile.agencyName && (
                <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">Preview</p>
                  <p className="mt-1 text-[12px] text-[var(--oracle-text-2)]">
                    My agency is <strong>{agencyProfile.agencyName}</strong> based in <strong>{agencyProfile.city || '...'}</strong>. We specialise in <strong>{agencyProfile.services || '...'}</strong>.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <motion.button {...buttonTapProps} onClick={saveProfile} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">Save Profile</motion.button>
                <motion.button {...buttonTapProps} onClick={() => { resetOnboarding(); toast.success('✅ Onboarding wizard will appear on next reload', TOAST_DEFAULTS); }} className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">🔄 Re-run Onboarding</motion.button>
              </div>
            </div>
          </Section>

          {/* ── Section 7: Knowledge Base ── */}
          <Section title="📚 Knowledge Base">
            <div className="oracle-glass rounded-xl p-4 space-y-3">
              <p className="text-[11px] text-[var(--oracle-text-muted)]">Upload agency documents (SOPs, templates, pricing guides) for RAG context.</p>
              <motion.button {...buttonTapProps} onClick={() => document.getElementById('kb-upload')?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--oracle-border-strong)] px-4 py-3 text-[12px] font-medium text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-primary)] hover:text-[var(--oracle-primary-l)]">
                + Upload document
              </motion.button>
              <input id="kb-upload" type="file" className="hidden" accept=".pdf,.docx,.xlsx,.txt,.md,.csv" multiple onChange={handleDocUpload} />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[var(--oracle-text-muted)]">{knowledgeDocs.length} document{knowledgeDocs.length !== 1 ? 's' : ''} uploaded</p>
                <motion.button
                  {...buttonTapProps}
                  onClick={handleReindexAll}
                  disabled={reindexing || knowledgeDocs.length === 0}
                  className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-primary)] hover:text-[var(--oracle-primary-l)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reindexing ? `⟳ Indexing ${reindexProgress?.done ?? 0}/${reindexProgress?.total ?? 0}` : '🔄 Re-index All for Semantic Search'}
                </motion.button>
              </div>
              {knowledgeDocs.length > 0 && (
                <div className="space-y-1.5">
                  {knowledgeDocs.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm">📄</span>
                        <span className="truncate text-[12px] text-[var(--oracle-text-2)]">{doc.name}</span>
                        {doc.id && (
                          <span className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            indexedDocIds.has(doc.id)
                              ? 'bg-[var(--oracle-success)]/15 text-[var(--oracle-success)]'
                              : 'bg-[var(--oracle-surface-3)] text-[var(--oracle-text-muted)]'
                          }`}>
                            {indexedDocIds.has(doc.id) ? '✓ Indexed' : '○ Not indexed'}
                          </span>
                        )}
                      </div>
                      {doc.id && (
                        <motion.button
                          {...buttonTapProps}
                          onClick={() => handleReindexDoc(doc.id!, doc.name)}
                          disabled={reindexingDocId !== null}
                          className="ml-2 rounded px-1.5 py-0.5 text-[10px] text-[var(--oracle-text-muted)] transition-colors hover:bg-[var(--oracle-primary)]/10 hover:text-[var(--oracle-primary-l)] disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Re-index this document"
                        >
                          {reindexingDocId === doc.id ? '⟳' : '⚡'}
                        </motion.button>
                      )}
                      <button onClick={() => removeDoc(i)} className="ml-1 text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] text-[12px]">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── Section 8: Claude Code Integration ── */}
          <Section title="⚡ Claude Code Integration">
            <div className="oracle-glass rounded-xl p-4 space-y-4">
              <div>
                <h4 className="mb-2 text-[13px] font-semibold text-[var(--oracle-text-1)]">Install Claude Code</h4>
                <pre className="overflow-x-auto rounded-lg bg-[var(--oracle-surface-2)] p-3 font-mono text-[11px] text-[var(--oracle-text-2)]">
{`# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Start Claude Code in your project
cd your-project
claude`}
                </pre>
              </div>
              <div>
                <h4 className="mb-2 text-[13px] font-semibold text-[var(--oracle-text-1)]">MCP Configuration</h4>
                <pre className="overflow-x-auto rounded-lg bg-[var(--oracle-surface-2)] p-3 font-mono text-[11px] text-[var(--oracle-text-2)]">
{`{
  "mcpServers": {
    "oracle": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/oracle-mcp"],
      "env": {
        "ORACLE_API_KEY": "your-key-here"
      }
    }
  }
}`}
                </pre>
              </div>
              <div>
                <h4 className="mb-2 text-[13px] font-semibold text-[var(--oracle-text-1)]">Power User Commands</h4>
                <div className="space-y-1">
                  {[
                    { cmd: '/audit', desc: 'Run a full website audit' },
                    { cmd: '/proposal [client]', desc: 'Generate a client proposal' },
                    { cmd: '/content [topic]', desc: 'Create SEO-optimized content' },
                    { cmd: '/code [feature]', desc: 'Build a feature from scratch' },
                    { cmd: '/research [topic]', desc: 'Deep market research' },
                  ].map((c) => (
                    <div key={c.cmd} className="flex items-center gap-3 rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2">
                      <code className="rounded bg-[var(--oracle-primary)]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--oracle-primary-l)]">{c.cmd}</code>
                      <span className="text-[11px] text-[var(--oracle-text-3)]">{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Section 9: Cost Dashboard ── */}
          <Section title="💰 Cost Dashboard">
            <div className="oracle-glass rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3 text-center">
                  <p className="text-[10px] text-[var(--oracle-text-muted)]">Total This Month</p>
                  <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">₹{totalCostINR.toFixed(2)}</p>
                  <p className="text-[10px] text-[var(--oracle-text-muted)]">${totalCostUSD.toFixed(4)}</p>
                </div>
                <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3 text-center">
                  <p className="text-[10px] text-[var(--oracle-text-muted)]">Avg per Request</p>
                  <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">₹{totalCostINR > 0 ? (totalCostINR / Math.max(costHistory.length, 1)).toFixed(2) : '0.00'}</p>
                </div>
                <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3 text-center">
                  <p className="text-[10px] text-[var(--oracle-text-muted)]">Requests Today</p>
                  <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{costHistory.length}</p>
                </div>
                <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3 text-center">
                  <p className="text-[10px] text-[var(--oracle-text-muted)]">Providers Used</p>
                  <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{new Set(costHistory.map((c) => c.provider)).size}</p>
                </div>
              </div>

              {/* Cost by Provider */}
              {costHistory.length > 0 && (
                <div>
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">Cost by Provider</h4>
                  <div className="space-y-1.5">
                    {Object.entries(
                      costHistory.reduce((acc, c) => { acc[c.provider] = (acc[c.provider] || 0) + c.cost; return acc; }, {} as Record<string, number>)
                    ).sort(([, a], [, b]) => b - a).map(([provider, cost]) => {
                      const providerInfo = PROVIDERS.find((p) => p.id === provider);
                      const maxCost = Math.max(...Object.values(costHistory.reduce((acc, c) => { acc[c.provider] = (acc[c.provider] || 0) + c.cost; return acc; }, {} as Record<string, number>)));
                      return (
                        <div key={provider} className="flex items-center gap-3">
                          <span className="w-20 text-[11px] text-[var(--oracle-text-3)]">{providerInfo?.name || provider}</span>
                          <div className="flex-1 h-3 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(cost / maxCost) * 100}%`, backgroundColor: providerInfo?.color || '#6366f1' }} />
                          </div>
                          <span className="w-16 text-right text-[11px] font-mono text-[var(--oracle-text-muted)]">₹{cost.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <motion.button {...buttonTapProps} onClick={resetCosts} className="rounded-lg border border-[var(--oracle-error)]/30 px-3 py-1.5 text-[11px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10 transition-colors">
                  Reset Costs
                </motion.button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
      <h2 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">{title}</h2>
      {children}
    </motion.div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onChange} className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-[var(--oracle-primary)]' : 'bg-[var(--oracle-surface-3)]'}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </motion.button>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-medium text-[var(--oracle-text-1)]">{label}</p>
        <p className="text-[11px] text-[var(--oracle-text-muted)]">{description}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}
