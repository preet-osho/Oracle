// ═══════════════════════════════════════
// ORACLE — Learning Loop Tests
// ═══════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LearningLoop,
  getLearningLoop,
  type TaskOutcome,
  type TaskScores,
} from './learning-loop';

describe('LearningLoop', () => {
  let loop: LearningLoop;

  beforeEach(() => {
    loop = getLearningLoop();
    loop.reset(); // Clean state for each test
  });

  const goodScores: TaskScores = {
    accuracy: 85,
    completeness: 90,
    speed: 75,
    costEfficiency: 80,
    businessValue: 85,
    risk: 20,
    clientUsefulness: 90,
  };

  const badScores: TaskScores = {
    accuracy: 30,
    completeness: 40,
    speed: 60,
    costEfficiency: 50,
    businessValue: 20,
    risk: 80,
    clientUsefulness: 25,
  };

  describe('reset()', () => {
    it('should clear all learning data', async () => {
      await loop.processTaskCompletion('agent_1', 't1', 'Task 1', 'success', goodScores);

      loop.reset();

      const history = loop.getAgentLearningHistory('agent_1');
      expect(history.length).toBe(0);
      expect(loop.getMistakeReports().length).toBe(0);
      expect(loop.getSuccessReports().length).toBe(0);
      expect(loop.getOptimizationPlans().length).toBe(0);
    });
  });

  describe('processTaskCompletion', () => {
    it('should record a successful task outcome', async () => {
      const entry = await loop.processTaskCompletion(
        'agent_success',
        'task_1',
        'SEO audit for homepage',
        'success',
        goodScores,
      );

      expect(entry.id).toMatch(/^learn_/);
      expect(entry.agentId).toBe('agent_success');
      expect(entry.taskId).toBe('task_1');
      expect(entry.outcome).toBe('success');
      expect(entry.scores.accuracy).toBe(85);
      expect(entry.lessonsLearned.length).toBeGreaterThan(0);
      expect(entry.reflection).toBeDefined();
      expect(entry.sopUpdates).toBeDefined();
      expect(entry.promptImprovements).toBeDefined();
    });

    it('should record a failure outcome', async () => {
      const entry = await loop.processTaskCompletion(
        'agent_fail',
        'task_fail',
        'Write blog post',
        'failure',
        badScores,
      );

      expect(entry.outcome).toBe('failure');
      expect(entry.scores.risk).toBe(80);
      expect(entry.reflection.whatFailed.length).toBeGreaterThan(0);
    });

    it('should generate mistake reports for failures', async () => {
      await loop.processTaskCompletion(
        'agent_mistake',
        'task_mistake',
        'SEO audit failed',
        'failure',
        badScores,
      );

      const reports = loop.getMistakeReports();
      expect(reports.length).toBe(1);
      expect(reports[0].agentId).toBe('agent_mistake');
    });

    it('should generate success reports for high-scoring tasks', async () => {
      const highScores: TaskScores = {
        accuracy: 95,
        completeness: 90,
        speed: 85,
        costEfficiency: 80,
        businessValue: 95,
        risk: 10,
        clientUsefulness: 95,
      };

      await loop.processTaskCompletion(
        'agent_high',
        'task_high',
        'Excellent SEO audit',
        'success',
        highScores,
      );

      const reports = loop.getSuccessReports();
      expect(reports.length).toBe(1);
    });

    it('should create optimization plans for low scores', async () => {
      await loop.processTaskCompletion(
        'agent_opt',
        'task_opt',
        'Poor quality task',
        'failure',
        badScores,
      );

      const plans = loop.getOptimizationPlans();
      expect(plans.length).toBeGreaterThan(0);
    });
  });

  describe('getAgentLearningHistory', () => {
    it('should return learning history for an agent', async () => {
      const agentId = 'agent_history';
      await loop.processTaskCompletion(agentId, 't1', 'Task 1', 'success', goodScores);
      await loop.processTaskCompletion(agentId, 't2', 'Task 2', 'failure', badScores);

      const history = loop.getAgentLearningHistory(agentId);

      expect(history.length).toBe(2);
      expect(history[0].agentId).toBe(agentId);
    });

    it('should limit results', async () => {
      const agentId = 'agent_limit';
      for (let i = 0; i < 10; i++) {
        await loop.processTaskCompletion(agentId, `t${i}`, `Task ${i}`, 'success', goodScores);
      }

      const history = loop.getAgentLearningHistory(agentId, 5);

      expect(history.length).toBe(5);
    });
  });

  describe('generateImprovementReport', () => {
    it('should generate a report for an agent', async () => {
      const agentId = 'agent_report';
      await loop.processTaskCompletion(agentId, 't1', 'Task 1', 'success', goodScores);
      await loop.processTaskCompletion(agentId, 't2', 'Task 2', 'failure', badScores);

      const report = loop.generateImprovementReport(agentId);

      expect(report.summary).toContain(agentId);
      expect(report.metrics.totalTasks).toBe(2);
      expect(report.metrics.successRate).toBe(50);
      expect(report.metrics.avgScore).toBeGreaterThan(0);
    });

    it('should return empty report for unknown agent', () => {
      const report = loop.generateImprovementReport('unknown_agent_xyz');

      expect(report.metrics.totalTasks).toBe(0);
      expect(report.metrics.successRate).toBe(0);
    });
  });

  describe('getOptimizationPlans', () => {
    it('should return all plans', async () => {
      await loop.processTaskCompletion('agent_plans', 't1', 'Task 1', 'failure', badScores);

      const plans = loop.getOptimizationPlans();
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0].category).toBeDefined();
      expect(plans[0].priority).toBeDefined();
    });

    it('should filter by status', () => {
      const plans = loop.getOptimizationPlans('planned');
      expect(Array.isArray(plans)).toBe(true);
    });
  });

  describe('getMistakeReports', () => {
    it('should return mistake reports', async () => {
      await loop.processTaskCompletion('agent_mistakes', 't1', 'Task 1', 'failure', badScores);

      const reports = loop.getMistakeReports();
      expect(reports.length).toBe(1);
      expect(reports[0].mistakeType).toBeDefined();
    });

    it('should filter by resolved status', () => {
      const reports = loop.getMistakeReports(false);
      expect(Array.isArray(reports)).toBe(true);
    });
  });

  describe('getSuccessReports', () => {
    it('should return success reports', async () => {
      const highScores: TaskScores = {
        accuracy: 95, completeness: 90, speed: 85, costEfficiency: 80,
        businessValue: 95, risk: 10, clientUsefulness: 95,
      };
      await loop.processTaskCompletion('agent_successes', 't1', 'Task 1', 'success', highScores);

      const reports = loop.getSuccessReports();
      expect(reports.length).toBe(1);
      expect(reports[0].successType).toBeDefined();
    });
  });

  describe('getImprovementTrends', () => {
    it('should return trends for an agent', async () => {
      await loop.processTaskCompletion('agent_trends', 't1', 'Task 1', 'success', goodScores);

      const trends = loop.getImprovementTrends('agent_trends', 1);
      expect(Array.isArray(trends)).toBe(true);
    });
  });
});

describe('getLearningLoop', () => {
  it('should return a singleton instance', () => {
    const loop1 = getLearningLoop();
    const loop2 = getLearningLoop();
    expect(loop1).toBe(loop2);
  });
});
