import { describe, it, expect } from 'vitest';
import { DEFAULT_LEAD_TEMPLATES } from './lead-templates';

describe('DEFAULT_LEAD_TEMPLATES', () => {
  it('has exactly 5 templates', () => {
    expect(DEFAULT_LEAD_TEMPLATES).toHaveLength(5);
  });

  it('each template has a unique business name', () => {
    const names = DEFAULT_LEAD_TEMPLATES.map((t) => t.businessName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('each template has all required fields', () => {
    DEFAULT_LEAD_TEMPLATES.forEach((t) => {
      expect(t.businessName).toBeTruthy();
      expect(t.phone).toBeTruthy();
      expect(t.address).toBeTruthy();
      expect(t.city).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.industry).toBeTruthy();
      expect(t.triggerCriterion).toBeTruthy();
      expect(t.notes).toBeTruthy();
      expect(typeof t.rating).toBe('number');
      expect(typeof t.reviewCount).toBe('number');
    });
  });

  it('has valid status values', () => {
    const validStatuses = ['New', 'Contacted', 'Responded', 'Hot', 'Warm', 'Cold', 'Converted', 'Lost'];
    DEFAULT_LEAD_TEMPLATES.forEach((t) => {
      expect(validStatuses).toContain(t.status);
    });
  });

  it('has valid source values', () => {
    const validSources = ['Google Maps', 'Website Audit', 'Funded Startup', 'Social Listening', 'Job Listing', 'Manual'];
    DEFAULT_LEAD_TEMPLATES.forEach((t) => {
      expect(validSources).toContain(t.source);
    });
  });

  it('phone numbers start with +91', () => {
    DEFAULT_LEAD_TEMPLATES.forEach((t) => {
      expect(t.phone).toMatch(/^\+91/);
    });
  });

  it('no template has id, createdAt, or updatedAt fields', () => {
    DEFAULT_LEAD_TEMPLATES.forEach((t) => {
      expect(t).not.toHaveProperty('id');
      expect(t).not.toHaveProperty('createdAt');
      expect(t).not.toHaveProperty('updatedAt');
    });
  });

  it('at least one template has a channel and personalisedMessage', () => {
    const withChannel = DEFAULT_LEAD_TEMPLATES.filter((t) => t.channel && t.personalisedMessage);
    expect(withChannel.length).toBeGreaterThanOrEqual(1);
  });

  it('at least one template has a followUpDate', () => {
    const withFollowUp = DEFAULT_LEAD_TEMPLATES.filter((t) => t.followUpDate);
    expect(withFollowUp.length).toBeGreaterThanOrEqual(1);
  });
});
