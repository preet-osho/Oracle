'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PROMPTS, PROMPT_CATEGORIES, CATEGORY_COLORS } from '@/data/prompts';
import { motionVariants, transitions, cardHoverProps, buttonTapProps } from '@/styles/design-tokens';
import type { PromptItem } from '@/types';
import { nanoid } from 'nanoid';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { favouritesApi, customPromptsApi } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';

// ─── PromptsTab ───────────────────────
export function PromptsTab({ onUsePrompt }: { onUsePrompt?: (prompt: string) => void }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeDifficulty, setActiveDifficulty] = useState<string>('All');
  const [showFavourites, setShowFavourites] = useState(false);
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'recent' | 'az'>('popular');
  const [favourites, setFavouritesState] = useState<string[]>([]);
  const [customPrompts, setCustomPromptsState] = useState<PromptItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    favouritesApi.list().then((rows) => {
      setFavouritesState(rows.map((r) => r.prompt_id));
    }).catch(() => {});
    customPromptsApi.list().then((rows) => {
      setCustomPromptsState(rows.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        domain: r.domain,
        difficulty: r.difficulty as PromptItem['difficulty'],
        timeEstimate: r.time_estimate,
        tools: r.tools || [],
        description: r.description,
        prompt: r.prompt,
        useCount: r.use_count,
        userRating: r.user_rating,
      })));
    }).catch(() => {});
  }, []);

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const allPrompts = useMemo(() => [...PROMPTS, ...customPrompts], [customPrompts]);

  const filteredPrompts = useMemo(() => {
    let result = allPrompts;
    if (showFavourites) result = result.filter((p) => favourites.includes(p.id));
    if (activeCategory !== 'All') result = result.filter((p) => p.category === activeCategory);
    if (activeDifficulty !== 'All') result = result.filter((p) => p.difficulty === activeDifficulty);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'popular': result = [...result].sort((a, b) => (b.useCount || 0) - (a.useCount || 0)); break;
      case 'rating': result = [...result].sort((a, b) => (b.userRating || 0) - (a.userRating || 0)); break;
      case 'recent': result = [...result].sort((a, b) => (b.useCount || 0) - (a.useCount || 0)); break;
      case 'az': result = [...result].sort((a, b) => a.title.localeCompare(b.title)); break;
    }
    return result;
  }, [allPrompts, activeCategory, activeDifficulty, debouncedSearch, sortBy, favourites, showFavourites]);

  const toggleFavourite = useCallback(async (id: string) => {
    const isFav = favourites.includes(id);
    setFavouritesState((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    try {
      if (isFav) {
        await favouritesApi.remove(id);
        toast.success('✅ Removed from favourites', TOAST_DEFAULTS);
      } else {
        await favouritesApi.add(id);
        toast.success('✅ Added to favourites', TOAST_DEFAULTS);
      }     } catch { toast.error('❌ Failed to update favourite', TOAST_DEFAULTS); /* revert on error */ }
  }, [favourites]);

  const handleCopy = useCallback((prompt: string, id: string) => {
    copyToClipboard(prompt).then((ok) => {
      if (ok) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        toast.error('❌ Clipboard access denied', TOAST_DEFAULTS);
      }
    });
  }, []);

  const handleUse = useCallback((prompt: string) => {
    onUsePrompt?.(prompt);
  }, [onUsePrompt]);

  const handleAddCustom = useCallback(async (data: Omit<PromptItem, 'id' | 'useCount' | 'userRating'>) => {
    const id = `custom-${nanoid()}`;
    const newPrompt: PromptItem = { ...data, id, useCount: 0, userRating: 0 };      setCustomPromptsState((prev) => [...prev, newPrompt]);
    try {
      await customPromptsApi.create({
        title: data.title,
        category: data.category,
        domain: data.domain,
        difficulty: data.difficulty,
        time_estimate: data.timeEstimate,
        tools: data.tools,
        description: data.description,
        prompt: data.prompt,
      });
      toast.success('✅ Prompt saved successfully', TOAST_DEFAULTS);
     } catch { toast.error('❌ Failed to save prompt', TOAST_DEFAULTS); /* ignore */ }
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">📖 Prompt Library</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">{allPrompts.length} prompts across {PROMPT_CATEGORIES.length} categories</p>
          </motion.div>

          {/* Search & Sort */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oracle-text-muted)]">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search prompts by title, description, or category..."
                className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] py-2.5 pl-9 pr-4 text-[14px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-2)] outline-none focus:border-[var(--oracle-primary)]"
            >
              <option value="popular">Most Used</option>
              <option value="rating">Highest Rated</option>
              <option value="recent">Recently Added</option>
              <option value="az">A–Z</option>
            </select>
          </div>

          {/* Category Filter Pills */}
          <div className="mb-3 flex flex-wrap gap-2">
            <FilterPill label="All" active={activeCategory === 'All' && !showFavourites} onClick={() => { setActiveCategory('All'); setShowFavourites(false); }} />
            <FilterPill label="⭐ My Favourites" active={showFavourites} onClick={() => { setShowFavourites((p) => !p); setActiveCategory('All'); }} />
            {PROMPT_CATEGORIES.map((cat) => (
              <FilterPill key={cat} label={cat} active={activeCategory === cat && !showFavourites} onClick={() => { setActiveCategory(cat); setShowFavourites(false); }} color={CATEGORY_COLORS[cat]} />
            ))}
          </div>

          {/* Difficulty Filter */}
          <div className="mb-4 flex gap-2">
            {['All', 'Easy', 'Medium', 'Hard'].map((d) => (
              <motion.button
                key={d}
                {...buttonTapProps}
                onClick={() => setActiveDifficulty(d)}
                className={`rounded-lg px-3 py-1 text-[12px] font-medium transition-all ${
                  activeDifficulty === d
                    ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)] border border-[var(--oracle-primary)]/30'
                    : 'text-[var(--oracle-text-muted)] border border-transparent hover:text-[var(--oracle-text-3)]'
                }`}
              >
                {d === 'Easy' && '🟢 '}{d === 'Medium' && '🟡 '}{d === 'Hard' && '🔴 '}{d}
              </motion.button>
            ))}
          </div>

          {/* Prompt Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {filteredPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  isFavourite={favourites.includes(prompt.id)}
                  isExpanded={expandedId === prompt.id}
                  isCopied={copiedId === prompt.id}
                  onToggleFavourite={() => toggleFavourite(prompt.id)}
                  onToggleExpand={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                  onCopy={() => handleCopy(prompt.prompt, prompt.id)}
                  onUse={() => handleUse(prompt.prompt)}
                />
              ))}
            </AnimatePresence>
          </div>

          {filteredPrompts.length === 0 && (
            <div className="py-12 text-center text-[var(--oracle-text-muted)]">
              <p className="text-[40px]">🔍</p>
              <p className="mt-2 text-[14px]">No prompts found matching your search.</p>
            </div>
          )}

          {/* Add Your Own Prompt */}
          <div className="mt-8 border-t border-[var(--oracle-border)] pt-6">
            <button
              onClick={() => setShowEditor(!showEditor)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[var(--oracle-border-strong)] bg-[var(--oracle-card)] px-4 py-3 text-[14px] font-medium text-[var(--oracle-text-2)] transition-colors hover:border-[var(--oracle-primary)] hover:text-[var(--oracle-primary-l)]"
            >
              <span className="text-lg">+</span> Add Your Own Prompt
            </button>
            <AnimatePresence>
              {showEditor && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                  <PromptEditor onSave={handleAddCustom} onClose={() => setShowEditor(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Pill ──────────────────────
function FilterPill({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <motion.button
      {...buttonTapProps}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-all border ${
        active
          ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)] border-[var(--oracle-primary)]/30'
          : 'text-[var(--oracle-text-muted)] border-transparent hover:text-[var(--oracle-text-3)] hover:border-[var(--oracle-border)]'
      }`}
      style={active && color ? { borderColor: `${color}40`, backgroundColor: `${color}15`, color } : undefined}
    >
      {label}
    </motion.button>
  );
}

// ─── Prompt Card ──────────────────────
function PromptCard({
  prompt,
  isFavourite,
  isExpanded,
  isCopied,
  onToggleFavourite,
  onToggleExpand,
  onCopy,
  onUse,
}: {
  prompt: PromptItem;
  isFavourite: boolean;
  isExpanded: boolean;
  isCopied: boolean;
  onToggleFavourite: () => void;
  onToggleExpand: () => void;
  onCopy: () => void;
  onUse: () => void;
}) {
  const catColor = CATEGORY_COLORS[prompt.category] || '#6366f1';
  const diffColor = prompt.difficulty === 'Easy' ? 'var(--oracle-success)' : prompt.difficulty === 'Medium' ? 'var(--oracle-warning)' : 'var(--oracle-error)';
  const isCustom = prompt.id.startsWith('custom-');

  return (
    <motion.div layout variants={motionVariants.fadeUp} initial="initial" animate="animate" exit="exit" transition={transitions.smooth} {...cardHoverProps}>
      <div className={`oracle-glass rounded-2xl p-4 transition-all duration-200 ${isExpanded ? 'ring-1 ring-[var(--oracle-primary)]/30' : 'hover:border-[var(--oracle-border-strong)]'}`}>
        {/* Top row: badges */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${catColor}20`, color: catColor }}>
            {prompt.category}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${diffColor}15`, color: diffColor }}>
            {prompt.difficulty === 'Easy' && '🟢 '}{prompt.difficulty === 'Medium' && '🟡 '}{prompt.difficulty === 'Hard' && '🔴 '}{prompt.difficulty}
          </span>
          <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">
            ⏱ {prompt.timeEstimate}
          </span>
          {isCustom && (
            <span className="rounded-full bg-[var(--oracle-info)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-info)]">Custom</span>
          )}
          {prompt.tools && prompt.tools.length > 0 && (
            <>
              {prompt.tools.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">
                  {t}
                </span>
              ))}
              {prompt.tools.length > 3 && (
                <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">
                  +{prompt.tools.length - 3} more
                </span>
              )}
            </>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{prompt.title}</h3>
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--oracle-text-3)]">{prompt.description}</p>

        {/* Meta row */}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-[var(--oracle-text-muted)]">
          <span>Used {prompt.useCount || 0} times</span>
          {prompt.userRating && (
            <span className="flex items-center gap-0.5">
              {'★'.repeat(prompt.userRating)}{'☆'.repeat(5 - prompt.userRating)}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-2">
          <motion.button {...buttonTapProps} onClick={onUse} className="flex items-center gap-1.5 rounded-lg oracle-gradient-bg px-3 py-1.5 text-[12px] font-semibold text-white transition-all">
            ⚡ Use
          </motion.button>
          <motion.button {...buttonTapProps} onClick={onCopy} className="flex items-center gap-1.5 rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-border-strong)]">
            {isCopied ? '✓ Copied' : '📋 Copy'}
          </motion.button>
          <motion.button {...buttonTapProps} onClick={onToggleExpand} className="flex items-center gap-1.5 rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-border-strong)]">
            {isExpanded ? '▲ Collapse' : '▼ Expand'}
          </motion.button>
          <motion.button {...buttonTapProps} onClick={onToggleFavourite} className={`ml-auto flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isFavourite ? 'text-red-400' : 'text-[var(--oracle-text-muted)] hover:text-red-400'}`}>
            {isFavourite ? '❤️' : '🤍'}
          </motion.button>
        </div>

        {/* Expanded prompt */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
              <div className="mt-4 rounded-xl bg-[var(--oracle-surface-2)] p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">Full Prompt</p>
                <pre className="overflow-x-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--oracle-text-2)] font-mono">{prompt.prompt}</pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Prompt Editor ────────────────────
function PromptEditor({ onSave, onClose }: { onSave: (data: Omit<PromptItem, 'id' | 'useCount' | 'userRating'>) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(PROMPT_CATEGORIES[0]);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [timeEstimate, setTimeEstimate] = useState('10 min');
  const [description, setDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!title.trim() || !description.trim() || !promptText.trim()) {
      setError('Please fill in title, description, and prompt text.');
      return;
    }
    onSave({
      title: title.trim(),
      category,
      domain: category,
      difficulty,
      timeEstimate,
      tools: [],
      description: description.trim(),
      prompt: promptText.trim(),
    });
    setTitle(''); setDescription(''); setPromptText(''); setError('');
    onClose();
  };

  return (
    <div className="mt-4 rounded-2xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)] p-5">
      <h3 className="mb-4 text-[16px] font-bold text-[var(--oracle-text-1)]">Create Custom Prompt</h3>
      {error && <p className="mb-3 rounded-lg bg-[var(--oracle-error)]/10 px-3 py-2 text-[12px] text-[var(--oracle-error)]">{error}</p>}
      <div className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Prompt title" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[14px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
        <div className="flex gap-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-2)] outline-none">
            {PROMPT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-2)] outline-none">
            <option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
          </select>
          <input value={timeEstimate} onChange={(e) => setTimeEstimate(e.target.value)} placeholder="Time" className="w-24 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-2)] outline-none" />
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description of what this prompt does..." rows={2} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
        <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder="The actual prompt text..." rows={6} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 font-mono text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
        <div className="flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white transition-all">Save Prompt</motion.button>
        </div>
      </div>
    </div>
  );
}
