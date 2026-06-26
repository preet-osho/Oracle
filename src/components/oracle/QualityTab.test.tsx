import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QualityTab } from './QualityTab';
import type { QualityScore } from '@/types';

// ─── Mocks ─────────────────────────────



// Mock quality lib with full inline implementations (no recursion risk)
const mockLoadQualityScores = vi.fn().mockReturnValue([]);
vi.mock('@/lib/quality', () => ({
  loadQualityScores: (...args: unknown[]) => mockLoadQualityScores(...args),
  analyzeQualityScores: (scores: QualityScore[]) => {
    if (scores.length === 0) {
      return {
        averageScore: 0, bestScore: 0, worstScore: 0, totalScored: 0,
        weakestDimension: 'completeness', strongestDimension: 'completeness',
        dimensionAverages: { completeness: 0, specificity: 0, actionability: 0, indiaContext: 0, clientReady: 0 },
        trend: 'stable' as const,
        suggestions: ['No scores yet. Start scoring responses to get insights.'],
      };
    }
    const totalScored = scores.length;
    const totalScores = scores.map((s) => s.total);
    const averageScore = Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScored);
    const bestScore = Math.max(...totalScores);
    const worstScore = Math.min(...totalScores);
    const dimensionAverages = {
      completeness: scores.reduce((a, s) => a + s.completeness, 0) / totalScored,
      specificity: scores.reduce((a, s) => a + s.specificity, 0) / totalScored,
      actionability: scores.reduce((a, s) => a + s.actionability, 0) / totalScored,
      indiaContext: scores.reduce((a, s) => a + s.indiaContext, 0) / totalScored,
      clientReady: scores.reduce((a, s) => a + s.clientReady, 0) / totalScored,
    };
    const dims = Object.entries(dimensionAverages) as [string, number][];
    dims.sort((a, b) => a[1] - b[1]);
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (totalScored >= 4) {
      const midpoint = Math.floor(totalScored / 2);
      const recentScores = scores.slice(0, midpoint);
      const olderScores = scores.slice(midpoint);
      const recentAvg = recentScores.reduce((a, s) => a + s.total, 0) / recentScores.length;
      const olderAvg = olderScores.reduce((a, s) => a + s.total, 0) / olderScores.length;
      if (recentAvg - olderAvg > 3) trend = 'improving';
      else if (olderAvg - recentAvg > 3) trend = 'declining';
    }
    const suggestions: string[] = [];
    if (dimensionAverages.completeness < 15) suggestions.push('Focus on covering the full scope — deliver complete outputs with no gaps.');
    if (dimensionAverages.specificity < 15) suggestions.push('Be more specific — use real tool names, INR prices, and concrete timelines.');
    if (dimensionAverages.actionability < 15) suggestions.push('Make outputs copy-paste ready — numbered steps, exact commands, no placeholders.');
    if (dimensionAverages.indiaContext < 8) suggestions.push('Add more India context — INR pricing, Indian platforms, local events, Hinglish where appropriate.');
    if (dimensionAverages.clientReady < 5) suggestions.push('Polish formatting — every response should be professional enough for a \u20B950,000+ client.');
    return { averageScore, bestScore, worstScore, totalScored, weakestDimension: dims[0][0], strongestDimension: dims[dims.length - 1][0], dimensionAverages, trend, suggestions };
  },
  getScoreColor: (total: number) => total >= 80 ? 'var(--oracle-success)' : total >= 60 ? 'var(--oracle-warning)' : 'var(--oracle-error)',
  getScoreLabel: (total: number) => total >= 80 ? 'Excellent' : total >= 60 ? 'Good' : total >= 40 ? 'Needs Work' : 'Poor',
  getScoreGrade: (total: number) => total >= 90 ? 'A+' : total >= 80 ? 'A' : total >= 70 ? 'B+' : total >= 60 ? 'B' : total >= 50 ? 'C' : total >= 40 ? 'D' : 'F',
}));

// ─── Helpers ───────────────────────────

