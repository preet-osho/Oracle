import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateNPS,
  getNPSCategoryLabel,
  getNPSCategoryColor,
  getNPSColor,
  getDimensionLabel,
  getDimensionEmoji,
  getRatingLabel,
  addSatisfactionEntry,
  getSatisfactionEntries,
  getClientSummary,
  getOverallSatisfaction,
} from './satisfaction-tracker';

describe('calculateNPS', () => {
  it('calculates NPS correctly', () => {
    // 3 promoters (9-10), 1 passive (7-8), 1 detractor (0-6)
    const nps = calculateNPS([10, 9, 9, 7, 5]);
    expect(nps.promoters).toBe(3);
    expect(nps.passives).toBe(1);
    expect(nps.detractors).toBe(1);
    expect(nps.score).toBe(40); // (3-1)/5 * 100
  });

  it('returns 0 for empty array', () => {
    const nps = calculateNPS([]);
    expect(nps.score).toBe(0);
    expect(nps.total).toBe(0);
  });

  it('returns 100 for all promoters', () => {
    const nps = calculateNPS([10, 10, 9, 9, 10]);
    expect(nps.score).toBe(100);
  });

  it('returns -100 for all detractors', () => {
    const nps = calculateNPS([0, 1, 2, 3, 6]);
    expect(nps.score).toBe(-100);
  });
});

describe('getNPSCategoryLabel', () => {
  it('returns correct labels', () => {
    expect(getNPSCategoryLabel('promoter')).toBe('Excellent');
    expect(getNPSCategoryLabel('passive')).toBe('Good');
    expect(getNPSCategoryLabel('detractor')).toBe('Needs Improvement');
  });
});

describe('getNPSCategoryColor', () => {
  it('returns correct colors', () => {
    expect(getNPSCategoryColor('promoter')).toBe('var(--oracle-success)');
    expect(getNPSCategoryColor('passive')).toBe('var(--oracle-warning)');
    expect(getNPSCategoryColor('detractor')).toBe('var(--oracle-error)');
  });
});

describe('getNPSColor', () => {
  it('returns success for high NPS', () => {
    expect(getNPSColor(50)).toBe('var(--oracle-success)');
  });

  it('returns warning for neutral NPS', () => {
    expect(getNPSColor(10)).toBe('var(--oracle-warning)');
  });

  it('returns error for negative NPS', () => {
    expect(getNPSColor(-10)).toBe('var(--oracle-error)');
  });
});

describe('getDimensionLabel', () => {
  it('returns correct labels', () => {
    expect(getDimensionLabel('quality')).toBe('Quality of Work');
    expect(getDimensionLabel('communication')).toBe('Communication');
    expect(getDimensionLabel('timeliness')).toBe('Timeliness');
    expect(getDimensionLabel('value')).toBe('Value for Money');
    expect(getDimensionLabel('overall')).toBe('Overall Satisfaction');
  });
});

describe('getDimensionEmoji', () => {
  it('returns emojis', () => {
    expect(getDimensionEmoji('quality')).toBe('⭐');
    expect(getDimensionEmoji('communication')).toBe('💬');
    expect(getDimensionEmoji('timeliness')).toBe('⏰');
  });
});

describe('getRatingLabel', () => {
  it('returns correct labels', () => {
    expect(getRatingLabel(4.5)).toBe('Excellent');
    expect(getRatingLabel(3.5)).toBe('Good');
    expect(getRatingLabel(2.5)).toBe('Average');
    expect(getRatingLabel(1.5)).toBe('Below Average');
    expect(getRatingLabel(0.5)).toBe('Poor');
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('addSatisfactionEntry and getSatisfactionEntries round-trip', () => {
    const entry = addSatisfactionEntry({
      projectId: 'proj-1',
      clientName: 'Acme Corp',
      nps: 9,
      dimension: 'quality',
      rating: 4.5,
      feedback: 'Great work!',
      surveySentAt: Date.now(),
    });
    const entries = getSatisfactionEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].clientName).toBe('Acme Corp');
    expect(entries[0].nps).toBe(9);
  });

  it('getClientSummary computes correctly', () => {
    addSatisfactionEntry({
      projectId: 'proj-1',
      clientName: 'Acme Corp',
      nps: 9,
      dimension: 'quality',
      rating: 5,
      feedback: '',
      surveySentAt: Date.now(),
    });
    addSatisfactionEntry({
      projectId: 'proj-1',
      clientName: 'Acme Corp',
      nps: 8,
      dimension: 'communication',
      rating: 4,
      feedback: '',
      surveySentAt: Date.now(),
    });
    const summary = getClientSummary('Acme Corp');
    expect(summary.totalResponses).toBe(2);
    // Both nps=9 and nps=8 are promoters (>=9) and passives (7-8)
    // 1 promoter + 1 passive = (1-0)/2 * 100 = 50
    expect(summary.overallNPS).toBe(50);
    expect(summary.avgRating).toBe(4.5);
  });

  it('getOverallSatisfaction returns defaults when empty', () => {
    const overall = getOverallSatisfaction();
    expect(overall.totalResponses).toBe(0);
    expect(overall.avgNPS).toBe(0);
  });

  it('getOverallSatisfaction aggregates across clients', () => {
    addSatisfactionEntry({
      projectId: 'proj-1',
      clientName: 'Acme',
      nps: 9,
      dimension: 'quality',
      rating: 5,
      feedback: '',
      surveySentAt: Date.now(),
    });
    addSatisfactionEntry({
      projectId: 'proj-2',
      clientName: 'Beta',
      nps: 5,
      dimension: 'quality',
      rating: 2,
      feedback: '',
      surveySentAt: Date.now(),
    });
    const overall = getOverallSatisfaction();
    expect(overall.totalResponses).toBe(2);
    expect(overall.avgRating).toBe(3.5);
  });
});
