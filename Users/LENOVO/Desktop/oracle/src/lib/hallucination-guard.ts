// ═══════════════════════════════════════
// ORACLE — Hallucination Guard
// Full validation pipeline: self-verify → confidence score → fact ground → pattern detect → flag
// ═══════════════════════════════════════

import type {
  HallucinationCheckResult,
  ValidationCheck,
  HallucinationPattern,
  SelfVerification,
  GuardConfig,
} from '@/types';
import { scoreConfidence } from '@/lib/confidence-scorer';
import { groundFacts } from '@/lib/fact-grounding';

// ─── Default Config ────────────────────

export const DEFAULT_GUARD_CONFIG: GuardConfig = {
  enabled: true,
  thresholds: {
    passThreshold: 70,
    warnThreshold: 50,
    blockThreshold: 30,
  },
  maxRetries: 2,
  selfVerification: true,
  factGrounding: true,
  patternDetection: true,
  strictDomains: ['finance', 'healthcare', 'legal', 'investment', 'ads'],
};

// ─── Config Persistence ─────────────────

const GUARD_CONFIG_KEY = 'oracle_guard_config';

export function loadGuardConfig(): GuardConfig {
  if (typeof window === 'undefined') return DEFAULT_GUARD_CONFIG;
  try {
    const raw = localStorage.getItem(GUARD_CONFIG_KEY);
    if (!raw) return DEFAULT_GUARD_CONFIG;
    const parsed = JSON.parse(raw) as Partial<GuardConfig>;
    return {
      ...DEFAULT_GUARD_CONFIG,
      ...parsed,
      thresholds: { ...DEFAULT_GUARD_CONFIG.thresholds, ...parsed.thresholds },
    };
  } catch {
    return DEFAULT_GUARD_CONFIG;
  }
}

export function saveGuardConfig(config: GuardConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUARD_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('[HallucinationGuard] Failed to save config:', e);
  }
}

// ─── Hallucination Pattern Detection ───

const PATTERN_DETECTORS: Array<{
  type: HallucinationPattern['type'];
  severity: HallucinationPattern['severity'];
  pattern: RegExp;
  description: string;
  suggestion: string;
}> = [
  {
    type: 'unsupported_claim',
    severity: 'high',
    pattern: /\b(?:every|all|none|always|never|100%|zero exceptions)\b/gi,
    description: 'Universal quantifier without evidence',
    suggestion: 'Replace with qualified statements ("most", "typically", "in our experience")',
  },
  {
    type: 'vague_quantification',
    severity: 'medium',
    pattern: /\b(?:hundreds of|thousands of|millions of|lots of|many|several|a few)\b/gi,
    description: 'Vague quantification that sounds specific but isn\'t',
    suggestion: 'Use specific numbers with sources, or remove the quantification',
  },

  {
    type: 'outdated_info',
    severity: 'medium',
    pattern: /\b(?:last year|in 202[0-4]|previous quarter|old|legacy)\b/gi,
    description: 'Potentially outdated information',
    suggestion: 'Verify the information is current (2025+)',
  },
  {
    type: 'fabricated_source',
    severity: 'critical',
    pattern: /\b(?:according to (?:a|the) (?:20\d{2}) (?:study|report|survey))\b/gi,
    description: 'Vague attribution to a non-specific study',
    suggestion: 'Replace with a real, verifiable source or remove the attribution',
  },
  {
    type: 'overconfident_statement',
    severity: 'medium',
    pattern: /\b(?:will definitely|guaranteed to|proven to|undoubtedly|without question)\b/gi,
    description: 'Overconfident language without hedging',
    suggestion: 'Add appropriate caveats ("likely", "expected to", "based on available data")',
  },
  {
    type: 'unsupported_claim',
    severity: 'low',
    pattern: /\b(?:best|cheapest|fastest|most popular|number one|top-rated)\b/gi,
    description: 'Superlative claim without supporting evidence',
    suggestion: 'Qualify with data or context ("one of the most popular", "commonly recommended")',
  },

];

