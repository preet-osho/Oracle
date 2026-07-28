// ═══════════════════════════════════════
// ORACLE — Failure Detection Tests
// ═══════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FailureDetectionEngine,
  getFailureDetectionEngine,
  detectFailures,
  generateFailureReport,
} from './failure-detection';

let testCounter = 0;

describe('FailureDetectionEngine', () => {
  let engine: FailureDetectionEngine;

  beforeEach(() => {
    testCounter++;
    engine = new FailureDetectionEngine(); // Use new instance to avoid shared state
  });

  describe('detectFailures', () => {
    it('should detect no failures in clean output', () => {
      const output = `
## SEO Analysis

Based on our audit, we found 15 issues that need attention.
The site loads in 3.2 seconds and has 1,250 backlinks.
      `;

      const failures = engine.detectFailures(output, 'seo-specialist', 'SEO audit');

      // Clean output should have no high/critical failures
      expect(failures.filter(f => f.severity === 'critical' || f.severity === 'high').length).toBe(0);
    });

    it('should detect hallucination patterns', () => {
      const output = `
According to a study by Stanford Research Institute, 73% of websites fail.
Research confirms this trend across industries.
Studies have shown that SEO improves rankings.
      `;

      const failures = engine.detectFailures(output, 'seo-specialist', 'Research analysis');

      const hallucinations = failures.filter(f => f.type === 'hallucination');
      expect(hallucinations.length).toBeGreaterThan(0);
    });

    it('should detect overconfident statements', () => {
      const output = `
This strategy will definitely increase your revenue.
There is zero risk in this approach.
You will absolutely see results within 24 hours.
      `;

      const failures = engine.detectFailures(output, 'marketer', 'Strategy');

      const overconfident = failures.filter(f => f.type === 'overconfident_statement');
      expect(overconfident.length).toBeGreaterThan(0);
    });

    it('should detect vague quantification', () => {
      const output = `
We will see a significant increase in traffic.
The results will be substantial and considerable.
Many companies have seen a lot of improvement.
      `;

      const failures = engine.detectFailures(output, 'seo-specialist', 'SEO plan');

      const vague = failures.filter(f => f.type === 'bad_assumption');
      expect(vague.length).toBeGreaterThan(0);
    });

    it('should detect weak outreach patterns', () => {
      const output = `
Dear Sir/Madam,

I hope this email finds you well. We are a leading digital agency that can help you grow your business.

Our services include SEO, PPC, and social media marketing. We offer affordable pricing for all budgets.

Best regards,
The Team
      `;

      const failures = engine.detectFailures(output, 'marketer', 'cold email outreach');

      const weakOutreach = failures.filter(f => f.type === 'weak_outreach');
      expect(weakOutreach.length).toBeGreaterThan(0);
    });

    it('should detect weak offer framing', () => {
      const output = `
We offer a wide range of services including web design, SEO, and marketing.
Our best quality service will deliver excellent results for your business.
We have affordable pricing rates starting at just $99.
      `;

      const failures = engine.detectFailures(output, 'marketer', 'proposal offer');

      const weakOffer = failures.filter(f => f.type === 'weak_offer');
      expect(weakOffer.length).toBeGreaterThan(0);
    });

    it('should detect poor SEO practices', () => {
      const output = `
To improve rankings, use keyword stuffing throughout your content.
Consider using invisible text to add more keywords.
      `;

      const failures = engine.detectFailures(output, 'seo-specialist', 'SEO strategy');

      const poorSEO = failures.filter(f => f.type === 'poor_seo');
      expect(poorSEO.length).toBeGreaterThan(0);
    });

    it('should detect inconsistent data', () => {
      const output = `
Traffic will increase by 200% this month.
Revenue will decrease by 50% compared to last quarter.
      `;

      const failures = engine.detectFailures(output, 'analyst', 'Performance report');

      const inconsistent = failures.filter(f => f.type === 'inconsistent_data');
      expect(inconsistent.length).toBeGreaterThan(0);
    });
  });

  describe('generateReport', () => {
    it('should generate a comprehensive report', () => {
      const output = `
According to a study by Stanford, this strategy will definitely work.
We will see a significant increase in results.
      `;

      const failures = engine.detectFailures(output, 'seo-specialist', 'Strategy review');
      const report = engine.generateReport('seo-specialist', 'Strategy review', failures);

      expect(report.id).toMatch(/^fail_/);
      expect(report.agentId).toBe('seo-specialist');
      expect(report.taskDescription).toBe('Strategy review');
      expect(report.failures.length).toBeGreaterThan(0);
      expect(report.recoveryActions.length).toBeGreaterThan(0);
      expect(report.overallSeverity).toBeDefined();
      expect(report.resolved).toBe(false);
    });

    it('should calculate correct overall severity for clean output', () => {
      const output = 'Simple output with no issues detected.';
      const failures = engine.detectFailures(output, 'seo-specialist', 'Task');
      const report = engine.generateReport('seo-specialist', 'Task', failures);

      expect(report.overallSeverity).toBe('low');
    });

    it('should calculate correct overall severity for problematic output', () => {
      const output = `
To improve rankings, use keyword stuffing throughout your content.
      `;
      const failures = engine.detectFailures(output, 'seo-specialist', 'SEO strategy');
      const report = engine.generateReport('seo-specialist', 'SEO strategy', failures);

      // keyword stuffing is critical severity
      expect(report.overallSeverity).toBe('critical');
    });
  });

  describe('getAgentFailureHistory', () => {
    it('should return failure history for an agent', () => {
      const agentId = `agent_history_${testCounter}`;
      const f1 = engine.detectFailures('Output 1', agentId, 'Task 1');
      engine.generateReport(agentId, 'Task 1', f1);
      const f2 = engine.detectFailures('Output 2', agentId, 'Task 2');
      engine.generateReport(agentId, 'Task 2', f2);

      const history = engine.getAgentFailureHistory(agentId);

      expect(history.length).toBe(2);
      expect(history[0].agentId).toBe(agentId);
    });

    it('should limit results', () => {
      const agentId = `agent_limit_${testCounter}`;
      for (let i = 0; i < 10; i++) {
        const f = engine.detectFailures(`Output ${i}`, agentId, `Task ${i}`);
        engine.generateReport(agentId, `Task ${i}`, f);
      }

      const history = engine.getAgentFailureHistory(agentId, 3);
      expect(history.length).toBe(3);
    });
  });

  describe('getFailureStats', () => {
    it('should calculate failure statistics', () => {
      const agentId = `agent_stats_${testCounter}`;
      const f1 = engine.detectFailures('Output with issues', agentId, 'Task 1');
      engine.generateReport(agentId, 'Task 1', f1);

      const stats = engine.getFailureStats(agentId);

      expect(stats.totalFailures).toBeGreaterThanOrEqual(0);
      expect(stats.byType).toBeDefined();
      expect(stats.bySeverity).toBeDefined();
      expect(stats.autoFixRate).toBeGreaterThanOrEqual(0);
      expect(stats.resolutionRate).toBe(0);
    });
  });
});

describe('Convenience Functions', () => {
  it('detectFailures should work', () => {
    const failures = detectFailures('Test output', 'seo-specialist', 'Test task');
    expect(Array.isArray(failures)).toBe(true);
  });

  it('generateFailureReport should work', () => {
    const report = generateFailureReport('seo-specialist', 'Test task', 'Test output');
    expect(report).toBeDefined();
    expect(report.id).toMatch(/^fail_/);
  });
});

describe('getFailureDetectionEngine', () => {
  it('should return a singleton instance', () => {
    const eng1 = getFailureDetectionEngine();
    const eng2 = getFailureDetectionEngine();
    expect(eng1).toBe(eng2);
  });
});
