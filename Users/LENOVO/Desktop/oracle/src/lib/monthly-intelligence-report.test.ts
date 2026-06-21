import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMonthlyReport,
  saveReport,
  getReports,
  getLatestReport,
} from './monthly-intelligence-report';

// ─── generateMonthlyReport Tests ───────

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

  // ── With localStorage data ──

  it('aggregates tasks by category from localStorage', () => {
    const tasks = [
      { category: 'seo', timestamp: new Date('2026-06-05').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-10').getTime() },
      { category: 'ads', timestamp: new Date('2026-06-15').getTime() },
    ];
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    expect(report.summary.totalTasks).toBe(3);
    expect(report.summary.tasksByCategory['seo']).toBe(2);
    expect(report.summary.tasksByCategory['ads']).toBe(1);
  });

  it('aggregates provider usage from oracle-router-store', () => {
    const routerStore = {
      state: {
        usageHistory: [
          { provider: 'openai', costINR: 10, inputTokens: 1000, outputTokens: 500, timestamp: new Date('2026-06-05').getTime() },
          { provider: 'openai', costINR: 15, inputTokens: 800, outputTokens: 400, timestamp: new Date('2026-06-10').getTime() },
          { provider: 'anthropic', costINR: 20, inputTokens: 2000, outputTokens: 1000, timestamp: new Date('2026-06-15').getTime() },
        ],
      },
    };
    localStorage.setItem('oracle-router-store', JSON.stringify(routerStore));

    const report = generateMonthlyReport('2026-06');
    expect(report.summary.topProviders).toHaveLength(2);
    expect(report.summary.topProviders[0].provider).toBe('openai');
    expect(report.summary.topProviders[0].usage).toBe(2);
    expect(report.summary.totalCostINR).toBe(45);
    expect(report.summary.totalTokens).toBe(5700);
  });

  it('calculates average quality score from localStorage', () => {
    const quality = [
      { score: 80, timestamp: new Date('2026-06-05').getTime() },
      { score: 90, timestamp: new Date('2026-06-10').getTime() },
      { score: 70, timestamp: new Date('2026-06-15').getTime() },
    ];
    localStorage.setItem('oracle_quality_history', JSON.stringify(quality));

    const report = generateMonthlyReport('2026-06');
    // (80 + 90 + 70) / 3 = 80
    expect(report.summary.avgQualityScore).toBe(80);
  });

  it('filters data to the specified month only', () => {
    const tasks = [
      { category: 'seo', timestamp: new Date('2026-05-15').getTime() }, // different month
      { category: 'ads', timestamp: new Date('2026-06-10').getTime() }, // same month
    ];
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    expect(report.summary.totalTasks).toBe(1);
    expect(report.summary.tasksByCategory['ads']).toBe(1);
    expect(report.summary.tasksByCategory['seo']).toBeUndefined();
  });

  // ── Recommendations engine ──

  it('generates low quality recommendation when avg < 70', () => {
    const quality = [
      { score: 50, timestamp: new Date('2026-06-05').getTime() },
      { score: 60, timestamp: new Date('2026-06-10').getTime() },
    ];
    localStorage.setItem('oracle_quality_history', JSON.stringify(quality));

    const report = generateMonthlyReport('2026-06');
    const lowQualRec = report.recommendations.find((r) => r.includes('below target'));
    expect(lowQualRec).toBeDefined();
  });

  it('generates high quality recommendation when avg >= 90', () => {
    const quality = [
      { score: 95, timestamp: new Date('2026-06-05').getTime() },
      { score: 92, timestamp: new Date('2026-06-10').getTime() },
    ];
    localStorage.setItem('oracle_quality_history', JSON.stringify(quality));

    const report = generateMonthlyReport('2026-06');
    const highQualRec = report.recommendations.find((r) => r.includes('Excellent quality'));
    expect(highQualRec).toBeDefined();
  });

  it('generates cost optimization recommendation when providers have cost', () => {
    const routerStore = {
      state: {
        usageHistory: [
          { provider: 'openai', costINR: 50, inputTokens: 1000, outputTokens: 500, timestamp: new Date('2026-06-05').getTime() },
        ],
      },
    };
    localStorage.setItem('oracle-router-store', JSON.stringify(routerStore));

    const report = generateMonthlyReport('2026-06');
    const costRec = report.recommendations.find((r) => r.includes('free models'));
    expect(costRec).toBeDefined();
    expect(costRec).toContain('openai');
  });

  it('generates diversification recommendation when > 60% in one category', () => {
    const tasks = Array.from({ length: 15 }, (_, i) => ({
      category: i < 12 ? 'seo' : 'ads',
      timestamp: new Date(`2026-06-${String(i + 1).padStart(2, '0')}`).getTime(),
    }));
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    const divRec = report.recommendations.find((r) => r.includes('diversifying'));
    expect(divRec).toBeDefined();
  });

  it('always includes general recommendations', () => {
    const report = generateMonthlyReport('2026-06');
    const weeklyRec = report.recommendations.find((r) => r.includes('weekly quality review'));
    const learningsRec = report.recommendations.find((r) => r.includes('LEARNINGS.md'));
    expect(weeklyRec).toBeDefined();
    expect(learningsRec).toBeDefined();
  });

  it('caps recommendations at 5', () => {
    const quality = [
      { score: 95, timestamp: new Date('2026-06-05').getTime() },
      { score: 92, timestamp: new Date('2026-06-10').getTime() },
    ];
    const routerStore = {
      state: {
        usageHistory: [
          { provider: 'openai', costINR: 50, inputTokens: 1000, outputTokens: 500, timestamp: new Date('2026-06-05').getTime() },
        ],
      },
    };
    const tasks = Array.from({ length: 15 }, (_, i) => ({
      category: i < 12 ? 'seo' : 'ads',
      timestamp: new Date(`2026-06-${String(i + 1).padStart(2, '0')}`).getTime(),
    }));
    localStorage.setItem('oracle_quality_history', JSON.stringify(quality));
    localStorage.setItem('oracle-router-store', JSON.stringify(routerStore));
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    expect(report.recommendations.length).toBeLessThanOrEqual(5);
  });

  // ── Trend detection ──

  it('detects improving quality trend', () => {
    // First half lower, second half higher → improving
    const quality = [
      { score: 90, timestamp: new Date('2026-06-01').getTime() },
      { score: 95, timestamp: new Date('2026-06-02').getTime() },
      { score: 60, timestamp: new Date('2026-06-15').getTime() },
      { score: 55, timestamp: new Date('2026-06-20').getTime() },
    ];
    localStorage.setItem('oracle_quality_history', JSON.stringify(quality));

    const report = generateMonthlyReport('2026-06');
    const improving = report.trends.find((t) => t.trend === 'Improving Quality');
    expect(improving).toBeDefined();
    expect(improving!.impact).toBe('positive');
    expect(improving!.actionRequired).toBe(false);
  });

  it('detects declining quality trend', () => {
    // First half higher, second half lower → declining
    const quality = [
      { score: 55, timestamp: new Date('2026-06-01').getTime() },
      { score: 50, timestamp: new Date('2026-06-02').getTime() },
      { score: 90, timestamp: new Date('2026-06-15').getTime() },
      { score: 95, timestamp: new Date('2026-06-20').getTime() },
    ];
    localStorage.setItem('oracle_quality_history', JSON.stringify(quality));

    const report = generateMonthlyReport('2026-06');
    const declining = report.trends.find((t) => t.trend === 'Declining Quality');
    expect(declining).toBeDefined();
    expect(declining!.impact).toBe('negative');
    expect(declining!.actionRequired).toBe(true);
  });

  it('detects rising cost trend', () => {
    const routerStore = {
      state: {
        usageHistory: [
          { provider: 'openai', costINR: 100, inputTokens: 1000, outputTokens: 500, timestamp: new Date('2026-06-01').getTime() },
          { provider: 'openai', costINR: 150, inputTokens: 1000, outputTokens: 500, timestamp: new Date('2026-06-03').getTime() },
          { provider: 'openai', costINR: 10, inputTokens: 500, outputTokens: 200, timestamp: new Date('2026-06-15').getTime() },
          { provider: 'openai', costINR: 5, inputTokens: 500, outputTokens: 200, timestamp: new Date('2026-06-20').getTime() },
        ],
      },
    };
    localStorage.setItem('oracle-router-store', JSON.stringify(routerStore));

    const report = generateMonthlyReport('2026-06');
    const rising = report.trends.find((t) => t.trend === 'Rising Costs');
    expect(rising).toBeDefined();
    expect(rising!.impact).toBe('negative');
  });

  // ── Pattern detection ──

  it('detects single-category pattern', () => {
    const tasks = [
      { category: 'seo', timestamp: new Date('2026-06-01').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-05').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-10').getTime() },
    ];
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    const singlePattern = report.learnings.patternsDetected.find((p) => p.includes('All tasks'));
    expect(singlePattern).toBeDefined();
  });

  it('detects burst activity pattern', () => {
    const tasks = [
      { category: 'seo', timestamp: new Date('2026-06-01').getTime() },
      { category: 'ads', timestamp: new Date('2026-06-02').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-03').getTime() },
      { category: 'ads', timestamp: new Date('2026-06-04').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-05').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-05').getTime() },
      { category: 'ads', timestamp: new Date('2026-06-05').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-05').getTime() },
    ];
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    const burstPattern = report.learnings.patternsDetected.find((p) => p.includes('Burst activity'));
    expect(burstPattern).toBeDefined();
  });

  it('skips pattern detection with fewer than 3 tasks', () => {
    const tasks = [
      { category: 'seo', timestamp: new Date('2026-06-01').getTime() },
      { category: 'ads', timestamp: new Date('2026-06-02').getTime() },
    ];
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    expect(report.learnings.patternsDetected).toHaveLength(0);
  });

  // ── Key Insights ──

  it('generates task count insight', () => {
    const tasks = [
      { category: 'seo', timestamp: new Date('2026-06-05').getTime() },
      { category: 'ads', timestamp: new Date('2026-06-10').getTime() },
    ];
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    const taskInsight = report.learnings.keyInsights.find((i) => i.includes('2 tasks'));
    expect(taskInsight).toBeDefined();
  });

  it('generates cost per task insight', () => {
    const tasks = [
      { category: 'seo', timestamp: new Date('2026-06-05').getTime() },
      { category: 'ads', timestamp: new Date('2026-06-10').getTime() },
    ];
    const routerStore = {
      state: {
        usageHistory: [
          { provider: 'openai', costINR: 20, inputTokens: 1000, outputTokens: 500, timestamp: new Date('2026-06-05').getTime() },
          { provider: 'openai', costINR: 30, inputTokens: 1000, outputTokens: 500, timestamp: new Date('2026-06-10').getTime() },
        ],
      },
    };
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));
    localStorage.setItem('oracle-router-store', JSON.stringify(routerStore));

    const report = generateMonthlyReport('2026-06');
    const costInsight = report.learnings.keyInsights.find((i) => i.includes('cost per task'));
    expect(costInsight).toBeDefined();
  });

  it('generates high quality insight when avg >= 80', () => {
    const quality = [
      { score: 85, timestamp: new Date('2026-06-05').getTime() },
      { score: 90, timestamp: new Date('2026-06-10').getTime() },
    ];
    localStorage.setItem('oracle_quality_history', JSON.stringify(quality));

    const report = generateMonthlyReport('2026-06');
    const qualityInsight = report.learnings.keyInsights.find((i) => i.includes('client-ready'));
    expect(qualityInsight).toBeDefined();
  });

  it('generates improvement insight when avg 1-79', () => {
    const quality = [
      { score: 60, timestamp: new Date('2026-06-05').getTime() },
      { score: 70, timestamp: new Date('2026-06-10').getTime() },
    ];
    localStorage.setItem('oracle_quality_history', JSON.stringify(quality));

    const report = generateMonthlyReport('2026-06');
    const improveInsight = report.learnings.keyInsights.find((i) => i.includes('Focus on improving'));
    expect(improveInsight).toBeDefined();
  });

  it('sorts top domains by count descending', () => {
    const tasks = [
      { category: 'ads', timestamp: new Date('2026-06-01').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-02').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-03').getTime() },
      { category: 'seo', timestamp: new Date('2026-06-04').getTime() },
      { category: 'design', timestamp: new Date('2026-06-05').getTime() },
    ];
    localStorage.setItem('oracle_task_history', JSON.stringify(tasks));

    const report = generateMonthlyReport('2026-06');
    expect(report.learnings.topDomains[0].domain).toBe('seo');
    expect(report.learnings.topDomains[0].count).toBe(3);
    // Top 5 domains max
    expect(report.learnings.topDomains.length).toBeLessThanOrEqual(5);
  });

  it('handles malformed localStorage data gracefully', () => {
    localStorage.setItem('oracle_task_history', 'not-json');
    localStorage.setItem('oracle_quality_history', 'not-json');
    localStorage.setItem('oracle-router-store', 'not-json');

    const report = generateMonthlyReport('2026-06');
    expect(report.summary.totalTasks).toBe(0);
    expect(report.summary.avgQualityScore).toBe(0);
    expect(report.summary.totalCostINR).toBe(0);
  });
});

// ─── localStorage persistence Tests ────

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

  it('handles malformed report storage gracefully', () => {
    localStorage.setItem('oracle_monthly_reports', 'not-json');
    expect(getReports()).toEqual([]);
  });
});