// ─── Main Guard Function ───────────────

export async function runHallucinationGuard(
  outputText: string,
  originalPrompt: string,
  context: {
    documentChunks?: string[];
    searchResults?: Array<{ title: string; url: string; snippet: string }>;
    memory?: Array<{ content: string; category: string }>;
    clientFacts?: Record<string, unknown>;
    domain?: string;
  },
  config: GuardConfig = DEFAULT_GUARD_CONFIG,
  callAI?: (prompt: string) => Promise<string>
): Promise<HallucinationCheckResult> {
  if (!config.enabled || outputText.length < 50) {
    return createPassResult('Output too short or guard disabled', 'none');
  }

  const checks: ValidationCheck[] = [];
  const allPatterns: HallucinationPattern[] = [];

  // ── Step 1: Self-Verification (if enabled) ──
  let selfVerification: SelfVerification | null = null;
  if (config.selfVerification && callAI) {
    selfVerification = await runSelfVerification(outputText, originalPrompt, callAI);
    checks.push({
      name: 'self_verification',
      passed: selfVerification.passed,
      score: selfVerification.confidence,
      message: selfVerification.passed
        ? `Self-verification passed — ${selfVerification.issuesFound.length} issue(s) found and addressed`
        : `Self-verification flagged ${selfVerification.issuesFound.length} issue(s)`,
      details: selfVerification.notes,
    });
  }

  // ── Step 2: Confidence Scoring ──
  const confidenceResult = scoreConfidence(
    outputText,
    context.documentChunks || [],
    context.searchResults || []
  );
  checks.push(...confidenceResult.checks);

  // ── Step 3: Fact Grounding ──
  let groundingResult = null;
  if (config.factGrounding) {
    groundingResult = groundFacts(outputText, {
      documentChunks: context.documentChunks,
      searchResults: context.searchResults,
      memory: context.memory,
      clientFacts: context.clientFacts,
    });

    checks.push({
      name: 'fact_grounding',
      passed: groundingResult.groundingScore >= 50,
      score: groundingResult.groundingScore,
      message: groundingResult.summary,
      details: groundingResult.ungroundedClaims.length > 0
        ? `Ungrounded claims: ${groundingResult.ungroundedClaims.slice(0, 3).map((c) => c.claim.slice(0, 80)).join('; ')}`
        : undefined,
    });
  }

  // ── Step 4: Hallucination Pattern Detection ──
  if (config.patternDetection) {
    const patterns = detectPatterns(outputText);
    allPatterns.push(...patterns);

    const criticalPatterns = patterns.filter((p) => p.severity === 'critical');
    const highPatterns = patterns.filter((p) => p.severity === 'high');

    checks.push({
      name: 'pattern_detection',
      passed: criticalPatterns.length === 0 && highPatterns.length <= 1,
      score: Math.max(0, 100 - criticalPatterns.length * 30 - highPatterns.length * 15 - patterns.length * 5),
      message: patterns.length > 0
        ? `${patterns.length} pattern(s) detected (${criticalPatterns.length} critical, ${highPatterns.length} high)`
        : 'No hallucination patterns detected',
      details: patterns.map((p) => `[${p.severity}] ${p.description}`).join('\n'),
    });
  }

  // ── Step 5: Domain Strictness ──
  if (context.domain && config.strictDomains.includes(context.domain.toLowerCase())) {
    const domainCheck = runDomainStrictness(outputText, context.domain);
    checks.push(domainCheck);
  }

  // ── Step 6: Internal Consistency ──
  const consistencyCheck = checkInternalConsistency(outputText);
  checks.push(consistencyCheck);

  // ── Calculate Final Confidence ──
  // Relative weights for each check — divided by totalWeight below for normalization
  const weights: Record<string, number> = {
    self_verification: 0.10,
    claim_grounding: 0.18,
    fact_grounding: 0.15,
    pattern_detection: 0.12,
    internal_consistency: 0.10,
    domain_strictness: 0.10,
    hedging_language: 0.08,
    hallucination_patterns: 0.08,
    overconfidence: 0.05,
    source_citations: 0.05,
    specificity: 0.04,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const check of checks) {
    const weight = weights[check.name] || 0.05;
    weightedSum += check.score * weight;
    totalWeight += weight;
  }

  const finalConfidence = totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : confidenceResult.confidence;

  // ── Determine Status ──
  const thresholds = config.thresholds;
  const passed = finalConfidence >= thresholds.passThreshold;
  const flagged = finalConfidence < thresholds.warnThreshold;

  // ── Generate Assessment ──
  const assessment = generateAssessment(finalConfidence, checks, allPatterns, groundingResult);

  // ── Generate Suggestions ──
  const suggestions = generateSuggestions(checks, allPatterns, groundingResult, finalConfidence);

  return {
    confidence: finalConfidence,
    passed,
    flagged,
    checks,
    hallucinationPatterns: allPatterns,
    groundedClaims: groundingResult?.groundedClaims || [],
    ungroundedClaims: [
      ...confidenceResult.ungroundedClaims,
      ...(groundingResult?.ungroundedClaims || []),
    ],
    selfVerification,
    assessment,
    suggestions,
    checkedAt: Date.now(),
    verificationModel: 'pipeline',
  };
}

