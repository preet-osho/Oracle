import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QualityScore } from '@/types';
import {
  getScoreColor,
  getScoreLabel,
  getScoreGrade,
  analyzeQualityScores,
  scoreResponse,
  loadQualityScores,
  saveQualityScore,
  getRecentScores,
} from './quality';

// ─── Helpers ───

function makeScore(overrides: Partial<QualityScore> = {}): QualityScore {
  return {
    completeness: 20,
    specificity: 18,
    actionability: 15,
    indiaContext: 10,
    clientReady: 7,
    total: 70,
    notes: 'Good response',
    scoredAt: Date.now(),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────

describe('getScoreColor', () => {
  it('returns success color for scores >= 80', () => {
    expect(getScoreColor(80)).toBe('var(--oracle-success)');
    expect(getScoreColor(100)).toBe('var(--oracle-success)');
  });

  it('returns warning color for scores 60-79', () => {
    expect(getScoreColor(60)).toBe('var(--oracle-warning)');
    expect(getScoreColor(79)).toBe('var(--oracle-warning)');
  });

  it('returns error color for scores < 60', () => {
    expect(getScoreColor(0)).toBe('var(--oracle-error)');
    expect(getScoreColor(59)).toBe('var(--oracle-error)');
  });
});

describe('getScoreLabel', () => {
  it('returns correct labels', () => {
    expect(getScoreLabel(85)).toBe('Excellent');
    expect(getScoreLabel(65)).toBe('Good');
    expect(getScoreLabel(45)).toBe('Needs Work');
    expect(getScoreLabel(20)).toBe('Poor');
  });

  it('handles boundary values', () => {
    expect(getScoreLabel(80)).toBe('Excellent');
    expect(getScoreLabel(60)).toBe('Good');
    expect(getScoreLabel(40)).toBe('Needs Work');
    expect(getScoreLabel(0)).toBe('Poor');
  });
});

describe('getScoreGrade', () => {
  it('returns correct grades', () => {
    expect(getScoreGrade(95)).toBe('A+');
    expect(getScoreGrade(90)).toBe('A+');
    expect(getScoreGrade(85)).toBe('A');
    expect(getScoreGrade(80)).toBe('A');
    expect(getScoreGrade(75)).toBe('B+');
    expect(getScoreGrade(65)).toBe('B');
    expect(getScoreGrade(55)).toBe('C');
    expect(getScoreGrade(45)).toBe('C');
    expect(getScoreGrade(30)).toBe('D');
    expect(getScoreGrade(10)).toBe('F');
  });
});

describe('analyzeQualityScores', () => {
  it('returns empty analysis for no scores', () => {
    const result = analyzeQualityScores([]);
    expect(result.totalScored).toBe(0);
    expect(result.averageScore).toBe(0);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toContain('No scores yet');
  });

  it('calculates averages correctly', () => {
    const scores = [
      makeScore({ total: 80, completeness: 25, specificity: 20, actionability: 15, indiaContext: 12, clientReady: 8 }),
      makeScore({ total: 60, completeness: 15, specificity: 15, actionability: 15, indiaContext: 8, clientReady: 7 }),
    ];
    const result = analyzeQualityScores(scores);
    expect(result.totalScored).toBe(2);
    expect(result.averageScore).toBe(70);
    expect(result.bestScore).toBe(80);
    expect(result.worstScore).toBe(60);
  });

  it('identifies weakest and strongest dimensions', () => {
    const scores = [
      makeScore({ completeness: 25, specificity: 10, actionability: 20, indiaContext: 12, clientReady: 8 }),
    ];
    const result = analyzeQualityScores(scores);
    expect(result.strongestDimension).toBe('completeness');
    // clientReady=8 < specificity=10, so clientReady is weakest
    expect(result.weakestDimension).toBe('clientReady');
  });

  it('detects improving trend', () => {
    const scores = [
      makeScore({ total: 90 }),
      makeScore({ total: 85 }),
      makeScore({ total: 60 }),
      makeScore({ total: 55 }),
    ];
    const result = analyzeQualityScores(scores);
    expect(result.trend).toBe('improving');
  });

  it('detects declining trend', () => {
    const scores = [
      makeScore({ total: 50 }),
      makeScore({ total: 55 }),
      makeScore({ total: 80 }),
      makeScore({ total: 85 }),
    ];
    const result = analyzeQualityScores(scores);
    expect(result.trend).toBe('declining');
  });

  it('returns stable for small differences', () => {
    const scores = [
      makeScore({ total: 70 }),
      makeScore({ total: 71 }),
      makeScore({ total: 69 }),
      makeScore({ total: 70 }),
    ];
    const result = analyzeQualityScores(scores);
    expect(result.trend).toBe('stable');
  });

  it('generates suggestions for low dimension scores', () => {
    const scores = [
      makeScore({ completeness: 5, specificity: 5, actionability: 5, indiaContext: 2, clientReady: 1 }),
    ];
    const result = analyzeQualityScores(scores);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(4);
    expect(result.suggestions.some((s) => s.includes('full scope'))).toBe(true);
    expect(result.suggestions.some((s) => s.includes('specific'))).toBe(true);
    expect(result.suggestions.some((s) => s.includes('copy-paste'))).toBe(true);
    expect(result.suggestions.some((s) => s.includes('India'))).toBe(true);
  });

  it('returns empty suggestions for high scores', () => {
    const scores = [
      makeScore({ completeness: 25, specificity: 25, actionability: 25, indiaContext: 15, clientReady: 10 }),
    ];
    const result = analyzeQualityScores(scores);
    expect(result.suggestions).toHaveLength(0);
  });
});

describe('scoreResponse', () => {
  it('returns null for short responses', async () => {
    const result = await scoreResponse('Short', vi.fn());
    expect(result).toBeNull();
  });

  it('returns null for empty responses', async () => {
    const result = await scoreResponse('', vi.fn());
    expect(result).toBeNull();
  });

  it('parses valid JSON from AI response', async () => {
    const mockCallAI = vi.fn().mockResolvedValue(JSON.stringify({
      completeness: { score: 20, note: 'Good coverage' },
      specificity: { score: 18, note: 'Specific' },
      actionability: { score: 15, note: 'Actionable' },
      indiaContext: { score: 10, note: 'India context' },
      clientReady: { score: 8, note: 'Polished' },
      overallNotes: 'Solid response',
    }));

    const result = await scoreResponse('A'.repeat(100), mockCallAI);
    expect(result).not.toBeNull();
    expect(result!.completeness).toBe(20);
    expect(result!.specificity).toBe(18);
    expect(result!.total).toBe(71);
    expect(result!.notes).toBe('Solid response');
  });

  it('parses JSON wrapped in markdown code fences', async () => {
    const mockCallAI = vi.fn().mockResolvedValue('```json\n' + JSON.stringify({
      completeness: 25, specificity: 20, actionability: 15, indiaContext: 10, clientReady: 8,
    }) + '\n```');

    const result = await scoreResponse('A'.repeat(100), mockCallAI);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(78);
  });

  it('extracts JSON from text with surrounding content', async () => {
    const mockCallAI = vi.fn().mockResolvedValue(
      'Here is the score: ' + JSON.stringify({
        completeness: 20, specificity: 18, actionability: 15, indiaContext: 10, clientReady: 7,
      }) + ' Hope this helps!'
    );

    const result = await scoreResponse('A'.repeat(100), mockCallAI);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(70);
  });

  it('returns null for unparseable AI response', async () => {
    const mockCallAI = vi.fn().mockResolvedValue('Not JSON at all');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await scoreResponse('A'.repeat(100), mockCallAI);
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('clamps scores to max values', async () => {
    const mockCallAI = vi.fn().mockResolvedValue(JSON.stringify({
      completeness: { score: 100 },
      specificity: { score: 100 },
      actionability: { score: 100 },
      indiaContext: { score: 100 },
      clientReady: { score: 100 },
    }));

    const result = await scoreResponse('A'.repeat(100), mockCallAI);
    expect(result!.completeness).toBe(25); // clamped to max
    expect(result!.specificity).toBe(25);
    expect(result!.actionability).toBe(25);
    expect(result!.indiaContext).toBe(15);
    expect(result!.clientReady).toBe(10);
  });

  it('handles numeric scores (not objects)', async () => {
    const mockCallAI = vi.fn().mockResolvedValue(JSON.stringify({
      completeness: 20,
      specificity: 18,
      actionability: 15,
      indiaContext: 10,
      clientReady: 8,
    }));

    const result = await scoreResponse('A'.repeat(100), mockCallAI);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(71);
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('loadQualityScores returns empty array when no data', () => {
    expect(loadQualityScores()).toEqual([]);
  });

  it('saveQualityScore persists and loadQualityScores retrieves', () => {
    const score = makeScore({ total: 80 });
    saveQualityScore(score);
    const loaded = loadQualityScores();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].total).toBe(80);
  });

  it('saveQualityScore prepends newest first', () => {
    saveQualityScore(makeScore({ total: 10, notes: 'first' }));
    saveQualityScore(makeScore({ total: 20, notes: 'second' }));
    const loaded = loadQualityScores();
    expect(loaded[0].notes).toBe('second');
    expect(loaded[1].notes).toBe('first');
  });

  it('saveQualityScore caps at 200 entries', () => {
    for (let i = 0; i < 210; i++) {
      saveQualityScore(makeScore({ total: i }));
    }
    const loaded = loadQualityScores();
    expect(loaded).toHaveLength(200);
  });

  it('getRecentScores returns limited count', () => {
    for (let i = 0; i < 10; i++) {
      saveQualityScore(makeScore({ total: i }));
    }
    const recent = getRecentScores(3);
    expect(recent).toHaveLength(3);
  });

  it('getRecentScores defaults to 10', () => {
    for (let i = 0; i < 15; i++) {
      saveQualityScore(makeScore({ total: i }));
    }
    const recent = getRecentScores();
    expect(recent).toHaveLength(10);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('oracle_quality_scores', 'not-json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadQualityScores()).toEqual([]);
    warnSpy.mockRestore();
  });
});