function makeScore(overrides: Partial<QualityScore> = {}): QualityScore {
  return {
    completeness: 20,
    specificity: 18,
    actionability: 15,
    indiaContext: 10,
    clientReady: 7,
    total: 70,
    notes: 'Good response overall',
    scoredAt: Date.now(),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────

describe('QualityTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLoadQualityScores.mockReturnValue([]);
  });

  // ── Empty State ──

  describe('empty state', () => {
    it('renders the empty state when no scores exist', () => {
      render(<QualityTab />);
      expect(screen.getByText('No Scores Yet')).toBeDefined();
      expect(screen.getByText('✅ Quality Scoring')).toBeDefined();
    });

    it('shows descriptive text in empty state', () => {
      render(<QualityTab />);
      expect(screen.getByText(/Use the Manual Scorer above/)).toBeDefined();
    });

    it('shows stat cards even when empty', () => {
      render(<QualityTab />);
      expect(screen.getByText('Total Scored')).toBeDefined();
      expect(screen.getByText('Average Score')).toBeDefined();
      expect(screen.getByText('Best Score')).toBeDefined();
      expect(screen.getByText('Trend')).toBeDefined();
    });

    it('shows zero for all stats when empty', () => {
      render(<QualityTab />);
      // Both Average Score and Best Score show 0/100 in empty state
      expect(screen.getAllByText('0/100').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
    });

    it('does not show scoring rubric when empty', () => {
      render(<QualityTab />);
      expect(screen.queryByText('Scoring Rubric')).toBeNull();
    });

    it('does not show score history when empty', () => {
      render(<QualityTab />);
      expect(screen.queryByText('Score History')).toBeNull();
    });
  });

  // ── With Data ──

  describe('with score data', () => {
    beforeEach(() => {
      mockLoadQualityScores.mockReturnValue([
        makeScore({ total: 85, completeness: 23, specificity: 22, actionability: 20, indiaContext: 12, clientReady: 8 }),
        makeScore({ total: 72, completeness: 18, specificity: 17, actionability: 18, indiaContext: 10, clientReady: 9 }),
        makeScore({ total: 65, completeness: 16, specificity: 15, actionability: 15, indiaContext: 10, clientReady: 9 }),
        makeScore({ total: 90, completeness: 24, specificity: 23, actionability: 22, indiaContext: 13, clientReady: 8 }),
      ]);
    });

    // ── Stat Cards ──

    it('shows correct total scored count', () => {
      render(<QualityTab />);
      // '4' may appear in multiple places (stat card + rubric)
      expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
    });

    it('shows scoring rubric when data exists', () => {
      render(<QualityTab />);
      expect(screen.getByText('Scoring Rubric')).toBeDefined();
    });

    it('shows analysis section', () => {
      render(<QualityTab />);
      expect(screen.getByText('📈 Analysis')).toBeDefined();
    });

    it('shows score history section', () => {
      render(<QualityTab />);
      // The heading includes an emoji: 📋 Score History
      expect(screen.getByText(/Score History/)).toBeDefined();
    });

    // ── Rubric Dimensions ──

    it('shows all 5 scoring dimensions', () => {
      render(<QualityTab />);
      expect(screen.getByText('Completeness')).toBeDefined();
      expect(screen.getByText('Specificity')).toBeDefined();
      expect(screen.getByText('Actionability')).toBeDefined();
      expect(screen.getByText('India Context')).toBeDefined();
      expect(screen.getByText('Client Ready')).toBeDefined();
    });

    it('shows max points for each dimension', () => {
      render(<QualityTab />);
      expect(screen.getAllByText('25').length).toBeGreaterThanOrEqual(3); // Completeness, Specificity, Actionability
      expect(screen.getByText('15')).toBeDefined(); // India Context
      expect(screen.getByText('10')).toBeDefined(); // Client Ready
    });

    // ── Analysis ──

    it('shows strongest dimension', () => {
      render(<QualityTab />);
      expect(screen.getByText(/Strongest:/)).toBeDefined();
    });

    it('shows focus area (weakest dimension)', () => {
      render(<QualityTab />);
      expect(screen.getByText(/Focus Area:/)).toBeDefined();
    });

    // ── Score History ──

    it('shows numbered score history rows', () => {
      render(<QualityTab />);
      // Should show 4 score rows numbered 1-4
      expect(screen.getAllByText(/\/100/).length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── Trend ──

  describe('trend detection', () => {
    it('shows improving trend when recent scores are higher', () => {
      // analyzeQualityScores uses scores.slice(0, midpoint) as 'recent'
      // and scores.slice(midpoint) as 'older'
      mockLoadQualityScores.mockReturnValue([
        makeScore({ total: 85, scoredAt: Date.now() - 1 * 60 * 60 * 1000 }),
        makeScore({ total: 82, scoredAt: Date.now() - 2 * 60 * 60 * 1000 }),
        makeScore({ total: 50, scoredAt: Date.now() - 3 * 60 * 60 * 1000 }),
        makeScore({ total: 48, scoredAt: Date.now() - 4 * 60 * 60 * 1000 }),
      ]);
      render(<QualityTab />);
      expect(screen.getByText('Trend')).toBeDefined();
      // recent=[85,82] avg=83.5, older=[50,48] avg=49, recent-older > 3 → improving
      expect(screen.getByText('Improving')).toBeDefined();
    });

    it('shows declining trend when recent scores are lower', () => {
      mockLoadQualityScores.mockReturnValue([
        makeScore({ total: 50, scoredAt: Date.now() - 4 * 60 * 60 * 1000 }),
        makeScore({ total: 50, scoredAt: Date.now() - 3 * 60 * 60 * 1000 }),
        makeScore({ total: 80, scoredAt: Date.now() - 2 * 60 * 60 * 1000 }),
        makeScore({ total: 85, scoredAt: Date.now() - 1 * 60 * 60 * 1000 }),
      ]);
      render(<QualityTab />);
      // recent=[50,50] avg=50, older=[80,85] avg=82.5, older-recent > 3 → declining
      expect(screen.getByText('Declining')).toBeDefined();
    });
  });

  // ── Suggestions ──

  describe('suggestions', () => {
    it('shows improvement suggestions when dimensions are low', () => {
      mockLoadQualityScores.mockReturnValue([
        makeScore({ completeness: 10, specificity: 10, actionability: 10, indiaContext: 3, clientReady: 2, total: 35 }),
        makeScore({ completeness: 8, specificity: 12, actionability: 8, indiaContext: 4, clientReady: 3, total: 35 }),
      ]);
      render(<QualityTab />);
      expect(screen.getByText(/Improvement Suggestions/)).toBeDefined();
    });

    it('does not show suggestions when scores are high', () => {
      mockLoadQualityScores.mockReturnValue([
        makeScore({ completeness: 24, specificity: 23, actionability: 22, indiaContext: 14, clientReady: 9, total: 92 }),
        makeScore({ completeness: 22, specificity: 21, actionability: 20, indiaContext: 12, clientReady: 8, total: 83 }),
      ]);
      render(<QualityTab />);
      expect(screen.queryByText(/Improvement Suggestions/)).toBeNull();
    });
  });

  // ── Single Score ──

  describe('single score', () => {
    it('renders correctly with a single score', () => {
      mockLoadQualityScores.mockReturnValue([makeScore({ total: 75 })]);
      render(<QualityTab />);
      // '1' may appear in multiple places (stat card + score history row)
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Scoring Rubric')).toBeDefined();
      expect(screen.getByText(/Score History/)).toBeDefined();
    });
  });
});
