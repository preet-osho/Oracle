// ═══════════════════════════════════════
// ORACLE — Training Scenario Library
// Diverse, measurable training cases for agent evaluation
// ═══════════════════════════════════════

import type { AgentName } from '@/lib/agents/registry';
import type { EvaluationDimension } from '@/lib/agents/evaluation-framework';

// ─── Scenario Types ────────────────────

export type ScenarioDifficulty = 'easy' | 'medium' | 'hard' | 'adversarial';

export type ScenarioCategory =
  | 'single-agent'
  | 'multi-agent-workflow'
  | 'edge-case'
  | 'failure-recovery'
  | 'india-specific'
  | 'client-facing'
  | 'technical'
  | 'compliance'
  | 'performance-under-pressure';

export type ExpectedOutcome = 'pass' | 'fail' | 'partial' | 'flagged';

// ─── Core Interfaces ───────────────────

export interface TrainingScenario {
  /** Unique scenario identifier */
  id: string;
  /** Human-readable scenario name */
  name: string;
  /** Detailed description of the scenario */
  description: string;
  /** Which agent(s) this scenario tests */
  agentNames: AgentName[];
  /** Scenario difficulty level */
  difficulty: ScenarioDifficulty;
  /** Scenario category */
  category: ScenarioCategory;
  /** The task prompt to send to the agent */
  taskPrompt: string;
  /** Optional: Additional context (RAG docs, conversation history, etc.) */
  context?: ScenarioContext;
  /** Expected behaviors and outcomes */
  expectations: ScenarioExpectations;
  /** Scoring rubric specific to this scenario */
  rubric: ScenarioRubric;
  /** Optional: Known failure patterns to watch for */
  knownFailures?: string[];
  /** Tags for filtering and grouping */
  tags: string[];
  /** Estimated execution time in seconds */
  estimatedTimeSeconds: number;
  /** Whether this scenario is critical (must pass for agent to be deployed) */
  isCritical: boolean;
}

export interface ScenarioContext {
  /** Simulated conversation history */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Simulated RAG documents */
  ragDocuments?: Array<{ name: string; content: string }>;
  /** Simulated memory items */
  memoryItems?: Array<{ content: string; category: string; importance: number }>;
  /** Simulated client data */
  clientData?: Record<string, unknown>;
  /** Simulated project constraints */
  constraints?: {
    budget?: number;
    deadline?: string;
    teamSize?: number;
    techStack?: string[];
  };
}

export interface ScenarioExpectations {
  /** Must contain these keywords/phrases */
  mustContain?: string[];
  /** Must NOT contain these keywords/phrases */
  mustNotContain?: string[];
  /** Minimum word count */
  minWordCount?: number;
  /** Maximum word count (for conciseness) */
  maxWordCount?: number;
  /** Expected structure elements */
  structureChecks?: {
    hasHeaders?: boolean;
    hasBulletPoints?: boolean;
    hasTables?: boolean;
    hasCodeBlocks?: boolean;
    hasPriceInINR?: boolean;
    hasActionItems?: boolean;
    hasNextStep?: boolean;
    hasSources?: boolean;
  };
  /** Minimum scores per evaluation dimension */
  minDimensionScores?: Partial<Record<EvaluationDimension, number>>;
  /** Expected minimum weighted total score */
  minWeightedTotal?: number;
  /** Expected pass/fail outcome */
  expectedOutcome: ExpectedOutcome;
  /** Specific flags that should be detected */
  expectedFlags?: Array<{ type: string; category: string }>;
}

export interface ScenarioRubric {
  /** Description of what a passing score looks like */
  passingDescription: string;
  /** Custom scoring criteria beyond the standard evaluation dimensions */
  customCriteria?: Array<{
    name: string;
    weight: number;
    description: string;
    checkFunction?: (output: string) => boolean;
  }>;
  /** Bonus points for exceptional output */
  bonusPoints?: {
    condition: string;
    points: number;
  }[];
  /** Penalty deductions for common mistakes */
  penalties?: {
    condition: string;
    deduction: number;
  }[];
}

// ─── Scenario Result ───────────────────

export interface ScenarioResult {
  /** Scenario ID */
  scenarioId: string;
  /** Agent name that was tested */
  agentName: AgentName;
  /** The output produced by the agent */
  agentOutput: string;
  /** Whether the scenario passed */
  passed: boolean;
  /** Evaluation scores from the framework */
  evaluationScores: Record<EvaluationDimension, number>;
  /** Weighted total score */
  weightedTotal: number;
  /** Custom rubric scores */
  customScores?: Record<string, number>;
  /** Bonus points earned */
  bonusPointsEarned: number;
  /** Penalty deductions applied */
  penaltyDeductions: number;
  /** Final score after bonuses and penalties */
  finalScore: number;
  /** Content check results */
  contentChecks: {
    mustContainResults: Array<{ term: string; found: boolean }>;
    mustNotContainResults: Array<{ term: string; found: boolean }>;
    structureCheckResults: Record<string, boolean>;
    wordCount: number;
  };
  /** Flags detected during evaluation */
  detectedFlags: string[];
  /** Expected vs actual outcome */
  expectedOutcome: ExpectedOutcome;
  actualOutcome: ExpectedOutcome;
  /** Execution metadata */
  executionTimeMs: number;
  tokenUsage?: { input: number; output: number };
  /** Detailed feedback */
  feedback: string[];
  /** Timestamp */
  executedAt: number;
}

// ─── Batch Result ──────────────────────

export interface BatchScenarioResult {
  /** Batch identifier */
  batchId: string;
  /** Total scenarios in batch */
  totalScenarios: number;
  /** Scenarios that passed */
  passedCount: number;
  /** Scenarios that failed */
  failedCount: number;
  /** Pass rate percentage */
  passRate: number;
  /** Average score across all scenarios */
  averageScore: number;
  /** Per-agent summary */
  agentSummaries: Record<AgentName, {
    totalTests: number;
    passed: number;
    failed: number;
    averageScore: number;
    weakestDimension: EvaluationDimension;
    strongestDimension: EvaluationDimension;
  }>;
  /** Individual results */
  results: ScenarioResult[];
  /** Timestamp */
  executedAt: number;
}
