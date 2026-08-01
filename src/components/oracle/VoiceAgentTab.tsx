'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { voiceAgentsApi, callLogsApi, activeCallsApi, type ApiVoiceAgent, type ApiCallLog, type ApiActiveCall } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';

// ─── Constants ─────────────────────────

const PROVIDERS = [
  { id: 'vapi', name: 'Vapi', color: '#6366f1', description: 'Fast setup, 50+ voices, natural conversation', free: 'Free trial available' },
  { id: 'sarvam', name: 'Sarvam AI', color: '#10b981', description: 'India-focused, Hindi + regional languages', free: 'Free tier for Indian languages' },
  { id: 'elevenlabs', name: 'ElevenLabs', color: '#8b5cf6', description: 'Ultra-realistic voices, voice cloning', free: '10K chars/month free' },
  { id: 'bland', name: 'Bland.ai', color: '#f59e0b', description: 'Simple API, quick deployment', free: 'Free credits on signup' },
];

const VOICES = [
  'Aria (Female, Professional)', 'Charlie (Male, Friendly)', 'Charlotte (Female, Warm)',
  'Harry (Male, Authoritative)', 'Liam (Male, Casual)', 'Matilda (Female, Calm)',
  'hindi-female-1 (Hindi)', 'hindi-male-1 (Hindi)', 'bengali-female-1 (Bengali)',
];

const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi'];

const TOOLS_OPTIONS = ['Book Appointment', 'Send SMS/WhatsApp', 'Transfer to Human', 'CRM Lookup', 'Send Invoice', 'Collect Feedback', 'Check Order Status'];

// ─── Voice Agent Tab ───────────────────

