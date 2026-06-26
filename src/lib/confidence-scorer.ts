// ═══════════════════════════════════════
// ORACLE — Confidence Scoring Engine
// Analyzes AI outputs for hallucination signals and assigns confidence scores
// ═══════════════════════════════════════

import type { ValidationCheck, UngroundedClaim } from '@/types';

// ─── Confidence Signal Patterns ────────

const HEDGING_PATTERNS = [
  /\bI think\b/i,
  /\bI believe\b/i,
  /\bprobably\b/i,
  /\bmaybe\b/i,
  /\bmight\b/i,
  /\bcould be\b/i,
  /\bpossibly\b/i,
  /\bI'm not sure\b/i,
  /\bI don't have access\b/i,
  /\bas far as I know\b/i,
  /\bto my knowledge\b/i,
  /\bgenerally\b/i,
  /\btypically\b/i,
  /\bbelieve\b/i,
  /\bseems like\b/i,
  /\bapproximately\b/i,
];

const HALLUCINATION_INDICATORS = [
  { pattern: /₹\d{1,3}(,\d{2})*\.\d{2}/g, type: 'fake_precision' as const, message: 'Suspiciously precise pricing (with paise) may be fabricated' },
  { pattern: /\b\d{4}\s*(st|nd|rd|th)\b/gi, type: 'fake_date' as const, message: 'Specific ordinal dates may be hallucinated' },
  { pattern: /according to (?:a |the )?(?:recent |new )?(?:study|survey|report|research)\b/gi, type: 'vague_source' as const, message: 'Vague source attribution ("a study") without specific citation' },
  { pattern: /\b(?:Google|Meta|Microsoft|Amazon|Apple)\s+(?:has |reported |confirmed |announced )/gi, type: 'unverified_attribution' as const, message: 'Attribution to major companies without specific source' },
  { pattern: /\b\d{1,3}\.\d{1,2}%\b/g, type: 'precise_stat' as const, message: 'Precise percentages without source attribution may be fabricated' },
  { pattern: /\b(?:exactly|precisely|always|never|every|all|none|100%)\b/gi, type: 'absolutist' as const, message: 'Absolutist language may indicate overconfident claims' },
];

const OVERCONFIDENCE_PATTERNS = [
  /\bguaranteed\b/i,
  /\bwill definitely\b/i,
  /\b100%\b/,
  /\bcertainly\b/i,
  /\bwithout a doubt\b/i,
  /\bproven\b/i,
  /\bthe best\b/i,
  /\bnumber one\b/i,
  /\bunmatched\b/i,
];

// ─── Core Scoring Functions ────────────

export function scoreConfidence(
  text: string,
  contextChunks: string[] = [],
  searchResults: Array<{ title: string; url: string; snippet: string }> = []
): {
  confidence: number;
  checks: ValidationCheck[];
  ungroundedClaims: UngroundedClaim[];
} {
  const checks: ValidationCheck[] = [];
  let totalScore = 100;
  const ungroundedClaims: UngroundedClaim[] = [];

  // 1. HEDGING CHECK (0-20 penalty)
  const hedgingCheck = checkHedging(text);
  checks.push(hedgingCheck);
  totalScore -= hedgingCheck.passed ? 0 : Math.min(20, hedgingCheck.score);

  // 2. HALLUCINATION PATTERN CHECK (0-30 penalty)
  const hallucinationCheck = checkHallucinationPatterns(text);
  checks.push(hallucinationCheck);
  totalScore -= hallucinationCheck.passed ? 0 : Math.min(30, hallucinationCheck.score);

  // 3. OVERCONFIDENCE CHECK (0-15 penalty)
  const overconfidenceCheck = checkOverconfidence(text);
  checks.push(overconfidenceCheck);
  totalScore -= overconfidenceCheck.passed ? 0 : Math.min(15, overconfidenceCheck.score);

  // 4. SOURCE CITATION CHECK (0-20 penalty)
  const citationCheck = checkSourceCitations(text, contextChunks, searchResults);
  checks.push(citationCheck);
  totalScore -= citationCheck.passed ? 0 : Math.min(20, citationCheck.score);

  // 5. SPECIFICITY CHECK (0-15 bonus for high specificity)
  const specificityCheck = checkSpecificity(text);
  checks.push(specificityCheck);
  totalScore += specificityCheck.passed ? 5 : 0;

  // 6. CLAIM GROUNDING CHECK
  const claims = extractClaims(text);
  const grounded = groundClaims(claims, contextChunks, searchResults);
  const ungrounded = grounded.ungrounded;
  ungroundedClaims.push(...ungrounded);

  if (ungrounded.length > 0) {
    const penalty = Math.min(25, ungrounded.length * 5);
    checks.push({
      name: 'claim_grounding',
      passed: ungrounded.length <= 2,
      score: Math.max(0, 100 - penalty * 4),
      message: `${ungrounded.length} claims could not be grounded in provided context`,
      details: ungrounded.map((c) => c.claim).join('; '),
    });
    totalScore -= penalty;
  } else {
    checks.push({
      name: 'claim_grounding',
      passed: true,
      score: 100,
      message: 'All claims could be grounded in provided context or are general knowledge',
    });
  }

  const finalConfidence = Math.max(0, Math.min(100, Math.round(totalScore)));

  return {
    confidence: finalConfidence,
    checks,
    ungroundedClaims,
  };
}

