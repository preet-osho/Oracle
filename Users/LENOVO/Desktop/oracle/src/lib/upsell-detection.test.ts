import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectUpsellOpportunities,
  getHighestValueSuggestion,
  recordUpsellSuggestion,
  recordUpsellAccepted,
  getUpsellStats,
} from './upsell-detection';

describe('detectUpsellOpportunities', () => {
  it('returns suggestions after code tasks', () => {
    const suggestions = detectUpsellOpportunities('code');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].suggestedService).toBeDefined();
    expect(suggestions[0].conversionProbability).toBeGreaterThan(0);
  });

  it('returns suggestions after ad-copy tasks', () => {
    const suggestions = detectUpsellOpportunities('ad-copy');
    expect(suggestions.some((s) => s.suggestedService === 'Landing Page Optimisation')).toBe(true);
  });

  it('excludes already active services', () => {
    const suggestions = detectUpsellOpportunities('code', ['SEO Setup & Optimisation', 'Analytics & Tracking Setup']);
    const suggestedNames = suggestions.map((s) => s.suggestedService);
    expect(suggestedNames).not.toContain('SEO Setup & Optimisation');
    expect(suggestedNames).not.toContain('Analytics & Tracking Setup');
  });

  it('adds quarterly review for mature projects', () => {
    const suggestions = detectUpsellOpportunities('code', [], 6);
    expect(suggestions.some((s) => s.suggestedService.includes('Quarterly'))).toBe(true);
  });

  it('sorts by conversion probability', () => {
    const suggestions = detectUpsellOpportunities('code');
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].conversionProbability).toBeGreaterThanOrEqual(suggestions[i].conversionProbability);
    }
  });
});

describe('getHighestValueSuggestion', () => {
  it('returns null for empty array', () => {
    expect(getHighestValueSuggestion([])).toBeNull();
  });

  it('returns suggestion with highest probability', () => {
    const suggestions = detectUpsellOpportunities('code');
    const best = getHighestValueSuggestion(suggestions);
    expect(best).not.toBeNull();
    expect(best!.conversionProbability).toBeGreaterThanOrEqual(
      suggestions.every((s) => s.conversionProbability <= best!.conversionProbability) ? 0 : 1
    );
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('recordUpsellSuggestion persists', () => {
    const suggestions = detectUpsellOpportunities('code');
    recordUpsellSuggestion(suggestions[0]);
    const stats = getUpsellStats();
    expect(stats.totalSuggestions).toBe(1);
  });

  it('recordUpsellAccepted marks as accepted', () => {
    const suggestions = detectUpsellOpportunities('code');
    recordUpsellSuggestion(suggestions[0]);
    recordUpsellAccepted(suggestions[0].id);
    const stats = getUpsellStats();
    expect(stats.accepted).toBe(1);
    expect(stats.conversionRate).toBe(100);
  });

  it('getUpsellStats returns defaults when empty', () => {
    const stats = getUpsellStats();
    expect(stats.totalSuggestions).toBe(0);
    expect(stats.accepted).toBe(0);
    expect(stats.conversionRate).toBe(0);
  });
});