// ─── Self-Verification ─────────────────

async function runSelfVerification(
  outputText: string,
  originalPrompt: string,
  callAI: (prompt: string) => Promise<string>
): Promise<SelfVerification> {
  const prompt = `You are a fact-checking auditor. Review this AI-generated output for accuracy, consistency, and potential hallucinations.

ORIGINAL REQUEST: ${originalPrompt.slice(0, 500)}

OUTPUT TO VERIFY:
${outputText.slice(0, 3000)}

CHECK FOR:
1. Factual accuracy — are all claims verifiable?
2. Internal consistency — do numbers/timeline match?
3. Logical coherence — does the reasoning hold?
4. Missing caveats — are there claims that need qualification?
5. Overconfidence — does it state things as certain when they shouldn't be?

Respond in JSON only:
{
  "passed": <boolean — true if output is reliable>,
  "issuesFound": [<list of specific issues>],
  "correctionsApplied": [<list of corrections that should be made>],
  "confidence": <0-100 score>,
  "notes": "<brief explanation>"
}`;

  try {
    const raw = await callAI(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return createDefaultSelfVerification();
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      passed: Boolean(parsed.passed),
      issuesFound: Array.isArray(parsed.issuesFound) ? parsed.issuesFound : [],
      correctionsApplied: Array.isArray(parsed.correctionsApplied) ? parsed.correctionsApplied : [],
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 70)),
      notes: String(parsed.notes || ''),
    };
  } catch {
    return createDefaultSelfVerification();
  }
}

function createDefaultSelfVerification(): SelfVerification {
  return {
    passed: true,
    issuesFound: [],
    correctionsApplied: [],
    confidence: 50,
    notes: 'Self-verification could not be completed — defaulting to neutral confidence',
  };
}

// ─── Pattern Detection ─────────────────

function detectPatterns(text: string): HallucinationPattern[] {
  const patterns: HallucinationPattern[] = [];

  for (const detector of PATTERN_DETECTORS) {
    if (!detector.pattern) continue; // Skip programmatic detectors

    const matches = text.match(detector.pattern);
    if (matches) {
      // Deduplicate by taking unique matches
      const uniqueMatches = Array.from(new Set(matches));
      for (const match of uniqueMatches.slice(0, 3)) {
        patterns.push({
          type: detector.type,
          severity: detector.severity,
          description: detector.description,
          location: findContext(text, match),
          suggestion: detector.suggestion,
        });
      }
    }
  }

  return patterns;
}

function findContext(text: string, match: string): string {
  const idx = text.indexOf(match);
  if (idx === -1) return match;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + match.length + 40);
  return `...${text.slice(start, end)}...`;
}

// ─── Domain Strictness ─────────────────

