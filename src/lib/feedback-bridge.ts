// ═══════════════════════════════════════
// ORACLE — Feedback Bridge
// Connects: hallucination-guard ↔ self-training ↔ model-selector
// Closes the loop: user verdicts → model learning → smarter selection
// ═══════════════════════════════════════

import type { QualityScore } from '@/types';
import { getTrainingEntries } from '@/lib/self-training';
import { getLearningEntries } from '@/lib/hallucination-guard';
import { logAgentPerformance, getBestPerformingModel } from '@/lib/model-selector';
import type { ModelTier } from '@/lib/model-selector';
import { PromptRegistry } from '@/lib/prompt-versioning';

// ─── Types ─────────────────────────────

export interface FeedbackSummary {
  totalVerdicts: number;
  acceptanceRate: number;
  avgConfidenceWhenAccepted: number;
  avgConfidenceWhenRejected: number;
  worstDomains: Array<{ domain: string; rejectionRate: number }>;
  bestModels: Array<{ model: string; acceptanceRate: number; avgQuality: number }>;
  promptRecommendation: string | null;
}

// ─── Wire Quality Score → Self-Training ─

/**
 * Called after quality scoring completes to feed quality into model performance.
 * Does NOT call recordTask — the caller already does that.
 */
export function attachQualityToTraining(
  provider: string,
  model: string,
  agentType: string,
  qualityScore: QualityScore
): void {
  try {
    logAgentPerformance(
      agentType,
      model,
      provider,
      qualityScore.total >= 60,
      qualityScore.total / 100,
      undefined,
      undefined,
      undefined
    );
  } catch {
    // Non-critical — fail silently
  }
}

// ─── Wire Feedback → Model Performance ──

/**
 * Called when user clicks 👍/👎 on a message.
 * Updates model-selector performance data so getBestPerformingModel learns.
 */
export function recordMessageFeedback(
  provider: string,
  model: string,
  agentType: string,
  qualityScore?: QualityScore,
  verdict: 'good' | 'bad' = 'good'
): void {
  try {
    const success = verdict === 'good';
    const quality = qualityScore
      ? qualityScore.total / 100
      : success ? 0.7 : 0.3;

    logAgentPerformance(
      agentType,
      model,
      provider,
      success,
      quality,
      undefined, // latency
      undefined, // tokens
      undefined  // cost
    );
  } catch {
    // Non-critical — fail silently
  }
}

// ─── Wire Verdict → Hallucination Guard ──

/**
 * Called when user clicks Accept/Reject on the hallucination guard confidence badge.
 * Records the learning AND updates model performance.
 */
export function recordGuardVerdict(
  provider: string,
  model: string,
  agentType: string,
  originalOutput: string,
  verdict: 'accepted' | 'rejected',
  confidence: number,
  _domain: string = 'general'
): void {
  try {
    // Update model performance based on guard verdict
    const success = verdict === 'accepted';
    logAgentPerformance(
      agentType,
      model,
      provider,
      success,
      success ? confidence / 100 : (confidence - 30) / 100,
      undefined,
      undefined,
      undefined
    );
  } catch {
    // Non-critical
  }
}

// ─── Aggregate Insights ─────────────────

/**
 * Combines insights from all three systems into a unified feedback summary.
 * Used by the self-training UI panel and model recommendation engine.
 */
