import { describe, it, expect } from 'vitest';
import { analyzeTask, agentToTaskCategory, type TaskCategory } from './task-analyzer';
import { ALL_AGENT_NAMES } from '@/lib/agents/registry';

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

    it('detects legal-compliance tasks', () => {
      const result = analyzeTask('review this contract for GST compliance and check the terms and regulation');
      expect(result.category).toBe('legal-compliance');
    });

    it('detects security-audit tasks', () => {
      const result = analyzeTask('run a security audit for vulnerabilities and check OWASP encryption and authentication');
      expect(result.category).toBe('security-audit');
    });

    it('detects data-science tasks', () => {
      const result = analyzeTask('build a machine learning prediction model with statistical regression and dashboard visualization');
      expect(result.category).toBe('data-science');
    });

    it('detects competitive-intelligence tasks', () => {
      const result = analyzeTask('analyze competitor positioning and SWOT market share differentiation and market analysis');
      expect(result.category).toBe('competitive-intelligence');
    });

    it('detects editorial tasks', () => {
      const result = analyzeTask('proofread this article for grammar consistency tone and do a final review');
      expect(result.category).toBe('editorial');
    });

    it('detects localization tasks', () => {
      const result = analyzeTask('translate this content to hindi and hinglish for regional multilingual audience');
      expect(result.category).toBe('localization');
    });

    it('detects sales tasks', () => {
      const result = analyzeTask('build a sales pipeline and outreach sequence for lead prospecting and demo proposal');
      expect(result.category).toBe('sales');
    });

    it('detects technical-writing tasks', () => {
      const result = analyzeTask('write API reference documentation and create a developer guide tutorial');
      expect(result.category).toBe('technical-writing');
    });

    it('detects voice-config tasks', () => {
      const result = analyzeTask('set up a voice agent with telephony and conversation flow');
      expect(result.category).toBe('voice-config');
    });

    it('detects project-management tasks', () => {
      const result = analyzeTask('create a project timeline with milestones and task assignments');
      expect(result.category).toBe('project-management');
    });

    it('detects workflow-design tasks', () => {
      const result = analyzeTask('design a workflow automation pipeline sequence');
      expect(result.category).toBe('workflow-design');
    });

    it('detects lead-generation tasks', () => {
      const result = analyzeTask('build a lead gen prospect list with cold email and outreach');
      expect(result.category).toBe('lead-generation');
    });

    it('detects lead-generation tasks with scoring keywords', () => {
      const result = analyzeTask('create ICP and qualification scoring for ideal client leads');
      expect(result.category).toBe('lead-generation');
    });

    it('detects offer-strategy tasks', () => {
      const result = analyzeTask('create an offer proposal with pricing package and retainer');
      expect(result.category).toBe('offer-strategy');
    });

    it('detects offer-strategy tasks with value proposition keywords', () => {
      const result = analyzeTask('design a value proposition with objection handling and deal structure');
      expect(result.category).toBe('offer-strategy');
    });

    it('detects video-production tasks', () => {
      const result = analyzeTask('create a video reel for youtube with a script and shot list');
      expect(result.category).toBe('video-production');
    });

    it('detects video-production tasks with editing keywords', () => {
      const result = analyzeTask('plan B-roll and video editing with hook and retention');
      expect(result.category).toBe('video-production');
    });

    it('detects web-design tasks', () => {
      const result = analyzeTask('design a website with landing page wireframe and UX conversion flow');
      expect(result.category).toBe('web-design');
    });

    it('detects web-design tasks with CTA keywords', () => {
      const result = analyzeTask('create above the fold CTA and trust signal for web design');
      expect(result.category).toBe('web-design');
    });

    it('detects agent-building tasks', () => {
      const result = analyzeTask('build an AI chatbot agent with routing logic and memory rule');
      expect(result.category).toBe('agent-building');
    });

    it('detects agent-building tasks with tool call keywords', () => {
      const result = analyzeTask('configure tool call and quality gate for the voice agent');
      expect(result.category).toBe('agent-building');
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

    it('assigns legal agent for legal-compliance tasks', () => {
      const result = analyzeTask('review this contract for GST compliance and terms');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('legal');
      expect(result.agents[0].role).toBe('legal');
    });

    it('assigns legal and analyst agents for legal-compliance tasks', () => {
      const result = analyzeTask('review this contract for GST compliance and terms');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('legal');
      expect(roles).toContain('analyst');
    });

    it('assigns security-auditor for security-audit tasks', () => {
      const result = analyzeTask('run a security audit for vulnerability encryption authentication and OWASP compliance');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('security-auditor');
      expect(result.agents[0].role).toBe('security-auditor');
    });

    it('assigns security-auditor and qa for security-audit tasks', () => {
      const result = analyzeTask('run a security audit for vulnerability encryption authentication and OWASP compliance');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('security-auditor');
      expect(roles).toContain('qa');
    });

    it('assigns data-scientist for data-science tasks', () => {
      const result = analyzeTask('build a machine learning prediction model with statistical regression');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('data-scientist');
      expect(result.agents[0].role).toBe('data-scientist');
    });

    it('assigns data-scientist and analyst for data-science tasks', () => {
      const result = analyzeTask('build a machine learning prediction model with statistical regression');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('data-scientist');
      expect(roles).toContain('analyst');
    });

    it('assigns competitor-intel for competitive-intelligence tasks', () => {
      const result = analyzeTask('analyze competitor positioning and SWOT market share');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('competitor-intel');
      expect(result.agents[0].role).toBe('competitor-intel');
    });

    it('assigns competitor-intel, researcher, and analyst for competitive-intelligence tasks', () => {
      const result = analyzeTask('analyze competitor positioning and SWOT market share and benchmark');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('competitor-intel');
      expect(roles).toContain('researcher');
      expect(roles).toContain('analyst');
    });

    it('assigns editor for editorial tasks', () => {
      const result = analyzeTask('proofread this article for grammar consistency and tone');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('editor');
      expect(result.agents).toHaveLength(1);
    });

    it('assigns localization agent for localization tasks', () => {
      const result = analyzeTask('translate this content to hindi and hinglish for regional audience');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('localization');
      expect(result.agents[0].role).toBe('localization');
    });

    it('assigns localization and writer for localization tasks', () => {
      const result = analyzeTask('translate this content to hindi and hinglish for regional audience');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('localization');
      expect(roles).toContain('writer');
    });

    it('auto-routes devops agent (category: technical) to code-generation without manual override', () => {
      const result = analyzeTask('implement a CI/CD code build and deploy function with database and API');
      expect(result.category).toBe('code-generation');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('devops');
      expect(roles).toContain('developer');
    });

    it('auto-routes ux-researcher agent (category: design) to design tasks', () => {
      const result = analyzeTask('conduct a UX usability test and wireframe layout mockup');
      expect(result.category).toBe('design');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('ux-researcher');
      expect(roles).toContain('designer');
    });

    it('auto-routes growth-hacker agent (category: marketing) to marketing tasks', () => {
      const result = analyzeTask('build a viral loop and referral program for the marketing campaign audience');
      expect(result.category).toBe('marketing');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('growth-hacker');
      expect(roles).toContain('marketer');
    });

    it('auto-routes seo-specialist agent (category: content) to content-creation tasks', () => {
      const result = analyzeTask('optimize on-page SEO keywords and create content for the blog');
      expect(result.category).toBe('content-creation');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('seo-specialist');
      expect(roles).toContain('writer');
    });

    it('auto-routes content-strategist (category: content) to content-creation tasks', () => {
      const result = analyzeTask('create a content strategy and editorial calendar for the blog');
      expect(result.category).toBe('content-creation');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('content-strategist');
      expect(roles).toContain('writer');
    });

    it('auto-routes conversion-optimizer (category: marketing) to marketing tasks', () => {
      const result = analyzeTask('optimize the landing page conversion rate and run A/B tests for the marketing campaign');
      expect(result.category).toBe('marketing');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('conversion-optimizer');
      expect(roles).toContain('marketer');
    });

    it('auto-routes community-manager (category: marketing) to marketing tasks', () => {
      const result = analyzeTask('build a community engagement strategy for the marketing campaign audience');
      expect(result.category).toBe('marketing');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('community-manager');
      expect(roles).toContain('marketer');
    });

    it('auto-routes sales-optimizer (category: sales) to sales tasks', () => {
      const result = analyzeTask('build a sales pipeline and outreach sequence for the demo proposal');
      expect(result.category).toBe('sales');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('sales-optimizer');
      expect(roles).toContain('analyst');
    });

    it('auto-routes accessibility-auditor (category: quality) to quality-assurance tasks', () => {
      const result = analyzeTask('run an accessibility audit and check WCAG compliance test for bugs');
      expect(result.category).toBe('quality-assurance');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('accessibility-auditor');
      expect(roles).toContain('qa');
    });

    it('auto-routes api-docs-writer (category: technical-writing) to technical-writing tasks', () => {
      const result = analyzeTask('write API reference documentation and create a developer guide tutorial');
      expect(result.category).toBe('technical-writing');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('api-docs-writer');
      expect(roles).toContain('developer');
    });

    it('assigns lead-hunter as primary for lead-generation tasks', () => {
      const result = analyzeTask('build a lead gen prospect list with cold email outreach');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('lead-hunter');
      expect(result.agents[0].role).toBe('lead-hunter');
    });

    it('assigns lead-hunter, sales-optimizer, and writer for lead-generation tasks', () => {
      const result = analyzeTask('build a lead gen prospect list with cold email outreach');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('lead-hunter');
      expect(roles).toContain('sales-optimizer');
      expect(roles).toContain('writer');
    });

    it('assigns offer-strategist as primary for offer-strategy tasks', () => {
      const result = analyzeTask('create an offer proposal with pricing package');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('offer-strategist');
      expect(result.agents[0].role).toBe('offer-strategist');
    });

    it('assigns offer-strategist, finance, and writer for offer-strategy tasks', () => {
      const result = analyzeTask('create an offer proposal with pricing package');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('offer-strategist');
      expect(roles).toContain('finance');
      expect(roles).toContain('writer');
    });

    it('assigns video-specialist as primary for video-production tasks', () => {
      const result = analyzeTask('create a video reel for youtube with script and shot list');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('video-specialist');
      expect(result.agents[0].role).toBe('video-specialist');
    });

    it('assigns video-specialist, designer, and writer for video-production tasks', () => {
      const result = analyzeTask('create a video reel for youtube with script and shot list');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('video-specialist');
      expect(roles).toContain('designer');
      expect(roles).toContain('writer');
    });

    it('assigns web-designer as primary for web-design tasks', () => {
      const result = analyzeTask('design a website with landing page wireframe and UX');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('web-designer');
      expect(result.agents[0].role).toBe('web-designer');
    });

    it('assigns web-designer, developer, and conversion-optimizer for web-design tasks', () => {
      const result = analyzeTask('design a website with landing page wireframe and UX');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('web-designer');
      expect(roles).toContain('developer');
      expect(roles).toContain('conversion-optimizer');
    });

    it('assigns agent-builder as primary for agent-building tasks', () => {
      const result = analyzeTask('build an AI chatbot agent with routing logic');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('agent-builder');
      expect(result.agents[0].role).toBe('agent-builder');
    });

    it('assigns agent-builder, developer, and qa for agent-building tasks', () => {
      const result = analyzeTask('build an AI chatbot agent with routing logic');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('agent-builder');
      expect(roles).toContain('developer');
      expect(roles).toContain('qa');
    });

    it('auto-routes voice agent to voice-config tasks using new keywords (tts, speech recognition, voice clone, sip trunk)', () => {
      const result = analyzeTask('set up TTS speech recognition with voice clone and SIP trunk telephony');
      expect(result.category).toBe('voice-config');
      const roles = result.agents.map(a => a.role);
      expect(roles).toContain('voice');
      expect(roles).toContain('developer');
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

    it('low complexity shifts agent tiers down from standard (complexity < 0.2)', () => {
      // Very short, simple task → complexity should be low
      const result = analyzeTask('quick simple brief');
      expect(result.complexity).toBeLessThan(0.4);
      // At least some agents should be shifted to a lower tier than standard
      const tiers = result.agents.map(a => a.requiredTier);
      const hasLowerTier = tiers.some(t => t === 'free' || t === 'budget');
      expect(hasLowerTier).toBe(true);
    });

    it('high complexity shifts agent tiers up from standard (complexity > 0.8)', () => {
      // Very complex, long task → complexity should be high
      const result = analyzeTask(
        'comprehensive detailed advanced in-depth thorough enterprise-grade complex multi-step end-to-end scalable production-ready optimization with comprehensive detailed advanced in-depth analysis'
      );
      expect(result.complexity).toBeGreaterThan(0.7);
      // At least some agents should be shifted to a higher tier than standard
      const tiers = result.agents.map(a => a.requiredTier);
      const hasHigherTier = tiers.some(t => t === 'premium' || t === 'elite');
      expect(hasHigherTier).toBe(true);
    });

    it('tier shifts are bounded — never below free or above elite', () => {
      // Extreme simple task should not go below 'free'
      const simple = analyzeTask('x');
      for (const agent of simple.agents) {
        const tierOrder = ['free', 'budget', 'standard', 'premium', 'elite'];
        expect(tierOrder).toContain(agent.requiredTier);
      }

      // Extreme complex task should not go above 'elite'
      const complex = analyzeTask(
        'comprehensive detailed advanced in-depth thorough enterprise-grade complex multi-step end-to-end scalable production-ready optimization with comprehensive detailed advanced in-depth analysis'
      );
      for (const agent of complex.agents) {
        const tierOrder = ['free', 'budget', 'standard', 'premium', 'elite'];
        expect(tierOrder).toContain(agent.requiredTier);
      }
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

    it('legal-compliance tasks provide correct breakdown', () => {
      const task = [
        'review this comprehensive detailed contract for GST compliance',
        'check all regulatory requirements and legal terms and regulation',
        'with thorough analysis of disclosure and disclaimer clauses',
        'and enterprise-level privacy and data protection requirements',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('regulations');
        expect(allText).toContain('compliance');
        expect(allText).toContain('disclaimers');
      }
    });

    it('security-audit tasks provide correct breakdown', () => {
      const task = [
        'run a comprehensive detailed security audit for vulnerabilities',
        'check OWASP encryption authentication and penetration testing',
        'with thorough analysis of firewall ssl and intrusion detection',
        'and enterprise-level breach prevention and hack prevention',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('owasp');
        expect(allText).toContain('vulnerabilities');
        expect(allText).toContain('remediation');
      }
    });

    it('data-science tasks provide correct breakdown', () => {
      const task = [
        'build a comprehensive machine learning prediction model',
        'with detailed statistical regression and dashboard visualization',
        'with thorough analysis of dataset classification and clustering',
        'and enterprise-level forecast and artificial intelligence model',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('statistical');
        expect(allText).toContain('visualizations');
      }
    });

    it('competitive-intelligence tasks provide correct breakdown', () => {
      const task = [
        'analyze competitor comprehensive detailed SWOT positioning',
        'with thorough benchmark market share and differentiation analysis',
        'and enterprise-level competitive landscape and market analysis',
        'including opportunity identification and threat assessment',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('competitors');
        expect(allText).toContain('comparison');
        expect(allText).toContain('gaps');
      }
    });

    it('editorial tasks provide correct breakdown', () => {
      const task = [
        'proofread this comprehensive detailed article for grammar',
        'with thorough consistency tone and spelling check',
        'and enterprise-level final review and quality check',
        'including formatting verification and professional polish',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('grammar');
        expect(allText).toContain('polish');
      }
    });

    it('localization tasks provide correct breakdown', () => {
      const task = [
        'translate this comprehensive detailed content to hindi',
        'with thorough hinglish regional and multilingual adaptation',
        'and enterprise-level cultural adaptation and vernacular support',
        'including dialect handling and audience tier identification',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('hinglish');
        expect(allText).toContain('cultural');
      }
    });

    it('sales tasks provide correct breakdown', () => {
      const task = [
        'build a comprehensive detailed sales pipeline and outreach sequence strategy',
        'with thorough analysis of lead prospect crm deal and closing metrics',
        'and enterprise-level demo proposal revenue and negotiation optimization',
        'including prospect list building and pipeline forecast planning',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('customer');
        expect(allText).toContain('prospect');
        expect(allText).toContain('pipeline');
      }
    });

    it('quality-assurance tasks provide correct breakdown', () => {
      const task = [
        'run a comprehensive detailed accessibility audit and quality assurance test',
        'with thorough WCAG compliance bug review and performance testing',
        'and enterprise-level security audit and quality verification',
        'including error identification and fix recommendation resolution',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('testing');
        expect(allText).toContain('issues');
        expect(allText).toContain('recommendations');
      }
    });

    it('technical-writing tasks provide correct breakdown', () => {
      const task = [
        'write comprehensive detailed API reference documentation and developer guide',
        'with thorough tutorial openapi swagger and changelog content',
        'and enterprise-level architecture documentation and migration guide',
        'including readme accuracy validation and publication planning',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('documentation');
        expect(allText).toContain('architecture');
        expect(allText).toContain('examples');
      }
    });

    it('voice-config tasks provide correct breakdown', () => {
      const task = [
        'configure a comprehensive detailed voice agent with telephony integration',
        'with thorough IVR phone call and conversation flow setup',
        'and enterprise-level voice configuration and optimization testing',
        'including call handling and telephony pipeline orchestration',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('conversation flow');
        expect(allText).toContain('voice');
        expect(allText).toContain('telephony');
      }
    });

    it('project-management tasks provide correct breakdown', () => {
      const task = [
        'create a comprehensive detailed project timeline with milestones',
        'with thorough task breakdown and deadline assignment coordination',
        'and enterprise-level project scope and responsibility tracking',
        'including milestone planning and task assignment management',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('scope');
        expect(allText).toContain('timeline');
        expect(allText).toContain('tracking');
      }
    });

    it('workflow-design tasks provide correct breakdown', () => {
      const task = [
        'design a comprehensive detailed workflow automation pipeline sequence',
        'with thorough process orchestration and optimization opportunities',
        'and enterprise-level workflow mapping and implementation automation',
        'including validation testing and current workflow analysis',
      ].join(' ');
      const result = analyzeTask(task);
      if (result.breakdown) {
        const allText = result.breakdown.join(' ').toLowerCase();
        expect(allText).toContain('workflow');
        expect(allText).toContain('automation');
        expect(allText).toContain('optimization');
      }
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

  // ─── Exhaustive Agent Routing ─────────

  describe('exhaustive agent routing', () => {      const EXPECTED_ROUTES: Record<string, TaskCategory> = {
      'researcher': 'research',
      'writer': 'content-creation',
      'developer': 'code-generation',
      'analyst': 'data-analysis',
      'strategist': 'strategic-planning',
      'marketer': 'marketing',
      'designer': 'design',
      'finance': 'finance',
      'voice': 'voice-config',
      'qa': 'quality-assurance',
      'coordinator': 'project-management',
      'workflow': 'workflow-design',
      'legal': 'legal-compliance',
      'security-auditor': 'security-audit',
      'data-scientist': 'data-science',
      'competitor-intel': 'competitive-intelligence',
      'editor': 'editorial',
      'localization': 'localization',
      'devops': 'code-generation',
      'ux-researcher': 'design',
      'growth-hacker': 'marketing',
      'seo-specialist': 'content-creation',
      'content-strategist': 'content-creation',
      'conversion-optimizer': 'marketing',
      'community-manager': 'marketing',
      'sales-optimizer': 'sales',
      'accessibility-auditor': 'quality-assurance',
      'api-docs-writer': 'technical-writing',
      'lead-hunter': 'lead-generation',
      'offer-strategist': 'offer-strategy',
      'video-specialist': 'video-production',
      'web-designer': 'web-design',
      'agent-builder': 'agent-building',
      'agency-brain': 'strategic-planning',
    };

    it('every agent in ALL_AGENT_NAMES maps to a valid TaskCategory', () => {
      for (const agentName of ALL_AGENT_NAMES) {
        const taskCategory = agentToTaskCategory(agentName);
        expect(taskCategory).toBeDefined();
        expect(typeof taskCategory).toBe('string');
      }
    });

    it('every agent routes to its expected task category', () => {
      for (const [agentName, expectedCategory] of Object.entries(EXPECTED_ROUTES)) {
        const taskCategory = agentToTaskCategory(agentName);
        expect(taskCategory).toBe(expectedCategory);
      }
    });

    it('no agent outside ALL_AGENT_NAMES gets a valid category', () => {
      // Non-existent agents should return undefined
      expect(agentToTaskCategory('nonexistent-agent')).toBeUndefined();
      expect(agentToTaskCategory('orchestrator')).toBeUndefined();
      expect(agentToTaskCategory('synthesizer')).toBeUndefined();
    });

    it('EXPECTED_ROUTES covers every agent in ALL_AGENT_NAMES', () => {
      expect(Object.keys(EXPECTED_ROUTES)).toHaveLength(ALL_AGENT_NAMES.length);
      for (const agentName of ALL_AGENT_NAMES) {
        expect(EXPECTED_ROUTES).toHaveProperty(agentName);
      }
    });

    it('every agent in EXPECTED_ROUTES is in ALL_AGENT_NAMES', () => {
      for (const agentName of Object.keys(EXPECTED_ROUTES)) {
        expect(ALL_AGENT_NAMES).toContain(agentName);
      }
    });
  });
});
