// ═══════════════════════════════════════
// ORACLE — Evaluation Framework
// Scores all agent outputs across multiple dimensions
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { AGENT_REGISTRY, type AgentName } from '@/lib/agents/registry';

const log = createLogger('EvaluationFramework');

// ─── Types ─────────────────────────────

export type EvaluationDimension =
  | 'accuracy'
  | 'completeness'
  | 'specificity'
  | 'actionability'
  | 'indiaContext'
  | 'clientReadiness'
  | 'professionalism'
  | 'clarity';

export interface EvaluationResult {
  id: string;
  agentName: AgentName;
  taskDescription: string;
  output: string;
  scores: Record<EvaluationDimension, number>;
  weightedTotal: number; // 0-100
  passed: boolean;
  flags: EvaluationFlag[];
  suggestions: string[];
  evaluatedAt: number;
  evaluatorVersion: string;
}

export interface EvaluationFlag {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  location?: string;
}

export interface EvaluationConfig {
  /** Weight for each dimension (must sum to 1) */
  weights: Record<EvaluationDimension, number>;
  /** Minimum score to pass */
  passThreshold: number;
  /** Dimensions that are critical (any below threshold = automatic fail) */
  criticalDimensions: EvaluationDimension[];
  /** Minimum critical dimension score */
  criticalThreshold: number;
}

// ─── Default Config ────────────────────

const DEFAULT_CONFIG: EvaluationConfig = {
  weights: {
    accuracy: 0.20,
    completeness: 0.15,
    specificity: 0.15,
    actionability: 0.15,
    indiaContext: 0.10,
    clientReadiness: 0.10,
    professionalism: 0.08,
    clarity: 0.07,
  },
  passThreshold: 70,
  criticalDimensions: ['accuracy', 'completeness'],
  criticalThreshold: 50,
};

// ─── Evaluation Framework ─────────────

export class EvaluationFramework {
  private config: EvaluationConfig;
  private evaluationHistory: EvaluationResult[] = [];

