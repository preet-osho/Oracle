// ═══════════════════════════════════════
// ORACLE — Self-Improvement Learning Loop
// Karpathy-style: Input → Plan → Execute → Verify → Score → Reflect → Learn
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { storeAgentMemory, type MemoryCategory } from '@/lib/agents/memory-system';

const log = createLogger('LearningLoop');

// ─── Types ─────────────────────────────

export type TaskOutcome = 'success' | 'partial' | 'failure';

export interface LearningEntry {
  id: string;
  agentId: string;
  taskId: string;
  taskDescription: string;
  outcome: TaskOutcome;
  scores: TaskScores;
  reflection: Reflection;
  lessonsLearned: string[];
  sopUpdates: string[];
  promptImprovements: string[];
  toolPerformance: ToolPerformance[];
  timestamp: number;
}

export interface TaskScores {
  accuracy: number;        // 0-100: Was the output correct?
  completeness: number;    // 0-100: Did it cover everything?
  speed: number;          // 0-100: Was it fast enough?
  costEfficiency: number; // 0-100: Was it cost-effective?
  businessValue: number;  // 0-100: Did it provide business value?
  risk: number;           // 0-100: Lower risk = higher score
  clientUsefulness: number; // 0-100: Would a client find this useful?
}

export interface Reflection {
  whatWorked: string[];
  whatFailed: string[];
  wrongAssumptions: string[];
  toolErrors: string[];
  bestPerformingAgent: string;
  automatableTasks: string[];
  suggestedSOPs: string[];
}

export interface ToolPerformance {
  toolName: string;
  calls: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  totalCostUsd: number;
}

export interface MistakeReport {
  id: string;
  agentId: string;
  mistakeType: string;
  description: string;
  rootCause: string;
  fix: string;
  preventionStrategy: string;
  timestamp: number;
  resolved: boolean;
}

export interface SuccessReport {
  id: string;
  agentId: string;
  successType: string;
  description: string;
  replicablePattern: string;
  applicableDomains: string[];
  timestamp: number;
}

export interface OptimizationPlan {
  id: string;
  category: 'prompt' | 'workflow' | 'tool' | 'agent' | 'memory';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedImpact: string;
  implementationSteps: string[];
  status: 'planned' | 'in-progress' | 'completed' | 'abandoned';
  createdAt: number;
  completedAt?: number;
}

// ─── Learning Loop Store ──────────────

const learningEntries: Map<string, LearningEntry> = new Map();
const mistakeReports: Map<string, MistakeReport> = new Map();
const successReports: Map<string, SuccessReport> = new Map();
const optimizationPlans: Map<string, OptimizationPlan> = new Map();

// ─── Learning Loop Engine ─────────────

export class LearningLoop {
  private minScoreForSuccess: number = 70;
  private maxRetriesBeforeReflection: number = 2;

  /**
   * Reset all in-memory stores — use for test isolation
   */
  reset(): void {
    learningEntries.clear();
    mistakeReports.clear();
    successReports.clear();
    optimizationPlans.clear();
    log.debug('Learning loop reset');
  }

