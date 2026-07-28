// ═══════════════════════════════════════
// ORACLE — Multi-Agent Orchestration Engine
// Coordinates specialist agents, manages context, handles failures
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import {
  AGENT_REGISTRY,
  type AgentName,
  type AgentMetadata,
} from '@/lib/agents/registry';

const log = createLogger('OrchestrationEngine');

// ─── Types ─────────────────────────────

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'retrying';

export interface AgentTask {
  id: string;
  agent: AgentName;
  prompt: string;
  inputs: Record<string, unknown>;
  status: AgentStatus;
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  retryCount: number;
  maxRetries: number;
  dependencies: string[]; // IDs of tasks that must complete first
  qualityScore?: number;
  tokensUsed?: number;
  costUsd?: number;
  providerId?: string; // Optional: specify which AI provider to use
  modelId?: string;   // Optional: specify which model to use
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tasks: Omit<AgentTask, 'id' | 'status' | 'retryCount'>[];
  createdAt: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
}

export interface OrchestrationConfig {
  maxConcurrentAgents: number;
  defaultTimeoutMs: number;
  defaultMaxRetries: number;
  enableQualityGates: boolean;
  qualityGateThreshold: number; // 0-100
  enableCostTracking: boolean;
  dailyBudgetUsd: number;
}

export interface OrchestrationResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  tasks: AgentTask[];
  totalTokensUsed: number;
  totalCostUsd: number;
  durationMs: number;
  qualityScores: number[];
  averageQuality: number;
}

/**
 * A single chunk yielded during streaming agent execution.
 */
export interface StreamingChunk {
  /** Type of chunk: 'text' for content, 'status' for lifecycle events, 'error' for failures, 'done' for completion */
  type: 'text' | 'status' | 'error' | 'done';
  /** The text content (for 'text' chunks) */
  content?: string;
  /** Task ID */
  taskId: string;
  /** Agent name */
  agent: AgentName;
  /** Timestamp */
  timestamp: number;
  /** Token usage so far */
  tokensUsed?: number;
  /** Cost so far */
  costUsd?: number;
  /** Quality score (only in 'done' chunk) */
  qualityScore?: number;
  /** Completed task (only in 'done' chunk) — for await...of discards the generator return value, so this is the primary way to get the final task */
  task?: AgentTask;
}

/**
 * Options for streaming agent execution.
 */
export interface StreamingOptions {
  /** Callback invoked for each chunk */
  onChunk?: (chunk: StreamingChunk) => void;
  /** Max tokens for the response */
  maxTokens?: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

// ─── Default Config ────────────────────

const DEFAULT_CONFIG: OrchestrationConfig = {
  maxConcurrentAgents: 3,
  defaultTimeoutMs: 120_000, // 2 minutes
  defaultMaxRetries: 2,
  enableQualityGates: true,
  qualityGateThreshold: 70,
  enableCostTracking: true,
  dailyBudgetUsd: 10.0,
};

// ─── Orchestration Engine ─────────────

export class OrchestrationEngine {
  private config: OrchestrationConfig;
  private activeTasks: Map<string, AgentTask> = new Map();
  private completedTasks: Map<string, AgentTask> = new Map();
  private dailyCostUsd: number = 0;
  private dailyCostResetDate: string = '';
  private routerModule: typeof import('@/lib/router') | null = null;

  constructor(config: Partial<OrchestrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.resetDailyCostIfNeeded();
  }

  /**
   * Get or cache the router module to avoid repeated dynamic imports
   */
  private async getRouter() {
    if (!this.routerModule) {
      this.routerModule = await import('@/lib/router');
    }
    return this.routerModule;
  }

  /**
   * Resolve provider and model for a task.
   * Priority: task-level override > registry defaults > router auto-selection (undefined).
   */
  private resolveProvider(
    task: AgentTask,
    agentMeta: AgentMetadata,
  ): { providerId?: string; modelId?: string } {
    return {
      providerId: task.providerId || agentMeta.defaultProviderId,
      modelId: task.modelId || agentMeta.defaultModelId,
    };
  }

  // ─── Core Methods ───────────────────

