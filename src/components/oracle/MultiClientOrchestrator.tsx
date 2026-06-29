'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import {
  getClientTasks,
  addClientTask,
  updateClientTask,
  analyzeBatchTasks,
  getClientSummaries,
  getSkillTemplates,
  addReviewCheckpoint,
  populateDemoTasks,
  type ClientTask,
  type TaskApproach,
  type TaskPriority,
  type TaskStatus,
  type ReviewCheckpoint,
} from '@/lib/client-task-queue';
import { type TaskCategory } from '@/lib/task-analyzer';
import { executeClientTask, type ExecutionProgress, type ExecutionResult, createProgressListener } from '@/lib/task-executor';



// ─── Types ────────────────────────────

interface AnalyzedTask {
  task: ClientTask;
  approaches: TaskApproach[];
  priority: TaskPriority;
  checkpoint?: ReviewCheckpoint;
}

// ─── Constants ────────────────────────

const STATUS_COLORS: Record<TaskStatus, string> = {
  queued: 'var(--oracle-text-muted)',
  analyzing: 'var(--oracle-info)',
  researching: 'var(--oracle-primary-l)',
  planning: 'var(--oracle-violet)',
  review: 'var(--oracle-warning)',
  executing: 'var(--oracle-success)',
  completed: 'var(--oracle-success)',
  failed: 'var(--oracle-error)',
  'on-hold': 'var(--oracle-text-muted)',
};

const STATUS_ICONS: Record<TaskStatus, string> = {
  queued: '📋',
  analyzing: '🔍',
  researching: '📚',
  planning: '📐',
  review: '👁️',
  executing: '⚡',
  completed: '✅',
  failed: '❌',
  'on-hold': '⏸️',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: 'var(--oracle-error)',
  high: 'var(--oracle-warning)',
  medium: 'var(--oracle-info)',
  low: 'var(--oracle-text-muted)',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  'research': '🔍',
  'content-creation': '✍️',
  'code-generation': '💻',
  'data-analysis': '📊',
  'strategic-planning': '🎯',
  'marketing': '📣',
  'design': '🎨',
  'finance': '💰',
  'voice-config': '🎙️',
  'quality-assurance': '🛡️',
  'project-management': '📋',
  'workflow-design': '🔗',
  'general': '🤖',
};

// ─── Main Component ───────────────────

