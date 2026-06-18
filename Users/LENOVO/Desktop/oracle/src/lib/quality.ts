// ═══════════════════════════════════════
// ORACLE — Response Quality Scoring
// 5-dimension scoring · Auto-analysis · Improvement suggestions
// ═══════════════════════════════════════

import type { QualityScore } from '@/types';
import { QUALITY_PROMPT } from '@/lib/system-prompt';

// ─── Score a Response ──────────────────

export async function scoreResponse(
  responseText: string,
  callAI: (prompt: string) => Promise<string>
): Promise<QualityScore | null> {
  if (!responseText || responseText.length < 50) return null;

  const prompt = `${QUALITY_PROMPT}\n\nResponse to score:\n${responseText.slice(0, 2000)}`;

  try {
    const raw = await callAI(prompt);

    // Try multiple JSON parsing strategies
    let parsed: Record<string, unknown> | null = null;

    // 1. Direct parse
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 2. Strip markdown code fences
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // 3. Extract JSON object from text
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch {
            console.warn('[Quality] Failed to parse JSON from AI response:', match[0].slice(0, 100));
            return null;
          }
        }
      }
    }

    if (!parsed) return null;

    // Normalize scores from the response
    const completeness = extractScore(parsed, 'completeness', 25);
    const specificity = extractScore(parsed, 'specificity', 25);
    const actionability = extractScore(parsed, 'actionability', 25);
    const indiaContext = extractScore(parsed, 'indiaContext', 15);
    const clientReady = extractScore(parsed, 'clientReady', 10);

    const total = completeness.score + specificity.score + actionability.score + indiaContext.score + clientReady.score;

    const notes = extractNote(parsed, 'overallNotes') ||
      `${completeness.note} ${specificity.note} ${actionability.note}`.trim();

    return {
      completeness: completeness.score,
      specificity: specificity.score,
      actionability: actionability.score,
      indiaContext: indiaContext.score,
      clientReady: clientReady.score,
      total,
      notes,
      scoredAt: Date.now(),
    };
  } catch (e) {
    console.warn('[Quality] Failed to score response:', e);
    return null;
  }
}

// ─── Extract Score from Parsed JSON ────

function extractScore(
  obj: Record<string, unknown>,
  key: string,
  max: number
): { score: number; note: string } {
  const val = obj[key];
  if (val && typeof val === 'object' && val !== null) {
    const v = val as Record<string, unknown>;
    return {
      score: Math.min(max, Math.max(0, Number(v.score) || 0)),
      note: String(v.note || v.notes || '').slice(0, 200),
    };
  }
  if (typeof val === 'number') {
    return { score: Math.min(max, Math.max(0, val)), note: '' };
  }
  return { score: 0, note: '' };
}

function extractNote(obj: Record<string, unknown>, key: string): string {
  const val = obj[key];
  return typeof val === 'string' ? val : '';
}

// ─── Score Display Helpers ─────────────

export function getScoreColor(total: number): string {
  if (total >= 80) return 'var(--oracle-success)';
  if (total >= 60) return 'var(--oracle-warning)';
  return 'var(--oracle-error)';
}

export function getScoreLabel(total: number): string {
  if (total >= 80) return 'Excellent';
  if (total >= 60) return 'Good';
  if (total >= 40) return 'Needs Work';
  return 'Poor';
}

/** Grades aligned with labels: A+/A = Excellent, B+/B = Good, C = Needs Work, D/F = Poor */
export function getScoreGrade(total: number): string {
  if (total >= 90) return 'A+';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B+';
  if (total >= 60) return 'B';
  if (total >= 40) return 'C';
  if (total >= 20) return 'D';
  return 'F';
}

// ─── Quality Analysis ──────────────────

export interface QualityAnalysis {
  averageScore: number;
  bestScore: number;
  worstScore: number;
  totalScored: number;
  weakestDimension: string;
  strongestDimension: string;
  dimensionAverages: {
    completeness: number;
    specificity: number;
    actionability: number;
    indiaContext: number;
    clientReady: number;
  };
  trend: 'improving' | 'declining' | 'stable';
  suggestions: string[];
}

