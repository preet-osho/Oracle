// ═══════════════════════════════════════
// ORACLE — Task Execution Engine
// Runs client tasks through swarm agents · Real-time progress · Client isolation
// ═══════════════════════════════════════

import { runSwarm, type SwarmResult } from '@/lib/swarm';
import { analyzeTask } from '@/lib/task-analyzer';
import {
  updateClientTask,
  addTaskResult,
  type ClientTask,
  type TaskResult,
} from '@/lib/client-task-queue';
import { NeverStopRouter } from '@/lib/router';

// ─── Types ─────────────────────────────

export interface ExecutionProgress {
  taskId: string;
  clientName: string;
  status: 'queued' | 'analyzing' | 'executing' | 'synthesizing' | 'completed' | 'failed';
  currentAgent?: string;
  completedAgents: string[];
  totalAgents: number;
  synthesisOutput?: string;
  error?: string;
  startedAt: number;
  elapsed: number;
}

export interface ExecutionResult {
  taskId: string;
  synthesis: string;
  agentResults: SwarmResult[];
  totalCostUsd: number;
  totalTokens: number;
  totalDurationMs: number;
  success: boolean;
  error?: string;
  /** Inngest event ID when dispatched to background queue */
  backgroundEventId?: string;
}

// ─── Event Helpers ─────────────────────

function dispatchProgress(progress: ExecutionProgress): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('oracle-task-progress', { detail: progress })
  );
}

function dispatchComplete(result: ExecutionResult): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('oracle-task-complete', { detail: result })
  );
}

// ─── Background Queue Dispatch ────────

/**
 * Attempt to dispatch a task to Inngest for background execution.
 * Uses dynamic import to avoid hard dependency when Inngest is not installed.
 * Returns the event ID if dispatched, or null to fall back to synchronous.
 */
async function tryInngestDispatch(
  task: ClientTask,
  options: {
    approach?: 'balanced' | 'premium' | 'fast';
    parallel?: boolean;
  }
): Promise<string | null> {
  try {
    const { isInngestConfigured, dispatchTaskExecution } = await import('@/lib/inngest/dispatch');
    if (!isInngestConfigured()) return null;

    return dispatchTaskExecution({
      taskId: task.id,
      clientName: task.clientName,
      title: task.title,
      description: task.description,
      category: task.category,
      assignedAgents: task.assignedAgents,
      approach: options.approach || 'balanced',
      parallel: options.parallel !== false,
    });
  } catch {
    // Inngest not installed or not configured — fall back to synchronous
    return null;
  }
}

// ─── Main Execution Function ───────────
// Tries Inngest background queue first, falls back to synchronous.

