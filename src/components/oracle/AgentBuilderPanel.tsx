'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { customAgentsApi, type ApiCustomAgent } from '@/lib/api';

// ─── Constants ─────────────────────────

const CATEGORIES = [
  'research', 'content', 'technical', 'analysis', 'strategy', 'marketing',
  'design', 'finance', 'quality', 'sales', 'security', 'legal',
  'management', 'orchestration', 'general',
];

const TIERS = ['standard', 'premium', 'enterprise'];

const TOOLS_OPTIONS = [
  'Web Search', 'Code Execution', 'File Operations', 'Database Query',
  'API Call', 'Image Generation', 'Document Creation', 'Data Analysis',
  'Email Send', 'WhatsApp Send', 'Calendar', 'CRM Access',
];

// ─── Agent Builder Panel ───────────────

export function AgentBuilderPanel() {
  const [agents, setAgents] = useState<ApiCustomAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<ApiCustomAgent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // ── Form state ──
  const [form, setForm] = useState({
    name: '', description: '', category: 'general', task_focus: '',
    prompt: '', default_tier: 'standard', default_provider_id: '',
    default_model_id: '', tools: [] as string[],
  });

  // ── Fetch agents ──
  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customAgentsApi.list();
      setAgents(data);
    } catch {
      toast.error('❌ Failed to load custom agents', TOAST_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // ── Filtered agents ──
  const filteredAgents = useMemo(() => {
    return agents.filter(a => {
      if (filterCategory !== 'all' && a.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.includes(q);
      }
      return true;
    });
  }, [agents, searchQuery, filterCategory]);

  // ── Category stats ──
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = { all: agents.length };
    for (const a of agents) {
      stats[a.category] = (stats[a.category] || 0) + 1;
    }
    return stats;
  }, [agents]);

  // ── Reset form ──
  const resetForm = useCallback(() => {
    setForm({ name: '', description: '', category: 'general', task_focus: '', prompt: '', default_tier: 'standard', default_provider_id: '', default_model_id: '', tools: [] });
    setEditingId(null);
    setShowCreate(false);
  }, []);

  // ── Start editing ──
  const startEdit = useCallback((agent: ApiCustomAgent) => {
    setEditingId(agent.id);
    setForm({
      name: agent.name, description: agent.description, category: agent.category,
      task_focus: agent.task_focus, prompt: agent.prompt, default_tier: agent.default_tier,
      default_provider_id: agent.default_provider_id || '', default_model_id: agent.default_model_id || '',
      tools: agent.tools,
    });
    setShowCreate(true);
  }, []);

  // ── Save agent ──
  const saveAgent = useCallback(async () => {
    if (!form.name.trim()) { toast.error('❌ Name is required', TOAST_DEFAULTS); return; }
    if (!form.prompt.trim()) { toast.error('❌ System prompt is required', TOAST_DEFAULTS); return; }

    const data = {
      name: form.name.trim(), description: form.description.trim(), category: form.category,
      task_focus: form.task_focus.trim(), prompt: form.prompt.trim(), default_tier: form.default_tier,
      default_provider_id: form.default_provider_id || null, default_model_id: form.default_model_id || null,
      tools: form.tools,
    };

    try {
      if (editingId) {
        const updated = await customAgentsApi.update(editingId, data);
        setAgents(prev => prev.map(a => a.id === editingId ? updated : a));
        toast.success('✅ Agent updated', TOAST_DEFAULTS);
      } else {
        const created = await customAgentsApi.create(data);
        setAgents(prev => [created, ...prev]);
        toast.success('✅ Agent created', TOAST_DEFAULTS);
      }
      resetForm();
    } catch {
      toast.error('❌ Failed to save agent', TOAST_DEFAULTS);
    }
  }, [form, editingId, resetForm]);

  // ── Delete agent ──
  const deleteAgent = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"? This cannot be undone.`)) return;
    try {
      await customAgentsApi.delete(id);
      setAgents(prev => prev.filter(a => a.id !== id));
      if (selectedAgent?.id === id) setSelectedAgent(null);
      toast.success('✅ Agent deleted', TOAST_DEFAULTS);
    } catch {
      toast.error('❌ Failed to delete agent', TOAST_DEFAULTS);
    }
  }, [selectedAgent]);

  // ── Toggle active ──
  const toggleActive = useCallback(async (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    try {
      const updated = await customAgentsApi.update(id, { is_active: !agent.is_active });
      setAgents(prev => prev.map(a => a.id === id ? updated : a));
    } catch {
      toast.error('❌ Failed to toggle agent', TOAST_DEFAULTS);
    }
  }, [agents]);

  // ── Toggle tool ──
  const toggleTool = useCallback((tool: string) => {
    setForm(prev => ({
      ...prev,
      tools: prev.tools.includes(tool) ? prev.tools.filter(t => t !== tool) : [...prev.tools, tool],
    }));
  }, []);

  const updateForm = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🔧 Agent Builder</h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Design and configure custom specialist agents with custom prompts, tools, and routing rules</p>
              </div>
              <motion.button {...buttonTapProps} onClick={() => { resetForm(); setShowCreate(true); }} className="rounded-xl oracle-gradient-bg px-4 py-2.5 text-[13px] font-semibold text-white transition-all">
                + New Agent
              </motion.button>
            </div>
          </motion.div>

          {/* Summary Stats */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <div className="grid grid-cols-4 gap-3">
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{agents.length}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Total Agents</p>
              </div>
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-success)]">{agents.filter(a => a.is_active).length}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Active</p>
              </div>
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-primary-l)]">{new Set(agents.map(a => a.category)).size}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Categories</p>
              </div>
              <div className="oracle-glass rounded-xl p-3 text-center">
                <p className="text-[18px] font-bold text-[var(--oracle-text-1)]">{agents.reduce((s, a) => s + a.tools.length, 0)}</p>
                <p className="text-[10px] text-[var(--oracle-text-muted)]">Tool Configs</p>
              </div>
            </div>
          </motion.div>

          {/* Search & Filters */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-4">
            <div className="oracle-glass rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search agents..." className="flex-1 min-w-[200px] rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors" />
                <div className="flex flex-wrap gap-1.5">
                  {['all', ...CATEGORIES].slice(0, 8).map(cat => (
                    <button key={cat} onClick={() => setFilterCategory(cat)} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${filterCategory === cat ? 'oracle-gradient-bg text-white' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'}`}>
                      {cat === 'all' ? 'All' : cat} ({categoryStats[cat] || 0})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Create/Edit Form */}
          <AnimatePresence>
            {showCreate && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 overflow-hidden">
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">
                    {editingId ? '✏️ Edit Custom Agent' : '➕ Create New Agent'}
                  </h3>

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Agent Name *</label>
                      <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="e.g., Clinic Appointment Bot" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Category</label>
                      <select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Description</label>
                      <input value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="What does this agent do?" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Task Focus</label>
                      <input value={form.task_focus} onChange={(e) => updateForm('task_focus', e.target.value)} placeholder="Primary task focus area" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                    </div>
                  </div>

                  {/* Tier & Provider */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Default Tier</label>
                      <select value={form.default_tier} onChange={(e) => updateForm('default_tier', e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
                        {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Default Provider</label>
                      <input value={form.default_provider_id} onChange={(e) => updateForm('default_provider_id', e.target.value)} placeholder="e.g., openai" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Default Model</label>
                      <input value={form.default_model_id} onChange={(e) => updateForm('default_model_id', e.target.value)} placeholder="e.g., gpt-4o" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
                    </div>
                  </div>

                  {/* System Prompt */}
                  <div className="mb-4">
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">System Prompt * <span className="text-[var(--oracle-text-muted)]">(This defines the agent's behavior, expertise, and output format)</span></label>
                    <textarea value={form.prompt} onChange={(e) => updateForm('prompt', e.target.value)} placeholder="You are an expert agent that specializes in...&#10;&#10;MISSION:&#10;...&#10;&#10;CORE PRINCIPLES:&#10;1. ...&#10;2. ..." rows={10} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)] font-mono leading-relaxed" />
                    <p className="mt-1 text-[10px] text-[var(--oracle-text-muted)]">{form.prompt.length} characters {form.prompt.length < 500 && form.prompt.length > 0 && '⚠️ Recommended: 500+ characters for quality outputs'}</p>
                  </div>

                  {/* Tools */}
                  <div className="mb-4">
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Available Tools</label>
                    <div className="flex flex-wrap gap-2">
                      {TOOLS_OPTIONS.map(tool => (
                        <button key={tool} onClick={() => toggleTool(tool)} className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all ${form.tools.includes(tool) ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'border-[var(--oracle-border)] text-[var(--oracle-text-muted)]'}`}>
                          {tool}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={resetForm} className="rounded-xl bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] font-semibold text-[var(--oracle-text-3)] transition-all hover:bg-[var(--oracle-card-hover)]">Cancel</button>
                    <motion.button {...buttonTapProps} onClick={saveAgent} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white transition-all">
                      💾 {editingId ? 'Update' : 'Create'} Agent
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--oracle-primary)]/30 border-t-[var(--oracle-primary)]" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-12 text-center">
              <span className="text-3xl mb-4 block">🔧</span>
              <h3 className="mb-2 text-[15px] font-bold text-[var(--oracle-text-1)]">No Custom Agents</h3>
              <p className="text-[13px] text-[var(--oracle-text-3)]">
                {agents.length === 0 ? 'Create your first custom agent to get started.' : 'No agents match your search or filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAgents.map(agent => (
                <motion.div key={agent.id} variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <div className="oracle-glass rounded-2xl p-5 transition-all duration-200 hover:border-[var(--oracle-border-strong)] cursor-pointer" onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[14px] font-bold text-[var(--oracle-text-1)]">{agent.name}</h3>
                          <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] font-semibold text-[var(--oracle-text-muted)]">{agent.category}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${agent.is_active ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>
                            {agent.is_active ? '● Active' : '○ Inactive'}
                          </span>
                          <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">{agent.default_tier}</span>
                        </div>
                        <p className="text-[11px] text-[var(--oracle-text-3)] line-clamp-1">{agent.description || 'No description'}</p>
                        {agent.task_focus && <p className="text-[10px] text-[var(--oracle-text-muted)] mt-0.5">Focus: {agent.task_focus}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <button onClick={(e) => { e.stopPropagation(); toggleActive(agent.id); }} className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${agent.is_active ? 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'}`}>
                          {agent.is_active ? '● Live' : '○ Off'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); startEdit(agent); }} className="rounded-lg p-1.5 text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-surface-2)]" title="Edit">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteAgent(agent.id, agent.name); }} className="rounded-lg p-1.5 text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]" title="Delete">🗑️</button>
                      </div>
                    </div>

                    {/* Tools */}
                    {agent.tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {agent.tools.map(t => (
                          <span key={t} className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Expanded Prompt Preview */}
                    {selectedAgent?.id === agent.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 border-t border-[var(--oracle-border)] pt-3">
                        <p className="text-[10px] font-semibold text-[var(--oracle-text-muted)] mb-1">System Prompt</p>
                        <pre className="max-h-40 overflow-y-auto rounded-xl bg-[var(--oracle-surface-2)] p-3 text-[11px] text-[var(--oracle-text-2)] whitespace-pre-wrap font-mono">{agent.prompt}</pre>
                        <div className="mt-2 flex items-center gap-4 text-[10px] text-[var(--oracle-text-muted)]">
                          {agent.default_provider_id && <span>Provider: {agent.default_provider_id}</span>}
                          {agent.default_model_id && <span>Model: {agent.default_model_id}</span>}
                          <span>Created: {new Date(agent.created_at).toLocaleDateString()}</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
