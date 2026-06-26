import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { aggregateStats, GuardStatsPanel } from './GuardStatsPanel';
import type { HallucinationCheckResult } from '@/types';
import React from 'react';

// ─── Test Helpers ──────────────────────

function makeResult(overrides: Partial<HallucinationCheckResult> = {}): HallucinationCheckResult {
  return {
    confidence: 75,
    passed: true,
    flagged: false,
    checks: [
      { name: 'hedging_detection', passed: true, score: 80, message: 'No hedging detected' },
      { name: 'overconfidence_check', passed: true, score: 90, message: 'Confidence is appropriate' },
      { name: 'fact_grounding', passed: false, score: 40, message: 'Some claims lack grounding' },
    ],
    hallucinationPatterns: [],
    groundedClaims: [],
    ungroundedClaims: [],
    selfVerification: null,
    suggestions: ['Consider adding more evidence'],
    assessment: 'Response looks generally reliable',
    checkedAt: Date.now(),
    verificationModel: 'test-model',
    ...overrides,
  };
}

function makeGuardResults(entries: Array<{ id: string; result: HallucinationCheckResult }>) {
  const map: Record<string, HallucinationCheckResult> = {};
  for (const { id, result } of entries) {
    map[id] = result;
  }
  return map;
}

// ─── aggregateStats Tests ───────────────

describe('aggregateStats', () => {
  it('returns empty defaults for no results', () => {
    const stats = aggregateStats({});
    expect(stats.totalChecked).toBe(0);
    expect(stats.avgConfidence).toBe(0);
    expect(stats.highConfidence).toBe(0);
    expect(stats.mediumConfidence).toBe(0);
    expect(stats.lowConfidence).toBe(0);
    expect(stats.totalChecks).toBe(0);
    expect(stats.passedChecks).toBe(0);
    expect(stats.failedChecks).toBe(0);
    expect(stats.topFailedChecks).toEqual([]);
    expect(stats.totalSuggestions).toBe(0);
    expect(stats.confidenceTrend).toBe('insufficient');
    expect(stats.trendDelta).toBe(0);
    expect(stats.confidenceHistory).toEqual([]);
  });

  it('computes average confidence correctly', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 80 }) },
      { id: '2', result: makeResult({ confidence: 60 }) },
      { id: '3', result: makeResult({ confidence: 90 }) },
    ]);
    const stats = aggregateStats(results);
    expect(stats.avgConfidence).toBe(77); // round((80+60+90)/3) = 77
  });

  it('counts confidence distribution correctly', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 80 }) },  // high
      { id: '2', result: makeResult({ confidence: 55 }) },  // medium
      { id: '3', result: makeResult({ confidence: 30 }) },  // low
      { id: '4', result: makeResult({ confidence: 70 }) },  // high (>=70)
      { id: '5', result: makeResult({ confidence: 49 }) },  // low (<50)
    ]);
    const stats = aggregateStats(results);
    expect(stats.highConfidence).toBe(2);
    expect(stats.mediumConfidence).toBe(1);
    expect(stats.lowConfidence).toBe(2);
  });

  it('counts passed and failed checks', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({
        checks: [
          { name: 'a', passed: true, score: 90, message: 'Check A passed' },
          { name: 'b', passed: false, score: 30, message: 'Check B failed' },
        ],
      })},
      { id: '2', result: makeResult({
        checks: [
          { name: 'a', passed: true, score: 85, message: 'Check A passed' },
          { name: 'c', passed: false, score: 20, message: 'Check C failed' },
        ],
      })},
    ]);
    const stats = aggregateStats(results);
    expect(stats.totalChecks).toBe(4);
    expect(stats.passedChecks).toBe(2);
    expect(stats.failedChecks).toBe(2);
  });

  it('ranks top failed checks by frequency', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({
        checks: [
          { name: 'fact_grounding', passed: false, score: 30, message: 'Fact grounding failed' },
          { name: 'hedging', passed: false, score: 40, message: 'Hedging detected' },
        ],
      })},
      { id: '2', result: makeResult({
        checks: [
          { name: 'fact_grounding', passed: false, score: 25, message: 'Fact grounding failed' },
          { name: 'overconfidence', passed: false, score: 35, message: 'Overconfidence detected' },
        ],
      })},
      { id: '3', result: makeResult({
        checks: [
          { name: 'fact_grounding', passed: false, score: 20, message: 'Fact grounding failed' },
        ],
      })},
    ]);
    const stats = aggregateStats(results);
    expect(stats.topFailedChecks[0]).toEqual({ name: 'fact_grounding', count: 3 });
    expect(stats.topFailedChecks[1]).toEqual({ name: 'hedging', count: 1 });
    expect(stats.topFailedChecks[2]).toEqual({ name: 'overconfidence', count: 1 });
  });

  it('limits top failed checks to 5', () => {
    const checks = Array.from({ length: 7 }, (_, i) => ({
      name: `check_${i}`, passed: false, score: 20, message: `Check ${i} failed`,
    }));
    const results = makeGuardResults([
      { id: '1', result: makeResult({ checks }) },
    ]);
    const stats = aggregateStats(results);
    expect(stats.topFailedChecks.length).toBe(5);
  });

  it('totals suggestions across all messages', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ suggestions: ['a', 'b'] }) },
      { id: '2', result: makeResult({ suggestions: ['c'] }) },
      { id: '3', result: makeResult({ suggestions: [] }) },
    ]);
    const stats = aggregateStats(results);
    expect(stats.totalSuggestions).toBe(3);
  });

  it('detects improving trend when second half is higher', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 50 }) },
      { id: '2', result: makeResult({ confidence: 50 }) },
      { id: '3', result: makeResult({ confidence: 80 }) },
      { id: '4', result: makeResult({ confidence: 80 }) },
    ]);
    const stats = aggregateStats(results);
    expect(stats.confidenceTrend).toBe('improving');
    expect(stats.trendDelta).toBeGreaterThan(0);
  });

  it('detects declining trend when second half is lower', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 90 }) },
      { id: '2', result: makeResult({ confidence: 90 }) },
      { id: '3', result: makeResult({ confidence: 50 }) },
      { id: '4', result: makeResult({ confidence: 50 }) },
    ]);
    const stats = aggregateStats(results);
    expect(stats.confidenceTrend).toBe('declining');
    expect(stats.trendDelta).toBeLessThan(0);
  });

  it('detects stable trend when delta is within threshold', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 70 }) },
      { id: '2', result: makeResult({ confidence: 72 }) },
    ]);
    const stats = aggregateStats(results);
    expect(stats.confidenceTrend).toBe('stable');
  });

  it('builds confidenceHistory in chronological order', () => {
    const results = makeGuardResults([
      { id: 'a', result: makeResult({ confidence: 60 }) },
      { id: 'b', result: makeResult({ confidence: 75 }) },
      { id: 'c', result: makeResult({ confidence: 90 }) },
    ]);
    const stats = aggregateStats(results);
    expect(stats.confidenceHistory).toEqual([
      { index: 1, confidence: 60 },
      { index: 2, confidence: 75 },
      { index: 3, confidence: 90 },
    ]);
  });

  it('returns insufficient trend for single message', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 80 }) },
    ]);
    const stats = aggregateStats(results);
    expect(stats.confidenceTrend).toBe('insufficient');
    expect(stats.trendDelta).toBe(0);
  });
});