export async function executeClientTask(
  task: ClientTask,
  options: {
    approach?: 'balanced' | 'premium' | 'fast';
    parallel?: boolean;
  } = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const approach = options.approach || 'balanced';
  const parallel = options.parallel !== false; // default to parallel

  // 0. Try background queue first — falls back to sync if Inngest unavailable
  const bgEventId = await tryInngestDispatch(task, options);
  if (bgEventId) {
    updateClientTask(task.id, { status: 'executing' });
    dispatchProgress({
      taskId: task.id,
      clientName: task.clientName,
      status: 'executing',
      completedAgents: [],
      totalAgents: task.assignedAgents.length || 1,
      startedAt: startTime,
      elapsed: 0,
    });
    // Return immediately — Inngest handles execution in background
    return {
      taskId: task.id,
      synthesis: '',
      agentResults: [],
      totalCostUsd: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      success: true,
      backgroundEventId: bgEventId,
    };
  }

  // Fallback: synchronous execution
  // 1. Mark task as analyzing
  updateClientTask(task.id, { status: 'analyzing' });
  dispatchProgress({
    taskId: task.id,
    clientName: task.clientName,
    status: 'analyzing',
    completedAgents: [],
    totalAgents: task.assignedAgents.length || 1,
    startedAt: startTime,
    elapsed: 0,
  });

  try {
    // 2. Run task analysis for agent selection
    const fullTask = `${task.title}\n\n${task.description}`;
    const analysis = analyzeTask(fullTask);
    const agents = approach === 'fast'
      ? [analysis.agents[0]?.role || 'researcher']
      : approach === 'premium'
        ? analysis.agents.map(a => a.role)
        : analysis.agents.slice(0, Math.min(3, analysis.agents.length)).map(a => a.role);

    // Ensure at least one agent
    if (agents.length === 0) agents.push('researcher');

    // 3. Mark as executing
    updateClientTask(task.id, {
      status: 'executing',
      assignedAgents: agents,
    });
    dispatchProgress({
      taskId: task.id,
      clientName: task.clientName,
      status: 'executing',
      completedAgents: [],
      totalAgents: agents.length,
      startedAt: startTime,
      elapsed: Date.now() - startTime,
    });

    // 4. Build client-isolated context
    const clientContext = {
      rag: undefined as string | undefined,
      memory: undefined as string | undefined,
      project: undefined as Parameters<typeof runSwarm>[3]['project'],
    };

    // 5. Call AI through the router (wrapping NeverStopRouter.callSync)
    const callAI = async (
      prompt: string,
      systemPrompt?: string,
      providerId?: string,
      modelId?: string
    ): Promise<{ text: string; provider: string; model: string; tokens: number }> => {
      const messages = [
        { id: 'user', role: 'user' as const, content: prompt, timestamp: Date.now() },
      ];
      const result = await NeverStopRouter.callSync(messages, {
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2000,
      });
      return {
        text: result.text,
        provider: result.provider,
        model: result.model,
        tokens: result.inputTokens + result.outputTokens,
      };
    };

    // 6. Execute via swarm with agent-by-agent progress tracking
    const completedAgents: string[] = [];
    const onAgentComplete = (agentRole: string, _result: string) => {
      completedAgents.push(agentRole);
      dispatchProgress({
        taskId: task.id,
        clientName: task.clientName,
        status: completedAgents.length >= agents.length ? 'synthesizing' : 'executing',
        currentAgent: agentRole,
        completedAgents: [...completedAgents],
        totalAgents: agents.length,
        startedAt: startTime,
        elapsed: Date.now() - startTime,
      });
    };

    // Build client-isolated task prompt
    const isolatedTask = [
      fullTask,
      '',
      `---`,
      `CLIENT: ${task.clientName}`,
      `CLIENT ISOLATION: This task is ONLY for ${task.clientName}. Do not reference or mix data from other clients.`,
      `INDUSTRY FOCUS: ${task.category.replace(/-/g, ' ')}`,
    ].join('\n');

    const swarmResult = await runSwarm(
      isolatedTask,
      agents,
      parallel,
      clientContext,
      callAI,
      onAgentComplete
    );

    // 7. Record results
    const totalDurationMs = Date.now() - startTime;
    const totalTokens = swarmResult.agentResults.reduce((sum, r) => sum + r.tokens, 0);

    // Record each agent result in the task
    for (const agentResult of swarmResult.agentResults) {
      addTaskResult(task.id, {
        agent: agentResult.agent,
        output: agentResult.result.slice(0, 500), // truncate for storage
        qualityScore: undefined,
        duration: agentResult.timeMs,
        tokensUsed: agentResult.tokens,
      });
    }

    // 8. Mark as completed
    updateClientTask(task.id, {
      status: 'completed',
      completedAt: Date.now(),
      actualCost: swarmResult.totalCostUsd,
    });

    const result: ExecutionResult = {
      taskId: task.id,
      synthesis: swarmResult.synthesis,
      agentResults: swarmResult.agentResults,
      totalCostUsd: swarmResult.totalCostUsd,
      totalTokens,
      totalDurationMs,
      success: true,
    };

    dispatchProgress({
      taskId: task.id,
      clientName: task.clientName,
      status: 'completed',
      completedAgents: agents,
      totalAgents: agents.length,
      synthesisOutput: swarmResult.synthesis.slice(0, 200),
      startedAt: startTime,
      elapsed: totalDurationMs,
    });

    dispatchComplete(result);
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';

    // Mark as failed
    updateClientTask(task.id, { status: 'failed' });

    const result: ExecutionResult = {
      taskId: task.id,
      synthesis: '',
      agentResults: [],
      totalCostUsd: 0,
      totalTokens: 0,
      totalDurationMs: Date.now() - startTime,
      success: false,
      error: errorMessage,
    };

    dispatchProgress({
      taskId: task.id,
      clientName: task.clientName,
      status: 'failed',
      completedAgents: [],
      totalAgents: task.assignedAgents.length || 1,
      error: errorMessage,
      startedAt: startTime,
      elapsed: Date.now() - startTime,
    });

    dispatchComplete(result);
    return result;
  }
}

// ─── Batch Execution ───────────────────

export async function executeBatchTasks(
  tasks: ClientTask[],
  options: {
    approach?: 'balanced' | 'premium' | 'fast';
    parallel?: boolean;
    concurrency?: number;
  } = {}
): Promise<ExecutionResult[]> {
  const concurrency = options.concurrency || 2; // Run up to 2 tasks in parallel
  const results: ExecutionResult[] = [];
  const queue = [...tasks];

  async function processNext(): Promise<void> {
    const task = queue.shift();
    if (!task) return;

    const result = await executeClientTask(task, options);
    results.push(result);
    await processNext();
  }

  // Start initial batch
  const initialBatch = queue.splice(0, Math.min(concurrency, queue.length));
  await Promise.all(initialBatch.map(task => executeClientTask(task, options).then(r => results.push(r))));

  // Process remaining
  while (queue.length > 0) {
    const task = queue.shift();
    if (task) {
      const result = await executeClientTask(task, options);
      results.push(result);
    }
  }

  return results;
}

// ─── Progress Listener Hook ────────────

export function createProgressListener(
  taskId: string,
  onUpdate: (progress: ExecutionProgress) => void,
  onComplete?: (result: ExecutionResult) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const progressHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as ExecutionProgress;
    if (detail.taskId === taskId) {
      onUpdate(detail);
    }
  };

  const completeHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail as ExecutionResult;
    if (detail.taskId === taskId && onComplete) {
      onComplete(detail);
    }
  };

  window.addEventListener('oracle-task-progress', progressHandler);
  window.addEventListener('oracle-task-complete', completeHandler);

  return () => {
    window.removeEventListener('oracle-task-progress', progressHandler);
    window.removeEventListener('oracle-task-complete', completeHandler);
  };
}

// ─── Global Progress Store ─────────────

const activeTasks = new Map<string, ExecutionProgress>();

export function getActiveTaskProgress(taskId: string): ExecutionProgress | undefined {
  return activeTasks.get(taskId);
}

export function getAllActiveProgress(): ExecutionProgress[] {
  return Array.from(activeTasks.values());
}

// Auto-update the global store via event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('oracle-task-progress', ((e: Event) => {
    const detail = (e as CustomEvent).detail as ExecutionProgress;
    if (detail.status === 'completed' || detail.status === 'failed') {
      activeTasks.delete(detail.taskId);
    } else {
      activeTasks.set(detail.taskId, detail);
    }
  }) as EventListener);
}