  constructor(config: Partial<EvaluationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate an agent output
   */
  evaluate(
    agentName: AgentName,
    taskDescription: string,
    output: string,
  ): EvaluationResult {
    const id = `eval_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    log.info('Evaluating agent output', {
      id,
      agentName,
      outputLength: output.length,
    });

    // Score each dimension
    const scores: Record<EvaluationDimension, number> = {
      accuracy: this.scoreAccuracy(output, agentName),
      completeness: this.scoreCompleteness(output, taskDescription),
      specificity: this.scoreSpecificity(output),
      actionability: this.scoreActionability(output),
      indiaContext: this.scoreIndiaContext(output),
      clientReadiness: this.scoreClientReadiness(output),
      professionalism: this.scoreProfessionalism(output),
      clarity: this.scoreClarity(output),
    };

    // Calculate weighted total
    const weightedTotal = this.calculateWeightedTotal(scores);

    // Check for flags
    const flags = this.detectFlags(output, agentName);

    // Generate suggestions
    const suggestions = this.generateSuggestions(scores, flags, agentName);

    // Determine if passed
    const passed = this.determinePassStatus(scores, weightedTotal);

    const result: EvaluationResult = {
      id,
      agentName,
      taskDescription,
      output,
      scores,
      weightedTotal,
      passed,
      flags,
      suggestions,
      evaluatedAt: Date.now(),
      evaluatorVersion: '1.0.0',
    };

    this.evaluationHistory.push(result);

    log.info('Evaluation completed', {
      id,
      weightedTotal,
      passed,
      flagCount: flags.length,
    });

    return result;
  }

  /**
   * Get evaluation history for an agent
   */
  getAgentEvaluations(agentName: AgentName, limit: number = 50): EvaluationResult[] {
    return this.evaluationHistory
      .filter((e) => e.agentName === agentName)
      .sort((a, b) => b.evaluatedAt - a.evaluatedAt)
      .slice(0, limit);
  }

  /**
   * Get aggregate statistics for an agent
   */
  getAgentStats(agentName: AgentName): {
    totalEvaluations: number;
    passRate: number;
    averageScore: number;
    dimensionAverages: Record<EvaluationDimension, number>;
    commonFlags: Array<{ type: string; count: number }>;
  } {
    const evaluations = this.getAgentEvaluations(agentName, 1000);
    const totalEvaluations = evaluations.length;

    if (totalEvaluations === 0) {
      return {
        totalEvaluations: 0,
        passRate: 0,
        averageScore: 0,
        dimensionAverages: {} as Record<EvaluationDimension, number>,
        commonFlags: [],
      };
    }

    const passRate = evaluations.filter((e) => e.passed).length / totalEvaluations * 100;
    const averageScore = evaluations.reduce((sum, e) => sum + e.weightedTotal, 0) / totalEvaluations;

    // Calculate dimension averages
    const dimensionAverages = {} as Record<EvaluationDimension, number>;
    const dimensions: EvaluationDimension[] = [
      'accuracy', 'completeness', 'specificity', 'actionability',
      'indiaContext', 'clientReadiness', 'professionalism', 'clarity',
    ];
    for (const dim of dimensions) {
      dimensionAverages[dim] = evaluations.reduce((sum, e) => sum + e.scores[dim], 0) / totalEvaluations;
    }

    // Count common flags
    const flagCounts = new Map<string, number>();
    for (const eval_ of evaluations) {
      for (const flag of eval_.flags) {
        const key = `${flag.type}:${flag.category}`;
        flagCounts.set(key, (flagCounts.get(key) || 0) + 1);
      }
    }
    const commonFlags = Array.from(flagCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvaluations,
      passRate,
      averageScore,
      dimensionAverages,
      commonFlags,
    };
  }

  // ─── Scoring Methods ────────────────

  private scoreAccuracy(output: string, agentName: AgentName): number {
    let score = 50; // Base score

    // Check for specific, verifiable claims
    const hasNumbers = /\d+/.test(output);
    const hasPercentages = /\d+%/.test(output);
    const hasCurrency = /₹|INR|\$/.test(output);

    if (hasNumbers) score += 10;
    if (hasPercentages) score += 10;
    if (hasCurrency) score += 5;

    // Check for vague language (penalize)
    const vaguePatterns = ['might', 'could', 'possibly', 'generally', 'typically'];
    const vagueCount = vaguePatterns.filter((p) => output.toLowerCase().includes(p)).length;
    score -= vagueCount * 3;

    // Check for confident language (reward)
    const confidentPatterns = ['will', 'must', 'specifically', 'exactly', 'clearly'];
    const confidentCount = confidentPatterns.filter((p) => output.toLowerCase().includes(p)).length;
    score += Math.min(confidentCount * 2, 10);

    // Agent-specific checks
    const agentMeta = AGENT_REGISTRY[agentName];
    if (agentMeta?.category === 'technical' && output.includes('```')) {
      score += 10; // Code blocks for technical agents
    }

    return Math.min(100, Math.max(0, score));
  }

  private scoreCompleteness(output: string, taskDescription: string): number {
    let score = 40; // Base score

    // Check output length relative to task complexity
    const taskWords = taskDescription.split(/\s+/).length;
    const outputWords = output.split(/\s+/).length;
    const ratio = outputWords / Math.max(taskWords, 1);

    if (ratio > 3) score += 15;
    if (ratio > 5) score += 10;
    if (ratio > 10) score += 5;

    // Check for structure
    const hasHeaders = /^#{1,3}\s/m.test(output);
    const hasBulletPoints = /^[-*]\s/m.test(output);
    const hasTables = /\|.*\|/.test(output);

    if (hasHeaders) score += 10;
    if (hasBulletPoints) score += 10;
    if (hasTables) score += 10;

    // Check for completeness markers
    const completenessMarkers = ['next step', 'action item', 'recommendation', 'conclusion'];
    const markerCount = completenessMarkers.filter((m) =>
      output.toLowerCase().includes(m),
    ).length;
    score += markerCount * 3;

    return Math.min(100, Math.max(0, score));
  }

  private scoreSpecificity(output: string): number {
    let score = 40; // Base score

    // Check for specific tools/platforms mentioned
    const specificTools = [
      'Google Ads', 'Meta Ads', 'LinkedIn', 'WhatsApp', 'Razorpay',
      'Screaming Frog', 'Ahrefs', 'Semrush', 'Google Analytics',
      'Canva', 'Figma', 'CapCut', 'DaVinci',
    ];
    const toolsMentioned = specificTools.filter((t) =>
      output.toLowerCase().includes(t.toLowerCase()),
    ).length;
    score += Math.min(toolsMentioned * 5, 20);

    // Check for specific numbers/metrics
    const specificNumbers = output.match(/\d+(\.\d+)?(k|m|%|x|₹|\$)/g) || [];
    score += Math.min(specificNumbers.length * 3, 15);

    // Check for specific timeframes
    const timeframes = ['days', 'weeks', 'months', 'quarters', 'Q1', 'Q2', 'Q3', 'Q4'];
    const timeframesMentioned = timeframes.filter((t) =>
      output.toLowerCase().includes(t.toLowerCase()),
    ).length;
    score += Math.min(timeframesMentioned * 3, 15);

    return Math.min(100, Math.max(0, score));
  }

