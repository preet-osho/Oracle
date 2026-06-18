'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, cardHoverProps, buttonTapProps } from '@/styles/design-tokens';
import type { ScopeChange, ApprovalItem } from '@/types/scope-approval';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';

// ─── Persistence Helpers ───────────────

const STORAGE_KEYS = {
  scopeChanges: 'oracle_scope_changes',
  approvalItems: 'oracle_approval_items',
} as const;

function loadFromStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

// ─── Status Colors ─────────────────────

const IMPACT_COLORS: Record<string, string> = {
  Low: 'var(--oracle-success)',
  Medium: 'var(--oracle-warning)',
  High: 'var(--oracle-error)',
  Critical: '#dc2626',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'var(--oracle-warning)',
  Approved: 'var(--oracle-success)',
  Rejected: 'var(--oracle-error)',
  Implemented: 'var(--oracle-info)',
  'Revision Requested': 'var(--oracle-warning)',
};

// ─── Scope Change Manager ─────────────

export function ScopeChangeManager({ projectId, projectName }: { projectId?: string; projectName?: string }) {
  const [scopeChanges, setScopeChanges] = useState<ScopeChange[]>(() => loadFromStorage<ScopeChange>(STORAGE_KEYS.scopeChanges));
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Persist to localStorage on change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.scopeChanges, scopeChanges);
  }, [scopeChanges]);

  const filtered = useMemo(() => {
    if (!projectId) return scopeChanges;
    return scopeChanges.filter((c) => c.projectId === projectId);
  }, [scopeChanges, projectId]);

  const stats = useMemo(() => ({
    pending: filtered.filter((c) => c.status === 'Pending').length,
    approved: filtered.filter((c) => c.status === 'Approved').length,
    totalAdditionalCost: filtered.filter((c) => c.status === 'Approved').reduce((s, c) => s + c.additionalCost, 0),
  }), [filtered]);

  const handleAdd = useCallback((data: Omit<ScopeChange, 'id' | 'createdAt'>) => {
    const change: ScopeChange = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setScopeChanges((prev) => [change, ...prev]);
    setShowForm(false);
    toast.success('✅ Scope change request created', TOAST_DEFAULTS);
  }, []);

  const handleStatusChange = useCallback((id: string, status: ScopeChange['status']) => {
    setScopeChanges((prev) => prev.map((c) =>
      c.id === id ? { ...c, status, resolvedAt: Date.now() } : c
    ));
    toast.success(`✅ Scope change ${status.toLowerCase()}`, TOAST_DEFAULTS);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setScopeChanges((prev) => prev.filter((c) => c.id !== id));
    toast.success('✅ Scope change deleted', TOAST_DEFAULTS);
  }, []);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-4">
      {/* Header + Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Scope Change Manager</h3>
          <p className="text-[11px] text-[var(--oracle-text-muted)]">Track and manage scope changes with pricing impact</p>
        </div>
        <motion.button {...buttonTapProps} onClick={() => setShowForm(true)} className="rounded-xl oracle-gradient-bg px-3 py-1.5 text-[12px] font-semibold text-white">
          + Request Change
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: stats.pending, icon: '⏳', color: 'var(--oracle-warning)' },
          { label: 'Approved', value: stats.approved, icon: '✅', color: 'var(--oracle-success)' },
          { label: 'Additional Cost', value: formatINR(stats.totalAdditionalCost), icon: '💰', color: 'var(--oracle-primary-l)' },
        ].map((s) => (
          <div key={s.label} className="oracle-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5">
              <span>{s.icon}</span>
              <span className="text-[10px] text-[var(--oracle-text-muted)]">{s.label}</span>
            </div>
            <p className="mt-1 text-[16px] font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Scope Changes List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-[var(--oracle-text-muted)]">
            <p className="text-[24px]">📋</p>
            <p className="mt-1 text-[12px]">No scope changes yet</p>
          </div>
        ) : (
          filtered.map((change) => (
            <motion.div key={change.id} layout variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} {...cardHoverProps}>
              <div className={`oracle-glass rounded-xl p-3 transition-all ${expandedId === change.id ? 'ring-1 ring-[var(--oracle-primary)]/30' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === change.id ? null : change.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{change.title}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${STATUS_COLORS[change.status]}20`, color: STATUS_COLORS[change.status] }}>{change.status}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${IMPACT_COLORS[change.impact]}20`, color: IMPACT_COLORS[change.impact] }}>{change.impact} impact</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--oracle-text-muted)]">
                      {projectName && <span>{projectName}</span>}
                      <span>Requested by: {change.requestedBy}</span>
                      <span>{new Date(change.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-bold text-[var(--oracle-warning)]">+{formatINR(change.additionalCost)}</p>
                    <p className="text-[10px] text-[var(--oracle-text-muted)]">additional</p>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === change.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                      <div className="mt-3 space-y-3 border-t border-[var(--oracle-border)] pt-3">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div><span className="text-[var(--oracle-text-muted)]">Original Estimate:</span> <span className="text-[var(--oracle-text-2)] font-semibold">{formatINR(change.originalEstimate)}</span></div>
                          <div><span className="text-[var(--oracle-text-muted)]">Revised Estimate:</span> <span className="text-[var(--oracle-text-2)] font-semibold">{formatINR(change.revisedEstimate)}</span></div>
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--oracle-text-muted)]">Reason:</span>
                          <p className="mt-1 text-[12px] text-[var(--oracle-text-2)]">{change.reason}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--oracle-text-muted)]">Description:</span>
                          <p className="mt-1 text-[12px] text-[var(--oracle-text-2)]">{change.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {change.status === 'Pending' && (
                            <>
                              <motion.button {...buttonTapProps} onClick={() => handleStatusChange(change.id, 'Approved')} className="rounded-lg bg-[var(--oracle-success)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20">✅ Approve</motion.button>
                              <motion.button {...buttonTapProps} onClick={() => handleStatusChange(change.id, 'Rejected')} className="rounded-lg bg-[var(--oracle-error)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/20">❌ Reject</motion.button>
                            </>
                          )}
                          {change.status === 'Approved' && (
                            <motion.button {...buttonTapProps} onClick={() => handleStatusChange(change.id, 'Implemented')} className="rounded-lg bg-[var(--oracle-info)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-info)] hover:bg-[var(--oracle-info)]/20">🚀 Mark Implemented</motion.button>
                          )}
                          <motion.button {...buttonTapProps} onClick={() => handleDelete(change.id)} className="ml-auto rounded-lg border border-[var(--oracle-error)]/30 px-3 py-1.5 text-[11px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10">🗑 Remove</motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ScopeChangeForm
            projectId={projectId || ''}
            projectName={projectName || ''}
            onSave={handleAdd}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ScopeChangeForm({ projectId, projectName, onSave, onClose }: {
  projectId: string;
  projectName: string;
  onSave: (data: Omit<ScopeChange, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestedBy, setRequestedBy] = useState('Client');
  const [originalEstimate, setOriginalEstimate] = useState('');
  const [revisedEstimate, setRevisedEstimate] = useState('');
  const [impact, setImpact] = useState<ScopeChange['impact']>('Medium');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    const orig = parseInt(originalEstimate) || 0;
    const rev = parseInt(revisedEstimate) || 0;
    onSave({
      projectId, projectName, title: title.trim(), description, requestedBy,
      originalEstimate: orig, revisedEstimate: rev, additionalCost: Math.max(0, rev - orig),
      impact, status: 'Pending', reason,
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[17px] font-bold text-[var(--oracle-text-1)]">📋 New Scope Change Request</h3>
        {error && <p className="mb-3 rounded-lg bg-[var(--oracle-error)]/10 px-3 py-2 text-[12px] text-[var(--oracle-error)]">{error}</p>}
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Change Title *" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description of the change..." rows={3} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <div className="flex gap-3">
            <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Requested By" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" />
            <select value={impact} onChange={(e) => setImpact(e.target.value as ScopeChange['impact'])} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
              {['Low', 'Medium', 'High', 'Critical'].map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Original Estimate (₹)</label><input type="number" value={originalEstimate} onChange={(e) => setOriginalEstimate(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] outline-none" /></div>
            <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Revised Estimate (₹)</label><input type="number" value={revisedEstimate} onChange={(e) => setRevisedEstimate(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] outline-none" /></div>
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for change..." rows={2} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">Submit Request</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Client Approval Workflows ─────────

export function ApprovalWorkflow({ projectId, projectName }: { projectId?: string; projectName?: string }) {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(() => loadFromStorage<ApprovalItem>(STORAGE_KEYS.approvalItems));
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Persist to localStorage on change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.approvalItems, approvals);
  }, [approvals]);

  const filtered = useMemo(() => {
    if (!projectId) return approvals;
    return approvals.filter((a) => a.projectId === projectId);
  }, [approvals, projectId]);

  const stats = useMemo(() => ({
    pending: filtered.filter((a) => a.status === 'Pending').length,
    approved: filtered.filter((a) => a.status === 'Approved').length,
    revisionRequested: filtered.filter((a) => a.status === 'Revision Requested').length,
  }), [filtered]);

  const handleAdd = useCallback((data: Omit<ApprovalItem, 'id' | 'submittedAt'>) => {
    const item: ApprovalItem = { ...data, id: crypto.randomUUID(), submittedAt: Date.now() };
    setApprovals((prev) => [item, ...prev]);
    setShowForm(false);
    toast.success('✅ Approval request submitted', TOAST_DEFAULTS);
  }, []);

  const handleStatusChange = useCallback((id: string, status: ApprovalItem['status'], comments?: string) => {
    setApprovals((prev) => prev.map((a) =>
      a.id === id ? { ...a, status, reviewedAt: Date.now(), comments: comments || a.comments } : a
    ));
    toast.success(`✅ Approval ${status.toLowerCase()}`, TOAST_DEFAULTS);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    toast.success('✅ Approval deleted', TOAST_DEFAULTS);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">✅ Client Approval Workflows</h3>
          <p className="text-[11px] text-[var(--oracle-text-muted)]">Track deliverable approvals from clients</p>
        </div>
        <motion.button {...buttonTapProps} onClick={() => setShowForm(true)} className="rounded-xl oracle-gradient-bg px-3 py-1.5 text-[12px] font-semibold text-white">
          + Submit for Approval
        </motion.button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: stats.pending, icon: '⏳', color: 'var(--oracle-warning)' },
          { label: 'Approved', value: stats.approved, icon: '✅', color: 'var(--oracle-success)' },
          { label: 'Revisions', value: stats.revisionRequested, icon: '🔄', color: 'var(--oracle-info)' },
        ].map((s) => (
          <div key={s.label} className="oracle-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5">
              <span>{s.icon}</span>
              <span className="text-[10px] text-[var(--oracle-text-muted)]">{s.label}</span>
            </div>
            <p className="mt-1 text-[16px] font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-[var(--oracle-text-muted)]">
            <p className="text-[24px]">✅</p>
            <p className="mt-1 text-[12px]">No approvals yet</p>
          </div>
        ) : (
          filtered.map((item) => (
            <motion.div key={item.id} layout variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} {...cardHoverProps}>
              <div className={`oracle-glass rounded-xl p-3 transition-all ${expandedId === item.id ? 'ring-1 ring-[var(--oracle-primary)]/30' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{item.title}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${STATUS_COLORS[item.status]}20`, color: STATUS_COLORS[item.status] }}>{item.status}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]">{item.type}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--oracle-text-muted)]">
                      {projectName && <span>{projectName}</span>}
                      <span>Deliverable: {item.deliverable}</span>
                      <span>{new Date(item.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === item.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                      <div className="mt-3 space-y-3 border-t border-[var(--oracle-border)] pt-3">
                        <div>
                          <span className="text-[11px] text-[var(--oracle-text-muted)]">Description:</span>
                          <p className="mt-1 text-[12px] text-[var(--oracle-text-2)]">{item.description}</p>
                        </div>
                        {item.comments && (
                          <div>
                            <span className="text-[11px] text-[var(--oracle-text-muted)]">Reviewer Comments:</span>
                            <p className="mt-1 text-[12px] text-[var(--oracle-text-2)]">{item.comments}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {item.status === 'Pending' && (
                            <>
                              <motion.button {...buttonTapProps} onClick={() => handleStatusChange(item.id, 'Approved')} className="rounded-lg bg-[var(--oracle-success)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20">✅ Approve</motion.button>
                              <motion.button {...buttonTapProps} onClick={() => handleStatusChange(item.id, 'Revision Requested', 'Needs revisions')} className="rounded-lg bg-[var(--oracle-warning)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-warning)] hover:bg-[var(--oracle-warning)]/20">🔄 Request Revisions</motion.button>
                              <motion.button {...buttonTapProps} onClick={() => handleStatusChange(item.id, 'Rejected')} className="rounded-lg bg-[var(--oracle-error)]/10 px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/20">❌ Reject</motion.button>
                            </>
                          )}
                          <motion.button {...buttonTapProps} onClick={() => handleDelete(item.id)} className="ml-auto rounded-lg border border-[var(--oracle-error)]/30 px-3 py-1.5 text-[11px] text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10">🗑 Remove</motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <ApprovalForm projectId={projectId || ''} projectName={projectName || ''} onSave={handleAdd} onClose={() => setShowForm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ApprovalForm({ projectId, projectName, onSave, onClose }: {
  projectId: string;
  projectName: string;
  onSave: (data: Omit<ApprovalItem, 'id' | 'submittedAt'>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [type, setType] = useState<ApprovalItem['type']>('Deliverable');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!deliverable.trim()) { setError('Deliverable is required.'); return; }
    onSave({ projectId, projectName, title: title.trim(), description, deliverable: deliverable.trim(), type, status: 'Pending' });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-lg rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[17px] font-bold text-[var(--oracle-text-1)]">✅ Submit for Approval</h3>
        {error && <p className="mb-3 rounded-lg bg-[var(--oracle-error)]/10 px-3 py-2 text-[12px] text-[var(--oracle-error)]">{error}</p>}
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <input value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder="Deliverable name *" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <select value={type} onChange={(e) => setType(e.target.value as ApprovalItem['type'])} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
            {['Milestone', 'Deliverable', 'Change Request', 'Invoice'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description..." rows={3} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">Submit</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