// ─── Individual Checks ─────────────────

function checkHedging(text: string): ValidationCheck {
  const matches = HEDGING_PATTERNS.filter((p) => p.test(text));
  const hedgingCount = matches.length;

  if (hedgingCount === 0) {
    return {
      name: 'hedging_language',
      passed: true,
      score: 100,
      message: 'No hedging language detected — output is direct and confident',
    };
  }

  return {
    name: 'hedging_language',
    passed: hedgingCount <= 2,
    score: Math.max(0, 100 - hedgingCount * 15),
    message: `${hedgingCount} hedging phrase${hedgingCount > 1 ? 's' : ''} detected — may indicate uncertainty`,
    details: matches.slice(0, 3).map((p) => p.source).join(', '),
  };
}

function checkHallucinationPatterns(text: string): ValidationCheck {
  const found: Array<{ type: string; message: string; match: string }> = [];

  for (const indicator of HALLUCINATION_INDICATORS) {
    const matches = text.match(indicator.pattern);
    if (matches) {
      found.push({
        type: indicator.type,
        message: indicator.message,
        match: matches[0],
      });
    }
  }

  if (found.length === 0) {
    return {
      name: 'hallucination_patterns',
      passed: true,
      score: 100,
      message: 'No hallucination signal patterns detected',
    };
  }

  const highSeverity = found.filter((f) =>
    ['fake_precision', 'vague_source', 'unverified_attribution'].includes(f.type)
  ).length;

  return {
    name: 'hallucination_patterns',
    passed: found.length <= 2 && highSeverity === 0,
    score: Math.max(0, 100 - found.length * 20 - highSeverity * 10),
    message: `${found.length} potential hallucination signal${found.length > 1 ? 's' : ''} detected`,
    details: found.map((f) => `${f.type}: "${f.match}" — ${f.message}`).join('\n'),
  };
}

function checkOverconfidence(text: string): ValidationCheck {
  const matches = OVERCONFIDENCE_PATTERNS.filter((p) => p.test(text));
  const count = matches.length;

  if (count === 0) {
    return {
      name: 'overconfidence',
      passed: true,
      score: 100,
      message: 'No overconfident language detected',
    };
  }

  return {
    name: 'overconfidence',
    passed: count <= 1,
    score: Math.max(0, 100 - count * 20),
    message: `${count} overconfident statement${count > 1 ? 's' : ''} detected — may need caveats`,
    details: matches.slice(0, 3).map((p) => p.source).join(', '),
  };
}