export function getFeedbackSummary(): FeedbackSummary {
  // ── Hallucination guard verdicts ──
  const guardEntries = getLearningEntries();
  const totalVerdicts = guardEntries.length;
  const accepted = guardEntries.filter((e) => e.userVerdict === 'accepted');
  const rejected = guardEntries.filter((e) => e.userVerdict !== 'accepted');
  const acceptanceRate = totalVerdicts > 0
    ? Math.round((accepted.length / totalVerdicts) * 100)
    : 0;

  const avgConfidenceWhenAccepted = accepted.length > 0
    ? Math.round(accepted.reduce((s, e) => s + e.confidenceAtCheck, 0) / accepted.length)
    : 0;
  const avgConfidenceWhenRejected = rejected.length > 0
    ? Math.round(rejected.reduce((s, e) => s + e.confidenceAtCheck, 0) / rejected.length)
    : 0;

  // ── Domain rejection rates ──
  const domainCounts = new Map<string, { total: number; rejected: number }>();
  for (const entry of guardEntries) {
    const domain = entry.domain || 'general';
    const current = domainCounts.get(domain) || { total: 0, rejected: 0 };
    current.total++;
    if (entry.userVerdict !== 'accepted') current.rejected++;
    domainCounts.set(domain, current);
  }
  const worstDomains = Array.from(domainCounts.entries())
    .map(([domain, counts]) => ({
      domain,
      rejectionRate: Math.round((counts.rejected / counts.total) * 100),
      total: counts.total,
    }))
    .filter((d) => d.total >= 3) // Need at least 3 data points
    .sort((a, b) => b.rejectionRate - a.rejectionRate)
    .slice(0, 5);

  // ── Model performance from self-training ──
  const trainingEntries = getTrainingEntries();
  const modelStats = new Map<string, { total: number; successful: number; totalQuality: number }>();
  for (const entry of trainingEntries) {
    const key = `${entry.provider}/${entry.model}`;
    const current = modelStats.get(key) || { total: 0, successful: 0, totalQuality: 0 };
    current.total++;
    if (entry.wasSuccessful) current.successful++;
    if (entry.qualityScore) current.totalQuality += entry.qualityScore.total;
    modelStats.set(key, current);
  }
  const bestModels = Array.from(modelStats.entries())
    .filter(([, stats]) => stats.total >= 3)
    .map(([model, stats]) => ({
      model,
      acceptanceRate: Math.round((stats.successful / stats.total) * 100),
      avgQuality: stats.total > 0 ? Math.round(stats.totalQuality / stats.total) : 0,
    }))
    .sort((a, b) => b.avgQuality - a.avgQuality)
    .slice(0, 5);

  // ── Prompt version recommendation ──
  let promptRecommendation: string | null = null;
  if (worstDomains.length > 0 && worstDomains[0].rejectionRate > 50) {
    promptRecommendation = `Domain "${worstDomains[0].domain}" has ${worstDomains[0].rejectionRate}% rejection rate — consider creating a specialised prompt version for this domain.`;
  } else if (acceptanceRate < 60 && totalVerdicts >= 5) {
    promptRecommendation = `Overall acceptance rate is ${acceptanceRate}% — review common rejection patterns to improve prompts.`;
  }

  return {
    totalVerdicts,
    acceptanceRate,
    avgConfidenceWhenAccepted,
    avgConfidenceWhenRejected,
    worstDomains,
    bestModels,
    promptRecommendation,
  };
}

// ─── Smart Model Recommendation ─────────

/**
 * Given an agent type and tier, returns the best model considering
 * both the static agent preferences AND the learned performance data.
 */
export function getRecommendedModel(
  agentRole: string,
  tier: ModelTier,
  availableProviders: string[]
): { providerId: string; modelId: string; reason: string } | null {
  // Check learned performance first
  const learned = getBestPerformingModel(agentRole, tier);
  if (learned && availableProviders.includes(learned.providerId)) {
    return {
      providerId: learned.providerId,
      modelId: learned.modelId,
      reason: `Learned: best performing model for ${agentRole} at ${tier} tier`,
    };
  }

  return null; // Caller should fall back to static preferences
}

// ─── Auto-create Prompt Version for Bad Domains ──

/**
 * If a domain has consistently poor quality, creates a prompt version
 * tag for tracking. Does NOT auto-switch — just flags for review.
 */
export function flagDomainForPromptReview(domain: string, rejectionRate: number): void {
  if (rejectionRate < 60) return;

  try {
    const versions = PromptRegistry.getVersions();
    const tag = `needs-review:${domain}`;

    // Check if we already have a flagged version
    const alreadyFlagged = versions.some((v) => v.tags.includes(tag));
    if (!alreadyFlagged && versions.length > 0) {
      // Tag the current default version for review
      const defaultVersion = versions[0];
      if (!defaultVersion.tags.includes(tag)) {
        defaultVersion.tags.push(tag);
        PromptRegistry.saveVersions(versions);
      }
    }
  } catch {
    // Non-critical
  }
}
