'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { workflowTemplatesApi, type ApiWorkflowTemplate } from '@/lib/api';

// ─── Types ────────────────────────────

interface WorkflowTemplatesPanelProps {
  onRunWorkflow?: (prompt: string) => void;
}

interface StepDraft {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

// ─── Constants ────────────────────────

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
const DOMAINS = ['Development', 'SEO', 'Content', 'Marketing', 'Design', 'Finance', 'Operations', 'AI Agents'];

// ─── WorkflowTemplatesPanel Component ─

export function WorkflowTemplatesPanel({ onRunWorkflow }: WorkflowTemplatesPanelProps) {
  const [templates, setTemplates] = useState<ApiWorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDomain, setFilterDomain] = useState<string>('all');

  // ── Form state ──
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formEstimatedTime, setFormEstimatedTime] = useState('1-2 hours');
  const [formDomains, setFormDomains] = useState<string[]>([]);
  const [formSteps, setFormSteps] = useState<StepDraft[]>([
    { id: 'step-1', name: '', description: '', prompt: '' },
  ]);

  // ── Fetch templates ──
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workflowTemplatesApi.list();
      setTemplates(data);
    } catch {
      toast.error('❌ Failed to load workflow templates', TOAST_DEFAULTS);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Filtered templates ──
  const filteredTemplates = templates.filter((t) => {
    if (filterDomain !== 'all' && !t.domains.includes(filterDomain)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Reset form ──
  const resetForm = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setFormColor(COLORS[0]);
    setFormEstimatedTime('1-2 hours');
    setFormDomains([]);
    setFormSteps([{ id: 'step-1', name: '', description: '', prompt: '' }]);
    setEditingId(null);
    setShowCreate(false);
  }, []);

  // ── Start editing ──
  const startEdit = useCallback((template: ApiWorkflowTemplate) => {
    setEditingId(template.id);
    setFormName(template.name);
    setFormDescription(template.description);
    setFormColor(template.color);
    setFormEstimatedTime(template.estimated_time);
    setFormDomains(template.domains);
    setFormSteps(template.steps.map((s) => ({ ...s })));
    setShowCreate(true);
  }, []);

  // ── Add step ──
  const addStep = useCallback(() => {
    setFormSteps((prev) => [
      ...prev,
      { id: `step-${Date.now()}-${prev.length}`, name: '', description: '', prompt: '' },
    ]);
  }, []);

  // ── Remove step ──
  const removeStep = useCallback((index: number) => {
    setFormSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Update step ──
  const updateStep = useCallback((index: number, field: keyof StepDraft, value: string) => {
    setFormSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, []);

  // ── Save template ──
  const saveTemplate = useCallback(async () => {
    if (!formName.trim()) {
      toast.error('❌ Name is required', TOAST_DEFAULTS);
      return;
    }
    if (formSteps.some((s) => !s.name.trim() || !s.prompt.trim())) {
      toast.error('❌ All steps need a name and prompt', TOAST_DEFAULTS);
      return;
    }

    const data = {
      name: formName.trim(),
      description: formDescription.trim(),
      color: formColor,
      estimated_time: formEstimatedTime,
      domains: formDomains,
      steps: formSteps,
    };

    try {
      if (editingId) {
        const updated = await workflowTemplatesApi.update(editingId, data);
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
        toast.success('✅ Template updated', TOAST_DEFAULTS);
      } else {
        const created = await workflowTemplatesApi.create(data);
        setTemplates((prev) => [created, ...prev]);
        toast.success('✅ Template created', TOAST_DEFAULTS);
      }
      resetForm();
    } catch {
      toast.error('❌ Failed to save template', TOAST_DEFAULTS);
    }
  }, [formName, formDescription, formColor, formEstimatedTime, formDomains, formSteps, editingId, resetForm]);

  // ── Delete template ──
  const deleteTemplate = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      await workflowTemplatesApi.delete(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('✅ Template deleted', TOAST_DEFAULTS);
    } catch {
      toast.error('❌ Failed to delete template', TOAST_DEFAULTS);
    }
  }, []);

  // ── Run workflow ──
  const runWorkflow = useCallback(async (template: ApiWorkflowTemplate) => {
    // Increment use count
    try {
      await workflowTemplatesApi.update(template.id, { use_count: (template.use_count || 0) + 1 });
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, use_count: (t.use_count || 0) + 1 } : t)));
    } catch {
      // Non-critical
    }

    // Combine all step prompts into a single workflow prompt
    const workflowPrompt = template.steps
      .map((s, i) => `Step ${i + 1}: ${s.name}\n${s.description}\n\n${s.prompt}`)
      .join('\n\n---\n\n');

    if (onRunWorkflow) {
      onRunWorkflow(workflowPrompt);
    }
  }, [onRunWorkflow]);

  // ── Toggle domain ──
  const toggleDomain = useCallback((domain: string) => {
    setFormDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🔄 Workflow Templates</h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
                  Create and run reusable multi-agent workflow templates ({templates.length} total)
                </p>
              </div>
              <motion.button
                {...buttonTapProps}
                onClick={() => { resetForm(); setShowCreate(true); }}
                className="flex items-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2.5 text-[13px] font-semibold text-white transition-all"
              >
                + New Template
              </motion.button>
            </div>
          </motion.div>

          {/* Search & Filters */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-4">
            <div className="oracle-glass rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="flex-1 min-w-[200px] rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
                />
                <div className="flex flex-wrap gap-1.5">
                  {['all', ...DOMAINS].slice(0, 6).map((d) => (
                    <button
                      key={d}
                      onClick={() => setFilterDomain(d)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${
                        filterDomain === d
                          ? 'oracle-gradient-bg text-white'
                          : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'
                      }`}
                    >
                      {d === 'all' ? 'All' : d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Create/Edit Form */}
          <AnimatePresence>
            {showCreate && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={transitions.smooth} className="mb-4 overflow-hidden">
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">
                    {editingId ? '✏️ Edit Template' : '➕ Create New Template'}
                  </h3>

                  {/* Basic Info */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Name *</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., New Client Onboarding"
                        className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Estimated Time</label>
                      <input
                        type="text"
                        value={formEstimatedTime}
                        onChange={(e) => setFormEstimatedTime(e.target.value)}
                        placeholder="e.g., 2-3 hours"
                        className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Description</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief description of what this workflow does..."
                      rows={2}
                      className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]"
                    />
                  </div>

                  {/* Color & Domains */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Color</label>
                      <div className="flex gap-2">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setFormColor(c)}
                            className={`h-7 w-7 rounded-full transition-all ${formColor === c ? 'ring-2 ring-offset-2 ring-[var(--oracle-text-1)]' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Domains</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DOMAINS.map((d) => (
                          <button
                            key={d}
                            onClick={() => toggleDomain(d)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all ${
                              formDomains.includes(d)
                                ? 'oracle-gradient-bg text-white'
                                : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-[var(--oracle-text-muted)]">Steps *</label>
                      <button onClick={addStep} className="text-[11px] font-semibold text-[var(--oracle-primary-l)] hover:underline">+ Add Step</button>
                    </div>
                    <div className="space-y-3">
                      {formSteps.map((step, i) => (
                        <div key={step.id} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold oracle-gradient-bg text-white">{i + 1}</span>
                            <input
                              type="text"
                              value={step.name}
                              onChange={(e) => updateStep(i, 'name', e.target.value)}
                              placeholder="Step name"
                              className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface)] px-2 py-1.5 text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]"
                            />
                            {formSteps.length > 1 && (
                              <button onClick={() => removeStep(i)} className="text-[var(--oracle-error)] hover:text-[var(--oracle-error)]/80 text-[11px]">✕</button>
                            )}
                          </div>
                          <textarea
                            value={step.prompt}
                            onChange={(e) => updateStep(i, 'prompt', e.target.value)}
                            placeholder="Prompt for this step..."
                            rows={3}
                            className="w-full resize-none rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface)] px-2 py-1.5 text-[11px] text-[var(--oracle-text-2)] outline-none focus:border-[var(--oracle-primary)] font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <motion.button {...buttonTapProps} onClick={saveTemplate} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white transition-all">
                      💾 {editingId ? 'Update' : 'Create'} Template
                    </motion.button>
                    <button onClick={resetForm} className="rounded-xl bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] font-semibold text-[var(--oracle-text-3)] transition-all hover:bg-[var(--oracle-card-hover)]">
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Template Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--oracle-primary)]/30 border-t-[var(--oracle-primary)]" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center">
              <span className="text-3xl mb-4 block">🔄</span>
              <h3 className="mb-2 text-[15px] font-bold text-[var(--oracle-text-1)]">No Templates Found</h3>
              <p className="text-[13px] text-[var(--oracle-text-3)]">
                {templates.length === 0
                  ? 'Create your first workflow template to get started.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <motion.div key={template.id} variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
                  <div className="oracle-glass rounded-2xl p-5 transition-all duration-200 hover:border-[var(--oracle-border-strong)]">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${template.color}20` }}>
                        <span className="text-lg" style={{ color: template.color }}>🔄</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-bold text-[var(--oracle-text-1)] truncate">{template.name}</h3>
                        <p className="mt-0.5 text-[11px] text-[var(--oracle-text-3)] line-clamp-2">{template.description || 'No description'}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--oracle-text-muted)]">
                      <span>📋 {template.steps.length} steps</span>
                      <span>⏱ {template.estimated_time}</span>
                      <span>🚀 {template.use_count || 0} runs</span>
                      {template.is_builtin && <span className="rounded-full bg-[var(--oracle-info)]/10 px-1.5 py-0.5 text-[var(--oracle-info)]">Built-in</span>}
                    </div>

                    {/* Domains */}
                    {template.domains.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {template.domains.slice(0, 3).map((d) => (
                          <span key={d} className="rounded-full bg-[var(--oracle-surface-2)] px-1.5 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">{d}</span>
                        ))}
                      </div>
                    )}

                    {/* Step Preview */}
                    <div className="mt-3 space-y-1">
                      {template.steps.slice(0, 3).map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2 text-[10px] text-[var(--oracle-text-3)]">
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold" style={{ backgroundColor: `${template.color}20`, color: template.color }}>{i + 1}</span>
                          <span className="truncate">{s.name}</span>
                        </div>
                      ))}
                      {template.steps.length > 3 && <p className="text-[9px] text-[var(--oracle-text-muted)]">+{template.steps.length - 3} more</p>}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      <motion.button
                        {...buttonTapProps}
                        onClick={() => runWorkflow(template)}
                        className="flex-1 rounded-xl py-2 text-[12px] font-semibold text-white transition-all"
                        style={{ backgroundColor: template.color }}
                      >
                        ▶ Run
                      </motion.button>
                      {!template.is_builtin && (
                        <>
                          <button onClick={() => startEdit(template)} className="rounded-lg p-2 text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-surface-2)] transition-colors" title="Edit">✏️</button>
                          <button onClick={() => deleteTemplate(template.id, template.name)} className="rounded-lg p-2 text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-error)]/10 hover:text-[var(--oracle-error)] transition-colors" title="Delete">🗑️</button>
                        </>
                      )}
                    </div>
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