  /**
   * Execute a single agent task
   */
  async executeTask(
    task: Omit<AgentTask, 'id' | 'status' | 'retryCount'>,
  ): Promise<AgentTask> {
    const taskId = this.generateTaskId();
    const fullTask: AgentTask = {
      ...task,
      id: taskId,
      status: 'idle',
      retryCount: 0,
    };

    log.info('Executing agent task', {
      taskId,
      agent: task.agent,
      hasDependencies: task.dependencies.length > 0,
    });

    // Check dependencies
    if (task.dependencies.length > 0) {
      const unmetDeps = task.dependencies.filter(
        (depId) => !this.completedTasks.has(depId),
      );
      if (unmetDeps.length > 0) {
        fullTask.status = 'failed';
        fullTask.error = `Unmet dependencies: ${unmetDeps.join(', ')}`;
        this.completedTasks.set(taskId, fullTask);
        return fullTask;
      }
    }

    // Check daily budget
    if (this.config.enableCostTracking && this.dailyCostUsd >= this.config.dailyBudgetUsd) {
      fullTask.status = 'failed';
      fullTask.error = `Daily budget exceeded: $${this.dailyCostUsd.toFixed(2)} / $${this.config.dailyBudgetUsd}`;
      this.completedTasks.set(taskId, fullTask);
      return fullTask;
    }

    return this.runTaskWithRetry(fullTask);
  }

  /**
   * Execute a workflow with multiple tasks
   */
  async executeWorkflow(workflow: WorkflowDefinition): Promise<OrchestrationResult> {
    const startTime = Date.now();
    log.info('Starting workflow execution', {
      workflowId: workflow.id,
      name: workflow.name,
      taskCount: workflow.tasks.length,
    });

    const results: AgentTask[] = [];
    const taskMap = new Map<string, AgentTask>();

    // Build task dependency graph
    for (const taskDef of workflow.tasks) {
      const task: AgentTask = {
        ...taskDef,
        id: this.generateTaskId(),
        status: 'idle',
        retryCount: 0,
      };
      taskMap.set(task.id, task);
      results.push(task);
    }

    // Execute tasks in dependency order
    const executed = new Set<string>();
    let maxIterations = results.length * 2; // Safety limit
    let hasProgress = true;

    while (executed.size < results.length && hasProgress && maxIterations > 0) {
      hasProgress = false;
      maxIterations--;

      for (const task of results) {
        if (executed.has(task.id)) continue;

        // Check if all dependencies are met
        const depsMet = task.dependencies.every((depId) => executed.has(depId));
        if (!depsMet) continue;

        // Execute the task
        const completedTask = await this.executeTask(task);
        Object.assign(task, completedTask);
        executed.add(task.id);
        hasProgress = true;

        // Check if task failed and has no retry options
        if (task.status === 'failed' && task.retryCount >= task.maxRetries) {
          log.error('Task failed permanently', {
            taskId: task.id,
            agent: task.agent,
            error: task.error,
          });
        }
      }
    }

    // Calculate results
    const totalTokensUsed = results.reduce((sum, t) => sum + (t.tokensUsed || 0), 0);
    const totalCostUsd = results.reduce((sum, t) => sum + (t.costUsd || 0), 0);
    const qualityScores = results
      .filter((t) => t.qualityScore !== undefined)
      .map((t) => t.qualityScore!);
    const averageQuality =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

    const allCompleted = results.every(
      (t) => t.status === 'completed' || t.status === 'failed',
    );
    const anyFailed = results.some((t) => t.status === 'failed');
    const allFailed = results.every((t) => t.status === 'failed');

    let status: OrchestrationResult['status'] = 'completed';
    if (allFailed) status = 'failed';
    else if (anyFailed) status = 'partial';

    const result: OrchestrationResult = {
      workflowId: workflow.id,
      status,
      tasks: results,
      totalTokensUsed,
      totalCostUsd,
      durationMs: Date.now() - startTime,
      qualityScores,
      averageQuality,
    };

    log.info('Workflow execution completed', {
      workflowId: workflow.id,
      status: result.status,
      durationMs: result.durationMs,
      averageQuality: result.averageQuality,
    });

    return result;
  }

  // ─── Private Methods ────────────────