function checkSourceCitations(
  text: string,
  contextChunks: string[],
  searchResults: Array<{ title: string; url: string; snippet: string }>
): ValidationCheck {
  const hasUrl = /https?:\/\/[^\s)]+/.test(text);
  const hasSourceRef = /(?:according to|source:|citation:|ref:|from \[|\(from)/i.test(text);
  const hasContextUse = contextChunks.length > 0 && /(?:document|context|reference|attached|knowledge)/i.test(text);
  const hasSearchUse = searchResults.length > 0 && /(?:search|found|online|web)/i.test(text);

  const needsCitation = contextChunks.length > 0 || searchResults.length > 0;
  const hasAnyCitation = hasUrl || hasSourceRef || hasContextUse || hasSearchUse;

  if (!needsCitation) {
    return {
      name: 'source_citations',
      passed: true,
      score: 100,
      message: 'No external context provided — citations not required',
    };
  }

  if (hasAnyCitation) {
    return {
      name: 'source_citations',
      passed: true,
      score: 90,
      message: 'Source references detected in output',
    };
  }

  return {
    name: 'source_citations',
      passed: false,
      score: 40,
      message: 'External context was provided but output contains no source citations',
      details: 'Output should reference provided documents or search results',
  };
}

function checkSpecificity(text: string): ValidationCheck {
  // Check for specific tool names, prices, timelines
  const hasToolNames = /(?:Next\.js|React|Google Analytics|Screaming Frog|Ahrefs|SEMrush|Vercel|Supabase|Figma|Canva|HubSpot|Mailchimp|Zapier|n8n|VAPI|ElevenLabs)/i.test(text);
  const hasINR = /₹[\d,]+/.test(text);
  const hasTimeframes = /\b(?:\d+\s*(?:days?|weeks?|months?|hours?))\b/i.test(text);
  const hasNumbers = /\b\d+\b/.test(text);

  let specificityScore = 50;
  if (hasToolNames) specificityScore += 15;
  if (hasINR) specificityScore += 15;
  if (hasTimeframes) specificityScore += 10;
  if (hasNumbers) specificityScore += 10;

  return {
    name: 'specificity',
    passed: specificityScore >= 70,
    score: specificityScore,
    message: specificityScore >= 70
      ? 'Output contains specific, actionable details'
      : 'Output may be too generic — consider adding specific tools, prices, or timelines',
  };
}

// ─── Claim Extraction & Grounding ──────

function extractClaims(text: string): string[] {
  const claims: string[] = [];

  // Extract sentences that make assertions
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    // Skip headings, code blocks, and very short fragments
    if (trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed.length < 15) continue;
    // Skip sentences that are clearly instructions or questions
    if (/^(?:how|what|why|when|where|who|which|do|does|don't|should|can|could|would|will|please|run|use|install|create|set|add|remove|delete)/i.test(trimmed)) continue;
    claims.push(trimmed);
  }

  return claims.slice(0, 20); // Limit to prevent performance issues
}

function groundClaims(
  claims: string[],
  contextChunks: string[],
  searchResults: Array<{ title: string; url: string; snippet: string }>
): { grounded: Array<{ claim: string; source: string; confidence: number }>; ungrounded: UngroundedClaim[] } {
  const grounded: Array<{ claim: string; source: string; confidence: number }> = [];
  const ungrounded: UngroundedClaim[] = [];

  const allContext = [
    ...contextChunks.map((c) => c.toLowerCase()),
    ...searchResults.map((r) => `${r.title} ${r.snippet}`.toLowerCase()),
  ];

  for (const claim of claims) {
    const claimLower = claim.toLowerCase();
    const claimWords = tokenizeSimple(claimLower);

    let bestScore = 0;
    let bestSource = '';

    for (const ctx of allContext) {
      const ctxWords = tokenizeSimple(ctx);
      let matchCount = 0;
      for (const word of claimWords) {
        if (word.length > 3 && ctxWords.includes(word)) {
          matchCount++;
        }
      }
      const score = claimWords.length > 0 ? (matchCount / claimWords.length) * 100 : 0;
      if (score > bestScore) {
        bestScore = score;
        bestSource = ctx.slice(0, 100);
      }
    }

    if (bestScore >= 30) {
      grounded.push({
        claim: claim.slice(0, 200),
        source: bestSource,
        confidence: Math.min(95, Math.round(bestScore)),
      });
    } else {
      ungrounded.push({
        claim: claim.slice(0, 200),
        confidence: Math.max(5, Math.round(100 - bestScore)),
        reason: bestScore > 0 ? 'Weak context match' : 'No matching context found',
        suggestion: 'Consider adding a source citation or removing the claim',
      });
    }
  }

  return { grounded, ungrounded };
}

function tokenizeSimple(text: string): string[] {
  return text
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}