  private scoreActionability(output: string): number {
    let score = 40; // Base score

    // Check for action verbs
    const actionVerbs = [
      'create', 'build', 'implement', 'optimize', 'launch', 'test',
      'analyze', 'audit', 'fix', 'improve', 'update', 'review',
    ];
    const actionVerbCount = actionVerbs.filter((v) =>
      output.toLowerCase().includes(v),
    ).length;
    score += Math.min(actionVerbCount * 4, 20);

    // Check for numbered steps
    const numberedSteps = output.match(/^\d+\.\s/gm) || [];
    score += Math.min(numberedSteps.length * 3, 15);

    // Check for clear next steps
    const hasNextStep = /next step|action item|immediate|today|this week/i.test(output);
    if (hasNextStep) score += 15;

    // Check for deliverables
    const hasDeliverables = /deliverable|output|document|report|template/i.test(output);
    if (hasDeliverables) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  private scoreIndiaContext(output: string): number {
    let score = 30; // Base score

    // Check for INR pricing
    const hasINR = /₹[\d,]+/.test(output);
    if (hasINR) score += 20;

    // Check for Indian platforms
    const indianPlatforms = [
      'WhatsApp', 'Google Business', 'IndiaMART', 'JustDial',
      'Razorpay', 'PhonePe', 'Paytm', 'Zoho', 'Freshworks',
    ];
    const platformsMentioned = indianPlatforms.filter((p) =>
      output.includes(p),
    ).length;
    score += Math.min(platformsMentioned * 5, 20);

    // Check for Indian context
    const indianContext = [
      'GST', 'INR', 'India', 'Indian', 'Diwali', 'IPL',
      'tier-1', 'tier-2', 'tier-3', 'Hinglish',
    ];
    const contextCount = indianContext.filter((c) =>
      output.toLowerCase().includes(c.toLowerCase()),
    ).length;
    score += Math.min(contextCount * 3, 15);

    // Check for Indian number formatting
    const hasIndianFormatting = /₹\d{1,2},?\d{2},?\d{3}/.test(output);
    if (hasIndianFormatting) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  private scoreClientReadiness(output: string): number {
    let score = 40; // Base score

    // Check for placeholders (penalize)
    const placeholders = /\[INSERT|TODO|TBD|PLACEHOLDER|YOUR_TEXT/gi;
    const placeholderCount = (output.match(placeholders) || []).length;
    score -= placeholderCount * 10;

    // Check for professional formatting
    const hasHeaders = /^#{1,3}\s/m.test(output);
    const hasBold = /\*\*.*\*\*/.test(output);
    const hasTables = /\|.*\|/.test(output);

    if (hasHeaders) score += 10;
    if (hasBold) score += 10;
    if (hasTables) score += 10;

    // Check for client-facing language
    const clientLanguage = [
      'client', 'stakeholder', 'team', 'deliverable', 'proposal',
    ];
    const clientLangCount = clientLanguage.filter((l) =>
      output.toLowerCase().includes(l),
    ).length;
    score += Math.min(clientLangCount * 3, 15);

    return Math.min(100, Math.max(0, score));
  }

  private scoreProfessionalism(output: string): number {
    let score = 50; // Base score

    // Check for casual language (penalize)
    const casualPatterns = ['gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'lol', 'omg'];
    const casualCount = casualPatterns.filter((p) =>
      output.toLowerCase().includes(p),
    ).length;
    score -= casualCount * 10;

    // Check for professional structure
    const hasIntroduction = output.split('\n').length > 5;
    const hasConclusion = /conclusion|summary|in summary|to summarize/i.test(output);

    if (hasIntroduction) score += 10;
    if (hasConclusion) score += 10;

    // Check for complete sentences
    const sentences = output.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    if (avgSentenceLength > 10 && avgSentenceLength < 30) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  private scoreClarity(output: string): number {
    let score = 50; // Base score

    // Check for readability (simple sentences)
    const sentences = output.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;

    if (avgSentenceLength < 20) score += 15;
    else if (avgSentenceLength < 30) score += 10;
    else score -= 5;

    // Check for paragraphs
    const paragraphs = output.split(/\n\n+/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 2) score += 10;

    // Check for bullet points
    const bulletPoints = output.match(/^[-*]\s/gm) || [];
    if (bulletPoints.length > 3) score += 10;

    // Check for code blocks (helps clarity for technical content)
    const codeBlocks = output.match(/```[\s\S]*?```/g) || [];
    if (codeBlocks.length > 0) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  // ─── Helper Methods ─────────────────

  private calculateWeightedTotal(scores: Record<EvaluationDimension, number>): number {
    let total = 0;
    for (const [dim, weight] of Object.entries(this.config.weights)) {
      total += scores[dim as EvaluationDimension] * weight;
    }
    return Math.round(total * 100) / 100;
  }

  private detectFlags(output: string, agentName: AgentName): EvaluationFlag[] {
    const flags: EvaluationFlag[] = [];

    // Check for placeholders
    const placeholders = output.match(/\[INSERT|TODO|TBD|PLACEHOLDER/gi);
    if (placeholders) {
      flags.push({
        type: 'error',
        category: 'completeness',
        message: `Found ${placeholders.length} placeholder(s) in output`,
      });
    }

    // Check for vague language
    const vaguePatterns = ['might', 'could', 'possibly', 'generally', 'typically'];
    const vagueMatches = vaguePatterns.filter((p) => output.toLowerCase().includes(p));
    if (vagueMatches.length > 2) {
      flags.push({
        type: 'warning',
        category: 'specificity',
        message: `Output contains vague language: ${vagueMatches.join(', ')}`,
      });
    }

    // Check for missing INR (for non-technical agents)
    const agentMeta = AGENT_REGISTRY[agentName];
    if (agentMeta?.category !== 'technical' && !/₹|INR/.test(output)) {
      flags.push({
        type: 'warning',
        category: 'indiaContext',
        message: 'No INR pricing found in output',
      });
    }

    // Check for very short output
    if (output.split(/\s+/).length < 50) {
      flags.push({
        type: 'warning',
        category: 'completeness',
        message: 'Output appears very short (< 50 words)',
      });
    }

    // Check for missing structure
    if (!/^#{1,3}\s/m.test(output) && output.split('\n').length > 10) {
      flags.push({
        type: 'info',
        category: 'clarity',
        message: 'Consider adding headers for better structure',
      });
    }

    return flags;
  }

  private generateSuggestions(
    scores: Record<EvaluationDimension, number>,
    flags: EvaluationFlag[],
    agentName: AgentName,
  ): string[] {
    const suggestions: string[] = [];

    // Suggestions based on low scores
    if (scores.accuracy < 60) {
      suggestions.push('Add more specific numbers, percentages, or metrics');
    }
    if (scores.completeness < 60) {
      suggestions.push('Include more sections or expand existing ones');
    }
    if (scores.specificity < 60) {
      suggestions.push('Mention specific tools, platforms, or techniques');
    }
    if (scores.actionability < 60) {
      suggestions.push('Add numbered steps or clear action items');
    }
    if (scores.indiaContext < 60) {
      suggestions.push('Include INR pricing and Indian platform references');
    }
    if (scores.clientReadiness < 60) {
      suggestions.push('Remove placeholders and ensure professional formatting');
    }

    // Suggestions based on flags
    for (const flag of flags) {
      if (flag.type === 'error') {
        suggestions.push(`Fix: ${flag.message}`);
      }
    }

    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  private determinePassStatus(
    scores: Record<EvaluationDimension, number>,
    weightedTotal: number,
  ): boolean {
    // Check critical dimensions
    for (const dim of this.config.criticalDimensions) {
      if (scores[dim] < this.config.criticalThreshold) {
        return false;
      }
    }

    // Check weighted total
    return weightedTotal >= this.config.passThreshold;
  }
}

// ─── Singleton ────────────────────────

let evaluationFrameworkInstance: EvaluationFramework | null = null;

export function getEvaluationFramework(config?: Partial<EvaluationConfig>): EvaluationFramework {
  if (!evaluationFrameworkInstance) {
    evaluationFrameworkInstance = new EvaluationFramework(config);
  }
  return evaluationFrameworkInstance;
}

// ─── Convenience Function ─────────────

export function evaluateAgentOutput(
  agentName: AgentName,
  taskDescription: string,
  output: string,
): EvaluationResult {
  return getEvaluationFramework().evaluate(agentName, taskDescription, output);
}