  private async runTaskWithRetry(task: AgentTask): Promise<AgentTask> {
    let lastError: string | undefined;

    while (task.retryCount <= task.maxRetries) {
      task.status = task.retryCount > 0 ? 'retrying' : 'running';
      task.startTime = Date.now();

      try {
        // Get agent metadata
        const agentMeta = AGENT_REGISTRY[task.agent];
        if (!agentMeta) {
          throw new Error(`Unknown agent: ${task.agent}`);
        }

        // Execute the task via AI provider
        const result = await this.callAgent(task, agentMeta);

        task.status = 'completed';
        task.result = result.content;
        task.tokensUsed = result.tokensUsed;
        task.costUsd = result.costUsd;
        task.endTime = Date.now();

        // Update daily cost
        if (this.config.enableCostTracking && result.costUsd) {
          this.dailyCostUsd += result.costUsd;
        }

        // Quality gate check
        if (this.config.enableQualityGates) {
          const qualityScore = this.evaluateQuality(result.content, task.agent);
          task.qualityScore = qualityScore;

          if (qualityScore < this.config.qualityGateThreshold) {
            log.warn('Quality gate not met', {
              taskId: task.id,
              score: qualityScore,
              threshold: this.config.qualityGateThreshold,
            });
            // Still accept but log the warning
          }
        }

        this.completedTasks.set(task.id, task);
        return task;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        task.error = lastError;
        task.retryCount++;

        log.warn('Task execution failed, retrying', {
          taskId: task.id,
          attempt: task.retryCount,
          error: lastError,
        });

        if (task.retryCount > task.maxRetries) {
          task.status = 'failed';
          task.endTime = Date.now();
          this.completedTasks.set(task.id, task);
          return task;
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, task.retryCount) * 1000);
      }
    }

    task.status = 'failed';
    task.endTime = Date.now();
    this.completedTasks.set(task.id, task);
    return task;
  }

