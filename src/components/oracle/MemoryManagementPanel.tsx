'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { memoriesApi, type ApiMemory } from '@/lib/api';
import { formatMemoryForContext } from '@/lib/memory';
import type { MemoryItem } from '@/types';

// ─── Types ────────────────────────────

interface MemoryManagementPanelProps {
  projectId?: string | null;
}

// ─── Constants ────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  preference: 'var(--oracle-info)',
  fact: 'var(--oracle-success)',
  feedback: 'var(--oracle-warning)',
  decision: 'var(--oracle-primary-l)',
  contact: 'var(--oracle-error)',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  preference: '⚙️',
  fact: '📋',
  feedback: '💬',
  decision: '✅',
  contact: '👤',
};

const VALID_CATEGORIES = ['preference', 'fact', 'feedback', 'decision', 'contact'];

// ─── Helper: ApiMemory → MemoryItem ───

function apiToMemoryItem(api: ApiMemory): MemoryItem {
  return {
    id: api.id,
    content: api.content,
    category: api.category as MemoryItem['category'],
    importance: api.importance as MemoryItem['importance'],
    createdAt: api.created_at,
  };
}

// ─── MemoryManagementPanel Component ─

export function MemoryManagementPanel({ projectId }: MemoryManagementPanelProps) {
  const [memories, setMemories] = useState<ApiMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterImportance, setFilterImportance] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImportance, setEditImportance] = useState(2);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Fetch memories ──
  const fetchMemories = useCallback(async () => {
    if (!projectId) {
      setMemories([]);
      return;
    }
    setLoading(true);
    try {
      const data = await memoriesApi.list(projectId);
      setMemories(data);
    } catch {
      toast.error('❌ Failed to load memories', TOAST_DEFAULTS);
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // ── Filtered memories ──
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      // Category filter
      if (filterCategory !== 'all' && m.category !== filterCategory) return false;
      // Importance filter
      if (filterImportance > 0 && m.importance !== filterImportance) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return m.content.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [memories, filterCategory, filterImportance, searchQuery]);

  // ── Category stats ──
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = { all: memories.length };
    for (const m of memories) {
      stats[m.category] = (stats[m.category] || 0) + 1;
    }
    return stats;
  }, [memories]);

  // ── Start editing ──
  const startEdit = useCallback((memory: ApiMemory) => {
    setEditingId(memory.id);
    setEditContent(memory.content);
    setEditCategory(memory.category);
    setEditImportance(memory.importance);
  }, []);

  // ── Cancel editing ──
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent('');
    setEditCategory('');
    setEditImportance(2);
  }, []);

  // ── Save edit ──
  const saveEdit = useCallback(async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const updated = await memoriesApi.update(id, {
        content: editContent.trim(),
        category: editCategory,
        importance: editImportance,
      });
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      cancelEdit();
      toast.success('✅ Memory updated', TOAST_DEFAULTS);
    } catch {
      toast.error('❌ Failed to update memory', TOAST_DEFAULTS);
    }
  }, [editContent, editCategory, editImportance, cancelEdit]);

  // ── Delete memory ──
  const deleteMemory = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    setDeletingId(id);
    try {
      await memoriesApi.delete(id);
      // Update state only after successful API call
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast.success('✅ Memory deleted', TOAST_DEFAULTS);
    } catch {
      toast.error('❌ Failed to delete memory', TOAST_DEFAULTS);
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ── Export context preview ──
  const contextPreview = useMemo(() => {
    const items = filteredMemories.map(apiToMemoryItem);
    return formatMemoryForContext(items);
  }, [filteredMemories]);

  // ── No project selected ──
  if (!projectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-12">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
          <span className="text-3xl">🧠</span>
        </div>
        <h3 className="mb-2 text-[16px] font-bold text-[var(--oracle-text-1)]">No Project Selected</h3>
        <p className="max-w-md text-center text-[13px] text-[var(--oracle-text-3)]">
          Select a client project to view and manage its memories.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🧠 Memory Management</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
              View, search, edit, and delete client memories ({memories.length} total)
            </p>
          </motion.div>

          {/* Search & Filters */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-4">
            <div className="oracle-glass rounded-2xl p-4">
              {/* Search */}
              <div className="mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search memories..."
                  className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
                />
              </div>

              {/* Category filter chips */}
              <div className="flex flex-wrap gap-2">
                {['all', ...VALID_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                      filterCategory === cat
                        ? 'oracle-gradient-bg text-white'
                        : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'
                    }`}
                  >
                    {cat === 'all' ? '📋 All' : `${CATEGORY_EMOJIS[cat]} ${cat}`}
                    <span className="ml-1 opacity-70">({categoryStats[cat] || 0})</span>
                  </button>
                ))}

                {/* Importance filter */}
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-[11px] text-[var(--oracle-text-muted)]">Importance:</span>
                  {[0, 1, 2, 3].map((imp) => (
                    <button
                      key={imp}
                      onClick={() => setFilterImportance(imp)}
                      className={`rounded-full px-2 py-1 text-[11px] transition-all ${
                        filterImportance === imp
                          ? 'oracle-gradient-bg text-white'
                          : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'
                      }`}
                    >
                      {imp === 0 ? 'All' : '⭐'.repeat(imp)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Memory List */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--oracle-primary)]/30 border-t-[var(--oracle-primary)]" />
                  <span className="ml-3 text-[13px] text-[var(--oracle-text-3)]">Loading memories...</span>
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-3xl mb-4 block">🔍</span>
                  <h3 className="mb-2 text-[15px] font-bold text-[var(--oracle-text-1)]">No Memories Found</h3>
                  <p className="text-[13px] text-[var(--oracle-text-3)]">
                    {memories.length === 0
                      ? 'Memories will appear here as they are auto-extracted from conversations.'
                      : 'Try adjusting your search or filters.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMemories.map((memory) => (
                    <div
                      key={memory.id}
                      className={`rounded-xl border p-3 transition-all ${
                        editingId === memory.id
                          ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/5'
                          : 'border-[var(--oracle-border)] hover:bg-[var(--oracle-card-hover)]'
                      }`}
                    >
                      {editingId === memory.id ? (
                        /* ── Edit Mode ── */
                        <div className="space-y-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]"
                          />
                          <div className="flex items-center gap-3">
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-1 text-[11px] text-[var(--oracle-text-1)] outline-none"
                            >
                              {VALID_CATEGORIES.map((c) => (
                                <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>
                              ))}
                            </select>
                            <select
                              value={editImportance}
                              onChange={(e) => setEditImportance(Number(e.target.value))}
                              className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-2 py-1 text-[11px] text-[var(--oracle-text-1)] outline-none"
                            >
                              <option value={1}>⭐ Low</option>
                              <option value={2}>⭐⭐ Medium</option>
                              <option value={3}>⭐⭐⭐ High</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(memory.id)}
                              disabled={!editContent.trim()}
                              className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[11px] font-semibold text-white transition-all disabled:opacity-40"
                            >
                              💾 Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded-lg bg-[var(--oracle-surface-2)] px-3 py-1.5 text-[11px] font-semibold text-[var(--oracle-text-3)] transition-all hover:bg-[var(--oracle-card-hover)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── View Mode ── */
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ backgroundColor: `${CATEGORY_COLORS[memory.category]}20`, color: CATEGORY_COLORS[memory.category] }}
                              >
                                {CATEGORY_EMOJIS[memory.category]} {memory.category}
                              </span>
                              <span className="text-[10px] text-[var(--oracle-text-muted)]">
                                {'⭐'.repeat(memory.importance)}
                              </span>
                              <span className="text-[10px] text-[var(--oracle-text-muted)]">
                                {new Date(memory.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-[12px] text-[var(--oracle-text-2)]">{memory.content}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(memory)}
                              className="rounded-lg p-1.5 text-[var(--oracle-text-muted)] transition-all hover:bg-[var(--oracle-surface-2)] hover:text-[var(--oracle-text-1)]"
                              title="Edit memory"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteMemory(memory.id)}
                              disabled={deletingId === memory.id}
                              className="rounded-lg p-1.5 text-[var(--oracle-text-muted)] transition-all hover:bg-[var(--oracle-error)]/10 hover:text-[var(--oracle-error)] disabled:opacity-40"
                              title="Delete memory"
                            >
                              {deletingId === memory.id ? '⏳' : '🗑️'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Context Preview */}
          {filteredMemories.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mt-4">
              <div className="oracle-glass rounded-2xl p-4">
                <h3 className="mb-2 text-[14px] font-bold text-[var(--oracle-text-1)]">📝 Context Preview</h3>
                <p className="mb-2 text-[11px] text-[var(--oracle-text-muted)]">
                  This is how memories appear in the AI context:
                </p>
                <pre className="max-h-40 overflow-y-auto rounded-xl bg-[var(--oracle-surface-2)] p-3 text-[11px] text-[var(--oracle-text-2)] whitespace-pre-wrap">
                  {contextPreview || 'No memories to display'}
                </pre>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
