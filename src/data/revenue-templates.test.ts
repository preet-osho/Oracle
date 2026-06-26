import { describe, it, expect } from 'vitest';
import { DEFAULT_REVENUE_TEMPLATES } from './revenue-templates';

describe('DEFAULT_REVENUE_TEMPLATES', () => {
  it('has exactly 9 templates', () => {
    expect(DEFAULT_REVENUE_TEMPLATES).toHaveLength(9);
  });

  it('each template has a unique name', () => {
    const names = DEFAULT_REVENUE_TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('each template has all required fields', () => {
    DEFAULT_REVENUE_TEMPLATES.forEach((t) => {
      expect(t.name).toBeTruthy();
      expect(t.type).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.status).toBeTruthy();
      expect(t.effort).toBeTruthy();
      expect(t.timeline).toBeTruthy();
      expect(t.notes).toBeTruthy();
      expect(typeof t.monthlyProjection).toBe('number');
      expect(typeof t.annualProjection).toBe('number');
      expect(typeof t.margin).toBe('number');
      expect(Array.isArray(t.tools)).toBe(true);
      expect(t.tools.length).toBeGreaterThan(0);
    });
  });

  it('has valid status values', () => {
    const validStatuses = ['Active', 'Planning', 'Building', 'Paused'];
    DEFAULT_REVENUE_TEMPLATES.forEach((t) => {
      expect(validStatuses).toContain(t.status);
    });
  });

  it('has valid type values', () => {
    const validTypes = ['Service', 'Product', 'Retainer', 'Affiliate', 'SaaS'];
    DEFAULT_REVENUE_TEMPLATES.forEach((t) => {
      expect(validTypes).toContain(t.type);
    });
  });

  it('has valid effort values', () => {
    const validEfforts = ['Low', 'Medium', 'High'];
    DEFAULT_REVENUE_TEMPLATES.forEach((t) => {
      expect(validEfforts).toContain(t.effort);
    });
  });

  it('annualProjection equals monthlyProjection * 12', () => {
    DEFAULT_REVENUE_TEMPLATES.forEach((t) => {
      expect(t.annualProjection).toBe(t.monthlyProjection * 12);
    });
  });

  it('margin is between 0 and 100', () => {
    DEFAULT_REVENUE_TEMPLATES.forEach((t) => {
      expect(t.margin).toBeGreaterThanOrEqual(0);
      expect(t.margin).toBeLessThanOrEqual(100);
    });
  });

  it('no template has id or createdAt fields', () => {
    DEFAULT_REVENUE_TEMPLATES.forEach((t) => {
      expect(t).not.toHaveProperty('id');
      expect(t).not.toHaveProperty('createdAt');
    });
  });
});