  /**
   * Record a completed task and trigger learning
   */
  async processTaskCompletion(
    agentId: string,
    taskId: string,
    taskDescription: string,
    outcome: TaskOutcome,
    scores: TaskScores,
    toolPerformance: ToolPerformance[] = [],
  ): Promise<LearningEntry> {
    log.info('Processing task completion', {
      agentId,
      taskId,
      outcome,
      avgScore: this.calculateAverageScore(scores),
    });

    // Step 1: Reflect on the task
    const reflection = this.reflectOnTask(agentId, taskDescription, outcome, scores, toolPerformance);

    // Step 2: Extract lessons learned
    const lessonsLearned = this.extractLessons(reflection, scores);

    // Step 3: Identify SOP updates needed
    const sopUpdates = this.identifySOPUpdates(reflection, outcome);

    // Step 4: Suggest prompt improvements
    const promptImprovements = this.suggestPromptImprovements(reflection, scores);

    // Step 5: Create learning entry
    const entry: LearningEntry = {
      id: `learn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentId,
      taskId,
      taskDescription,
      outcome,
      scores,
      reflection,
      lessonsLearned,
      sopUpdates,
      promptImprovements,
      toolPerformance,
      timestamp: Date.now(),
    };

    learningEntries.set(entry.id, entry);

    // Step 6: Store lessons in memory (fire-and-forget, don't block task completion)
    for (const lesson of lessonsLearned) {
      storeAgentMemory(
        'system', // System-level learning
        agentId,
        lesson,
        'lesson',
        outcome === 'failure' ? 3 : 2,
        ['learning-loop', outcome],
      ).catch((err) => {
        log.debug('Failed to store learning memory', { error: err instanceof Error ? err.message : String(err) });
      });
    }

    // Step 7: Generate reports if needed
    if (outcome === 'failure') {
      this.generateMistakeReport(agentId, taskDescription, reflection);
    } else if (outcome === 'success' && this.calculateAverageScore(scores) > 85) {
      this.generateSuccessReport(agentId, taskDescription, reflection);
    }

    // Step 8: Create optimization plans
    this.createOptimizationPlans(entry);

    log.info('Learning entry created', {
      entryId: entry.id,
      lessonsCount: lessonsLearned.length,
      sopUpdatesCount: sopUpdates.length,
      promptImprovementsCount: promptImprovements.length,
    });

    return entry;
  }

  /**
   * Get learning history for an agent
   */
  getAgentLearningHistory(agentId: string, limit: number = 50): LearningEntry[] {
    return Array.from(learningEntries.values())
      .filter((e) => e.agentId === agentId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get improvement trends for an agent
   */
  getImprovementTrends(agentId: string, days: number = 30): {
    date: string;
    avgScore: number;
    successRate: number;
    taskCount: number;
  }[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const entries = Array.from(learningEntries.values())
      .filter((e) => e.agentId === agentId && e.timestamp > cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Group by day
    const byDay = new Map<string, LearningEntry[]>();
    for (const entry of entries) {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      if (!byDay.has(date)) byDay.set(date, []);
      byDay.get(date)!.push(entry);
    }

    return Array.from(byDay.entries()).map(([date, dayEntries]) => ({
      date,
      avgScore: dayEntries.reduce((sum, e) => sum + this.calculateAverageScore(e.scores), 0) / dayEntries.length,
      successRate: dayEntries.filter((e) => e.outcome === 'success').length / dayEntries.length * 100,
      taskCount: dayEntries.length,
    }));
  }

  /**
   * Get all optimization plans
   */
  getOptimizationPlans(status?: OptimizationPlan['status']): OptimizationPlan[] {
    return Array.from(optimizationPlans.values())
      .filter((p) => !status || p.status === status)
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * Get all mistake reports
   */
  getMistakeReports(resolved?: boolean): MistakeReport[] {
    return Array.from(mistakeReports.values())
      .filter((r) => resolved === undefined || r.resolved === resolved)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get all success reports
   */
  getSuccessReports(): SuccessReport[] {
    return Array.from(successReports.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate a comprehensive improvement report
   */
  generateImprovementReport(agentId: string): {
    summary: string;
    metrics: {
      totalTasks: number;
      successRate: number;
      avgScore: number;
      improvementRate: number;
    };
    topLessons: string[];
    activeOptimizations: OptimizationPlan[];
    recentMistakes: MistakeReport[];
    recentSuccesses: SuccessReport[];
  } {
    const entries = this.getAgentLearningHistory(agentId, 100);
    const totalTasks = entries.length;
    const successRate = totalTasks > 0
      ? entries.filter((e) => e.outcome === 'success').length / totalTasks * 100
      : 0;
    const avgScore = totalTasks > 0
      ? entries.reduce((sum, e) => sum + this.calculateAverageScore(e.scores), 0) / totalTasks
      : 0;

    // Calculate improvement rate (compare last 10 vs previous 10)
    const recent = entries.slice(0, 10);
    const previous = entries.slice(10, 20);
    const recentAvg = recent.length > 0
      ? recent.reduce((sum, e) => sum + this.calculateAverageScore(e.scores), 0) / recent.length
      : 0;
    const previousAvg = previous.length > 0
      ? previous.reduce((sum, e) => sum + this.calculateAverageScore(e.scores), 0) / previous.length
      : 0;
    const improvementRate = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

    // Collect top lessons
    const lessonCounts = new Map<string, number>();
    for (const entry of entries) {
      for (const lesson of entry.lessonsLearned) {
        lessonCounts.set(lesson, (lessonCounts.get(lesson) || 0) + 1);
      }
    }
    const topLessons = Array.from(lessonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lesson]) => lesson);

    return {
      summary: `Agent ${agentId} has completed ${totalTasks} tasks with a ${successRate.toFixed(1)}% success rate and an average score of ${avgScore.toFixed(1)}/100. Improvement rate: ${improvementRate >= 0 ? '+' : ''}${improvementRate.toFixed(1)}%.`,
      metrics: {
        totalTasks,
        successRate,
        avgScore,
        improvementRate,
      },
      topLessons,
      activeOptimizations: this.getOptimizationPlans('planned').slice(0, 5),
      recentMistakes: this.getMistakeReports(false).slice(0, 5),
      recentSuccesses: this.getSuccessReports().slice(0, 5),
    };
  }

  // ─── Private Methods ────────────────

  private reflectOnTask(
    agentId: string,
    taskDescription: string,
    outcome: TaskOutcome,
    scores: TaskScores,
    toolPerformance: ToolPerformance[],
  ): Reflection {
    const reflection: Reflection = {
      whatWorked: [],
      whatFailed: [],
      wrongAssumptions: [],
      toolErrors: [],
      bestPerformingAgent: agentId,
      automatableTasks: [],
      suggestedSOPs: [],
    };

    // Analyze what worked
    if (scores.accuracy > 80) reflection.whatWorked.push('High accuracy in output');
    if (scores.completeness > 80) reflection.whatWorked.push('Comprehensive coverage');
    if (scores.speed > 80) reflection.whatWorked.push('Fast execution');
    if (scores.costEfficiency > 80) reflection.whatWorked.push('Cost-effective approach');
    if (scores.businessValue > 80) reflection.whatWorked.push('High business value');

    // Analyze what failed
    if (scores.accuracy < 50) reflection.whatFailed.push('Low accuracy - output had errors');
    if (scores.completeness < 50) reflection.whatFailed.push('Incomplete coverage');
    if (scores.speed < 50) reflection.whatFailed.push('Slow execution');
    if (scores.costEfficiency < 50) reflection.whatFailed.push('Poor cost efficiency');
    if (scores.businessValue < 50) reflection.whatFailed.push('Low business value');

    // Analyze tool performance
    for (const tool of toolPerformance) {
      const failureRate = tool.calls > 0 ? tool.failures / tool.calls : 0;
      if (failureRate > 0.3) {
        reflection.toolErrors.push(`${tool.toolName}: ${(failureRate * 100).toFixed(0)}% failure rate`);
      }
    }

    // Identify automatable tasks (tasks that succeeded with consistent high scores)
    if (outcome === 'success' && this.calculateAverageScore(scores) > 85) {
      reflection.automatableTasks.push(taskDescription);
    }

    return reflection;
  }

  private extractLessons(reflection: Reflection, scores: TaskScores): string[] {
    const lessons: string[] = [];

    // Extract lessons from failures
    for (const failure of reflection.whatFailed) {
      lessons.push(`Avoid: ${failure}`);
    }

    // Extract lessons from successes
    for (const success of reflection.whatWorked) {
      lessons.push(`Replicate: ${success}`);
    }

    // Extract lessons from tool errors
    for (const error of reflection.toolErrors) {
      lessons.push(`Tool issue: ${error}`);
    }

    // Extract lessons from scores
    if (scores.risk < 50) {
      lessons.push('High-risk approach detected - consider safer alternatives');
    }

    return lessons;
  }

  private identifySOPUpdates(reflection: Reflection, outcome: TaskOutcome): string[] {
    const updates: string[] = [];

    if (outcome === 'failure') {
      updates.push('Add error handling for this failure mode');
      updates.push('Add validation step before proceeding');
    }

    for (const sop of reflection.suggestedSOPs) {
      updates.push(sop);
    }

    return updates;
  }

  private suggestPromptImprovements(reflection: Reflection, scores: TaskScores): string[] {
    const improvements: string[] = [];

    if (scores.accuracy < 70) {
      improvements.push('Add more specific instructions for accuracy');
      improvements.push('Include examples of correct output format');
    }

    if (scores.completeness < 70) {
      improvements.push('Add checklist of required sections');
      improvements.push('Explicitly list all expected deliverables');
    }

    if (scores.businessValue < 70) {
      improvements.push('Emphasize actionable recommendations');
      improvements.push('Include specific KPIs and metrics');
    }

    return improvements;
  }

  private generateMistakeReport(
    agentId: string,
    taskDescription: string,
    reflection: Reflection,
  ): MistakeReport {
    const report: MistakeReport = {
      id: `mistake_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentId,
      mistakeType: reflection.whatFailed[0] || 'Unknown failure',
      description: taskDescription,
      rootCause: reflection.wrongAssumptions[0] || 'Analysis pending',
      fix: 'See prevention strategy',
      preventionStrategy: reflection.suggestedSOPs[0] || 'Add validation step',
      timestamp: Date.now(),
      resolved: false,
    };

    mistakeReports.set(report.id, report);
    return report;
  }

