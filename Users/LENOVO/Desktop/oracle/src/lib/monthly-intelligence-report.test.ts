import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMonthlyReport,
  saveReport,
  getReports,
  getLatestReport,
} from './monthly-intelligence-report';

describe('generateMonthlyReport', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a report for the given month', () => {
    const report = generateMonthlyReport('2026-06');
    expect(report.month).toBe('2026-06');
    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.summary).toBeDefined();
    expect(report.learnings).toBeDefined();
    expect(report.recommendations).toBeDefined();
    expect(report.trends).toBeDefined();
  });

  it('report has correct summary structure', () => {
    const report = generateMonthlyReport('2026-06');
    expect(typeof report.summary.totalTasks).toBe('number');
    expect(typeof report.summary.avgQualityScore).toBe('number');
    expect(typeof report.summary.totalCostINR).toBe('number');
    expect(typeof report.summary.totalTokens).toBe('number');
    expect(Array.isArray(report.summary.topProviders)).toBe(true);
  });

  it('report has learnings structure', () => {
    const report = generateMonthlyReport('2026-06');
    expect(typeof report.learnings.totalLearnings).toBe('number');
    expect(Array.isArray(report.learnings.topDomains)).toBe(true);
    expect(Array.isArray(report.learnings.keyInsights)).toBe(true);
    expect(Array.isArray(report.learnings.patternsDetected)).toBe(true);
  });

  it('report has all required sections', () => {
    const report = generateMonthlyReport('2026-06');
    expect(report.id).toContain('report-2026-06');
    expect(report.month).toBe('2026-06');
    expect(typeof report.summary.totalTasks).toBe('number');
    expect(typeof report.summary.totalCostINR).toBe('number');
    expect(typeof report.summary.avgQualityScore).toBe('number');
    expect(Array.isArray(report.learnings.keyInsights)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(Array.isArray(report.trends)).toBe(true);
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveReport and getReports round-trip', () => {
    const report = generateMonthlyReport('2026-06');
    saveReport(report);
    const reports = getReports();
    expect(reports).toHaveLength(1);
    expect(reports[0].month).toBe('2026-06');
  });

  it('saveReport prepends newest first', () => {
    saveReport(generateMonthlyReport('2026-01'));
    saveReport(generateMonthlyReport('2026-06'));
    const reports = getReports();
    expect(reports[0].month).toBe('2026-06');
    expect(reports[1].month).toBe('2026-01');
  });

  it('saveReport caps at 12 reports', () => {
    for (let m = 1; m <= 13; m++) {
      saveReport(generateMonthlyReport(`2025-${String(m).padStart(2, '0')}`));
    }
    const reports = getReports();
    expect(reports).toHaveLength(12);
  });

  it('getLatestReport returns most recent', () => {
    saveReport(generateMonthlyReport('2026-01'));
    saveReport(generateMonthlyReport('2026-06'));
    const latest = getLatestReport();
    expect(latest).not.toBeNull();
    expect(latest!.month).toBe('2026-06');
  });

  it('getLatestReport returns null when empty', () => {
    expect(getLatestReport()).toBeNull();
  });

  it('getReports returns empty when no data', () => {
    expect(getReports()).toEqual([]);
  });
});