export function MultiClientOrchestrator({ onAskOracle }: { onAskOracle?: (prompt?: string) => void }) {
  const [allTasks, setAllTasks] = useState<ClientTask[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showBatchAnalysis, setShowBatchAnalysis] = useState(false);
  const [batchResults, setBatchResults] = useState<AnalyzedTask[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'clients' | 'tasks' | 'skills'>('clients');
  const [executionProgress, setExecutionProgress] = useState<Map<string, ExecutionProgress>>(new Map());
  const [executionResults, setExecutionResults] = useState<Map<string, ExecutionResult>>(new Map());
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);

  // Load tasks
  useEffect(() => {
    populateDemoTasks();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- safe initialization from local data
    setAllTasks(getClientTasks());
  }, []);

  // Client summaries
  // eslint-disable-next-line react-hooks/exhaustive-deps -- allTasks triggers re-computation of getClientSummaries()
  const clientSummaries = useMemo(() => getClientSummaries(), [allTasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let tasks = allTasks;
    if (selectedClientId) {
      tasks = tasks.filter(t => t.clientId === selectedClientId);
    }
    if (statusFilter !== 'all') {
      tasks = tasks.filter(t => t.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.clientName.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return tasks.sort((a, b) => {
      const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [allTasks, selectedClientId, statusFilter, searchQuery]);

  // Skills
  // eslint-disable-next-line react-hooks/exhaustive-deps -- allTasks triggers re-computation of getSkillTemplates()
  const skills = useMemo(() => getSkillTemplates(), [allTasks]);

  // Handle batch analysis
  const handleBatchAnalysis = useCallback(() => {
    const queuedTasks = allTasks.filter(t => t.status === 'queued');
    if (queuedTasks.length === 0) {
      toast('No queued tasks to analyze', TOAST_DEFAULTS);
      return;
    }

    const results = analyzeBatchTasks(queuedTasks);
    const analyzed: AnalyzedTask[] = results.map(r => {
      const task = queuedTasks.find(t => t.id === r.taskId)!;
      return {
        task,
        approaches: r.approaches,
        priority: r.priority,
      };
    });

    setBatchResults(analyzed);
    setShowBatchAnalysis(true);
    toast.success(`Analyzed ${analyzed.length} task(s)`, { ...TOAST_DEFAULTS, icon: '🔍' });
  }, [allTasks]);

  // Handle create task
  const handleCreateTask = useCallback((data: {
    clientName: string;
    title: string;
    description: string;
    category: TaskCategory;
    priority: TaskPriority;
  }) => {
    const clientId = `client-${Date.now()}`;
    addClientTask({
      clientId,
      clientName: data.clientName,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: 'queued',
      assignedAgents: [],
      tags: [data.category],
    });

    setAllTasks(getClientTasks());
    setShowNewTaskDialog(false);
    toast.success(`Task created for ${data.clientName}`, { ...TOAST_DEFAULTS, icon: '✅' });
  }, []);

  // Handle task status update
  const handleStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    updateClientTask(taskId, { status: newStatus });
    setAllTasks(getClientTasks());
    toast.success(`Task status updated to ${newStatus}`, { ...TOAST_DEFAULTS, icon: STATUS_ICONS[newStatus] });
  }, []);

  // Handle review checkpoint
  const handleReviewCheckpoint = useCallback((taskId: string, approved: boolean) => {
    const checkpoint: ReviewCheckpoint = {
      taskId,
      type: 'pre-execution',
      status: approved ? 'approved' : 'rejected',
      notes: approved ? 'Pre-execution review passed' : 'Needs changes before execution',
      checkedBy: 'user',
      checkedAt: Date.now(),
    };
    addReviewCheckpoint(checkpoint);
    if (approved) {
      handleStatusChange(taskId, 'executing');
    }
  }, [handleStatusChange]);

  // Handle direct execution — runs the task through the swarm engine with real-time progress
  const handleDirectExecute = useCallback(async (task: ClientTask, approach?: 'balanced' | 'premium' | 'fast') => {
    toast.success(`🚀 Executing task for ${task.clientName}...`, { ...TOAST_DEFAULTS, icon: '⚡' });
    setShowExecutionPanel(true);

    // Set up real-time progress listener
    const unsubscribe = createProgressListener(
      task.id,
      (progress) => {
        setExecutionProgress(prev => new Map(prev).set(task.id, progress));
      },
      (result) => {
        setExecutionResults(prev => new Map(prev).set(task.id, result));
        setAllTasks(getClientTasks()); // Refresh task list
        if (result.success) {
          toast.success(`✅ Task completed for ${task.clientName}`, { ...TOAST_DEFAULTS, icon: '🎯' });
        } else {
          toast.error(`❌ Task failed: ${result.error}`, { ...TOAST_DEFAULTS, icon: '💥' });
        }
      }
    );

    try {
      await executeClientTask(task, { approach, parallel: true });
    } finally {
      unsubscribe();
    }
  }, []);

  // Handle send to orchestrator — builds a rich context prompt with client isolation
  const handleSendToOrchestrator = useCallback((task: ClientTask) => {
    if (!onAskOracle) return;

    // Build a comprehensive prompt with full client context for the orchestrator
    const prompt = [
      `## Client Task: ${task.title}`,
      `**Client:** ${task.clientName}`,
      `**Category:** ${task.category.replace(/-/g, ' ')}`,
      `**Priority:** ${task.priority}`,
      `**Tags:** ${task.tags.join(', ')}`,
      '',
      `### Task Description`,
      task.description,
      '',
      '### Instructions',
      `- This task is for client: ${task.clientName}. Do NOT mix work from other clients.`,
      `- Classify this task, analyse the best approach, and research thoroughly before executing.`,
      `- Present 2-3 best approach options with pros/cons before proceeding.`,
      `- All deliverables must be specific to this client's industry and needs.`,
      `- Store results separately under this client's namespace to avoid confusion.`,
      `- Review all work before finalising — clients need results, not excuses.`,
    ].join('\n');

    // Dispatch custom event so OrchestratorPanel can auto-fill
    window.dispatchEvent(new CustomEvent('oracle-client-task', { detail: { task, prompt } }));

    // Navigate to orchestrator tab with the prompt
    onAskOracle(prompt);
  }, [onAskOracle]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🎯 Multi-Client Orchestrator</h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Manage tasks from multiple clients without confusion</p>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  {...buttonTapProps}
                  onClick={handleBatchAnalysis}
                  className="flex items-center gap-2 rounded-xl border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
                >
                  🔍 Batch Analyze
                </motion.button>
                <motion.button
                  {...buttonTapProps}
                  onClick={() => setShowNewTaskDialog(true)}
                  className="flex items-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white"
                >
                  ➕ New Task
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Stats Overview */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Tasks', value: allTasks.length, icon: '📋', color: 'var(--oracle-info)' },
                { label: 'Active', value: allTasks.filter(t => ['queued', 'analyzing', 'executing'].includes(t.status)).length, icon: '⚡', color: 'var(--oracle-primary-l)' },
                { label: 'Completed', value: allTasks.filter(t => t.status === 'completed').length, icon: '✅', color: 'var(--oracle-success)' },
                { label: 'Clients', value: clientSummaries.length, icon: '👥', color: 'var(--oracle-violet)' },
              ].map((stat) => (
                <div key={stat.label} className="oracle-glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{stat.icon}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">{stat.label}</span>
                  </div>
                  <p className="text-[24px] font-bold" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* View Toggle */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-4">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--oracle-border)] p-1 w-fit">
              {(['clients', 'tasks', 'skills'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-lg px-4 py-2 text-[12px] font-medium transition-all ${
                    viewMode === mode
                      ? 'oracle-gradient-bg text-white'
                      : 'text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)]'
                  }`}
                >
                  {mode === 'clients' ? '👥 Clients' : mode === 'tasks' ? '📋 Tasks' : '🛠️ Skills'}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Clients View */}
          {viewMode === 'clients' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clientSummaries.map((summary) => (
                  <motion.div
                    key={summary.clientId}
                    {...buttonTapProps}
                    onClick={() => {
                      setSelectedClientId(summary.clientId);
                      setViewMode('tasks');
                    }}
                    className={`oracle-glass rounded-2xl p-5 cursor-pointer transition-all hover:border-[var(--oracle-border-strong)] ${
                      selectedClientId === summary.clientId ? 'border-[var(--oracle-primary)]/40 bg-[var(--oracle-primary)]/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--oracle-violet)]/10">
                        <span className="text-2xl">👤</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-bold text-[var(--oracle-text-1)] truncate">{summary.clientName}</h3>
                        <p className="text-[11px] text-[var(--oracle-text-muted)]">{summary.totalTasks} tasks total</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[16px] font-bold text-[var(--oracle-primary-l)]">{summary.activeTasks}</p>
                        <p className="text-[9px] text-[var(--oracle-text-muted)]">Active</p>
                      </div>
                      <div>
                        <p className="text-[16px] font-bold text-[var(--oracle-success)]">{summary.completedTasks}</p>
                        <p className="text-[9px] text-[var(--oracle-text-muted)]">Done</p>
                      </div>
                      <div>
                        <p className="text-[16px] font-bold text-[var(--oracle-warning)]">{summary.avgQuality}%</p>
                        <p className="text-[9px] text-[var(--oracle-text-muted)]">Quality</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tasks View */}
          {viewMode === 'tasks' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              {/* Filters */}
              <div className="mb-4 flex items-center gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
                  className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
                >
                  <option value="all">All Status</option>
                  <option value="queued">Queued</option>
                  <option value="analyzing">Analyzing</option>
                  <option value="executing">Executing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Task List */}
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`oracle-glass rounded-xl p-4 cursor-pointer transition-all hover:border-[var(--oracle-border-strong)] ${
                      selectedTaskId === task.id ? 'border-[var(--oracle-primary)]/40 bg-[var(--oracle-primary)]/5' : ''
                    }`}
                    onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                          style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}15` }}
                        >
                          {CATEGORY_EMOJIS[task.category] || '🤖'}
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold text-[var(--oracle-text-1)]">{task.title}</h4>
                          <p className="text-[11px] text-[var(--oracle-text-muted)]">{task.clientName}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span
                              className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                              style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}15`, color: PRIORITY_COLORS[task.priority] }}
                            >
                              {task.priority}
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                              style={{ backgroundColor: `${STATUS_COLORS[task.status]}15`, color: STATUS_COLORS[task.status] }}
                            >
                              {STATUS_ICONS[task.status]} {task.status}
                            </span>
                            <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">
                              {task.category.replace(/-/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.status === 'queued' && (
                          <motion.button
                            {...buttonTapProps}
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'analyzing'); }}
                            className="rounded-lg bg-[var(--oracle-primary)]/10 px-3 py-1 text-[10px] font-semibold text-[var(--oracle-primary-l)] hover:bg-[var(--oracle-primary)]/20 transition-colors"
                          >
                            🔍 Analyze
                          </motion.button>
                        )}
                        {task.status === 'review' && (
                          <>
                            <motion.button
                              {...buttonTapProps}
                              onClick={(e) => { e.stopPropagation(); handleReviewCheckpoint(task.id, true); }}
                              className="rounded-lg bg-[var(--oracle-success)]/10 px-3 py-1 text-[10px] font-semibold text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20 transition-colors"
                            >
                              ✓ Approve
                            </motion.button>
                            <motion.button
                              {...buttonTapProps}
                              onClick={(e) => { e.stopPropagation(); handleReviewCheckpoint(task.id, false); }}
                              className="rounded-lg bg-[var(--oracle-error)]/10 px-3 py-1 text-[10px] font-semibold text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/20 transition-colors"
                            >
                              ✗ Reject
                            </motion.button>
                          </>
                        )}
                        <motion.button
                          {...buttonTapProps}
                          onClick={(e) => { e.stopPropagation(); handleDirectExecute(task); }}
                          className="rounded-lg bg-[var(--oracle-success)]/15 px-3 py-1 text-[10px] font-semibold text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/25 transition-colors"
                          title="Execute directly via swarm agents"
                        >
                          🚀 Run
                        </motion.button>
                        <motion.button
                          {...buttonTapProps}
                          onClick={(e) => { e.stopPropagation(); handleSendToOrchestrator(task); }}
                          className="rounded-lg oracle-gradient-bg px-3 py-1 text-[10px] font-semibold text-white"
                          title="Send to Orchestrator for manual analysis first"
                        >
                          ⚡ Orchestrator
                        </motion.button>
                      </div>
                    </div>

                    {/* Expanded Task Details */}
                    <AnimatePresence>
                      {selectedTaskId === task.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-[var(--oracle-border)]"
                        >
                          <p className="text-[12px] text-[var(--oracle-text-2)] mb-3">{task.description}</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {task.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[9px] text-[var(--oracle-text-muted)]">
                                #{tag}
                              </span>
                            ))}
                          </div>
                          {task.results.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold text-[var(--oracle-text-muted)]">Results ({task.results.length}):</p>
                              {task.results.slice(-2).map((result, i) => (
                                <div key={i} className="rounded-lg bg-[var(--oracle-surface-2)] p-3">
                                  <p className="text-[10px] text-[var(--oracle-text-muted)]">
                                    {result.agent} • {result.duration}ms • {result.tokensUsed} tokens
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Skills View */}
          {viewMode === 'skills' && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">🛠️ Auto-Created Skills</h3>
                {skills.length === 0 ? (
                  <div className="py-8 text-center">
                    <span className="text-3xl mb-4 block">🔄</span>
                    <p className="text-[13px] text-[var(--oracle-text-3)]">
                      Skills are automatically created from successful task patterns.
                    </p>
                    <p className="text-[11px] text-[var(--oracle-text-muted)] mt-2">
                      Complete 3+ tasks in the same category to generate a skill template.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {skills.map((skill) => (
                      <div key={skill.id} className="rounded-xl border border-[var(--oracle-border)] p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{CATEGORY_EMOJIS[skill.category] || '🤖'}</span>
                            <div>
                              <h4 className="text-[13px] font-bold text-[var(--oracle-text-1)]">{skill.name}</h4>
                              <p className="text-[11px] text-[var(--oracle-text-muted)]">{skill.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[12px] font-bold text-[var(--oracle-success)]">{skill.avgQuality}%</p>
                            <p className="text-[9px] text-[var(--oracle-text-muted)]">Used {skill.usageCount}x</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Real-time Execution Progress Panel */}
          {showExecutionPanel && executionProgress.size > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div className="oracle-glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">⚡ Live Execution</h3>
                  <button
                    onClick={() => setShowExecutionPanel(false)}
                    className="rounded-lg px-2 py-1 text-[10px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
                  >
                    Minimize
                  </button>
                </div>
                <div className="space-y-3">
                  {Array.from(executionProgress.entries()).map(([taskId, progress]) => {
                    const result = executionResults.get(taskId);
                    const pct = progress.totalAgents > 0
                      ? Math.round((progress.completedAgents.length / progress.totalAgents) * 100)
                      : 0;
                    return (
                      <div key={taskId} className="rounded-xl border border-[var(--oracle-border)] p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold text-[var(--oracle-text-1)]">
                            {progress.clientName}
                          </span>
                          <span className={`text-[10px] font-medium ${
                            progress.status === 'completed' ? 'text-[var(--oracle-success)]' :
                            progress.status === 'failed' ? 'text-[var(--oracle-error)]' :
                            'text-[var(--oracle-primary-l)]'
                          }`}>
                            {progress.status === 'analyzing' ? '🔍 Analyzing...' :
                             progress.status === 'executing' ? `⚡ Running (${progress.completedAgents.length}/${progress.totalAgents})` :
                             progress.status === 'synthesizing' ? '🔗 Synthesizing...' :
                             progress.status === 'completed' ? '✅ Completed' :
                             '❌ Failed'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--oracle-surface-2)] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: progress.status === 'failed' ? 'var(--oracle-error)' : 'var(--oracle-primary)' }}
                            animate={{ width: `${pct}%` }}
                            transition={transitions.smooth}
                          />
                        </div>
                        {progress.currentAgent && progress.status === 'executing' && (
                          <p className="mt-1 text-[10px] text-[var(--oracle-text-muted)]">
                            Current: {progress.currentAgent} · {Math.round(progress.elapsed / 1000)}s elapsed
                          </p>
                        )}
                        {result?.success && result.synthesis && (
                          <div className="mt-2 rounded-lg bg-[var(--oracle-success)]/5 p-2 max-h-20 overflow-y-auto">
                            <p className="text-[10px] text-[var(--oracle-text-2)] line-clamp-3">{result.synthesis.slice(0, 300)}...</p>
                          </div>
                        )}
                        {result && !result.success && result.error && (
                          <p className="mt-2 text-[10px] text-[var(--oracle-error)]">{result.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Batch Analysis Dialog */}
          <AnimatePresence>
            {showBatchAnalysis && batchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                onClick={() => setShowBatchAnalysis(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="oracle-glass rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[18px] font-bold text-[var(--oracle-text-1)]">🔍 Batch Analysis Results</h3>
                    <button
                      onClick={() => setShowBatchAnalysis(false)}
                      className="rounded-lg p-2 text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-4">
                    {batchResults.map((result) => (
                      <div key={result.task.id} className="rounded-xl border border-[var(--oracle-border)] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-[14px] font-bold text-[var(--oracle-text-1)]">{result.task.title}</h4>
                            <p className="text-[11px] text-[var(--oracle-text-muted)]">{result.task.clientName}</p>
                          </div>
                          <span
                            className="rounded-full px-3 py-1 text-[10px] font-semibold"
                            style={{ backgroundColor: `${PRIORITY_COLORS[result.priority]}15`, color: PRIORITY_COLORS[result.priority] }}
                          >
                            {result.priority}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {result.approaches.map((approach) => (
                            <div key={approach.id} className="rounded-lg bg-[var(--oracle-surface-2)] p-3">
                              <h5 className="text-[12px] font-bold text-[var(--oracle-text-1)] mb-2">{approach.name}</h5>
                              <p className="text-[10px] text-[var(--oracle-text-muted)] mb-2">{approach.description}</p>
                              <div className="flex items-center gap-2 text-[9px]">
                                <span className="text-[var(--oracle-info)]">⏱️ {approach.estimatedTime}</span>
                                <span className="text-[var(--oracle-warning)]">💰 {approach.estimatedCost}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {approach.agents.map((agent) => (
                                  <span key={agent} className="rounded-full bg-[var(--oracle-primary)]/10 px-2 py-0.5 text-[8px] font-medium text-[var(--oracle-primary-l)]">
                                    {agent}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* New Task Dialog */}
          <AnimatePresence>
            {showNewTaskDialog && (
              <NewTaskDialog
                onClose={() => setShowNewTaskDialog(false)}
                onSubmit={handleCreateTask}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── New Task Dialog ──────────────────

function NewTaskDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    clientName: string;
    title: string;
    description: string;
    category: TaskCategory;
    priority: TaskPriority;
  }) => void;
}) {
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('general');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !title.trim() || !description.trim()) {
      toast('Please fill in all required fields', { ...TOAST_DEFAULTS, icon: '⚠️' });
      return;
    }
    onSubmit({ clientName, title, description, category, priority });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="oracle-glass rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px] font-bold text-[var(--oracle-text-1)] mb-4">➕ New Client Task</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--oracle-text-1)] mb-1">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., Priya Sharma - Dental Clinic"
              className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--oracle-text-1)] mb-1">Task Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Google Ads Campaign Setup"
              className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--oracle-text-1)] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task requirements..."
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[var(--oracle-text-1)] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
              >
                <option value="research">🔍 Research</option>
                <option value="content-creation">✍️ Content</option>
                <option value="code-generation">💻 Code</option>
                <option value="marketing">📣 Marketing</option>
                <option value="design">🎨 Design</option>
                <option value="finance">💰 Finance</option>
                <option value="workflow-design">🔗 Workflow</option>
                <option value="general">🤖 General</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[var(--oracle-text-1)] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2 text-[12px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
              >
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--oracle-border)] px-4 py-2 text-[12px] font-medium text-[var(--oracle-text-1)] hover:bg-[var(--oracle-surface-2)] transition-colors"
            >
              Cancel
            </button>
            <motion.button
              {...buttonTapProps}
              type="submit"
              className="rounded-xl oracle-gradient-bg px-4 py-2 text-[12px] font-semibold text-white"
            >
              Create Task
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
