import { describe, it, expect } from 'vitest';
import {
  getAdjacentServices,
  getUpgradeOpportunities,
  SERVICE_BUNDLES,
} from './cross-domain-thinking';

describe('getAdjacentServices', () => {
  it('returns adjacent services for known services', () => {
    const results = getAdjacentServices('website-development');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].primaryService).toBe('website-development');
    expect(results[0].adjacentService).toBeDefined();
    expect(results[0].relevance).toBeGreaterThan(0);
    expect(results[0].rationale).toBeDefined();
  });

  it('returns SEO as top adjacent for website', () => {
    const results = getAdjacentServices('website-development');
    expect(results.some((r) => r.adjacentService === 'SEO')).toBe(true);
  });

  it('returns empty for unknown service', () => {
    const results = getAdjacentServices('nonexistent-service');
    expect(results).toEqual([]);
  });

  it('respects minRelevance filter', () => {
    const results = getAdjacentServices('website-development', 90);
    expect(results.every((r) => r.relevance >= 90)).toBe(true);
  });

  it('returns multiple adjacent services', () => {
    const results = getAdjacentServices('google-ads');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getUpgradeOpportunities', () => {
  it('returns opportunities for active services', () => {
    const results = getUpgradeOpportunities(['website-development']);
    expect(results.length).toBeGreaterThan(0);
  });

  it('excludes already active services', () => {
    const results = getUpgradeOpportunities(['website-development', 'SEO', 'Google Analytics Setup']);
    expect(results.every((r) => !r.adjacentService.includes('SEO'))).toBe(true);
  });

  it('returns max 5 results', () => {
    const results = getUpgradeOpportunities(['website-development', 'google-ads', 'email-marketing']);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('deduplicates results', () => {
    const results = getUpgradeOpportunities(['website-development', 'google-ads']);
    const names = results.map((r) => r.adjacentService);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('SERVICE_BUNDLES', () => {
  it('has at least 3 bundles', () => {
    expect(SERVICE_BUNDLES.length).toBeGreaterThanOrEqual(3);
  });

  it('each bundle has required fields', () => {
    for (const bundle of SERVICE_BUNDLES) {
      expect(bundle.name).toBeDefined();
      expect(bundle.services.length).toBeGreaterThan(0);
      expect(bundle.savings).toBeDefined();
      expect(bundle.description).toBeDefined();
      expect(bundle.priceRange).toBeDefined();
    }
  });
});