export function VoiceAgentTab() {
  const [agents, setAgents] = useState<ApiVoiceAgent[]>([]);
  const [callLogs, setCallLogs] = useState<ApiCallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<ApiVoiceAgent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'agents' | 'logs'>('agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [vapiAssistantId, setVapiAssistantId] = useState('');
  const [activeCalls, setActiveCalls] = useState<ApiActiveCall[]>([]);
  const [newAgent, setNewAgent] = useState<{
    name: string;
    provider: 'vapi' | 'sarvam' | 'elevenlabs' | 'bland';
    voice: string;
    language: string;
    greeting: string;
    instructions: string;
    tools: string[];
  }>({
    name: '', provider: 'vapi' as const, voice: VOICES[0], language: 'English', greeting: '', instructions: '', tools: [] as string[],
  });

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsData, logsData] = await Promise.all([
        voiceAgentsApi.list(),
        callLogsApi.list(),
      ]);
      setAgents(agentsData);
      setCallLogs(logsData);
    } catch {
      toast.error('❌ Failed to load voice agents', TOAST_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Live call polling ──
  useEffect(() => {
    const pollActiveCalls = async () => {
      try {
        const calls = await activeCallsApi.list();
        setActiveCalls(calls);
      } catch { /* silent */ }
    };
    pollActiveCalls();
    const interval = setInterval(pollActiveCalls, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Stats ──
  const stats = useMemo(() => {
    const totalCalls = callLogs.length;
    const completedCalls = callLogs.filter(l => l.status === 'completed').length;
    const avgDuration = callLogs.length > 0 ? callLogs.reduce((s, l) => s + l.duration, 0) / callLogs.length : 0;
    const positiveSentiment = callLogs.filter(l => l.sentiment === 'positive').length;
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.is_active).length,
      totalCalls,
      successRate: totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(0) : '0',
      avgDuration: `${Math.floor(avgDuration / 60)}m ${Math.floor(avgDuration % 60)}s`,
      sentimentRate: totalCalls > 0 ? ((positiveSentiment / totalCalls) * 100).toFixed(0) : '0',
    };
  }, [agents, callLogs]);

  // ── Filtered agents ──
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(a => a.name.toLowerCase().includes(q) || a.provider.includes(q) || a.language.toLowerCase().includes(q));
  }, [agents, searchQuery]);

  // ── CRUD ──
  const createAgent = useCallback(async () => {
    if (!newAgent.name.trim()) { toast.error('❌ Name required', TOAST_DEFAULTS); return; }
    try {
      const config: Record<string, unknown> = {};
      if (vapiAssistantId.trim()) config.vapi_assistant_id = vapiAssistantId.trim();
      const created = await voiceAgentsApi.create({ ...newAgent, config } as any);
      setAgents(prev => [created, ...prev]);
      setShowCreate(false);
      setNewAgent({ name: '', provider: 'vapi', voice: VOICES[0], language: 'English', greeting: '', instructions: '', tools: [] });
      setVapiAssistantId('');
      toast.success('✅ Voice agent created', TOAST_DEFAULTS);
    } catch {
      toast.error('❌ Failed to create agent', TOAST_DEFAULTS);
    }
  }, [newAgent, vapiAssistantId]);

  const updateAgent = useCallback(async (id: string, data: Partial<ApiVoiceAgent>) => {
    try {
      const updated = await voiceAgentsApi.update(id, data);
      setAgents(prev => prev.map(a => a.id === id ? updated : a));
      if (selectedAgent?.id === id) setSelectedAgent(updated);
      toast.success('✅ Agent updated', TOAST_DEFAULTS);
    } catch {
      toast.error('❌ Failed to update agent', TOAST_DEFAULTS);
    }
  }, [selectedAgent]);

  const deleteAgent = useCallback(async (id: string) => {
    if (!confirm('Delete this voice agent? This cannot be undone.')) return;
    try {
      await voiceAgentsApi.delete(id);
      setAgents(prev => prev.filter(a => a.id !== id));
      if (selectedAgent?.id === id) setSelectedAgent(null);
      toast.success('✅ Agent deleted', TOAST_DEFAULTS);
    } catch {
      toast.error('❌ Failed to delete agent', TOAST_DEFAULTS);
    }
  }, [selectedAgent]);

  const toggleAgent = useCallback(async (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    await updateAgent(id, { is_active: !agent.is_active });
  }, [agents, updateAgent]);

  const startEdit = useCallback((agent: ApiVoiceAgent) => {
    setEditingId(agent.id);
    setNewAgent({
      name: agent.name, provider: agent.provider, voice: agent.voice,
      language: agent.language, greeting: agent.greeting, instructions: agent.instructions, tools: agent.tools,
    });
    setVapiAssistantId((agent.config as Record<string, unknown>)?.vapi_assistant_id as string || '');
    setShowCreate(true);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const config: Record<string, unknown> = {};
    if (vapiAssistantId.trim()) config.vapi_assistant_id = vapiAssistantId.trim();
    await updateAgent(editingId, { ...newAgent, config } as any);
    setEditingId(null);
    setShowCreate(false);
    setNewAgent({ name: '', provider: 'vapi', voice: VOICES[0], language: 'English', greeting: '', instructions: '', tools: [] });
    setVapiAssistantId('');
  }, [editingId, newAgent, vapiAssistantId, updateAgent]);

  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🎙️ Voice Agent Builder</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Create AI voice agents for inbound/outbound calls with VAPI, Sarvam, ElevenLabs & Bland.ai</p>
          </motion.div>

          {/* Provider Cards */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <p className="mb-2 text-[11px] font-medium text-[var(--oracle-text-muted)] uppercase tracking-wider">Supported Providers</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PROVIDERS.map((p) => (
                <div key={p.id} className="oracle-glass rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{p.name}</span>
                  </div>
                  <p className="text-[10px] text-[var(--oracle-text-muted)] mb-1">{p.description}</p>
                  <span className="text-[9px] font-medium" style={{ color: p.color }}>{p.free}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Summary Stats */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{stats.totalAgents}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Agents</p>
              </div>
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-success)]">{stats.activeAgents}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Active</p>
              </div>
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{stats.totalCalls}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Total Calls</p>
              </div>
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-primary-l)]">{stats.successRate}%</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Success</p>
              </div>
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{stats.avgDuration}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Avg Duration</p>
              </div>
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-success)]">{stats.sentimentRate}%</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Positive</p>
              </div>
            </div>
          </motion.div>

          {/* Live Calls Banner */}
          {activeCalls.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-4">
              <div className="oracle-glass rounded-2xl p-4 border-l-4 border-[var(--oracle-success)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--oracle-success)] animate-pulse" />
                  <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">🔴 Live Calls ({activeCalls.length})</p>
                </div>
                <div className="space-y-2">
                  {activeCalls.map((call) => {
                    const agent = agents.find(a => a.id === call.agent_id);
                    const elapsed = Math.floor((Date.now() - call.started_at) / 1000);
                    return (
                      <div key={call.id} className="flex items-center justify-between rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${call.status === 'in-progress' ? 'bg-[var(--oracle-success)] animate-pulse' : call.status === 'ringing' ? 'bg-[var(--oracle-warning)] animate-pulse' : 'bg-[var(--oracle-primary)]'}`} />
                          <span className="text-[11px] font-medium text-[var(--oracle-text-1)]">{call.caller_number || 'Unknown'}</span>
                          {agent && <span className="text-[10px] text-[var(--oracle-text-muted)]">via {agent.name}</span>}
                          <span className="rounded-full bg-[var(--oracle-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-success)]">{call.status}</span>
                        </div>
                        <span className="text-[10px] text-[var(--oracle-text-muted)]">{Math.floor(elapsed / 60)}m {elapsed % 60}s</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* View Tabs + Search + New Button */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(['agents', 'logs'] as const).map((v) => (
              <button key={v} onClick={() => setActiveView(v)} className={`rounded-xl border px-4 py-2 text-[12px] font-medium transition-all ${activeView === v ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'}`}>
                {v === 'agents' ? '🤖 Agents' : '📞 Call Logs'}
              </button>
            ))}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents..."
              className="ml-auto w-48 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]"
            />
            <motion.button {...buttonTapProps} onClick={() => { setEditingId(null); setNewAgent({ name: '', provider: 'vapi', voice: VOICES[0], language: 'English', greeting: '', instructions: '', tools: [] }); setShowCreate(!showCreate); }} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">
              + New Agent
            </motion.button>
          </div>

          {/* Create/Edit Form */}
          <AnimatePresence>
            {showCreate && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 overflow-hidden">
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">
                    {editingId ? '✏️ Edit Voice Agent' : '➕ Create New Voice Agent'}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Name *</label>
                      <input value={newAgent.name} onChange={(e) => setNewAgent((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., Clinic Receptionist" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Provider</label>
                      <select value={newAgent.provider} onChange={(e) => setNewAgent((p) => ({ ...p, provider: e.target.value as typeof p.provider }))} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                        {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Voice</label>
                      <select value={newAgent.voice} onChange={(e) => setNewAgent((p) => ({ ...p, voice: e.target.value }))} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                        {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Language</label>
                      <select value={newAgent.language} onChange={(e) => setNewAgent((p) => ({ ...p, language: e.target.value }))} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                        {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  {newAgent.provider === 'vapi' && (
                    <div className="mb-3">
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">VAPI Assistant ID <span className="text-[var(--oracle-text-muted)]">(for webhook routing)</span></label>
                      <input value={vapiAssistantId} onChange={(e) => setVapiAssistantId(e.target.value)} placeholder="e.g., asst_abc123 (from VAPI dashboard)" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)] font-mono" />
                      <p className="mt-1 text-[10px] text-[var(--oracle-text-muted)]">Paste your VAPI assistant ID here so incoming calls are routed to this agent via the webhook.</p>
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Greeting Message</label>
                    <textarea value={newAgent.greeting} onChange={(e) => setNewAgent((p) => ({ ...p, greeting: e.target.value }))} placeholder="Hi! Welcome to [Business]. How can I help you today?" rows={2} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                  </div>
                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Agent Instructions</label>
                    <textarea value={newAgent.instructions} onChange={(e) => setNewAgent((p) => ({ ...p, instructions: e.target.value }))} placeholder="What should this agent do? How should it behave? What are its rules?" rows={3} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                  </div>
                  <div className="mb-4">
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Tools</label>
                    <div className="flex flex-wrap gap-2">
                      {TOOLS_OPTIONS.map((tool) => (
                        <button key={tool} onClick={() => setNewAgent((p) => ({ ...p, tools: p.tools.includes(tool) ? p.tools.filter((t) => t !== tool) : [...p.tools, tool] }))} className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all ${newAgent.tools.includes(tool) ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'border-[var(--oracle-border)] text-[var(--oracle-text-muted)]'}`}>
                          {tool}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowCreate(false); setEditingId(null); }} className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] text-[var(--oracle-text-3)]">Cancel</button>
                    <button onClick={editingId ? saveEdit : createAgent} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white">
                      {editingId ? '💾 Update Agent' : '🚀 Create Agent'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agents List */}
          {activeView === 'agents' && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--oracle-primary)]/30 border-t-[var(--oracle-primary)]" />
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-3xl mb-4 block">🎙️</span>
                  <h3 className="mb-2 text-[15px] font-bold text-[var(--oracle-text-1)]">No Voice Agents</h3>
                  <p className="text-[13px] text-[var(--oracle-text-3)]">
                    {agents.length === 0 ? 'Create your first voice agent to get started.' : 'No agents match your search.'}
                  </p>
                </div>
              ) : (
                filteredAgents.map((agent) => {
                  const providerInfo = PROVIDERS.find(p => p.id === agent.provider);
                  const agentLogs = callLogs.filter(l => l.agent_id === agent.id);
                  const agentCalls = agentLogs.length;
                  const agentSuccess = agentCalls > 0 ? ((agentLogs.filter(l => l.status === 'completed').length / agentCalls) * 100).toFixed(0) : '0';
                  return (
                    <motion.div key={agent.id} variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                      <div className="oracle-glass rounded-xl p-4 cursor-pointer hover:bg-[var(--oracle-card-hover)] transition-colors" onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: (providerInfo?.color || '#6366f1') + '20' }}>
                              <span className="text-lg">🎙️</span>
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{agent.name}</p>
                              <p className="text-[11px] text-[var(--oracle-text-muted)]">{agent.provider} · {agent.voice} · {agent.language}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-[11px] text-[var(--oracle-text-muted)]">{agentCalls} calls · {agentSuccess}% success</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); toggleAgent(agent.id); }} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${agent.is_active ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>
                              {agent.is_active ? '● Live' : '○ Off'}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); startEdit(agent); }} className="rounded-lg p-1.5 text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-surface-2)]" title="Edit">✏️</button>
                            <button onClick={(e) => { e.stopPropagation(); deleteAgent(agent.id); }} className="rounded-lg p-1.5 text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]" title="Delete">🗑</button>
                          </div>
                        </div>
                        {/* Expanded details */}
                        {selectedAgent?.id === agent.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 border-t border-[var(--oracle-border)] pt-3">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div><p className="text-[10px] text-[var(--oracle-text-muted)]">Greeting</p><p className="text-[12px] text-[var(--oracle-text-3)]">{agent.greeting || 'Not set'}</p></div>
                              <div><p className="text-[10px] text-[var(--oracle-text-muted)]">Instructions</p><p className="text-[12px] text-[var(--oracle-text-3)] line-clamp-3">{agent.instructions || 'Not set'}</p></div>
                            </div>
                            <div className="mb-3"><p className="text-[10px] text-[var(--oracle-text-muted)] mb-1">Tools</p><div className="flex flex-wrap gap-1">{agent.tools.length > 0 ? agent.tools.map((t) => <span key={t} className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">{t}</span>) : <span className="text-[10px] text-[var(--oracle-text-muted)]">No tools configured</span>}</div></div>
                            {String((agent.config as Record<string, unknown>)?.vapi_assistant_id || '') && (
                              <div className="mb-2">
                                <p className="text-[10px] text-[var(--oracle-text-muted)]">VAPI Assistant ID</p>
                                <p className="text-[11px] text-[var(--oracle-text-3)] font-mono">{String((agent.config as Record<string, unknown>).vapi_assistant_id)}</p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); copyToClipboard(`npx vapi create --agent ${agent.id}`).then((ok) => ok ? toast.success('Deploy command copied', TOAST_DEFAULTS) : toast.error('❌ Clipboard access denied', TOAST_DEFAULTS)); }} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[10px] text-[var(--oracle-text-3)]">📋 Copy Deploy Cmd</button>
                              <button onClick={(e) => { e.stopPropagation(); toast.success('Test call initiated (simulated)', TOAST_DEFAULTS); }} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[10px] font-medium text-white">📞 Test Call</button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}

          {/* Call Logs */}
          {activeView === 'logs' && (
            <div className="space-y-3">
              {callLogs.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-3xl mb-4 block">📞</span>
                  <h3 className="mb-2 text-[15px] font-bold text-[var(--oracle-text-1)]">No Call Logs</h3>
                  <p className="text-[13px] text-[var(--oracle-text-3)]">Call logs will appear here as your voice agents handle calls.</p>
                </div>
              ) : (
                callLogs.map((log) => {
                  const agent = agents.find(a => a.id === log.agent_id);
                  return (
                    <div key={log.id} className="oracle-glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-[var(--oracle-text-1)]">{log.caller_number || 'Unknown'}</span>
                          {agent && <span className="text-[10px] text-[var(--oracle-text-muted)]">via {agent.name}</span>}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${log.status === 'completed' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : log.status === 'missed' ? 'bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)]' : 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]'}`}>{log.status}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${log.sentiment === 'positive' ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : log.sentiment === 'negative' ? 'bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>{log.sentiment}</span>
                        </div>
                        <span className="text-[11px] text-[var(--oracle-text-muted)]">{formatDuration(log.duration)} · {new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      {log.transcript && <div className="rounded-lg bg-[var(--oracle-surface-2)] px-3 py-2 text-[11px] text-[var(--oracle-text-3)] whitespace-pre-line max-h-24 overflow-y-auto">{log.transcript}</div>}
                      {log.summary && <p className="mt-2 text-[11px] text-[var(--oracle-text-muted)]">{log.summary}</p>}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
