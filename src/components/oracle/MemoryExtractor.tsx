'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { MEMORY_EXTRACTION_PROMPT } from '@/lib/system-prompt';
import { memoriesApi } from '@/lib/api';

// ─── Types ────────────────────────────
interface ExtractedMemory {
  content: string;
  category: 'preference' | 'fact' | 'feedback' | 'decision' | 'contact';
  importance: 1 | 2 | 3;
}

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

// ─── MemoryExtractor Component ────────
export function MemoryExtractor({ projectId }: { projectId?: string | null }) {
  const [conversationText, setConversationText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedMemories, setExtractedMemories] = useState<ExtractedMemory[]>([]);
  const [selectedMemories, setSelectedMemories] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState('');

  const extractMemories = useCallback(async () => {
    if (!conversationText.trim()) return;
    setIsExtracting(true);
    setError('');
    setExtractedMemories([]);
    setSelectedMemories(new Set());

    const prompt = MEMORY_EXTRACTION_PROMPT
      .replace('{{conversation}}', conversationText.slice(0, 4000));

    try {
      const { NeverStopRouter } = await import('@/lib/router');
      const result = await NeverStopRouter.callSync(
        [{ id: 'extract', role: 'user', content: prompt, timestamp: Date.now() }],
        { messages: [{ role: 'user', content: prompt }], maxTokens: 1000 }
      );

      // Parse JSON response
      let memories: ExtractedMemory[] = [];
      try {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          memories = JSON.parse(jsonMatch[0]) as ExtractedMemory[];
        } else {
          toast('⚠️ Failed to parse extracted memories', TOAST_DEFAULTS);
        }
      } catch {
        toast('⚠️ Failed to parse extracted memories', TOAST_DEFAULTS);
      }

      setExtractedMemories(memories);
      // Auto-select all high-importance memories
      const autoSelected = new Set<number>();
      memories.forEach((m, i) => { if (m.importance >= 2) autoSelected.add(i); });
      setSelectedMemories(autoSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      toast.error('❌ Memory extraction failed', TOAST_DEFAULTS);
    } finally {
      setIsExtracting(false);
    }
  }, [conversationText]);

  const toggleMemory = useCallback((index: number) => {
    setSelectedMemories((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const saveSelectedMemories = useCallback(async () => {
    if (!projectId || selectedMemories.size === 0) return;
    setIsSaving(true);
    setError('');
    try {
      const toSave = Array.from(selectedMemories).map((i) => ({
        content: extractedMemories[i].content,
        category: extractedMemories[i].category,
        importance: extractedMemories[i].importance as 1 | 2 | 3,
      }));

      await Promise.all(toSave.map((m) => memoriesApi.create({ client_id: projectId, ...m })));
      setSavedCount(toSave.length);
      setSelectedMemories(new Set());
      setTimeout(() => setSavedCount(0), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save memories');
      toast.error('❌ Failed to save memories', TOAST_DEFAULTS);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, selectedMemories, extractedMemories]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🧠 Memory Extraction</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Extract and save key client facts from conversations</p>
          </motion.div>

          {/* Input Section */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-5">
              <textarea
                value={conversationText}
                onChange={(e) => setConversationText(e.target.value)}
                placeholder="Paste a conversation transcript here...\n\nThe AI will extract key facts about the client: preferences, business details, feedback, decisions, and contact information."
                rows={6}
                className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-[var(--oracle-text-muted)]">
                  {conversationText.length > 0 ? `${conversationText.length} characters` : 'Paste conversation to extract memories'}
                </span>
                <motion.button
                  {...buttonTapProps}
                  onClick={extractMemories}
                  disabled={!conversationText.trim() || isExtracting}
                  className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-6 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isExtracting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Extracting...
                    </>
                  ) : (
                    '🧠 Extract Memories'
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Extracted Memories */}
          <AnimatePresence>
            {extractedMemories.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={transitions.smooth} className="mt-6">
                <div className="oracle-glass rounded-2xl p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">
                      Extracted Memories ({extractedMemories.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      {projectId && (
                        <motion.button
                          {...buttonTapProps}
                          onClick={saveSelectedMemories}
                          disabled={selectedMemories.size === 0 || isSaving}
                          className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white transition-all disabled:opacity-40"
                        >
                          {isSaving ? 'Saving...' : `Save Selected (${selectedMemories.size})`}
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {savedCount > 0 && (
                    <div className="mb-4 rounded-xl bg-[var(--oracle-success)]/10 p-3 text-[12px] text-[var(--oracle-success)]">
                      ✓ {savedCount} memories saved successfully
                    </div>
                  )}

                  <div className="space-y-2">
                    {extractedMemories.map((memory, i) => (
                      <div
                        key={i}
                        onClick={() => toggleMemory(i)}
                        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                          selectedMemories.has(i)
                            ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/5'
                            : 'border-[var(--oracle-border)] hover:bg-[var(--oracle-card-hover)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMemories.has(i)}
                          onChange={() => toggleMemory(i)}
                          className="mt-1 h-4 w-4 rounded border-[var(--oracle-border)] accent-[var(--oracle-primary)]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: `${CATEGORY_COLORS[memory.category]}20`, color: CATEGORY_COLORS[memory.category] }}
                            >
                              {CATEGORY_EMOJIS[memory.category]} {memory.category}
                            </span>
                            <span className="text-[10px] text-[var(--oracle-text-muted)]">
                              Importance: {'⭐'.repeat(memory.importance)}
                            </span>
                          </div>
                          <p className="text-[12px] text-[var(--oracle-text-2)]">{memory.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error State */}
          {error && (
            <div className="mt-4 rounded-xl bg-[var(--oracle-error)]/10 p-4 text-[12px] text-[var(--oracle-error)]">
              {error}
            </div>
          )}

          {/* Empty State */}
          {extractedMemories.length === 0 && !isExtracting && !error && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mt-8 py-12 text-center">
              <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-3xl">🧠</span>
              </div>
              <h3 className="mb-2 text-[16px] font-bold text-[var(--oracle-text-1)]">No Memories Extracted Yet</h3>
              <p className="max-w-md mx-auto text-[13px] text-[var(--oracle-text-3)]">
                Paste a conversation transcript above and click "Extract Memories" to identify key client facts.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
