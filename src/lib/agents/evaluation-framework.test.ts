// ═══════════════════════════════════════
// ORACLE — Evaluation Framework Tests
// ═══════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EvaluationFramework,
  getEvaluationFramework,
  type EvaluationDimension,
} from './evaluation-framework';

let testCounter = 0;

describe('EvaluationFramework', () => {
  let framework: EvaluationFramework;

  beforeEach(() => {
    testCounter++;
    framework = new EvaluationFramework(); // New instance per test — isolated
  });

  describe('evaluate', () => {
    it('should evaluate a high-quality output', () => {
      const output = `
## SEO Audit Report — ₹50,000/month budget

### Current State
- Domain Authority: 35/100
- Backlinks: 1,250
- Organic Traffic: 15,000/month
- Google Business Profile: Optimized for Mumbai market

### Issues Found
1. Missing meta descriptions on 23 pages
2. Slow page load time (4.2s average)
3. No schema markup implemented

### Recommendations
1. Add meta descriptions to all pages — Expected impact: +15% CTR
2. Optimize images and enable caching — Expected impact: -40% load time
3. Implement Article schema — Expected impact: Rich snippets in SERPs

### Priority Order
- **Critical**: Page speed optimization
- **High**: Meta descriptions
- **Medium**: Schema implementation

### KPIs to Track
- Organic traffic growth
- Page load time
- Click-through rate
- WhatsApp click-through rate
- Rankings for target keywords

### Next Steps
1. Schedule kickoff meeting with client
2. Assign team responsibilities
3. Set up Google Analytics tracking
4. Create WhatsApp Business integration
      `;

      const result = framework.evaluate('seo-specialist', 'SEO audit for homepage', output);

      expect(result.passed).toBe(true);
      expect(result.weightedTotal).toBeGreaterThan(60);
      expect(result.scores.accuracy).toBeGreaterThan(0);
      expect(result.scores.completeness).toBeGreaterThan(0);
      expect(result.scores.actionability).toBeGreaterThan(0);
    });

    it('should evaluate a low-quality output', () => {
      const output = 'SEO is good. Do more SEO.';

      const result = framework.evaluate('seo-specialist', 'Comprehensive SEO audit', output);

      expect(result.weightedTotal).toBeLessThan(70);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect India context', () => {
      const output = `
## Digital Marketing Plan

### Budget: ₹5,00,000/month
### Target: Mumbai and Delhi markets

### Channels
1. WhatsApp Business for lead nurturing
2. Google My Business optimization
3. Instagram Reels for brand awareness

### ROI Projection
Expected 3x ROI within 6 months
      `;

      const result = framework.evaluate('marketer', 'Marketing strategy', output);

      expect(result.scores.indiaContext).toBeGreaterThan(0);
    });

    it('should detect professional formatting', () => {
      const output = `
# Executive Summary

## Key Findings

| Metric | Current | Target |
|--------|---------|--------|
| Traffic | 10,000 | 25,000 |
| Conv. Rate | 2.1% | 4.5% |
| Revenue | ₹5L | ₹15L |

## Recommendations

### Quick Wins (Week 1-2)
- Optimize title tags
- Fix broken links

### Medium-term (Month 1-3)
- Content cluster strategy
- Link building campaign

## Next Steps
1. Schedule kickoff meeting
2. Assign team responsibilities
3. Set up tracking dashboard
      `;

      const result = framework.evaluate('agency-brain', 'Strategy brief', output);

      expect(result.scores.professionalism).toBeGreaterThan(0);
      expect(result.scores.clarity).toBeGreaterThan(0);
    });

    it('should generate flags for vague output', () => {
      const output = 'We might possibly do something generally. This could be good.';

      const result = framework.evaluate('seo-specialist', 'Strategy', output);

      expect(result.flags.length).toBeGreaterThan(0);
    });

    it('should generate suggestions for low scores', () => {
      const output = 'Short.';

      const result = framework.evaluate('seo-specialist', 'Comprehensive audit', output);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('getAgentEvaluations', () => {
    it('should retrieve evaluations for an agent', () => {
      const agentName = `seo-eval-${testCounter}` as any;
      framework.evaluate(agentName, 'Task 1', 'Output 1 with enough detail and numbers like 42%');
      framework.evaluate(agentName, 'Task 2', 'Output 2 with enough detail and ₹50,000 budget');

      const evaluations = framework.getAgentEvaluations(agentName);

      expect(evaluations.length).toBe(2);
      expect(evaluations[0].agentName).toBe(agentName);
    });

    it('should filter by limit', () => {
      const agentName = `seo-limit-${testCounter}` as any;
      for (let i = 0; i < 10; i++) {
        framework.evaluate(agentName, `Task ${i}`, `Output ${i} with detail`);
      }

      const evaluations = framework.getAgentEvaluations(agentName, 3);

      expect(evaluations.length).toBe(3);
    });
  });

  describe('getAgentStats', () => {
    it('should calculate agent statistics', () => {
      const agentName = `seo-stats-${testCounter}` as any;
      framework.evaluate(agentName, 'Task 1', 'Detailed output with numbers like 42% and ₹50,000');
      framework.evaluate(agentName, 'Task 2', 'Another detailed output with metrics');

      const stats = framework.getAgentStats(agentName);

      expect(stats.totalEvaluations).toBe(2);
      expect(stats.averageScore).toBeGreaterThan(0);
      expect(stats.passRate).toBeGreaterThanOrEqual(0);
      expect(stats.passRate).toBeLessThanOrEqual(100);
      expect(stats.dimensionAverages).toBeDefined();
    });

    it('should return zero stats for unknown agent', () => {
      const stats = framework.getAgentStats('unknown-agent' as any);

      expect(stats.totalEvaluations).toBe(0);
      expect(stats.passRate).toBe(0);
      expect(stats.averageScore).toBe(0);
    });
  });
});

describe('getEvaluationFramework', () => {
  it('should return a singleton instance', () => {
    const fw1 = getEvaluationFramework();
    const fw2 = getEvaluationFramework();
    expect(fw1).toBe(fw2);
  });
});