  private generateSuccessReport(
    agentId: string,
    taskDescription: string,
    reflection: Reflection,
  ): SuccessReport {
    const report: SuccessReport = {
      id: `success_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentId,
      successType: reflection.whatWorked[0] || 'Successful execution',
      description: taskDescription,
      replicablePattern: reflection.whatWorked.join('; '),
      applicableDomains: ['general'],
      timestamp: Date.now(),
    };

    successReports.set(report.id, report);
    return report;
  }

  private createOptimizationPlans(entry: LearningEntry): void {
    // Create optimization plans based on learning
    if (entry.scores.accuracy < 70) {
      this.addOptimizationPlan({
        category: 'prompt',
        priority: 'high',
        description: `Improve accuracy for ${entry.agentId} agent`,
        expectedImpact: 'Reduce errors by 30-50%',
        implementationSteps: [
          'Review recent failures',
          'Identify common error patterns',
          'Update agent prompt with specific instructions',
          'Add validation examples',
        ],
      });
    }

    if (entry.scores.speed < 60) {
      this.addOptimizationPlan({
        category: 'workflow',
        priority: 'medium',
        description: `Optimize execution speed for ${entry.agentId} agent`,
        expectedImpact: 'Reduce execution time by 20-40%',
        implementationSteps: [
          'Profile task execution',
          'Identify bottlenecks',
          'Parallelize independent operations',
          'Cache frequently used data',
        ],
      });
    }

    if (entry.scores.costEfficiency < 60) {
      this.addOptimizationPlan({
        category: 'tool',
        priority: 'medium',
        description: `Reduce costs for ${entry.agentId} agent`,
        expectedImpact: 'Reduce costs by 20-30%',
        implementationSteps: [
          'Analyze token usage',
          'Optimize prompt length',
          'Use cheaper models for simple tasks',
          'Implement caching',
        ],
      });
    }
  }

  private addOptimizationPlan(
    plan: Omit<OptimizationPlan, 'id' | 'status' | 'createdAt'>,
  ): void {
    // Check if similar plan already exists
    const existing = Array.from(optimizationPlans.values()).find(
      (p) => p.category === plan.category && p.description === plan.description,
    );

    if (existing) {
      // Update priority if new plan is higher priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[plan.priority] < priorityOrder[existing.priority]) {
        existing.priority = plan.priority;
      }
      return;
    }

    const newPlan: OptimizationPlan = {
      ...plan,
      id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      status: 'planned',
      createdAt: Date.now(),
    };

    optimizationPlans.set(newPlan.id, newPlan);
  }

  private calculateAverageScore(scores: TaskScores): number {
    return (
      (scores.accuracy +
        scores.completeness +
        scores.speed +
        scores.costEfficiency +
        scores.businessValue +
        (100 - scores.risk) + // Invert risk (lower risk = higher score)
        scores.clientUsefulness) /
      7
    );
  }
}

// ─── Singleton ────────────────────────

let learningLoopInstance: LearningLoop | null = null;

export function getLearningLoop(): LearningLoop {
  if (!learningLoopInstance) {
    learningLoopInstance = new LearningLoop();
  }
  return learningLoopInstance;
}

// ─── Convenience Functions ────────────

export function recordTaskCompletion(
  agentId: string,
  taskId: string,
  taskDescription: string,
  outcome: TaskOutcome,
  scores: TaskScores,
): Promise<LearningEntry> {
  return getLearningLoop().processTaskCompletion(
    agentId,
    taskId,
    taskDescription,
    outcome,
    scores,
  );
}

export function getAgentImprovementReport(agentId: string) {
  return getLearningLoop().generateImprovementReport(agentId);
}