// ─── GuardStatsPanel Rendering Tests ────

describe('GuardStatsPanel', () => {
  it('renders nothing when guardResults is empty', () => {
    const { container } = render(<GuardStatsPanel guardResults={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders collapsed bar with message count', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 80 }) },
      { id: '2', result: makeResult({ confidence: 60 }) },
    ]);
    render(<GuardStatsPanel guardResults={results} />);
    expect(screen.getByText(/2 messages checked/)).toBeDefined();
    expect(screen.getByText(/Guard Stats/)).toBeDefined();
  });

  it('renders singular form for single message', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 80 }) },
    ]);
    render(<GuardStatsPanel guardResults={results} />);
    expect(screen.getByText(/1 message checked/)).toBeDefined();
  });

  it('displays average confidence', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 80 }) },
      { id: '2', result: makeResult({ confidence: 60 }) },
    ]);
    render(<GuardStatsPanel guardResults={results} />);
    expect(screen.getByText('70% avg')).toBeDefined();
  });

  it('shows expanded details on click', async () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 80 }) },
    ]);
    render(<GuardStatsPanel guardResults={results} />);
    const toggle = screen.getByRole('button', { name: /Toggle guard statistics/ });
    fireEvent.click(toggle);
    expect(screen.getByText('Avg Confidence')).toBeDefined();
    expect(screen.getByText('Pass Rate')).toBeDefined();
    expect(screen.getByText('Messages Checked')).toBeDefined();
    expect(screen.getByText('Confidence Distribution')).toBeDefined();
    expect(screen.getByText('Confidence Trend')).toBeDefined();
  });

  it('renders sparkline SVG when expanded', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({ confidence: 80 }) },
      { id: '2', result: makeResult({ confidence: 60 }) },
    ]);
    render(<GuardStatsPanel guardResults={results} />);
    fireEvent.click(screen.getByRole('button', { name: /Toggle guard statistics/ }));
    const svg = screen.getByRole('img', { name: /Confidence trend chart/ });
    expect(svg).toBeDefined();
  });

  it('shows top failed checks when expanded', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({
        checks: [
          { name: 'fact_grounding', passed: false, score: 30, message: 'Fact grounding failed' },
          { name: 'hedging', passed: true, score: 80, message: 'No hedging detected' },
        ],
        suggestions: ['Add sources'],
      })},
    ]);
    render(<GuardStatsPanel guardResults={results} />);
    fireEvent.click(screen.getByRole('button', { name: /Toggle guard statistics/ }));
    expect(screen.getByText(/Most Common Issues/)).toBeDefined();
    expect(screen.getByText(/fact grounding/)).toBeDefined();
    expect(screen.getByText(/1 suggestion flagged/)).toBeDefined();
  });

  it('does not show issues section when all checks pass', () => {
    const results = makeGuardResults([
      { id: '1', result: makeResult({
        checks: [
          { name: 'hedging', passed: true, score: 90, message: 'No hedging detected' },
        ],
        suggestions: [],
      })},
    ]);
    render(<GuardStatsPanel guardResults={results} />);
    fireEvent.click(screen.getByRole('button', { name: /Toggle guard statistics/ }));
    expect(screen.queryByText(/Most Common Issues/)).toBeNull();
    expect(screen.queryByText(/suggestion.*flagged/)).toBeNull();
  });
});
