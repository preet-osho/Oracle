'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { MULTI_AGENT_ORCHESTRATOR_PROMPT } from '@/lib/system-prompt';
import { extractFirstJson, buildPlanGraph, detectCyclesInPlan, topologicalSort, parallelExecutionGroups } from '@/lib/workflow-validation';
import { DependencyGraph, parseCycleEdges } from '@/components/oracle/DependencyGraph';
import { recogniseTaskPatterns, getKnowledgeHints, getTaskMeta, recordTask, type TaskCategory } from '@/lib/pattern-recognition';

// ─── Types ────────────────────────────
interface AgentPlan {
  agent: string;
  task: string;
  inputs: string;
  expectedOutput: string;
  dependsOn: number[];
}

interface OrchestratorResult {
  analysis: string;
  plan: AgentPlan[];
  synthesisInstructions: string;
}

const AGENT_EMOJIS: Record<string, string> = {
  researcher: '🔍',
  writer: '✍️',
  developer: '💻',
  analyst: '📊',
  strategist: '🎯',
  marketer: '📣',
  designer: '🎨',
  finance: '💰',
  voice: '🎙️',
  qa: '🛡️',
  coordinator: '📋',
  workflow: '🔗',
};

const AGENT_COLORS: Record<string, string> = {
  researcher: 'var(--oracle-info)',
  writer: 'var(--oracle-success)',
  developer: 'var(--oracle-primary-l)',
  analyst: 'var(--oracle-warning)',
  strategist: 'var(--oracle-error)',
  marketer: 'var(--oracle-violet)',
  designer: 'var(--oracle-pink)',
  finance: 'var(--oracle-amber)',
  voice: 'var(--oracle-cyan)',
  qa: 'var(--oracle-info)',
  coordinator: 'var(--oracle-primary-l)',
  workflow: 'var(--oracle-success)',
};

type WorkflowPreset = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  agents: string[];
  prompt: string;
};

// ─── Workflow Presets ─────────────────
const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'website-launch',
    name: 'Website Launch Pipeline',
    emoji: '🌐',
    color: '#3b82f6',
    agents: ['researcher', 'strategist', 'designer', 'developer', 'qa', 'marketer'],
    prompt: 'Create a complete website launch pipeline for a new client. Chain the following agents in sequence: researcher (market research & competitor analysis) → strategist (positioning & sitemap) → designer (UI/UX design specs) → developer (build production-ready Next.js site) → qa (testing & performance audit) → marketer (launch checklist & SEO setup). Each agent should produce a complete deliverable that the next agent can consume. All prices in INR, India-contextualized.',
  },
  {
    id: 'marketing-campaign',
    name: 'Marketing Campaign Pipeline',
    emoji: '📣',
    color: '#8b5cf6',
    agents: ['researcher', 'analyst', 'marketer', 'writer', 'coordinator'],
    prompt: 'Design and launch a complete digital marketing campaign. Chain agents: researcher (audience research & competitor ad analysis) → analyst (data-driven channel strategy & budget allocation) → marketer (campaign structure across Google/Meta/LinkedIn) → writer (ad copy, landing page copy, email sequences) → coordinator (project timeline, deliverables, launch checklist). All budgets in INR, India-specific platforms and cultural context.',
  },
  {
    id: 'product-launch',
    name: 'Product Launch Pipeline',
    emoji: '🚀',
    color: '#f59e0b',
    agents: ['strategist', 'finance', 'designer', 'writer', 'marketer', 'coordinator'],
    prompt: 'Plan and execute a product launch for a new SaaS or digital product. Chain agents: strategist (go-to-market strategy & positioning) → finance (pricing strategy in INR, revenue projections, unit economics) → designer (brand identity & landing page design) → writer (product copy, launch emails, press release) → marketer (launch campaign across channels) → coordinator (timeline, milestones, launch checklist). India-first approach, all prices in INR.',
  },
  {
    id: 'seo-overhaul',
    name: 'SEO Overhaul Pipeline',
    emoji: '🔍',
    color: '#10b981',
    agents: ['researcher', 'analyst', 'developer', 'writer', 'qa'],
    prompt: 'Execute a comprehensive SEO overhaul. Chain agents: researcher (keyword research, competitor gap analysis, backlink audit) → analyst (technical SEO audit, content gap analysis, priority matrix) → developer (technical fixes: Core Web Vitals, schema markup, site structure) → writer (content calendar with 12 SEO-optimized articles) → qa (verify all fixes, test Core Web Vitals, validate structured data). All in INR context, Indian market keywords.',
  },
  {
    id: 'client-proposal',
    name: 'Client Proposal Pipeline',
    emoji: '📋',
    color: '#ec4899',
    agents: ['researcher', 'strategist', 'finance', 'writer', 'coordinator'],
    prompt: 'Generate a professional client proposal. Chain agents: researcher (client business research, competitor analysis, market data) → strategist (recommended strategy with 3 pillars, 90-day roadmap) → finance (3-tier pricing in INR: Essential/Growth/Premium with ROI justification) → writer (complete proposal document: executive summary, strategy, work plan, pricing, KPIs, terms) → coordinator (follow-up sequence, presentation timeline). Professional enough for ₹50,000+ client.',
  },
  {
    id: 'voice-agent-setup',
    name: 'Voice Agent Pipeline',
    emoji: '🎙️',
    color: '#06b6d4',
    agents: ['researcher', 'designer', 'developer', 'qa', 'coordinator'],
    prompt: 'Set up an AI voice agent for a business. Chain agents: researcher (caller intent mapping, competitor voice agent analysis, Indian market voice preferences) → designer (conversation flow design, greeting scripts, error handling UX) → developer (VAPI/Sarvam configuration, Twilio telephony setup, CRM integration) → qa (test with 50+ scenarios: Hindi/English, emotional callers, edge cases) → coordinator (go-live plan, monitoring dashboard, weekly optimization cadence). Support Hindi, English, Hinglish. TRAI compliance.',
  },
];



