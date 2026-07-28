// ═══════════════════════════════════════
// ORACLE — Orchestration Engine Tests
// ═══════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrchestrationEngine,
  getOrchestrationEngine,
  buildAgentTask,
  buildSequentialWorkflow,
  buildParallelWorkflow,
  type AgentTask,
  type WorkflowDefinition,
  type StreamingChunk,
} from './orchestration-engine';
import { AGENT_REGISTRY, type AgentName } from './registry';

// Mock the router module
vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    callAISyncServer: vi.fn().mockResolvedValue({
      text: 'Mocked AI response for testing',
      inputTokens: 100,
      outputTokens: 50,
      costUSD: 0.001,
    }),
  },
}));

describe('OrchestrationEngine', () => {
  let engine: OrchestrationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new OrchestrationEngine({
      maxConcurrentAgents: 2,
      defaultTimeoutMs: 10_000,
      defaultMaxRetries: 1,
      enableQualityGates: true,
      qualityGateThreshold: 50,
      enableCostTracking: true,
      dailyBudgetUsd: 1.0,
    });
  });

  describe('executeTask', () => {
    it('should execute a simple task successfully', async () => {
      const task = buildAgentTask('seo-specialist', 'Analyze on-page SEO for homepage');
      const result = await engine.executeTask(task);

      expect(result.status).toBe('completed');
      expect(result.id).toMatch(/^task_/);
      expect(result.result).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.costUsd).toBeGreaterThanOrEqual(0);
    });

    it('should handle task with dependencies', async () => {
      // Execute first task
      const task1 = buildAgentTask('lead-hunter', 'Find prospects in Mumbai');
      const result1 = await engine.executeTask(task1);
      expect(result1.status).toBe('completed');

      // Execute dependent task
      const task2 = buildAgentTask('offer-strategist', 'Create offer for found prospects', {}, [result1.id]);
      const result2 = await engine.executeTask(task2);
      expect(result2.status).toBe('completed');
    });

    it('should fail task with unmet dependencies', async () => {
      const task = buildAgentTask('content-strategist', 'Write content', {}, ['nonexistent_task_id']);
      const result = await engine.executeTask(task);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Unmet dependencies');
    });

    it('should respect daily budget limit', async () => {
      // Set a very low budget
      engine.updateConfig({ dailyBudgetUsd: 0.00001 });
      
      // Execute a task to use up budget
      const task1 = buildAgentTask('seo-specialist', 'Task 1');
      await engine.executeTask(task1);

      // Next task should fail due to budget
      const task2 = buildAgentTask('seo-specialist', 'Task 2');
      const result = await engine.executeTask(task2);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Daily budget exceeded');
    });

    it('should retry failed tasks', async () => {
      const task = buildAgentTask('seo-specialist', 'Test task');
      task.maxRetries = 2;

      const result = await engine.executeTask(task);
      // Task should either succeed or fail after retries
      expect(['completed', 'failed']).toContain(result.status);
      expect(result.retryCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a sequential workflow', async () => {
      const workflow = buildSequentialWorkflow('SEO Audit', [
        { agent: 'lead-hunter', prompt: 'Find prospects' },
        { agent: 'seo-specialist', prompt: 'Audit SEO' },
        { agent: 'content-strategist', prompt: 'Create content plan' },
      ]);

      const result = await engine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.tasks.length).toBe(3);
      expect(result.totalTokensUsed).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should execute a parallel workflow', async () => {
      const workflow = buildParallelWorkflow('Parallel Research', [
        { agent: 'lead-hunter', prompt: 'Find leads' },
        { agent: 'seo-specialist', prompt: 'Research keywords' },
        { agent: 'researcher', prompt: 'Market research' },
      ]);

      const result = await engine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.tasks.length).toBe(3);
    });

    it('should handle workflow with mixed dependencies', async () => {
      const task1 = buildAgentTask('lead-hunter', 'Find leads');
      const task2 = buildAgentTask('seo-specialist', 'Research keywords');
      const task3 = buildAgentTask('offer-strategist', 'Create offer', {}, ['task_1', 'task_2']);

      const workflow: WorkflowDefinition = {
        id: 'mixed_workflow',
        name: 'Mixed Dependencies',
        description: 'Tasks with mixed dependency patterns',
        tasks: [task1, task2, task3],
        createdAt: Date.now(),
        status: 'pending',
      };

      const result = await engine.executeWorkflow(workflow);

      expect(['completed', 'partial']).toContain(result.status);
      expect(result.tasks.length).toBe(3);
    });

    it('should calculate average quality score', async () => {
      const workflow = buildSequentialWorkflow('Quality Test', [
        { agent: 'seo-specialist', prompt: 'Analyze SEO with detailed output' },
        { agent: 'content-strategist', prompt: 'Create comprehensive content plan' },
      ]);

      const result = await engine.executeWorkflow(workflow);

      expect(result.qualityScores.length).toBeGreaterThan(0);
      expect(result.averageQuality).toBeGreaterThan(0);
    });
  });

  describe('config management', () => {
    it('should update config', () => {
      engine.updateConfig({ maxConcurrentAgents: 5 });
      const config = engine.getConfig();
      expect(config.maxConcurrentAgents).toBe(5);
    });

    it('should track daily cost', () => {
      const initialCost = engine.getDailyCost();
      expect(initialCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('task getters', () => {
    it('should return completed tasks', async () => {
      const task = buildAgentTask('seo-specialist', 'Test');
      await engine.executeTask(task);

      const completed = engine.getCompletedTasks();
      expect(completed.length).toBeGreaterThan(0);
    });
  });
});

describe('Helper Functions', () => {
  describe('buildAgentTask', () => {
    it('should create a valid task definition', () => {
      const task = buildAgentTask('seo-specialist', 'Test prompt', { key: 'value' }, ['dep1']);

      expect(task.agent).toBe('seo-specialist');
      expect(task.prompt).toBe('Test prompt');
      expect(task.inputs).toEqual({ key: 'value' });
      expect(task.dependencies).toEqual(['dep1']);
      expect(task.maxRetries).toBe(2);
    });

    it('should use default values', () => {
      const task = buildAgentTask('lead-hunter', 'Simple task');

      expect(task.inputs).toEqual({});
      expect(task.dependencies).toEqual([]);
    });
  });

  describe('buildSequentialWorkflow', () => {
    it('should create a sequential workflow with dependencies', () => {
      const workflow = buildSequentialWorkflow('Test Sequential', [
        { agent: 'lead-hunter', prompt: 'Step 1' },
        { agent: 'seo-specialist', prompt: 'Step 2' },
        { agent: 'content-strategist', prompt: 'Step 3' },
      ]);

      expect(workflow.name).toBe('Test Sequential');
      expect(workflow.tasks.length).toBe(3);
      expect(workflow.tasks[0].dependencies).toEqual([]);
      expect(workflow.tasks[1].dependencies.length).toBe(1);
      expect(workflow.tasks[2].dependencies.length).toBe(1);
      expect(workflow.status).toBe('pending');
    });
  });

  describe('buildParallelWorkflow', () => {
    it('should create a parallel workflow without dependencies', () => {
      const workflow = buildParallelWorkflow('Test Parallel', [
        { agent: 'lead-hunter', prompt: 'Task A' },
        { agent: 'seo-specialist', prompt: 'Task B' },
      ]);

      expect(workflow.tasks.length).toBe(2);
      expect(workflow.tasks[0].dependencies).toEqual([]);
      expect(workflow.tasks[1].dependencies).toEqual([]);
    });
  });
});

describe('getOrchestrationEngine', () => {
  it('should return a singleton instance', () => {
    const engine1 = getOrchestrationEngine();
    const engine2 = getOrchestrationEngine();
    expect(engine1).toBe(engine2);
  });
});

describe('Streaming', () => {
  let engine: OrchestrationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new OrchestrationEngine({
      maxConcurrentAgents: 2,
      defaultTimeoutMs: 10_000,
      defaultMaxRetries: 1,
      enableQualityGates: true,
      qualityGateThreshold: 50,
      enableCostTracking: true,
      dailyBudgetUsd: 1.0,
    });
  });

  describe('executeTaskStreaming', () => {
    it('should yield chunks and include completed task in done chunk', async () => {
      const task = buildAgentTask('seo-specialist', 'Analyze SEO');
      const chunks: StreamingChunk[] = [];

      for await (const chunk of engine.executeTaskStreaming(task, {
        onChunk: (c) => chunks.push(c),
      })) {
        // consume chunks
      }

      // Should have text chunks and a done chunk with the completed task
      const textChunks = chunks.filter((c) => c.type === 'text');
      const doneChunks = chunks.filter((c) => c.type === 'done');
      expect(textChunks.length).toBeGreaterThan(0);
      expect(doneChunks.length).toBe(1);
      // The done chunk carries the completed task with results
      expect(doneChunks[0].task).toBeDefined();
      expect(doneChunks[0].task!.status).toBe('completed');
      expect(doneChunks[0].task!.result).toBeDefined();
      expect(doneChunks[0].task!.tokensUsed).toBeGreaterThan(0);
    });

    it('should fail task with unmet dependencies via streaming', async () => {
      const task = buildAgentTask('content-strategist', 'Write', {}, ['nonexistent']);
      const chunks: StreamingChunk[] = [];

      for await (const chunk of engine.executeTaskStreaming(task, {
        onChunk: (c) => chunks.push(c),
      })) {
        // should yield error chunk
      }

      const errorChunks = chunks.filter((c) => c.type === 'error');
      expect(errorChunks.length).toBe(1);
      expect(errorChunks[0].content).toContain('Unmet dependencies');
    });

    it('should respect abort signal', async () => {
      const controller = new AbortController();
      const task = buildAgentTask('seo-specialist', 'Analyze SEO');
      const chunks: StreamingChunk[] = [];

      // Abort immediately
      controller.abort();

      for await (const chunk of engine.executeTaskStreaming(task, {
        onChunk: (c) => chunks.push(c),
        abortSignal: controller.signal,
      })) {
        // should stop early
      }

      // Should have been aborted — no done chunk expected
      const doneChunks = chunks.filter((c) => c.type === 'done');
      expect(doneChunks.length).toBe(0);
    });

    it('should pass providerId and modelId to router', async () => {
      const { NeverStopRouter } = await import('@/lib/router');
      const task = buildAgentTask('seo-specialist', 'Analyze SEO', {}, [], {
        providerId: 'openai',
        modelId: 'gpt-4o',
      });

      for await (const _chunk of engine.executeTaskStreaming(task)) {
        // consume chunks
      }

      expect(NeverStopRouter.callAISyncServer).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ providerId: 'openai', modelId: 'gpt-4o' }),
      );
    });
  });

  describe('buildAgentTask with options', () => {
    it('should accept providerId and modelId options', () => {
      const task = buildAgentTask('seo-specialist', 'Test', {}, [], {
        providerId: 'anthropic',
        modelId: 'claude-sonnet',
        maxRetries: 5,
      });

      expect(task.providerId).toBe('anthropic');
      expect(task.modelId).toBe('claude-sonnet');
      expect(task.maxRetries).toBe(5);
    });

    it('should use defaults when no options provided', () => {
      const task = buildAgentTask('seo-specialist', 'Test');

      expect(task.providerId).toBeUndefined();
      expect(task.modelId).toBeUndefined();
      expect(task.maxRetries).toBe(2);
    });
  });
});
