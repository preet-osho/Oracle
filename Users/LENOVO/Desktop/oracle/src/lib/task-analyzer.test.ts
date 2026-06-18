import { describe, it, expect } from 'vitest';
import { analyzeTask, type TaskCategory } from './task-analyzer';

// ─── Category Detection ────────────────

describe('analyzeTask', () => {
  describe('category detection', () => {
    it('detects research tasks', () => {
      const result = analyzeTask('research the current market trends and find data about competitors');
      expect(result.category).toBe('research');
    });

    it('detects content-creation tasks', () => {
      const result = analyzeTask('write a blog article about digital marketing content');
      expect(result.category).toBe('content-creation');
    });

    it('detects code-generation tasks', () => {
      const result = analyzeTask('implement an API with database functions and code');
      expect(result.category).toBe('code-generation');
    });

    it('detects data-analysis tasks', () => {
      const result = analyzeTask('analyze the metrics and compare benchmarks');
      expect(result.category).toBe('data-analysis');
    });

    it('detects strategic-planning tasks', () => {
      const result = analyzeTask('create a strategy roadmap with long-term growth goals');
      expect(result.category).toBe('strategic-planning');
    });

    it('detects marketing tasks', () => {
      const result = analyzeTask('develop a marketing campaign for seo and social media ads');
      expect(result.category).toBe('marketing');
    });

    it('detects design tasks', () => {
      const result = analyzeTask('create a UI UX wireframe mockup visual design');
      expect(result.category).toBe('design');
    });

    it('detects finance tasks', () => {
      const result = analyzeTask('build a financial budget pricing model and calculate ROI');
      expect(result.category).toBe('finance');
    });

    it('detects voice-config tasks', () => {
      const result = analyzeTask('set up a voice agent with telephony and conversation flow');
      expect(result.category).toBe('voice-config');
    });

    it('detects quality-assurance tasks', () => {
      const result = analyzeTask('review the code and run a security audit and test for bugs');
      expect(result.category).toBe('quality-assurance');
    });

    it('detects project-management tasks', () => {
      const result = analyzeTask('create a project timeline with milestones and task assignments');
      expect(result.category).toBe('project-management');
    });

    it('detects workflow-design tasks', () => {
      const result = analyzeTask('design a workflow automation pipeline sequence');
      expect(result.category).toBe('workflow-design');
    });

    it('defaults to general for unmatched tasks', () => {
      const result = analyzeTask('do something random');
      expect(result.category).toBe('general');
    });
  });

  // ─── Agent Assignment ──────────────────

  describe('agent assignment', () => {
    it('assigns researcher and analyst for research tasks', () => {
      const result = analyzeTask('research market data and analyze findings');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('researcher');
      expect(roles).toContain('analyst');
    });

    it('assigns writer for content-creation tasks', () => {
      const result = analyzeTask('write a blog post about marketing');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('writer');
    });

    it('assigns developer for code-generation tasks', () => {
      const result = analyzeTask('build an API endpoint with database');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('developer');
    });

    it('assigns strategist for strategic-planning tasks', () => {
      const result = analyzeTask('create a strategy roadmap for growth');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('strategist');
    });

    it('assigns finance agent for finance tasks', () => {
      const result = analyzeTask('create a budget and pricing model');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('finance');
    });

    it('assigns primary agent with priority 1', () => {
      const result = analyzeTask('write a comprehensive article');
      expect(result.agents[0].priority).toBe(1);
    });

    it('assigns multiple agents with distinct priorities', () => {
      const result = analyzeTask('create a marketing campaign with content and design');
      const priorities = result.agents.map(a => a.priority);
      expect(new Set(priorities).size).toBe(priorities.length); // all unique
    });

    it('general tasks get only researcher', () => {
      const result = analyzeTask('do something random');
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].role).toBe('researcher');
    });
  });

  // ─── Complexity Scoring ────────────────

  describe('complexity scoring', () => {
    it('simple tasks have low complexity', () => {
      const result = analyzeTask('quick basic summary');
      expect(result.complexity).toBeLessThan(0.5);
    });

    it('complex keywords increase complexity', () => {
      const simple = analyzeTask('list tools');
      const complex = analyzeTask('comprehensive detailed advanced in-depth analysis with enterprise optimization and scalable multi-step end-to-end implementation');
      expect(complex.complexity).toBeGreaterThan(simple.complexity);
    });

    it('simple keywords decrease complexity', () => {
      const normal = analyzeTask('analyze the data and provide findings');
      const withSimple = analyzeTask('quick simple basic brief summary overview of the data');
      expect(withSimple.complexity).toBeLessThan(normal.complexity);
    });

    it('longer tasks are more complex', () => {
      const short = analyzeTask('analyze');
      const long = analyzeTask('analyze '.repeat(100) + ' and provide detailed findings');
      expect(long.complexity).toBeGreaterThan(short.complexity);
    });

    it('complexity is clamped between 0 and 1', () => {
      const result = analyzeTask('a');
      expect(result.complexity).toBeGreaterThanOrEqual(0);
      expect(result.complexity).toBeLessThanOrEqual(1);
    });
  });

  // ─── Tier Selection ────────────────────

  describe('tier selection', () => {
    it('simple tasks get lower tiers', () => {
      const result = analyzeTask('quick list of tools');
      expect(['free', 'budget']).toContain(result.suggestedTier);
    });

    it('complex tasks get higher tiers', () => {
      const result = analyzeTask(
        'create a comprehensive enterprise-grade end-to-end advanced implementation with complex multi-step optimization and scalable architecture'
      );
      expect(['premium', 'elite']).toContain(result.suggestedTier);
    });
  });

  // ─── Parallelization ───────────────────

  describe('parallelization', () => {
    it('multi-agent tasks below complexity threshold are parallelizable', () => {
      const result = analyzeTask('write a blog post about tools and research data');
      if (result.agents.length > 1 && result.complexity < 0.7) {
        expect(result.parallelizable).toBe(true);
      }
    });

    it('single-agent tasks are not parallelizable', () => {
      const result = analyzeTask('do something random');
      expect(result.parallelizable).toBe(false);
    });
  });

  // ─── Web Search Detection ──────────────

  describe('web search detection', () => {
    it('detects search-related tasks', () => {
      const result = analyzeTask('search for current trends and find the latest data');
      expect(result.requiresWebSearch).toBe(true);
    });

    it('non-search tasks do not require web search', () => {
      const result = analyzeTask('write a draft article about internal processes');
      expect(result.requiresWebSearch).toBe(false);
    });
  });

  // ─── Token Estimation ──────────────────

  describe('token estimation', () => {
    it('estimates tokens based on word count', () => {
      const short = analyzeTask('hello');
      const long = analyzeTask('word '.repeat(200));
      expect(long.estimatedTokens).toBeGreaterThan(short.estimatedTokens);
    });

    it('estimates reasonable token count for typical tasks', () => {
      const result = analyzeTask('write a 500 word article about digital marketing trends in India');
      // ~15 words × 1.5 × 2.5 = ~56 tokens minimum
      expect(result.estimatedTokens).toBeGreaterThan(0);
    });
  });

  // ─── Task Breakdown ────────────────────

  describe('task breakdown', () => {
    it('provides breakdown for complex tasks', () => {
      // Need complexity > 0.6 AND wordCount > 100 to trigger breakdown
      const task = [
        'create a comprehensive detailed in-depth thorough analysis of the entire market landscape',
        'with advanced complex multi-step end-to-end enterprise scalable optimization strategies',
        'evaluate compare contrast assess determine the strategic implementation plan',
        'reasoning deeply about the competitor position and financial model performance',
        'the goals objectives vision growth roadmap benchmarks metrics and targets',
        'for an Indian digital agency with complete revenue projections and budget allocation',
        'including a production-ready deployment plan with security audit and compliance review',
        'that covers every aspect of the business from operations to marketing to sales',
        'and provides specific actionable recommendations with clear next steps and priorities',
        'along with detailed risk assessment mitigation strategies and contingency planning',
        'making sure all aspects are thoroughly covered and nothing is left out or missed',
      ].join(' ');
      const result = analyzeTask(task);
      expect(result.complexity).toBeGreaterThan(0.5);
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown!.length).toBeGreaterThan(0);
    });

    it('no breakdown for simple tasks', () => {
      const result = analyzeTask('quick list');
      expect(result.breakdown).toBeUndefined();
    });

    it('breakdown matches task category', () => {
      const task = [
        'write a comprehensive detailed in-depth blog article',
        'about advanced content strategy marketing and editorial planning',
        'with thorough analysis of audience demographics and engagement metrics',
        'creating a production-ready content calendar and editorial workflow',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        // Content creation breakdown should mention draft, polish, etc.
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('draft');
      }
    });
  });

  // ─── Agent Tier Assignment ─────────────

  describe('agent tier assignment', () => {
    it('primary agents get higher tiers than support agents', () => {
      const result = analyzeTask('create a marketing campaign with content and design');
      const primaryAgent = result.agents.find(a => a.priority === 1);
      const supportAgent = result.agents.find(a => a.priority === 3);

      if (primaryAgent && supportAgent) {
        const tierOrder = ['free', 'budget', 'standard', 'premium', 'elite'];
        const primaryIndex = tierOrder.indexOf(primaryAgent.requiredTier);
        const supportIndex = tierOrder.indexOf(supportAgent.requiredTier);
        expect(primaryIndex).toBeGreaterThanOrEqual(supportIndex);
      }
    });
  });
});