// ─── OrchestratorPanel Component ──────
export function OrchestratorPanel({ onAskOracle }: { onAskOracle?: (prompt: string) => void }) {
  const [task, setTask] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orchestrator-last-task') || '';
    }
    return '';
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orchestrator-selected-preset');
    }
    return null;
  });
  const [recentPresetIds, setRecentPresetIds] = useState<Array<{ id: string; usedAt: number }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = JSON.parse(localStorage.getItem('orchestrator-recent-presets') || '[]');
        // Migrate legacy string[] format to { id, usedAt }[]
        return raw.map((entry: string | { id: string; usedAt: number }) =>
          typeof entry === 'string' ? { id: entry, usedAt: Date.now() } : entry
        );
      } catch { return []; }
    }
    return [];
  });

  // Format a timestamp as a relative time string
  const formatRelativeTime = useCallback((ts: number): string => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }, []);

  // Helper to add a preset to recent history (dedup + cap at 5)
  const addToRecent = useCallback((presetId: string) => {
    setRecentPresetIds((prev) => {
      const now = Date.now();
      const filtered = prev.filter((e) => e.id !== presetId);
      const next = [{ id: presetId, usedAt: now }, ...filtered].slice(0, 5);
      if (typeof window !== 'undefined') {
        localStorage.setItem('orchestrator-recent-presets', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const [presetSearch, setPresetSearch] = useState('');

  // Drag-to-reorder state for custom presets
  const [draggedPresetId, setDraggedPresetId] = useState<string | null>(null);
  const [dragOverPresetId, setDragOverPresetId] = useState<string | null>(null);
  const justDraggedRef = useRef(false);

  // Undo buffer for deleted presets (5-second window)
  const deletedPresetsRef = useRef<Map<string, { preset: WorkflowPreset; timeoutId: ReturnType<typeof setTimeout> }>>(new Map());

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<OrchestratorResult | null>(null);
  const [error, setError] = useState('');
  const [detectedPatterns, setDetectedPatterns] = useState<Array<{ category: string; confidence: number; matchedKeywords: string[]; knowledgeHints: string[]; complexity: string; tools: string[]; estimatedTime: string }>>([]);
  const [cycleWarnings, setCycleWarnings] = useState<string[]>([]);
  const [executionOrder, setExecutionOrder] = useState<number[] | null>(null);
  const [parallelGroups, setParallelGroups] = useState<number[][] | null>(null);

  // Workflow execution progress state
  const [executingPlan, setExecutingPlan] = useState(false);
  const [completedPhaseCount, setCompletedPhaseCount] = useState(0);
  const [currentWave, setCurrentWave] = useState(0);
  const [completedWaves, setCompletedWaves] = useState<number[]>([]);
  const [showModeChangeDialog, setShowModeChangeDialog] = useState(false);
  const pendingModeValue = useRef(false);

  const [sequentialMode, setSequentialMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orchestrator-sequential-mode') === 'true';
    }
    return false;
  });
  const [customPresets, setCustomPresets] = useState<WorkflowPreset[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('orchestrator-custom-presets') || '[]');
      } catch { return []; }
    }
    return [];
  });

  const reorderCustomPresets = useCallback((fromId: string, toId: string) => {
    setCustomPresets((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === fromId);
      const toIdx = prev.findIndex((p) => p.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const deletePreset = useCallback((preset: WorkflowPreset) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== preset.id));
    if (selectedPresetId === preset.id) setSelectedPresetId(null);
    // Clear any previous undo for this preset
    const existing = deletedPresetsRef.current.get(preset.id);
    if (existing) clearTimeout(existing.timeoutId);
    // Store in undo buffer
    const timeoutId = setTimeout(() => {
      deletedPresetsRef.current.delete(preset.id);
    }, 5000);
    deletedPresetsRef.current.set(preset.id, { preset, timeoutId });
    // Show undo toast
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span className="flex-1 text-[12px]">Deleted &quot;{preset.name}&quot;</span>
          <button
            onClick={() => {
              // Restore the preset
              const buffered = deletedPresetsRef.current.get(preset.id);
              if (buffered) {
                clearTimeout(buffered.timeoutId);
                deletedPresetsRef.current.delete(preset.id);
              }
              setCustomPresets((prev) => [...prev, preset]);
              toast.dismiss(t.id);
              toast(`Restored "${preset.name}"`, { ...TOAST_DEFAULTS, icon: '♻️' });
            }}
            className="rounded-lg bg-[var(--oracle-primary)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/20 transition-colors"
          >
            Undo
          </button>
        </div>
      ),
      { ...TOAST_DEFAULTS, duration: 5000, icon: '🗑️' }
    );
  }, [selectedPresetId]);

  const importFileRef = useRef<HTMLInputElement>(null);
  const presetSearchRef = useRef<HTMLInputElement>(null);

  // Import preview dialog state
  const [importPreviewPresets, setImportPreviewPresets] = useState<WorkflowPreset[]>([]);
  const [importCheckedIds, setImportCheckedIds] = useState<Set<string>>(new Set());
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Highlight matching text in search results
  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded bg-[var(--oracle-primary)]/20 text-[var(--oracle-primary-l)] px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  }, []);

  // All presets: built-in + custom
  const allPresets = useMemo(() => [...WORKFLOW_PRESETS, ...customPresets], [customPresets]);

  // Filtered presets based on search query
  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return allPresets;
    const q = presetSearch.toLowerCase();
    return allPresets.filter(
      (p) => p.name.toLowerCase().includes(q) || p.agents.some((a) => a.toLowerCase().includes(q))
    );
  }, [allPresets, presetSearch]);

  // Look up the saved preset for the resume banner (search built-in + custom)
  const savedPreset = useMemo(() => {
    if (!selectedPresetId) return null;
    return allPresets.find((p) => p.id === selectedPresetId) || null;
  }, [selectedPresetId, allPresets]);

  // Resolve recent preset entries to full preset objects with timestamps
  const recentPresets = useMemo(() => {
    return recentPresetIds
      .map((entry) => {
        const preset = allPresets.find((p) => p.id === entry.id);
        return preset ? { ...preset, usedAt: entry.usedAt } : null;
      })
      .filter(Boolean) as Array<WorkflowPreset & { usedAt: number }>;
  }, [recentPresetIds, allPresets]);

  // Keyboard shortcuts: / focuses search, Escape clears and blurs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/') {
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (showImportDialog || showModeChangeDialog) return;
        e.preventDefault();
        presetSearchRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (document.activeElement === presetSearchRef.current) {
          setPresetSearch('');
          presetSearchRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showImportDialog, showModeChangeDialog]);

  // Clean up undo buffer timeouts on unmount
  useEffect(() => {
    const currentPresets = deletedPresetsRef.current;
    return () => {
      currentPresets.forEach(({ timeoutId }) => clearTimeout(timeoutId));
      currentPresets.clear();
    };
  }, []);

  // Persist custom presets
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orchestrator-custom-presets', JSON.stringify(customPresets));
    }
  }, [customPresets]);

  // Export custom presets as JSON file
  const exportPresets = useCallback(() => {
    if (customPresets.length === 0) {
      toast('No custom presets to export', TOAST_DEFAULTS);
      return;
    }
    const blob = new Blob([JSON.stringify(customPresets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oracle-presets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${customPresets.length} preset(s)`, { ...TOAST_DEFAULTS, icon: '📥' });
  }, [customPresets]);

  // Import presets from JSON file — parses and opens preview dialog
  const importPresets = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const items = Array.isArray(data) ? data : [data];
        const valid: WorkflowPreset[] = [];
        for (const item of items) {
          if (item && typeof item.name === 'string' && typeof item.prompt === 'string' && Array.isArray(item.agents)) {
            valid.push({
              id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: item.name,
              emoji: typeof item.emoji === 'string' ? item.emoji : '🔧',
              color: typeof item.color === 'string' ? item.color : '#6366f1',
              agents: item.agents.filter((a: unknown) => typeof a === 'string'),
              prompt: item.prompt,
            });
          }
        }
        if (valid.length === 0) {
          toast('No valid presets found in file', { ...TOAST_DEFAULTS, icon: '⚠️' });
          return;
        }
        setImportPreviewPresets(valid);
        setImportCheckedIds(new Set(valid.map((p) => p.id)));
        setShowImportDialog(true);
      } catch {
        toast('Failed to parse preset file', { ...TOAST_DEFAULTS, icon: '⚠️' });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  }, []);

  // Confirm import of selected presets from preview dialog
  const confirmImport = useCallback(() => {
    const selected = importPreviewPresets.filter((p) => importCheckedIds.has(p.id));
    if (selected.length === 0) {
      toast('No presets selected', { ...TOAST_DEFAULTS, icon: '⚠️' });
    } else {
      setCustomPresets((prev) => [...prev, ...selected]);
      toast(`Imported ${selected.length} preset(s)`, { ...TOAST_DEFAULTS, icon: '📤' });
    }
    setShowImportDialog(false);
    setImportPreviewPresets([]);
    setImportCheckedIds(new Set());
  }, [importPreviewPresets, importCheckedIds, setCustomPresets]);

  // Persist sequential mode preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orchestrator-sequential-mode', String(sequentialMode));
    }
  }, [sequentialMode]);

  // Persist selected preset and task
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orchestrator-last-task', task);
      if (selectedPresetId) {
        localStorage.setItem('orchestrator-selected-preset', selectedPresetId);
      } else {
        localStorage.removeItem('orchestrator-selected-preset');
      }
    }
  }, [task, selectedPresetId]);

  // ── Listen for client tasks from MultiClientOrchestrator ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.prompt) {
        setTask(detail.prompt);
        setSelectedPresetId(null);
        toast.success('📥 Client task loaded — ready to analyze', { ...TOAST_DEFAULTS, icon: '🎯' });
      }
    };
    window.addEventListener('oracle-client-task', handler);
    return () => window.removeEventListener('oracle-client-task', handler);
  }, []);

  // Pattern recognition on input change
  useEffect(() => {
    if (!task.trim() || task.length < 10) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear patterns when input is short
      setDetectedPatterns([]);
      return;
    }
    const timer = setTimeout(() => {
      const patterns = recogniseTaskPatterns(task, 3);
      setDetectedPatterns(patterns.map((p) => {
        const meta = getTaskMeta(p.category);
        return {
          category: p.category,
          confidence: p.confidence,
          matchedKeywords: p.matchedKeywords,
          knowledgeHints: getKnowledgeHints(p.category),
          complexity: meta?.complexity || 'unknown',
          tools: meta?.tools || [],
          estimatedTime: meta?.estimatedTime || 'unknown',
        };
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [task]);

  const clearSavedState = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('orchestrator-last-task');
      localStorage.removeItem('orchestrator-selected-preset');
      localStorage.removeItem('orchestrator-sequential-mode');
      localStorage.removeItem('orchestrator-recent-presets');
      localStorage.removeItem('orchestrator-custom-presets');
    }
    setTask('');
    setSelectedPresetId(null);
    setRecentPresetIds([]);
    setCustomPresets([]);
    setSequentialMode(false);
    setDraggedPresetId(null);
    setDragOverPresetId(null);
    deletedPresetsRef.current.forEach(({ timeoutId }) => clearTimeout(timeoutId));
    deletedPresetsRef.current.clear();
    setResult(null);
    setError('');
    setDetectedPatterns([]);
    setCycleWarnings([]);
    setExecutionOrder(null);
    setParallelGroups(null);
    setExecutingPlan(false);
    setCompletedPhaseCount(0);
    setCurrentWave(0);
    setCompletedWaves([]);
  }, []);

  const analyzeTask = useCallback(async () => {
    if (!task.trim()) return;
    setIsAnalyzing(true);
    setResult(null);
    setExecutingPlan(false);
    setCompletedPhaseCount(0);
    setCycleWarnings([]);
    setExecutionOrder(null);
    setParallelGroups(null);
    setError('');

    // Record task pattern for history
    if (detectedPatterns.length > 0) {
      recordTask(detectedPatterns[0].category as TaskCategory);
    }

    const prompt = MULTI_AGENT_ORCHESTRATOR_PROMPT + '\n\nAnalyze this task:\n' + task.slice(0, 2000);

    try {
      const { NeverStopRouter } = await import('@/lib/router');
      const apiResult = await NeverStopRouter.callSync(
        [{ id: 'orchestrator', role: 'user', content: prompt, timestamp: Date.now() }],
        { messages: [{ role: 'user', content: prompt }], maxTokens: 1500 }
      );

      // Parse JSON response using non-greedy bracket-depth extraction
      let parsed: OrchestratorResult | null = null;
      try {
        const jsonString = extractFirstJson(apiResult.text);
        if (jsonString) {
          parsed = JSON.parse(jsonString) as OrchestratorResult;
        } else {
          toast('⚠️ Failed to parse orchestrator response', TOAST_DEFAULTS);
        }
      } catch {
        toast('⚠️ Failed to parse orchestrator response', TOAST_DEFAULTS);
      }

      if (parsed && parsed.plan) {
        setResult(parsed);
        // Check for dependency cycles in the plan
        const deps = parsed.plan.map((p) => p.dependsOn);
        const graph = buildPlanGraph(deps, parsed.plan.length);
        const cycles = detectCyclesInPlan(deps, parsed.plan.length, graph);
        setCycleWarnings(cycles);
        // Compute optimal execution order and parallel groups using the shared graph
        setExecutionOrder(topologicalSort(deps, parsed.plan.length, graph));
        setParallelGroups(parallelExecutionGroups(deps, parsed.plan.length, graph));
      } else {
        setError('Failed to parse orchestrator response. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [task, detectedPatterns]);

  // Cache for completed wave outputs — keyed by wave index
  const waveOutputsRef = useRef<Map<number, { agent: string; phaseIdx: number; output: string }[]>>(new Map());

  // Speed comparison between parallel and sequential execution
  const speedComparison = useMemo(() => {
    if (!result || result.plan.length <= 1) return null;
    const totalPhases = result.plan.length;
    const parallelWaves = parallelGroups && parallelGroups.length > 0
      ? parallelGroups.length
      : totalPhases; // fallback: same as sequential
    const sequentialWaves = totalPhases;
    if (parallelWaves >= sequentialWaves) return null; // no speed advantage
    const speedup = (sequentialWaves / parallelWaves).toFixed(1);
    const savedWaves = sequentialWaves - parallelWaves;
    return { parallelWaves, sequentialWaves, speedup, savedWaves };
  }, [result, parallelGroups]);

  const executePlan = useCallback(() => {
    if (!result || !onAskOracle) return;
    if (cycleWarnings.length > 0) {
      toast(`⚠️ Cannot execute: ${cycleWarnings.length} dependency cycle(s) detected in the plan`, { ...TOAST_DEFAULTS, icon: '🔄' });
      return;
    }
    // Clear any stale cached outputs from a previous execution
    waveOutputsRef.current.clear();
    setExecutingPlan(true);
    setCompletedPhaseCount(0);
    setCurrentWave(0);
    setCompletedWaves([]);
  }, [result, onAskOracle, cycleWarnings]);

  // Wave-based execution: send prompts and advance progress in sync
  useEffect(() => {
    if (!executingPlan || !result || result.plan.length === 0 || !onAskOracle) return;
    const groups = sequentialMode
      ? result.plan.map((_, i) => [i]) // sequential: one phase per wave
      : parallelGroups && parallelGroups.length > 0
        ? parallelGroups
        : result.plan.map((_, i) => [i]);
    const totalPhases = result.plan.length;
    const totalWaves = groups.length;
    const intervalMs = Math.max(1200, 5000 / totalWaves);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize wave execution progress
    setCompletedPhaseCount(0);
     
    setCurrentWave(0);
     
    setCompletedWaves([]);
    let waveIdx = 0;
    let stopped = false;
    let completedCount = 0;

    // Build context for a wave by reading cached outputs from previous waves
    const buildContext = (wIdx: number) => {
      const parts: string[] = [];
      for (let w = 0; w < wIdx; w++) {
        const cached = waveOutputsRef.current.get(w);
        if (cached && cached.length > 0) {
          for (const entry of cached) {
            parts.push(`- [${entry.agent}] (Phase ${entry.phaseIdx + 1}): ${entry.output}`);
          }
        }
      }
      return parts;
    };

    const sendWave = (wIdx: number) => {
      const waveGroup = groups[wIdx];
      const wavePhases = waveGroup.map((idx) => ({ ...result.plan[idx], phaseIdx: idx }));

      const waveLines = wavePhases
        .map((p) => `[${p.agent}] (Phase ${p.phaseIdx + 1}) ${p.task}\n  Inputs: ${p.inputs}\n  Expected Output: ${p.expectedOutput}`)
        .join('\n\n');

      // Use cached outputs from previous waves instead of re-parsing the plan
      const contextParts = buildContext(wIdx);
      const prevContext = contextParts.length > 0
        ? '\n\nCOMPLETED PHASES (use their outputs as context):\n' + contextParts.join('\n')
        : '';

      const prompt =
        `WAVE ${wIdx + 1} of ${totalWaves} — Execute these ${wavePhases.length} concurrent phase(s):\n\n` +
        wavePhases.map((p) => `${AGENT_EMOJIS[p.agent] || '🤖'} ${p.agent.charAt(0).toUpperCase() + p.agent.slice(1)} (Phase ${p.phaseIdx + 1})`).join(', ') +
        '\n\n' +
        'TASKS:\n' + waveLines +
        prevContext +
        '\n\nCONTEXT:\n' + result.analysis +
        '\n\nSYNTHESIS INSTRUCTIONS:\n' + result.synthesisInstructions +
        '\n\nOriginal Task: ' + task;

      onAskOracle(prompt);
    };

    // Send first wave immediately
    sendWave(0);

    const timer = setInterval(() => {
      if (stopped) return;
      waveIdx++;
      if (waveIdx >= totalWaves) {
        stopped = true;
        clearInterval(timer);
        setCompletedPhaseCount(totalPhases);
        setCurrentWave(totalWaves);
        return;
      }
      // Cache the outputs from the wave that just completed
      const completedWaveIdx = waveIdx - 1;
      const completedGroup = groups[completedWaveIdx];
      waveOutputsRef.current.set(
        completedWaveIdx,
        completedGroup.map((idx) => ({
          agent: result.plan[idx].agent,
          phaseIdx: idx,
          output: result.plan[idx].expectedOutput,
        })),
      );
      completedCount += groups[completedWaveIdx].length;
      setCompletedWaves((cw) => [...cw, completedWaveIdx]);
      setCompletedPhaseCount(Math.min(completedCount, totalPhases));
      setCurrentWave(waveIdx);
      sendWave(waveIdx);
    }, intervalMs);

    return () => { stopped = true; clearInterval(timer); };
  }, [executingPlan, result, parallelGroups, onAskOracle, task, sequentialMode]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">⚡ Agent Orchestrator</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Decompose complex tasks across specialist agents</p>
          </motion.div>

          {/* Resume Last Pipeline Banner */}
          {savedPreset && task && !result && !isAnalyzing && !error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.smooth}
              className="mb-4"
            >
              <div className="oracle-glass flex items-center justify-between rounded-2xl border border-[var(--oracle-primary)]/20 bg-[var(--oracle-primary)]/5 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{savedPreset.emoji}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">
                      Resume: {savedPreset.name}
                    </p>
                    <p className="text-[11px] text-[var(--oracle-text-muted)]">
                      {savedPreset.agents.length} agents · {task.length} chars saved
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTask('');
                      setSelectedPresetId(null);
                    }}
                    className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-surface-2)] hover:text-[var(--oracle-text-3)] transition-colors"
                  >
                    Clear
                  </button>
                  <motion.button
                    {...buttonTapProps}
                    onClick={analyzeTask}
                    className="flex items-center justify-center gap-1.5 rounded-xl oracle-gradient-bg px-4 py-1.5 text-[12px] font-semibold text-white transition-all hover:opacity-90"
                  >
                    ⚡ Resume
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Recent Pipelines */}
          {recentPresets.length > 0 && !executingPlan && !isAnalyzing && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">🕐 Recent Pipelines</p>
                <button
                  onClick={() => {
                    setRecentPresetIds([]);
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('orchestrator-recent-presets');
                    }
                  }}
                  className="rounded px-1.5 py-0.5 text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/5 transition-colors"
                  aria-label="Clear recent history"
                >
                  ×
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recentPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setTask(preset.prompt);
                      setSelectedPresetId(preset.id);
                      addToRecent(preset.id);
                    }}
                    className={`shrink-0 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all duration-200 hover:border-[var(--oracle-border-strong)] ${
                      selectedPresetId === preset.id
                        ? 'border-[var(--oracle-primary)]/40 bg-[var(--oracle-primary)]/5 text-[var(--oracle-primary-l)]'
                        : 'border-[var(--oracle-border)] text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)]'
                    }`}
                  >
                    <span>{preset.emoji}</span>
                    <span>{preset.name}</span>
                    <span className="text-[9px] text-[var(--oracle-text-muted)]">{formatRelativeTime(preset.usedAt)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Workflow Presets */}
          {!executingPlan && !isAnalyzing && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">⚡ Workflow Pipelines</p>
                <div className="flex items-center gap-1">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={importPresets}
                  />
                  <button
                    onClick={() => importFileRef.current?.click()}
                    className="rounded px-1.5 py-0.5 text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/5 transition-colors"
                    aria-label="Import presets"
                  >
                    📤 Import
                  </button>
                  <button
                    onClick={exportPresets}
                    className="rounded px-1.5 py-0.5 text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/5 transition-colors"
                    aria-label="Export custom presets"
                  >
                    📥 Export Custom
                  </button>
                  {customPresets.length > 1 && (
                    <button
                      onClick={() => setCustomPresets((prev) => [...prev].sort((a, b) => a.id.localeCompare(b.id)))}
                      className="rounded px-1.5 py-0.5 text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/5 transition-colors"
                      aria-label="Reset custom preset order"
                    >
                      ↺ Reset order
                    </button>
                  )}
                </div>
              </div>
              <div className="relative mb-2">
                <input
                  ref={presetSearchRef}
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search pipelines..."
                  className="w-full rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] pl-3 pr-7 py-1.5 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
                />
                {!presetSearch && (
                  <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--oracle-border)] px-1 py-0.5 text-[9px] font-medium text-[var(--oracle-text-muted)]">/</kbd>
                )}
              </div>
              {filteredPresets.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-[var(--oracle-text-muted)]">
                  No matching pipelines for &quot;{presetSearch}&quot;
                </p>
              ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{filteredPresets.map((preset) => {
                const isCustom = !WORKFLOW_PRESETS.some((bp) => bp.id === preset.id);
                const isDragging = draggedPresetId === preset.id;
                const isDragOver = dragOverPresetId === preset.id && !isDragging;
                return (
                <motion.button
                  key={preset.id}
                  {...buttonTapProps}
                  draggable={isCustom}
                  onDragStart={() => { setDraggedPresetId(preset.id); }}
                  onDragOver={(ev) => { if (isCustom) { ev.preventDefault(); setDragOverPresetId(preset.id); } }}
                  onDragLeave={() => { setDragOverPresetId((prev) => prev === preset.id ? null : prev); }}
                  onDrop={() => { if (isCustom && draggedPresetId && draggedPresetId !== preset.id) { reorderCustomPresets(draggedPresetId, preset.id); } setDragOverPresetId(null); setDraggedPresetId(null); }}
                  onDragEnd={() => { justDraggedRef.current = true; setTimeout(() => { justDraggedRef.current = false; }, 0); setDraggedPresetId(null); setDragOverPresetId(null); }}
                  onClick={() => {
                    if (justDraggedRef.current) return;
                    setTask(preset.prompt);
                    setSelectedPresetId(preset.id);
                    addToRecent(preset.id);
                  }}
                  className={`oracle-glass rounded-xl p-3 text-left transition-all duration-200 hover:border-[var(--oracle-border-strong)] group relative ${
                    selectedPresetId === preset.id
                      ? 'border-[var(--oracle-primary)]/40 bg-[var(--oracle-primary)]/5'
                      : ''
                  } ${
                    isDragging ? 'opacity-50 ring-2 ring-[var(--oracle-primary)]/40' : ''
                  } ${
                    isDragOver ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/5 scale-[1.02]' : ''
                  } ${
                    isCustom ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                >
                  {isCustom && (
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          const existingNames = new Set(customPresets.map((p) => p.name));
                          let copyName = `${preset.name} (copy 1)`;
                          let copyIdx = 1;
                          while (existingNames.has(copyName)) {
                            copyIdx++;
                            copyName = `${preset.name} (copy ${copyIdx})`;
                          }
                          const dup: WorkflowPreset = {
                            ...preset,
                            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            name: copyName,
                          };
                          setCustomPresets((prev) => [...prev, dup]);
                          toast(`Duplicated "${preset.name}"`, { ...TOAST_DEFAULTS, icon: '📋' });
                        }}
                        className="rounded px-1 py-0.5 text-[9px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/5 transition-colors"
                        aria-label={`Duplicate ${preset.name}`}
                      >
                        ⧉
                      </button>
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          deletePreset(preset);
                        }}
                        className="rounded px-1 py-0.5 text-[9px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/5 transition-colors"
                        aria-label={`Delete ${preset.name}`}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{preset.emoji}</span>
                    <span className="text-[12px] font-semibold text-[var(--oracle-text-1)] group-hover:text-[var(--oracle-primary-l)] transition-colors truncate">{highlightMatch(preset.name, presetSearch)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {preset.agents.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]">{AGENT_EMOJIS[a] || '🤖'} {highlightMatch(a, presetSearch)}</span>
                    ))}
                    {preset.agents.length > 4 && <span className="text-[9px] text-[var(--oracle-text-muted)]">+{preset.agents.length - 4}</span>}
                    {isCustom && <span className="rounded-full bg-[var(--oracle-primary)]/10 px-1.5 py-0.5 text-[9px] font-medium text-[var(--oracle-primary-l)]">custom</span>}
                  </div>
                </motion.button>
                );
              })}</div>
              )}
            </motion.div>
          )}

          {/* Input Section */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-5">
              <textarea
                value={task}
                onChange={(e) => {
                  setTask(e.target.value);
                  // Clear preset selection when user edits the task manually
                  if (selectedPresetId) setSelectedPresetId(null);
                }}
                placeholder="Describe a complex task that needs multiple specialists... (e.g. Create a complete digital marketing strategy for a new D2C skincare brand launching in India)"
                rows={5}
                className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-[var(--oracle-text-muted)]">
                  {task.length > 0 ? `${task.length} characters` : 'Describe a complex task'}
                </span>
                <motion.button
                  {...buttonTapProps}
                  onClick={analyzeTask}
                  disabled={!task.trim() || isAnalyzing}
                  className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-6 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Analyzing...
                    </>
                  ) : (
                    '⚡ Analyze & Decompose'
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Error State */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl bg-[var(--oracle-error)]/10 p-4 text-[12px] text-[var(--oracle-error)]">
              {error}
            </motion.div>
          )}

          {/* Detected Task Patterns */}
          {detectedPatterns.length > 0 && task.length > 10 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mt-4">
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">🏷️ Detected Task Patterns</h3>
                <div className="space-y-3">
                  {detectedPatterns.map((p, i) => (
                    <div key={i} className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="rounded-full bg-[var(--oracle-primary)]/10 px-3 py-1 text-[12px] font-semibold text-[var(--oracle-primary-l)]">
                          {p.category.replace(/-/g, ' ')}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--oracle-text-muted)]">{p.confidence}% confidence</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] mb-2">
                        <div><span className="text-[var(--oracle-text-muted)]">Complexity:</span> <span className="text-[var(--oracle-text-1)] capitalize">{p.complexity}</span></div>
                        <div><span className="text-[var(--oracle-text-muted)]">Time:</span> <span className="text-[var(--oracle-text-1)]">{p.estimatedTime}</span></div>
                        <div><span className="text-[var(--oracle-text-muted)]">Matched:</span> <span className="text-[var(--oracle-text-1)]">{p.matchedKeywords.slice(0, 3).join(', ')}</span></div>
                      </div>
                      {p.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {p.tools.map((t) => (
                            <span key={t} className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">🔧 {t}</span>
                          ))}
                        </div>
                      )}
                      {p.knowledgeHints.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] font-semibold text-[var(--oracle-text-muted)] mb-1">💡 Knowledge Hints:</p>
                          <div className="flex flex-wrap gap-1">
                            {p.knowledgeHints.map((h) => (
                              <span key={h} className="rounded-full bg-[var(--oracle-warning)]/10 px-2 py-0.5 text-[10px] text-[var(--oracle-warning)]">{h}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Workflow Execution Progress Tracker */}
          {executingPlan && result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <div className="oracle-glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">🔄 Workflow Execution</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--oracle-text-muted)]">
                      Wave {Math.min(currentWave + 1, (parallelGroups?.length || 1))}/{parallelGroups?.length || 1} · {completedPhaseCount}/{result.plan.length} phases
                    </span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--oracle-surface-2)]">
                      <motion.div
                        className="h-full rounded-full bg-[var(--oracle-primary)]"
                        animate={{ width: `${(completedPhaseCount / result.plan.length) * 100}%` }}
                        transition={transitions.smooth}
                      />
                    </div>
                    <button
                      onClick={() => { setExecutingPlan(false); setCompletedPhaseCount(0); setCurrentWave(0); setCompletedWaves([]); }}
                      className="rounded-lg border border-[var(--oracle-border)] px-2 py-1 text-[10px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-text-3)] transition-colors"
                    >
                      {completedPhaseCount >= result.plan.length ? '✓ Done' : 'Dismiss'}
                    </button>
                  </div>
                </div>

                {/* Wave Progress Indicator */}
                {(() => {
                  const groups = sequentialMode
                    ? result.plan.map((_, i) => [i])
                    : parallelGroups && parallelGroups.length > 0
                      ? parallelGroups
                      : result.plan.map((_, i) => [i]);
                  return (
                    <div className="mb-4 space-y-2">
                      {groups.map((waveGroup, waveIdx) => {
                        const isCompleted = completedWaves.includes(waveIdx) || waveIdx < currentWave;
                        const isActive = waveIdx === currentWave && executingPlan && !isCompleted;

                        return (
                          <motion.div
                            key={waveIdx}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: waveIdx * 0.05, duration: 0.25 }}
                            className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-300 ${
                              isCompleted
                                ? 'border-[var(--oracle-success)]/20 bg-[var(--oracle-success)]/5'
                                : isActive
                                  ? 'border-[var(--oracle-primary)]/30 bg-[var(--oracle-primary)]/5'
                                  : 'border-[var(--oracle-border)] bg-transparent opacity-50'
                            }`}
                          >
                            {/* Wave number */}
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-300 ${
                                isCompleted ? 'bg-[var(--oracle-success)] text-white'
                                  : isActive ? 'bg-[var(--oracle-primary)] text-white animate-pulse'
                                  : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'
                              }`}
                            >
                              {isCompleted ? '✓' : isActive ? '⟳' : waveIdx + 1}
                            </div>

                            {/* Wave label */}
                            <span className="shrink-0 text-[11px] font-semibold text-[var(--oracle-text-muted)] w-12">
                              Wave {waveIdx + 1}
                            </span>

                            {/* Agent badges in this wave */}
                            <div className="flex flex-1 flex-wrap gap-1.5">
                              {waveGroup.map((phaseIdx) => {
                                const phase = result.plan[phaseIdx];
                                if (!phase) return null;
                                const agentColor = AGENT_COLORS[phase.agent] || 'var(--oracle-text-muted)';
                                return (
                                  <motion.span
                                    key={phaseIdx}
                                    initial={isActive ? { scale: [1, 1.08, 1] } : undefined}
                                    animate={isActive ? { scale: [1, 1.08, 1] } : undefined}
                                    transition={isActive ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : undefined}
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-300 ${
                                      isCompleted
                                        ? 'bg-[var(--oracle-success)]/15 text-[var(--oracle-success)]'
                                        : isActive
                                          ? 'bg-[var(--oracle-primary)]/15 text-[var(--oracle-primary-l)]'
                                          : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                                        isActive ? 'animate-pulse' : ''
                                      }`}
                                      style={{ backgroundColor: isCompleted ? 'var(--oracle-success)' : isActive ? agentColor : 'var(--oracle-text-muted)' }}
                                    />
                                    {AGENT_EMOJIS[phase.agent] || '🤖'} {phase.agent}
                                  </motion.span>
                                );
                              })}
                            </div>

                            {/* Wave status */}
                            <span className={`shrink-0 text-[9px] font-medium ${
                              isCompleted ? 'text-[var(--oracle-success)]'
                                : isActive ? 'text-[var(--oracle-primary-l)]'
                                : 'text-[var(--oracle-text-muted)]'
                            }`}>
                              {isCompleted ? 'Done' : isActive ? 'Running…' : 'Pending'}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Phase Timeline */}
                <div className="space-y-0">
                  {result.plan.map((phase, i) => {
                    // Determine phase status based on wave-based execution
                    const phaseWave = sequentialMode
                      ? i
                      : parallelGroups
                        ? parallelGroups.findIndex((g) => g.includes(i))
                        : i;
                    const isCompleted = completedWaves.includes(phaseWave) || phaseWave < currentWave;
                    const isActive = phaseWave === currentWave && executingPlan;
                    const isUpcoming = phaseWave > currentWave;
                    const isLast = i === result.plan.length - 1;
                    const agentColor = AGENT_COLORS[phase.agent] || 'var(--oracle-text-muted)';

                    return (
                      <div key={i} className="flex gap-3">
                        {/* Timeline column */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300 ${
                              isCompleted ? 'text-white' : isActive ? 'text-white animate-pulse' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'
                            }`}
                            style={isCompleted || isActive ? { backgroundColor: agentColor } : undefined}
                          >
                            {isCompleted ? '✓' : isActive ? '⟳' : i + 1}
                          </div>
                          {!isLast && (
                            <div className={`w-0.5 min-h-[24px] flex-1 transition-colors duration-300 ${
                              isCompleted ? 'bg-[var(--oracle-success)]' : 'bg-[var(--oracle-surface-2)]'
                            }`} />
                          )}
                        </div>

                        {/* Content column */}
                        <div className={`flex-1 pb-4 transition-opacity duration-300 ${isUpcoming ? 'opacity-40' : ''}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">
                              {AGENT_EMOJIS[phase.agent] || '🤖'} {phase.agent.charAt(0).toUpperCase() + phase.agent.slice(1)}
                            </span>
                            {isCompleted && (
                              <span className="rounded-full bg-[var(--oracle-success)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--oracle-success)]">✓ Done</span>
                            )}
                            {isActive && (
                              <span className="rounded-full bg-[var(--oracle-primary)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--oracle-primary-l)] animate-pulse">⟳ Active</span>
                            )}
                            {isUpcoming && (
                              <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] font-medium text-[var(--oracle-text-muted)]">Pending</span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--oracle-text-3)] mb-1">{phase.task}</p>
                          <div className="flex gap-4 text-[10px] text-[var(--oracle-text-muted)]">
                            <span>📥 {phase.inputs}</span>
                            <span>📤 {phase.expectedOutput}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={transitions.smooth} className="mt-6 space-y-4">
                {/* Analysis */}
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Task Analysis</h3>
                  <p className="text-[13px] text-[var(--oracle-text-2)] leading-relaxed">{result.analysis}</p>
                </div>

                {/* Agent Plan */}
                <div className="oracle-glass rounded-2xl p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">🎯 Execution Plan ({result.plan.length} agents)</h3>
                    <div className="flex items-center gap-3">
                      {/* Execution mode toggle + speed badge */}
                      <div className="flex items-center gap-2">
                        {speedComparison && !sequentialMode && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--oracle-success)]/10 px-2 py-0.5 text-[9px] font-semibold text-[var(--oracle-success)]"
                          >
                            🚀 {speedComparison.speedup}x faster
                          </motion.span>
                        )}
                        {speedComparison && sequentialMode && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--oracle-warning)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--oracle-warning)]">
                            ⏳ +{speedComparison.savedWaves} waves slower
                          </span>
                        )}
                        <Tooltip open={executingPlan ? false : undefined}>
                          <TooltipTrigger render={<div className="flex items-center gap-2" />}>
                            <span className="text-[10px] text-[var(--oracle-text-muted)] cursor-help">
                              {sequentialMode ? '🔒 Sequential' : '⚡ Parallel'}
                            </span>
                            <Switch
                              size="sm"
                              checked={sequentialMode}
                              onCheckedChange={(val) => {
                                if (executingPlan) {
                                  pendingModeValue.current = val;
                                  setShowModeChangeDialog(true);
                                } else {
                                  setSequentialMode(val);
                                }
                              }}
                              aria-label="Toggle sequential execution mode"
                            />
                          </TooltipTrigger>                           <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px]">
                          {/* eslint-disable-next-line react-hooks/refs */}
                          {pendingModeValue.current
                            ? 'Switching to sequential mode will restart the plan from the beginning, running one phase at a time. This will be slower than parallel execution.'
                            : 'Switching to parallel mode will restart the plan from the beginning, running independent phases simultaneously. This is faster but changes the execution order.'
                          }
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {onAskOracle && (
                        <motion.button
                          {...buttonTapProps}
                          onClick={executePlan}
                          disabled={cycleWarnings.length > 0}
                          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold transition-all ${
                            cycleWarnings.length > 0
                              ? 'cursor-not-allowed border border-[var(--oracle-error)]/30 bg-[var(--oracle-error)]/10 text-[var(--oracle-error)]'
                              : 'oracle-gradient-bg text-white'
                          }`}
                        >
                          {cycleWarnings.length > 0 ? '🔄 Cycles Detected' : '⚡ Execute Plan'}
                        </motion.button>
                      )}
                    </div>
                  </div>
                  {/* Dependency Graph Visualization */}
                  <div className="mb-4">
                    <p className="mb-2 text-[12px] font-semibold text-[var(--oracle-text-1)]">🗺️ Dependency Graph</p>
                    <DependencyGraph
                      plan={result.plan}
                      cycleEdges={parseCycleEdges(cycleWarnings)}
                      parallelGroups={parallelGroups}
                      sequentialMode={sequentialMode}
                    />
                  </div>

                  {cycleWarnings.length > 0 && (
                    <div className="mb-4 rounded-xl border border-[var(--oracle-error)]/20 bg-[var(--oracle-error)]/5 p-3">
                      <p className="mb-1 text-[12px] font-semibold text-[var(--oracle-error)]">🔄 {cycleWarnings.length} Dependency Cycle{cycleWarnings.length > 1 ? 's' : ''} Detected</p>
                      <ul className="space-y-1">
                        {cycleWarnings.map((c, i) => (
                          <li key={i} className="text-[11px] text-[var(--oracle-error)]/80">• {c}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[10px] text-[var(--oracle-text-muted)]">Fix the plan to remove circular dependencies before executing.</p>
                    </div>
                  )}

                  {executionOrder && cycleWarnings.length === 0 && (
                    <div className="mb-4 rounded-xl border border-[var(--oracle-primary)]/20 bg-[var(--oracle-primary)]/5 p-3">
                      <p className="mb-2 text-[12px] font-semibold text-[var(--oracle-primary-l)]">📊 Optimal Execution Order</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {executionOrder.map((phaseIdx, orderIdx) => {
                          const phase = result.plan[phaseIdx];
                          if (!phase) return null;
                          return (
                            <React.Fragment key={phaseIdx}>
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-text-1)]">
                                <span className="text-[9px] text-[var(--oracle-text-muted)]">{orderIdx + 1}.</span>
                                {AGENT_EMOJIS[phase.agent] || '🤖'} {phase.agent}
                              </span>
                              {orderIdx < executionOrder.length - 1 && (
                                <span className="text-[10px] text-[var(--oracle-text-muted)]">→</span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {parallelGroups && parallelGroups.length > 1 && cycleWarnings.length === 0 && (
                    <div className="mb-4 rounded-xl border border-[var(--oracle-success)]/20 bg-[var(--oracle-success)]/5 p-3">
                      <p className="mb-2 text-[12px] font-semibold text-[var(--oracle-success)]">⚡ Parallel Execution Groups ({parallelGroups.length} waves)</p>
                      <div className="space-y-2">
                        {parallelGroups.map((group, waveIdx) => (
                          <div key={waveIdx} className="flex items-center gap-2">
                            <span className="shrink-0 text-[10px] font-semibold text-[var(--oracle-text-muted)] w-16">Wave {waveIdx + 1}:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {group.map((phaseIdx) => {
                                const phase = result.plan[phaseIdx];
                                if (!phase) return null;
                                return (
                                  <span key={phaseIdx} className="inline-flex items-center gap-1 rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--oracle-text-1)]">
                                    {AGENT_EMOJIS[phase.agent] || '🤖'} {phase.agent}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {result.plan.map((plan, i) => (
                      <div key={i} className="rounded-xl border border-[var(--oracle-border)] p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px]"
                            style={{ backgroundColor: `${AGENT_COLORS[plan.agent]}20` }}
                          >
                            {AGENT_EMOJIS[plan.agent] || '🤖'}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">
                                Agent {i + 1}: {plan.agent.charAt(0).toUpperCase() + plan.agent.slice(1)}
                              </span>
                              {plan.dependsOn.length > 0 && (
                                <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">
                                  Depends on: {plan.dependsOn.map((d) => d + 1).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-[12px] text-[var(--oracle-text-2)] mb-2">{plan.task}</p>
                        <div className="flex gap-4 text-[11px] text-[var(--oracle-text-muted)]">
                          <span><strong>Inputs:</strong> {plan.inputs}</span>
                          <span><strong>Output:</strong> {plan.expectedOutput}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Synthesis Instructions */}
                <div className="oracle-glass rounded-2xl p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">🔗 Synthesis Instructions</h3>
                  <p className="text-[13px] text-[var(--oracle-text-2)] leading-relaxed">{result.synthesisInstructions}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {!result && !isAnalyzing && !error && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mt-8 py-12 text-center">
              <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="mb-2 text-[16px] font-bold text-[var(--oracle-text-1)]">No Task Analyzed Yet</h3>
              <p className="max-w-md mx-auto text-[13px] text-[var(--oracle-text-3)]">
                Describe a complex task above and click &quot;Analyze &amp; Decompose&quot; to see how ORACLE would break it down across specialist agents.
              </p>
              {(task || selectedPresetId || sequentialMode) && (
                <button
                  onClick={clearSavedState}
                  className="mt-4 rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-muted)] hover:border-[var(--oracle-error)]/30 hover:text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/5 transition-colors"
                >
                  🗑️ Clear saved state
                </button>
              )}
            </motion.div>
          )}

          {/* Import Preview Dialog */}
          <Dialog open={showImportDialog} onOpenChange={(open) => {
            if (!open) {
              setShowImportDialog(false);
              setImportPreviewPresets([]);
              setImportCheckedIds(new Set());
            }
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>📤 Import Presets</DialogTitle>
                <DialogDescription>
                  Found {importPreviewPresets.length} preset(s) in file. Select which ones to import.
                </DialogDescription>
              </DialogHeader>
              <div className="my-4 max-h-[300px] space-y-2 overflow-y-auto">
                <button
                  onClick={() => {
                    const allIds = new Set(importPreviewPresets.map((p) => p.id));
                    setImportCheckedIds(importCheckedIds.size === allIds.size ? new Set() : allIds);
                  }}
                  className="w-full rounded-lg border border-[var(--oracle-border)] px-3 py-2 text-left text-[12px] font-semibold text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
                >
                  {importCheckedIds.size === importPreviewPresets.length ? '☐ Deselect All' : '☑ Select All'}
                </button>
                {importPreviewPresets.map((preset) => (
                  <label
                    key={preset.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--oracle-border)] px-3 py-2 cursor-pointer hover:bg-[var(--oracle-surface-2)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={importCheckedIds.has(preset.id)}
                      onChange={() => {
                        setImportCheckedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(preset.id)) next.delete(preset.id); else next.add(preset.id);
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-[var(--oracle-border)] accent-[var(--oracle-primary)]"
                    />
                    <span className="text-lg">{preset.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--oracle-text-1)] truncate">{preset.name}</p>
                      <p className="text-[10px] text-[var(--oracle-text-muted)]">{preset.agents.length} agents</p>
                    </div>
                  </label>
                ))}
              </div>
              <DialogFooter>
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportPreviewPresets([]);
                    setImportCheckedIds(new Set());
                  }}
                  className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importCheckedIds.size === 0}
                  className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  📤 Import {importCheckedIds.size} Preset{importCheckedIds.size !== 1 ? 's' : ''}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Mode Change Confirmation Dialog */}
          <Dialog open={showModeChangeDialog} onOpenChange={setShowModeChangeDialog}>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>⚠️ Switch Execution Mode?</DialogTitle>                 <DialogDescription>
                  {/* eslint-disable-next-line react-hooks/refs */}
                  {pendingModeValue.current
                    ? 'Switching to sequential mode will restart the plan from the beginning, running one phase at a time. This will be slower than parallel execution.'
                    : 'Switching to parallel mode will restart the plan from the beginning, running independent phases simultaneously. This is faster but changes the execution order.'
                  }
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  onClick={() => setShowModeChangeDialog(false)}
                  className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const newMode = pendingModeValue.current;
                    // Stop current execution, switch mode, and restart
                    setExecutingPlan(false);
                    setSequentialMode(newMode);
                    setCompletedPhaseCount(0);
                    setCurrentWave(0);
                    setCompletedWaves([]);
                    // Close dialog then restart execution on next frame
                    setShowModeChangeDialog(false);
                    requestAnimationFrame(() => setExecutingPlan(true));
                  }}
                  className="rounded-lg oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  🔄 Switch & Restart
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
