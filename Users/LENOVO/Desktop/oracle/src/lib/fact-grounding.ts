// ═══════════════════════════════════════
// ORACLE — Fact Grounding Engine
// Cross-references AI claims against provided context (documents, search, memory)
// ═══════════════════════════════════════

import type { GroundedClaim, UngroundedClaim } from '@/types';

// ─── Fact Grounding Pipeline ───────────

export interface GroundingResult {
  groundedClaims: GroundedClaim[];
  ungroundedClaims: UngroundedClaim[];
  groundingScore: number; // 0-100
  summary: string;
}

/**
 * Ground claims from AI output against provided context sources.
 * Returns which claims are supported and which are unsupported.
 */
export function groundFacts(
  outputText: string,
  context: {
    documentChunks?: string[];
    searchResults?: Array<{ title: string; url: string; snippet: string }>;
    memory?: Array<{ content: string; category: string }>;
    clientFacts?: Record<string, unknown>;
  }
): GroundingResult {
  const claims = extractFactualClaims(outputText);
  const groundedClaims: GroundedClaim[] = [];
  const ungroundedClaims: UngroundedClaim[] = [];

  // Build a unified context index
  const contextEntries: Array<{ text: string; source: string; sourceType: GroundedClaim['sourceType'] }> = [];

  if (context.documentChunks) {
    for (const chunk of context.documentChunks) {
      contextEntries.push({ text: chunk, source: 'Knowledge Document', sourceType: 'knowledge_doc' });
    }
  }

  if (context.searchResults) {
    for (const result of context.searchResults) {
      contextEntries.push({
        text: `${result.title} ${result.snippet}`,
        source: result.url,
        sourceType: 'web_search',
      });
    }
  }

  if (context.memory) {
    for (const mem of context.memory) {
      contextEntries.push({
        text: mem.content,
        source: `Memory (${mem.category})`,
        sourceType: 'memory',
      });
    }
  }

  // Ground each claim
  for (const claim of claims) {
    const result = groundClaim(claim, contextEntries);

    if (result.score >= 40) {
      groundedClaims.push({
        claim: claim.text,
        source: result.bestSource,
        confidence: Math.min(95, Math.round(result.score)),
        sourceType: result.bestSourceType,
      });
    } else {
      ungroundedClaims.push({
        claim: claim.text,
        confidence: Math.max(5, Math.round(100 - result.score)),
        reason: result.bestScore > 0
          ? `Weak match (${Math.round(result.score)}%) with context`
          : 'No matching context found',
        suggestion: getSuggestion(claim.type),
      });
    }
  }

  const total = groundedClaims.length + ungroundedClaims.length;
  const groundingScore = total > 0 ? Math.round((groundedClaims.length / total) * 100) : 100;

  const summary = generateSummary(groundedClaims, ungroundedClaims, groundingScore);

  return {
    groundedClaims,
    ungroundedClaims,
    groundingScore,
    summary,
  };
}

// ─── Claim Extraction ──────────────────

interface ExtractedClaim {
  text: string;
  type: 'quantitative' | 'qualitative' | 'comparative' | 'temporal' | 'causal';
}

function extractFactualClaims(text: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 15);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();

    // Skip non-claims
    if (trimmed.startsWith('#') || trimmed.startsWith('```')) continue;
    if (/^(?:how|what|why|when|where|who|which|do|does|should|can|could|would|will|please)/i.test(trimmed)) continue;
    if (/^(?:install|run|use|create|set|add|remove|delete|import|export)/i.test(trimmed)) continue;

    // Classify claim type
    let type: ExtractedClaim['type'] = 'qualitative';
    if (/\d+%|₹[\d,]+|\$\d+|\d+\s*(?:x|times)/i.test(trimmed)) type = 'quantitative';
    if (/\b(more|less|better|worse|faster|higher|lower|greater|fewer)\b/i.test(trimmed)) type = 'comparative';
    if (/\b(before|after|during|since|until|by \d{4}|in \d{4})\b/i.test(trimmed)) type = 'temporal';
    if (/\b(because|therefore|thus|consequently|leads to|causes|results in)\b/i.test(trimmed)) type = 'causal';

    claims.push({ text: trimmed, type });
  }

  return claims.slice(0, 15); // Limit for performance
}

// ─── Claim Grounding ───────────────────

function groundClaim(
  claim: ExtractedClaim,
  contextEntries: Array<{ text: string; source: string; sourceType: GroundedClaim['sourceType'] }>
): { score: number; bestSource: string; bestSourceType: GroundedClaim['sourceType']; bestScore: number } {
  const claimTokens = tokenize(claim.text);
  let bestScore = 0;
  let bestSource = 'General knowledge';
  let bestSourceType: GroundedClaim['sourceType'] = 'context';

  for (const entry of contextEntries) {
    const entryTokens = tokenize(entry.text);
    const score = computeSimilarity(claimTokens, entryTokens);

    if (score > bestScore) {
      bestScore = score;
      bestSource = entry.source;
      bestSourceType = entry.sourceType;
    }
  }

  // Quantitative claims need stronger grounding
  if (claim.type === 'quantitative' && bestScore < 60) {
    bestScore *= 0.7; // Penalize ungrounded quantitative claims more
  }

  return { score: bestScore * 100, bestSource, bestSourceType, bestScore: bestScore * 100 };
}

// ─── Similarity Scoring ────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s₹]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function computeSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const bSet = new Set(tokensB);
  let matches = 0;

  for (const token of tokensA) {
    if (bSet.has(token)) {
      matches++;
      // Bonus for longer, more specific tokens
      if (token.length > 5) matches += 0.2;
    }
  }

  // Jaccard-like similarity with length weighting
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union > 0 ? matches / union : 0;

  // Also compute overlap coefficient (how much of A is in B)
  const overlap = matches / tokensA.length;

  // Weighted combination
  return Math.min(1, jaccard * 0.4 + overlap * 0.6);
}

// ─── Suggestions ───────────────────────

function getSuggestion(claimType: ExtractedClaim['type']): string {
  switch (claimType) {
    case 'quantitative':
      return 'Quantitative claims (prices, percentages, counts) need source citations. Add a reference or remove the specific number.';
    case 'comparative':
      return 'Comparative claims need evidence. Add data sources or rephrase as opinions.';
    case 'temporal':
      return 'Temporal claims need verification. Ensure dates and timeframes are current and accurate.';
    case 'causal':
      return 'Causal claims need supporting evidence. Add research citations or rephrase as hypotheses.';
    default:
      return 'Consider adding a source citation or rephrasing as a recommendation rather than a fact.';
  }
}

// ─── Summary Generation ────────────────

function generateSummary(
  grounded: GroundedClaim[],
  ungrounded: UngroundedClaim[],
  score: number
): string {
  const parts: string[] = [];

  if (score >= 80) {
    parts.push('✅ Strong grounding — most claims are supported by provided context.');
  } else if (score >= 60) {
    parts.push('⚠️ Moderate grounding — some claims lack supporting context.');
  } else {
    parts.push('🚨 Weak grounding — many claims could not be verified against provided context.');
  }

  if (ungrounded.length > 0) {
    const quantitative = ungrounded.filter((c) => /₹|[%]|\d{2,}/.test(c.claim)).length;
    if (quantitative > 0) {
      parts.push(`${quantitative} ungrounded quantitative claims (prices/percentages) — verify these numbers.`);
    }
  }

  return parts.join(' ');
}
