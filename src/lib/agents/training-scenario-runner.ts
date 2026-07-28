// ═══════════════════════════════════════
// ORACLE — Training Scenario Runner
// Executes training scenarios and tracks results
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { evaluateAgentOutput, type EvaluationDimension } from '@/lib/agents/evaluation-framework';
import type { AgentName } from '@/lib/agents/registry';
import {
  type TrainingScenario,
  type ScenarioResult,
  type BatchScenarioResult,
  type ScenarioContext,
  type ExpectedOutcome,
} from './training-scenarios';
import { TRAINING_SCENARIOS, getScenarioStats } from './training-scenarios-library';

const log = createLogger('TrainingScenarioRunner');

// ─── Configuration ────────────────────

export interface RunnerConfig {
  /** Timeout per scenario in milliseconds */
  scenarioTimeoutMs: number;
  /** Maximum concurrent scenarios */
  maxConcurrency: number;
  /** Whether to skip non-critical scenarios */
  skipNonCritical: boolean;
  /** Scenarios to exclude by ID */
  excludeScenarioIds: string[];
  /** Only run scenarios for these agents */
  agentFilter?: AgentName[];
  /** Only run scenarios with these difficulties */
  difficultyFilter?: ('easy' | 'medium' | 'hard' | 'adversarial')[];
}

const DEFAULT_RUNNER_CONFIG: RunnerConfig = {
  scenarioTimeoutMs: 60000, // 60 seconds
  maxConcurrency: 3,
  skipNonCritical: false,
  excludeScenarioIds: [],
};

// ─── Agent Output Function ────────────

/**
 * Function type that takes a task prompt and context, returns agent output.
 * This is the interface to your actual agent system.
 */
export type AgentExecutor = (
  agentName: AgentName,
  taskPrompt: string,
  context?: ScenarioContext,
) => Promise<string>;

// ─── Scenario Runner ──────────────────

export class TrainingScenarioRunner {
  private config: RunnerConfig;
  private executionHistory: BatchScenarioResult[] = [];

  constructor(config: Partial<RunnerConfig> = {}) {
    this.config = { ...DEFAULT_RUNNER_CONFIG, ...config };
  }

  /**
   * Run a single training scenario
   */
  async runScenario(
    scenario: TrainingScenario,
    agentExecutor: AgentExecutor,
  ): Promise<ScenarioResult> {
    const startTime = Date.now();
    log.info('Running scenario', { scenarioId: scenario.id, name: scenario.name });

    try {
      // Execute agent with timeout
      const output = await this.executeWithTimeout(
        () => agentExecutor(scenario.agentNames[0], scenario.taskPrompt, scenario.context),
        this.config.scenarioTimeoutMs,
      );

      // Evaluate output
      const evaluation = evaluateAgentOutput(
        scenario.agentNames[0],
        scenario.taskPrompt,
        output,
      );

      // Check content expectations
      const contentChecks = this.checkContentExpectations(output, scenario);

      // Calculate custom scores
      const customScores = this.calculateCustomScores(output, scenario);

      // Calculate bonus points
      const bonusPointsEarned = this.calculateBonusPoints(output, scenario);

      // Calculate penalty deductions
      const penaltyDeductions = this.calculatePenalties(output, scenario);

      // Determine actual outcome
      const actualOutcome = this.determineOutcome(
        evaluation.weightedTotal,
        contentChecks,
        scenario.expectations.expectedOutcome,
      );

      const finalScore = Math.max(
        0,
        evaluation.weightedTotal + bonusPointsEarned - penaltyDeductions,
      );

      const result: ScenarioResult = {
        scenarioId: scenario.id,
        agentName: scenario.agentNames[0],
        agentOutput: output,
        passed: actualOutcome === scenario.expectations.expectedOutcome,
        evaluationScores: evaluation.scores,
        weightedTotal: evaluation.weightedTotal,
        customScores,
        bonusPointsEarned,
        penaltyDeductions,
        finalScore,
        contentChecks,
        detectedFlags: evaluation.flags.map((f) => f.message),
        expectedOutcome: scenario.expectations.expectedOutcome,
        actualOutcome,
        executionTimeMs: Date.now() - startTime,
        feedback: evaluation.suggestions,
        executedAt: Date.now(),
      };

      log.info('Scenario completed', {
        scenarioId: scenario.id,
        passed: result.passed,
        finalScore: result.finalScore,
      });

      return result;
    } catch (error) {
      log.error('Scenario failed', { scenarioId: scenario.id, error });

      return {
        scenarioId: scenario.id,
        agentName: scenario.agentNames[0],
        agentOutput: '',
        passed: false,
        evaluationScores: {} as Record<EvaluationDimension, number>,
        weightedTotal: 0,
        finalScore: 0,
        bonusPointsEarned: 0,
        penaltyDeductions: 0,
        contentChecks: {
          mustContainResults: [],
          mustNotContainResults: [],
          structureCheckResults: {},
          wordCount: 0,
        },
        detectedFlags: [`Execution error: ${error instanceof Error ? error.message : String(error)}`],
        expectedOutcome: scenario.expectations.expectedOutcome,
        actualOutcome: 'fail',
        executionTimeMs: Date.now() - startTime,
        feedback: ['Scenario execution failed due to error'],
        executedAt: Date.now(),
      };
    }
  }