export function analyzeQualityScores(scores: QualityScore[]): QualityAnalysis {
  if (scores.length === 0) {
    return {
      averageScore: 0,
      bestScore: 0,
      worstScore: 0,
      totalScored: 0,
      weakestDimension: 'completeness',
      strongestDimension: 'completeness',
      dimensionAverages: { completeness: 0, specificity: 0, actionability: 0, indiaContext: 0, clientReady: 0 },
      trend: 'stable',
      suggestions: ['No scores yet. Start scoring responses to get insights.'],
    };
  }

  const totalScored = scores.length;
  const totalScores = scores.map((s) => s.total);
  const averageScore = totalScores.reduce((a, b) => a + b, 0) / totalScored;
  const bestScore = Math.max(...totalScores);
  const worstScore = Math.min(...totalScores);

  // Dimension averages
  const dimensionAverages = {
    completeness: scores.reduce((a, s) => a + s.completeness, 0) / totalScored,
    specificity: scores.reduce((a, s) => a + s.specificity, 0) / totalScored,
    actionability: scores.reduce((a, s) => a + s.actionability, 0) / totalScored,
    indiaContext: scores.reduce((a, s) => a + s.indiaContext, 0) / totalScored,
    clientReady: scores.reduce((a, s) => a + s.clientReady, 0) / totalScored,
  };

  // Find weakest and strongest
  const dims = Object.entries(dimensionAverages) as [string, number][];
  dims.sort((a, b) => a[1] - b[1]);
  const weakestDimension = dims[0][0];
  const strongestDimension = dims[dims.length - 1][0];

  // Trend analysis: scores are newest-first, so slice(0, mid) = recent, slice(mid) = older
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (totalScored >= 4) {
    const midpoint = Math.floor(totalScored / 2);
    const recentScores = scores.slice(0, midpoint); // newest half
    const olderScores = scores.slice(midpoint);       // oldest half
    const recentAvg = recentScores.reduce((a, s) => a + s.total, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((a, s) => a + s.total, 0) / olderScores.length;
    if (recentAvg - olderAvg > 5) trend = 'improving';
    else if (olderAvg - recentAvg > 5) trend = 'declining';
  }

  // Generate suggestions — thresholds at ~60% of each dimension's max
  const suggestions: string[] = [];
  if (dimensionAverages.completeness < 15) suggestions.push('Focus on covering the full scope — deliver complete outputs with no gaps.');
  if (dimensionAverages.specificity < 15) suggestions.push('Be more specific — use real tool names, INR prices, and concrete timelines.');
  if (dimensionAverages.actionability < 15) suggestions.push('Make outputs copy-paste ready — numbered steps, exact commands, no placeholders.');
  if (dimensionAverages.indiaContext < 9) suggestions.push('Add more India context — INR pricing, Indian platforms, local events, Hinglish where appropriate.');
  if (dimensionAverages.clientReady < 6) suggestions.push('Polish formatting — every response should be professional enough for a ₹50,000+ client.');

  return {
    averageScore: Math.round(averageScore),
    bestScore,
    worstScore,
    totalScored,
    weakestDimension,
    strongestDimension,
    dimensionAverages,
    trend,
    suggestions,
  };
}

// ─── Persist Quality Scores ────────────

const QUALITY_STORAGE_KEY = 'oracle_quality_scores';

export function loadQualityScores(): QualityScore[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUALITY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QualityScore[];
  } catch (e) {
    console.warn('[Quality] Failed to load quality scores from localStorage:', e);
    return [];
  }
}

export function saveQualityScore(score: QualityScore): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadQualityScores();
    const updated = [score, ...existing].slice(0, 200); // Keep last 200
    localStorage.setItem(QUALITY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[Quality] Failed to save quality score to localStorage:', e);
  }
}

export function getRecentScores(count: number = 10): QualityScore[] {
  return loadQualityScores().slice(0, count);
}