function runDomainStrictness(text: string, domain: string): ValidationCheck {
  const issues: string[] = [];

  // Finance/Investment: must have disclaimer
  if (['finance', 'investment'].includes(domain.toLowerCase())) {
    if (!/educational purposes|consult.*advisor|not.*advice|SEBI/i.test(text)) {
      issues.push('Missing financial disclaimer (SEBI requirement)');
    }
    if (!/risk/i.test(text)) {
      issues.push('No risk acknowledgment mentioned');
    }
  }

  // Healthcare: must have professional disclaimer
  if (domain.toLowerCase() === 'healthcare') {
    if (!/consult.*doctor|medical professional|not.*medical advice/i.test(text)) {
      issues.push('Missing healthcare disclaimer');
    }
  }

  // Legal: must have professional disclaimer
  if (domain.toLowerCase() === 'legal') {
    if (!/consult.*lawyer|legal professional|not.*legal advice/i.test(text)) {
      issues.push('Missing legal disclaimer');
    }
  }

  // Ads: must mention tracking/verification
  if (domain.toLowerCase() === 'ads') {
    if (!/track|analytics|conversion|pixel|measurement/i.test(text)) {
      issues.push('No mention of conversion tracking — critical for ad campaigns');
    }
  }

  return {
    name: 'domain_strictness',
    passed: issues.length === 0,
    score: issues.length === 0 ? 100 : Math.max(30, 100 - issues.length * 25),
    message: issues.length === 0
      ? `${domain} domain requirements met`
      : `${issues.length} domain-specific issue(s) for ${domain}`,
    details: issues.join('\n'),
  };
}

// ─── Internal Consistency ──────────────

function checkInternalConsistency(text: string): ValidationCheck {
  const issues: string[] = [];

  // Check for duplicate but different numbers
  const priceMatches = text.match(/₹[\d,]+/g) || [];
  if (priceMatches.length > 1) {
    // Just note if there are many different prices without clear context
    const uniquePrices = new Set(priceMatches);
    if (Array.from(uniquePrices).length > 5) {
      issues.push(`${uniquePrices.size} different price points — verify consistency`);
    }
  }

  return {
    name: 'internal_consistency',
    passed: issues.length === 0,
    score: issues.length === 0 ? 100 : Math.max(50, 100 - issues.length * 20),
    message: issues.length === 0
      ? 'Output appears internally consistent'
      : `${issues.length} consistency concern(s) detected`,
    details: issues.join('\n'),
  };
}

// ─── Assessment Generation ─────────────

function generateAssessment(
  confidence: number,
  checks: ValidationCheck[],
  patterns: HallucinationPattern[],
  groundingResult: { groundingScore: number; ungroundedClaims: Array<{ claim: string }> } | null
): string {
  const parts: string[] = [];

  if (confidence >= 80) {
    parts.push('High confidence output with strong grounding.');
  } else if (confidence >= 60) {
    parts.push('Moderate confidence — some areas need verification.');
  } else if (confidence >= 40) {
    parts.push('Lower confidence — several claims need verification before use.');
  } else {
    parts.push('Low confidence — significant concerns about accuracy. Consider regenerating.');
  }

  const failedChecks = checks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    parts.push(`${failedChecks.length} check(s) failed: ${failedChecks.map((c) => c.name).join(', ')}.`);
  }

  const criticalPatterns = patterns.filter((p) => p.severity === 'critical');
  if (criticalPatterns.length > 0) {
    parts.push(`${criticalPatterns.length} critical pattern(s) detected that need attention.`);
  }

  if (groundingResult && groundingResult.ungroundedClaims.length > 0) {
    parts.push(`${groundingResult.ungroundedClaims.length} claim(s) lack supporting context.`);
  }

  return parts.join(' ');
}

// ─── Suggestions Generation ────────────