  /**
   * Run multiple scenarios as a batch
   */
  async runBatch(
    scenarioIds: string[],
    agentExecutor: AgentExecutor,
  ): Promise<BatchScenarioResult> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();

    log.info('Starting batch execution', { batchId, scenarioCount: scenarioIds.length });

    const scenarios = scenarioIds
      .map((id) => TRAINING_SCENARIOS.find((s) => s.id === id))
      .filter((s): s is TrainingScenario => s !== undefined);

    const results: ScenarioResult[] = [];

    // Run scenarios with concurrency limit
    for (let i = 0; i < scenarios.length; i += this.config.maxConcurrency) {
      const batch = scenarios.slice(i, i + this.config.maxConcurrency);
      const batchResults = await Promise.all(
        batch.map((scenario) => this.runScenario(scenario, agentExecutor)),
      );
      results.push(...batchResults);
    }

    // Calculate summary statistics
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.length - passedCount;
    const passRate = results.length > 0 ? (passedCount / results.length) * 100 : 0;
    const averageScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.finalScore, 0) / results.length
      : 0;

    // Calculate per-agent summaries
    const agentSummaries = this.calculateAgentSummaries(results);

    const batchResult: BatchScenarioResult = {
      batchId,
      totalScenarios: results.length,
      passedCount,
      failedCount,
      passRate,
      averageScore,
      agentSummaries,
      results,
      executedAt: Date.now(),
    };

    this.executionHistory.push(batchResult);

    log.info('Batch execution completed', {
      batchId,
      passRate,
      averageScore,
      durationMs: Date.now() - startTime,
    });

    return batchResult;
  }

  /**
   * Run all scenarios (optionally filtered)
   */
  async runAll(
    agentExecutor: AgentExecutor,
  ): Promise<BatchScenarioResult> {
    let scenarios = TRAINING_SCENARIOS;

    // Apply filters
    if (this.config.skipNonCritical) {
      scenarios = scenarios.filter((s) => s.isCritical);
    }

    if (this.config.excludeScenarioIds.length > 0) {
      scenarios = scenarios.filter((s) => !this.config.excludeScenarioIds.includes(s.id));
    }

    if (this.config.agentFilter && this.config.agentFilter.length > 0) {
      scenarios = scenarios.filter((s) =>
        s.agentNames.some((name) => this.config.agentFilter!.includes(name)),
      );
    }

    if (this.config.difficultyFilter && this.config.difficultyFilter.length > 0) {
      scenarios = scenarios.filter((s) =>
        this.config.difficultyFilter!.includes(s.difficulty),
      );
    }

    return this.runBatch(
      scenarios.map((s) => s.id),
      agentExecutor,
    );
  }

  /**
   * Get execution history
   */
  getHistory(): BatchScenarioResult[] {
    return [...this.executionHistory];
  }

  /**
   * Get latest batch result
   */
  getLatestResult(): BatchScenarioResult | null {
    return this.executionHistory[this.executionHistory.length - 1] || null;
  }

  // ─── Private Helpers ────────────────

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private checkContentExpectations(
    output: string,
    scenario: TrainingScenario,
  ): ScenarioResult['contentChecks'] {
    const { expectations } = scenario;
    const outputLower = output.toLowerCase();

    // Check must contain
    const mustContainResults = (expectations.mustContain || []).map((term) => ({
      term,
      found: outputLower.includes(term.toLowerCase()),
    }));

    // Check must not contain
    const mustNotContainResults = (expectations.mustNotContain || []).map((term) => ({
      term,
      found: outputLower.includes(term.toLowerCase()),
    }));

    // Check structure
    const structureCheckResults: Record<string, boolean> = {};
    if (expectations.structureChecks) {
      const checks = expectations.structureChecks;
      if (checks.hasHeaders) {
        structureCheckResults.hasHeaders = /^#{1,3}\s/m.test(output);
      }
      if (checks.hasBulletPoints) {
        structureCheckResults.hasBulletPoints = /^[-*]\s/m.test(output);
      }
      if (checks.hasTables) {
        structureCheckResults.hasTables = /\|.*\|/.test(output);
      }
      if (checks.hasCodeBlocks) {
        structureCheckResults.hasCodeBlocks = /```[\s\S]*?```/.test(output);
      }
      if (checks.hasPriceInINR) {
        structureCheckResults.hasPriceInINR = /₹[\d,]+/.test(output);
      }
      if (checks.hasActionItems) {
        structureCheckResults.hasActionItems = /action item|next step|to-do/i.test(output);
      }
      if (checks.hasNextStep) {
        structureCheckResults.hasNextStep = /next step|what's next|proceed/i.test(output);
      }
      if (checks.hasSources) {
        structureCheckResults.hasSources = /source|reference|http/i.test(output);
      }
    }

    // Word count
    const wordCount = output.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      mustContainResults,
      mustNotContainResults,
      structureCheckResults,
      wordCount,
    };
  }

  private calculateCustomScores(
    output: string,
    scenario: TrainingScenario,
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    if (scenario.rubric.customCriteria) {
      for (const criterion of scenario.rubric.customCriteria) {
        if (criterion.checkFunction) {
          scores[criterion.name] = criterion.checkFunction(output) ? criterion.weight * 100 : 0;
        } else {
          // Default scoring based on keyword presence
          const keywords = criterion.description.toLowerCase().split(/\s+/);
          const matches = keywords.filter((kw) => output.toLowerCase().includes(kw)).length;
          scores[criterion.name] = Math.min(100, (matches / keywords.length) * 100);
        }
      }
    }

    return scores;
  }

  private calculateBonusPoints(
    output: string,
    scenario: TrainingScenario,
  ): number {
    let bonus = 0;

    if (scenario.rubric.bonusPoints) {
      for (const bonusRule of scenario.rubric.bonusPoints) {
        if (output.toLowerCase().includes(bonusRule.condition.toLowerCase())) {
          bonus += bonusRule.points;
        }
      }
    }

    return bonus;
  }

  private calculatePenalties(
    output: string,
    scenario: TrainingScenario,
  ): number {
    let deduction = 0;

    if (scenario.rubric.penalties) {
      for (const penalty of scenario.rubric.penalties) {
        if (output.toLowerCase().includes(penalty.condition.toLowerCase())) {
          deduction += penalty.deduction;
        }
      }
    }

    return deduction;
  }

  private determineOutcome(
    weightedTotal: number,
    contentChecks: ScenarioResult['contentChecks'],
    expectedOutcome: ExpectedOutcome,
  ): ExpectedOutcome {
    // Check if must-contain terms are missing
    const missingMustContain = contentChecks.mustContainResults.filter((r) => !r.found);
    if (missingMustContain.length > 0) {
      return 'fail';
    }

    // Check if must-not-contain terms are present
    const foundMustNotContain = contentChecks.mustNotContainResults.filter((r) => r.found);
    if (foundMustNotContain.length > 0) {
      return 'fail';
    }

    // Check word count bounds
    const wordCount = contentChecks.wordCount;
    if (wordCount < 50) {
      return 'fail';
    }

    // If the scenario expects to be flagged, return flagged regardless of score
    if (expectedOutcome === 'flagged') {
      return 'flagged';
    }

    // Determine based on score
    if (weightedTotal >= 70) {
      return 'pass';
    } else {
      return 'partial';
    }
  }

  private calculateAgentSummaries(
    results: ScenarioResult[],
  ): BatchScenarioResult['agentSummaries'] {
    const summaries: BatchScenarioResult['agentSummaries'] = {} as Record<
      AgentName,
      {
        totalTests: number;
        passed: number;
        failed: number;
        averageScore: number;
        weakestDimension: EvaluationDimension;
        strongestDimension: EvaluationDimension;
      }
    >;

    // Group results by agent
    const agentResults = new Map<AgentName, ScenarioResult[]>();
    for (const result of results) {
      const existing = agentResults.get(result.agentName) || [];
      existing.push(result);
      agentResults.set(result.agentName, existing);
    }

    // Calculate summaries
    for (const [agentName, agentResultsList] of agentResults) {
      const totalTests = agentResultsList.length;
      const passed = agentResultsList.filter((r) => r.passed).length;
      const failed = totalTests - passed;
      const averageScore =
        agentResultsList.reduce((sum, r) => sum + r.finalScore, 0) / totalTests;

      // Find weakest and strongest dimensions
      const dimensionSums: Record<string, number> = {};
      const dimensionCounts: Record<string, number> = {};

      for (const result of agentResultsList) {
        for (const [dim, score] of Object.entries(result.evaluationScores)) {
          dimensionSums[dim] = (dimensionSums[dim] || 0) + score;
          dimensionCounts[dim] = (dimensionCounts[dim] || 0) + 1;
        }
      }

      let weakestDimension: EvaluationDimension = 'accuracy';
      let strongestDimension: EvaluationDimension = 'accuracy';
      let minAvg = Infinity;
      let maxAvg = -Infinity;

      for (const [dim, sum] of Object.entries(dimensionSums)) {
        const avg = sum / (dimensionCounts[dim] || 1);
        if (avg < minAvg) {
          minAvg = avg;
          weakestDimension = dim as EvaluationDimension;
        }
        if (avg > maxAvg) {
          maxAvg = avg;
          strongestDimension = dim as EvaluationDimension;
        }
      }

      summaries[agentName] = {
        totalTests,
        passed,
        failed,
        averageScore,
        weakestDimension,
        strongestDimension,
      };
    }

    return summaries;
  }
}

// ─── Convenience Functions ─────────────

/**
 * Create a runner with default config
 */
export function createScenarioRunner(
  config?: Partial<RunnerConfig>,
): TrainingScenarioRunner {
  return new TrainingScenarioRunner(config);
}

/**
 * Quick run: execute all critical scenarios
 */
export async function runCriticalScenarios(
  agentExecutor: AgentExecutor,
): Promise<BatchScenarioResult> {
  const runner = createScenarioRunner({
    skipNonCritical: true,
    scenarioTimeoutMs: 120000,
  });
  return runner.runAll(agentExecutor);
}

/**
 * Quick run: execute scenarios for a specific agent
 */
export async function runAgentScenarios(
  agentName: AgentName,
  agentExecutor: AgentExecutor,
): Promise<BatchScenarioResult> {
  const runner = createScenarioRunner({
    agentFilter: [agentName],
  });
  return runner.runAll(agentExecutor);
}

/**
 * Get scenario library statistics
 */
export function getTrainingLibraryStats() {
  return getScenarioStats();
}