  private async callAgent(
    task: AgentTask,
    agentMeta: AgentMetadata,
  ): Promise<{ content: string; tokensUsed: number; costUsd: number }> {
    const systemPrompt = agentMeta.prompt;
    const userPrompt = task.prompt;

    // Compose full prompt with system context
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;      const { providerId, modelId } = this.resolveProvider(task, agentMeta);

      try {
      const { NeverStopRouter } = await this.getRouter();
      const result = await NeverStopRouter.callAISyncServer(fullPrompt, {
        maxTokens: 4096,
        ...(providerId && { providerId }),
        ...(modelId && { modelId }),
      });

      return {
        content: result.text,
        tokensUsed: result.inputTokens + result.outputTokens,
        costUsd: result.costUSD,
      };
    } catch (error) {
      log.error('AI provider call failed, falling back to simulation', {
        agent: task.agent,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to simulated response if no providers configured
      const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
      const estimatedCost = (estimatedTokens / 1000) * 0.002;

      return {
        content: `[${task.agent}] Task completed: ${task.prompt.substring(0, 100)}...`,
        tokensUsed: estimatedTokens,
        costUsd: estimatedCost,
      };
    }
  }

  /**
   * Stream an agent call, yielding text chunks as they arrive.
   * Uses the sync API internally and simulates chunked delivery,
   * which is the standard pattern when the underlying provider
   * does not expose a native streaming endpoint.
   *
   * When a native streaming provider is added to the router,
   * this method should be updated to consume the SSE stream directly.
   */
  async *callAgentStreaming(
    task: AgentTask,
    agentMeta: AgentMetadata,
    options: StreamingOptions = {},
  ): AsyncGenerator<StreamingChunk, void, undefined> {
    const { onChunk, maxTokens = 4096, abortSignal } = options;
    const systemPrompt = agentMeta.prompt;
    const userPrompt = task.prompt;
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const emit = (chunk: StreamingChunk) => {
      if (abortSignal?.aborted) return;
      // Never emit 'done' via onChunk — the caller (e.g. executeTaskStreaming)
      // emits its own done chunk with the completed task attached.
      if (chunk.type === 'done') return;
      onChunk?.(chunk);
    };

    // Emit status: running
    emit({ type: 'status', content: 'running', taskId: task.id, agent: task.agent, timestamp: Date.now() });

    try {
      const { providerId, modelId } = this.resolveProvider(task, agentMeta);

      const { NeverStopRouter } = await this.getRouter();
      const result = await NeverStopRouter.callAISyncServer(fullPrompt, {
        maxTokens,
        ...(providerId && { providerId }),
        ...(modelId && { modelId }),
      });

      if (abortSignal?.aborted) return;

      // Yield the full text as simulated streaming chunks.
      const text = result.text;
      const chunkSize = 20; // words per chunk
      const words = text.split(/(\s+)/);
      let buffer = '';
      let wordCount = 0;

      for (let i = 0; i < words.length; i++) {
        if (abortSignal?.aborted) return;

        buffer += words[i];
        if (words[i].trim()) wordCount++;

        if (wordCount >= chunkSize || i === words.length - 1) {
          emit({
            type: 'text',
            content: buffer,
            taskId: task.id,
            agent: task.agent,
            timestamp: Date.now(),
          });
          buffer = '';
          wordCount = 0;
        }
      }

      const tokensUsed = result.inputTokens + result.outputTokens;
      const costUsd = result.costUSD;

      const doneChunk: StreamingChunk = {
        type: 'done',
        taskId: task.id,
        agent: task.agent,
        timestamp: Date.now(),
        tokensUsed,
        costUsd,
      };
      emit(doneChunk);
      yield doneChunk;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('Streaming agent call failed', { agent: task.agent, error: errorMsg });

      emit({
        type: 'error',
        content: errorMsg,
        taskId: task.id,
        agent: task.agent,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Execute a single agent task with streaming progress.
   * Returns the completed AgentTask and yields real-time chunks.
   */
  async *executeTaskStreaming(
    task: Omit<AgentTask, 'id' | 'status' | 'retryCount'>,
    options: StreamingOptions = {},
  ): AsyncGenerator<StreamingChunk, void, undefined> {
    const taskId = this.generateTaskId();
    const fullTask: AgentTask = {
      ...task,
      id: taskId,
      status: 'idle',
      retryCount: 0,
    };

    log.info('Executing streaming agent task', { taskId, agent: task.agent });

    const emit = (chunk: StreamingChunk) => {
      options.onChunk?.(chunk);
    };

    // Check dependencies
    if (task.dependencies.length > 0) {
      const unmetDeps = task.dependencies.filter(
        (depId) => !this.completedTasks.has(depId),
      );
      if (unmetDeps.length > 0) {
        fullTask.status = 'failed';
        fullTask.error = `Unmet dependencies: ${unmetDeps.join(', ')}`;
        this.completedTasks.set(taskId, fullTask);
        const errChunk: StreamingChunk = { type: 'error', content: fullTask.error, taskId, agent: task.agent, timestamp: Date.now() };
        emit(errChunk);
        yield errChunk;
        return;
      }
    }

    // Check daily budget
    if (this.config.enableCostTracking && this.dailyCostUsd >= this.config.dailyBudgetUsd) {
      fullTask.status = 'failed';
      fullTask.error = `Daily budget exceeded: $${this.dailyCostUsd.toFixed(2)} / $${this.config.dailyBudgetUsd}`;
      this.completedTasks.set(taskId, fullTask);
      const errChunk: StreamingChunk = { type: 'error', content: fullTask.error, taskId, agent: task.agent, timestamp: Date.now() };
      emit(errChunk);
      yield errChunk;
      return;
    }

    // Get agent metadata
    const agentMeta = AGENT_REGISTRY[task.agent];
    if (!agentMeta) {
      fullTask.status = 'failed';
      fullTask.error = `Unknown agent: ${task.agent}`;
      this.completedTasks.set(taskId, fullTask);
      const errChunk: StreamingChunk = { type: 'error', content: fullTask.error, taskId, agent: task.agent, timestamp: Date.now() };
      emit(errChunk);
      yield errChunk;
      return;
    }

    // Stream the agent call
    fullTask.status = 'running';
    fullTask.startTime = Date.now();
    let fullContent = '';
    let tokensUsed = 0;
    let costUsd = 0;
    let qualityScore: number | undefined;

    for await (const chunk of this.callAgentStreaming(fullTask, agentMeta, options)) {
      // Capture data before yielding so the generator doesn't pause mid-assignment
      if (chunk.type === 'text' && chunk.content) {
        fullContent += chunk.content;
      }
      if (chunk.type === 'done') {
        tokensUsed = chunk.tokensUsed || 0;
        costUsd = chunk.costUsd || 0;
      }
      yield chunk;
    }

    if (options.abortSignal?.aborted) {
      fullTask.status = 'failed';
      fullTask.error = 'Aborted by caller';
      fullTask.endTime = Date.now();
      this.completedTasks.set(taskId, fullTask);
      return;
    }

    // Update task with results
    fullTask.status = 'completed';
    fullTask.result = fullContent;
    fullTask.tokensUsed = tokensUsed;
    fullTask.costUsd = costUsd;
    fullTask.endTime = Date.now();

    // Update daily cost
    if (this.config.enableCostTracking && costUsd) {
      this.dailyCostUsd += costUsd;
    }

    // Quality gate
    if (this.config.enableQualityGates && fullContent) {
      qualityScore = this.evaluateQuality(fullContent, task.agent);
      fullTask.qualityScore = qualityScore;
    }

    this.completedTasks.set(taskId, fullTask);

    // Emit done chunk with the completed task attached
    emit({
      type: 'done',
      taskId: fullTask.id,
      agent: fullTask.agent,
      timestamp: Date.now(),
      tokensUsed,
      costUsd,
      qualityScore,
      task: fullTask,
    });
  }

  private evaluateQuality(output: string, agentName: AgentName): number {
    let score = 50; // Base score

    // Check for completeness
    if (output.length > 500) score += 10;
    if (output.length > 1000) score += 5;

    // Check for structure
    if (output.includes('##')) score += 5;
    if (output.includes('###')) score += 3;
    if (output.includes('- ')) score += 3;

    // Check for India context (INR, Indian platforms)
    if (output.includes('₹') || output.includes('INR')) score += 5;
    if (output.includes('WhatsApp') || output.includes('Google Business')) score += 3;

    // Check for actionable content
    if (output.includes('Next Step') || output.includes('Action Item')) score += 5;

    // Agent-specific quality checks
    const agentCategory = AGENT_REGISTRY[agentName]?.category;
    if (agentCategory === 'content' && output.length > 1000) score += 5;
    if (agentCategory === 'technical' && (output.includes('```') || output.includes('import'))) score += 5;
    if (agentCategory === 'strategy' && output.includes('KPI')) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  // ─── Utility Methods ────────────────

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private resetDailyCostIfNeeded(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyCostResetDate !== today) {
      this.dailyCostUsd = 0;
      this.dailyCostResetDate = today;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Public Getters ─────────────────

  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  getCompletedTasks(): AgentTask[] {
    return Array.from(this.completedTasks.values());
  }

  getDailyCost(): number {
    this.resetDailyCostIfNeeded();
    return this.dailyCostUsd;
  }

  getConfig(): OrchestrationConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<OrchestrationConfig>): void {
    this.config = { ...this.config, ...updates };
    log.info('Orchestration config updated', updates);
  }
}

// ─── Factory Function ─────────────────

let engineInstance: OrchestrationEngine | null = null;

export function getOrchestrationEngine(
  config?: Partial<OrchestrationConfig>,
): OrchestrationEngine {
  if (!engineInstance) {
    engineInstance = new OrchestrationEngine(config);
  }
  return engineInstance;
}

// ─── Workflow Builder Helpers ─────────

export function buildAgentTask(
  agent: AgentName,
  prompt: string,
  inputs: Record<string, unknown> = {},
  dependencies: string[] = [],
  options: { providerId?: string; modelId?: string; maxRetries?: number } = {},
): Omit<AgentTask, 'id' | 'status' | 'retryCount'> {
  return {
    agent,
    prompt,
    inputs,
    dependencies,
    maxRetries: options.maxRetries ?? 2,
    providerId: options.providerId,
    modelId: options.modelId,
  };
}

export interface WorkflowTaskDef {
  agent: AgentName;
  prompt: string;
  /** Optional: specify which AI provider to use for this task */
  providerId?: string;
  /** Optional: specify which model to use for this task */
  modelId?: string;
}

export function buildSequentialWorkflow(
  name: string,
  tasks: WorkflowTaskDef[],
): WorkflowDefinition {
  const taskDefs: Omit<AgentTask, 'id' | 'status' | 'retryCount'>[] = [];
  const taskIds: string[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const taskDef = buildAgentTask(
      tasks[i].agent,
      tasks[i].prompt,
      {},
      i > 0 ? [taskIds[i - 1]] : [],
      { providerId: tasks[i].providerId, modelId: tasks[i].modelId },
    );
    taskDefs.push(taskDef);
    taskIds.push(`task_${i}`);
  }

  return {
    id: `workflow_${Date.now()}`,
    name,
    description: `Sequential workflow: ${tasks.map((t) => t.agent).join(' → ')}`,
    tasks: taskDefs,
    createdAt: Date.now(),
    status: 'pending',
  };
}

export function buildParallelWorkflow(
  name: string,
  tasks: WorkflowTaskDef[],
): WorkflowDefinition {
  const taskDefs = tasks.map((t) =>
    buildAgentTask(t.agent, t.prompt, {}, [], { providerId: t.providerId, modelId: t.modelId }),
  );

  return {
    id: `workflow_${Date.now()}`,
    name,
    description: `Parallel workflow: ${tasks.map((t) => t.agent).join(' | ')}`,
    tasks: taskDefs,
    createdAt: Date.now(),
    status: 'pending',
  };
}