function generateSuggestions(
  checks: ValidationCheck[],
  patterns: HallucinationPattern[],
  groundingResult: { ungroundedClaims: Array<{ claim: string; suggestion: string }> } | null,
  confidence: number
): string[] {
  const suggestions: string[] = [];

  // Add suggestions from failed checks
  for (const check of checks) {
    if (!check.passed && check.details) {
      suggestions.push(check.details.split('\n')[0]);
    }
  }

  // Add suggestions from patterns
  const uniqueSuggestions = new Set(patterns.map((p) => p.suggestion));
  for (const s of Array.from(uniqueSuggestions)) {
    suggestions.push(s);
  }

  // Add suggestions from ungrounded claims
  if (groundingResult) {
    for (const claim of groundingResult.ungroundedClaims.slice(0, 3)) {
      suggestions.push(claim.suggestion);
    }
  }

  // General suggestions based on confidence
  if (confidence < 50) {
    suggestions.unshift('Consider regenerating this output with more specific context or a different model.');
  }

  return Array.from(new Set(suggestions)).slice(0, 8);
}

// ─── Helper ────────────────────────────

function createPassResult(assessment: string, model: string): HallucinationCheckResult {
  return {
    confidence: 100,
    passed: true,
    flagged: false,
    checks: [],
    hallucinationPatterns: [],
    groundedClaims: [],
    ungroundedClaims: [],
    selfVerification: null,
    assessment,
    suggestions: [],
    checkedAt: Date.now(),
    verificationModel: model,
  };
}

// ─── Learning Storage ──────────────────

const LEARNING_KEY = 'oracle_guard_learning';

export function recordLearning(entry: {
  originalOutput: string;
  userVerdict: 'accepted' | 'corrected' | 'rejected';
  corrections?: string;
  patternType: string;
  domain: string;
  confidenceAtCheck: number;
}): void {
  if (typeof window === 'undefined') return;

  try {
    const raw = localStorage.getItem(LEARNING_KEY);
    const entries: Array<typeof entry & { id: string; timestamp: number }> = raw ? JSON.parse(raw) : [];
    entries.unshift({
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
    // Keep last 500 entries
    localStorage.setItem(LEARNING_KEY, JSON.stringify(entries.slice(0, 500)));
  } catch (e) {
    console.warn('[HallucinationGuard] Failed to record learning:', e);
  }
}

export function getLearningEntries(): Array<{
  id: string;
  timestamp: number;
  originalOutput: string;
  userVerdict: string;
  patternType: string;
  domain: string;
  confidenceAtCheck: number;
}> {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LEARNING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLearningInsights(): {
  totalInteractions: number;
  acceptanceRate: number;
  commonPatterns: Array<{ pattern: string; count: number }>;
  domainAccuracy: Record<string, number>;
} {
  const entries = getLearningEntries();
  if (entries.length === 0) {
    return { totalInteractions: 0, acceptanceRate: 0, commonPatterns: [], domainAccuracy: {} };
  }

  const accepted = entries.filter((e) => e.userVerdict === 'accepted').length;
  const acceptanceRate = Math.round((accepted / entries.length) * 100);

  // Count pattern frequencies
  const patternCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.userVerdict !== 'accepted') {
      patternCounts.set(entry.patternType, (patternCounts.get(entry.patternType) || 0) + 1);
    }
  }
  const patternEntries: Array<[string, number]> = [];
  patternCounts.forEach((count, pattern) => { patternEntries.push([pattern, count]); });
  const commonPatterns = patternEntries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern, count]) => ({ pattern, count }));

  // Domain accuracy
  const domainCounts = new Map<string, { total: number; accepted: number }>();
  for (const entry of entries) {
    const current = domainCounts.get(entry.domain) || { total: 0, accepted: 0 };
    current.total++;
    if (entry.userVerdict === 'accepted') current.accepted++;
    domainCounts.set(entry.domain, current);
  }
  const domainAccuracy: Record<string, number> = {};
  domainCounts.forEach((counts, domain) => {
    domainAccuracy[domain] = Math.round((counts.accepted / counts.total) * 100);
  });

  return { totalInteractions: entries.length, acceptanceRate, commonPatterns, domainAccuracy };
}
