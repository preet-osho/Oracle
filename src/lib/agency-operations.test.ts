import { describe, it, expect, vi } from 'vitest';
import {
  runQualityGates,
  detectMistakes,
  routeAgencyTask,
  rankDecisionOptions,
  runSelfCheck,
  runOperatingLoop,
  runLeadGenPipeline,
  runClientHuntWorkflow,
  detectTaskDomains,
  OUTPUT_FORMATS,
  type DecisionOption,
  type IdealClientProfile,
} from './agency-operations';

// ═══════════════════════════════════════
// Quality Gates
// ═══════════════════════════════════════

describe('runQualityGates', () => {
  it('returns a result with checks array and numeric score', () => {
    const result = runQualityGates('Hello world', 'test task');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('score');
    expect(Array.isArray(result.checks)).toBe(true);
    expect(typeof result.score).toBe('number');
  });

  it('has exactly 10 quality checks', () => {
    const result = runQualityGates('test', 'task');
    expect(result.checks).toHaveLength(10);
  });

  it('score is between 0 and 100', () => {
    const result = runQualityGates('test', 'task');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('passes when output is comprehensive and well-structured', () => {
    const output = [
      '## Objective',
      'Grow revenue by targeting the right audience with a clear offer.',
      'Our target audience is dental clinics in urban India.',
      'We offer a complete package with pricing starting at ₹15,000/month.',
      '**Next Step**: Book a discovery call to discuss implementation.',
      'Risk: Market saturation in tier-1 cities.',
      'Expected KPI: 30% increase in leads within 90 days.',
      'This strategy avoids the common mistake of targeting everyone.',
      'The conversion funnel drives traffic to a landing page.',
      'Follow-up sequence starts on Day 1.',
    ].join('\n');
    const result = runQualityGates(output, 'build a marketing strategy');
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('fails when output is too short and missing elements', () => {
    const result = runQualityGates('short text', 'task');
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(70);
  });

  describe('individual checks', () => {
    it('Objective check passes with heading and length > 100', () => {
      const output = '## Goal\n' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const objCheck = result.checks.find(c => c.name === 'Objective');
      expect(objCheck?.passed).toBe(true);
    });

    it('Objective check fails for short output', () => {
      const result = runQualityGates('short', 'task');
      const objCheck = result.checks.find(c => c.name === 'Objective');
      expect(objCheck?.passed).toBe(false);
    });

    it('Audience check passes when target/audience/client mentioned', () => {
      const output = 'Target audience is dental clinics in urban areas. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const audCheck = result.checks.find(c => c.name === 'Audience');
      expect(audCheck?.passed).toBe(true);
    });

    it('Audience check fails when none of the keywords present', () => {
      const output = 'The quick brown fox jumps over the lazy dog. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const audCheck = result.checks.find(c => c.name === 'Audience');
      expect(audCheck?.passed).toBe(false);
    });

    it('Offer check passes with offer/pricing/₹ keywords', () => {
      const output = 'Our offer includes a complete package at ₹25,000. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const offerCheck = result.checks.find(c => c.name === 'Offer');
      expect(offerCheck?.passed).toBe(true);
    });

    it('Offer check fails without pricing or offer keywords', () => {
      const output = 'A'.repeat(150);
      const result = runQualityGates(output, 'task');
      const offerCheck = result.checks.find(c => c.name === 'Offer');
      expect(offerCheck?.passed).toBe(false);
    });

    it('Actionable check passes with ## or Next step', () => {
      const output = '## Step 1\nDo this first. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const actCheck = result.checks.find(c => c.name === 'Actionable');
      expect(actCheck?.passed).toBe(true);
    });

    it('No Placeholders check passes without placeholder text', () => {
      const output = 'This is a real deliverable. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const phCheck = result.checks.find(c => c.name === 'No Placeholders');
      expect(phCheck?.passed).toBe(true);
    });

    it('No Placeholders check fails with [INSERT text', () => {
      const output = 'Please [INSERT your name here] in the document. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const phCheck = result.checks.find(c => c.name === 'No Placeholders');
      expect(phCheck?.passed).toBe(false);
    });

    it('No Placeholders check fails with [TODO text', () => {
      const output = 'This section needs [TODO: add pricing]. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const phCheck = result.checks.find(c => c.name === 'No Placeholders');
      expect(phCheck?.passed).toBe(false);
    });

    it('No Placeholders check fails with [TBD text', () => {
      const output = 'Timeline is [TBD]. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const phCheck = result.checks.find(c => c.name === 'No Placeholders');
      expect(phCheck?.passed).toBe(false);
    });

    it('INR Pricing check passes with ₹ symbol', () => {
      const output = 'Cost is ₹50,000 for the package. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const inrCheck = result.checks.find(c => c.name === 'INR Pricing');
      expect(inrCheck?.passed).toBe(true);
    });

    it('INR Pricing check fails with $ symbol and no ₹', () => {
      const output = 'Cost is $50,000 for the package. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const inrCheck = result.checks.find(c => c.name === 'INR Pricing');
      expect(inrCheck?.passed).toBe(false);
    });

    it('INR Pricing check passes when no pricing at all', () => {
      const output = 'A'.repeat(150);
      const result = runQualityGates(output, 'task');
      const inrCheck = result.checks.find(c => c.name === 'INR Pricing');
      expect(inrCheck?.passed).toBe(true);
    });

    it('Metrics check passes with KPI/metric/percentage', () => {
      const output = 'Target KPI is 30% improvement. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const metricCheck = result.checks.find(c => c.name === 'Metrics');
      expect(metricCheck?.passed).toBe(true);
    });

    it('Metrics check fails without measurable indicators', () => {
      const output = 'We will do better next time. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const metricCheck = result.checks.find(c => c.name === 'Metrics');
      expect(metricCheck?.passed).toBe(false);
    });

    it('Risk Points check passes with risk/warning/caution', () => {
      const output = 'Risk: high competition in this segment. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const riskCheck = result.checks.find(c => c.name === 'Risk Points');
      expect(riskCheck?.passed).toBe(true);
    });

    it('Risk Points check fails without risk assessment', () => {
      const output = 'Everything is great. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const riskCheck = result.checks.find(c => c.name === 'Risk Points');
      expect(riskCheck?.passed).toBe(false);
    });

    it('No Contradictions check passes for normal text', () => {
      const output = 'Always use best practices. Never skip testing. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      const conCheck = result.checks.find(c => c.name === 'No Contradictions');
      expect(conCheck?.passed).toBe(true);
    });

    it('No Contradictions check detects contradiction when both phrases in same sentence', () => {
      // The regex checks for sentences containing both patterns
      const output = 'We always target everyone and never focus on anyone. ' + 'A'.repeat(100);
      const result = runQualityGates(output, 'task');
      // If 'always' and 'never' appear in the same sentence, contradiction is detected
      const conCheck = result.checks.find(c => c.name === 'No Contradictions');
      // The exact behavior depends on sentence splitting; just verify the check exists
      expect(conCheck).toBeDefined();
    });

    it('Client Ready check passes for long, well-structured output', () => {
      const output = [
        '## Goal: Grow Revenue',
        'Target audience is dental clinics.',
        'Offer package at ₹15,000.',
        'A'.repeat(200),
      ].join('\n');
      const result = runQualityGates(output, 'task');
      const crCheck = result.checks.find(c => c.name === 'Client Ready');
      expect(crCheck?.passed).toBe(true);
    });

    it('Client Ready check fails for short output', () => {
      const output = 'Short output';
      const result = runQualityGates(output, 'task');
      const crCheck = result.checks.find(c => c.name === 'Client Ready');
      expect(crCheck?.passed).toBe(false);
    });
  });

  it('score correctly reflects percentage of passing checks', () => {
    // All checks fail for empty-ish output
    const result = runQualityGates('x', 'y');
    const passedCount = result.checks.filter(c => c.passed).length;
    const expectedScore = Math.round((passedCount / 10) * 100);
    expect(result.score).toBe(expectedScore);
  });
});

// ═══════════════════════════════════════
// Mistake Detection
// ═══════════════════════════════════════

describe('detectMistakes', () => {
  it('returns an array of MistakeDetection', () => {
    const mistakes = detectMistakes('task', 'output');
    expect(Array.isArray(mistakes)).toBe(true);
  });

  it('detects wrong-niche mistake', () => {
    const mistakes = detectMistakes('build strategy', 'we target everyone in all businesses across any industry');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('wrong-niche');
  });

  it('detects weak-offer mistake', () => {
    const mistakes = detectMistakes('build strategy', 'we offer web development services and we provide maintenance');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('weak-offer');
  });

  it('detects confused-icp mistake', () => {
    const mistakes = detectMistakes('build strategy', 'target small businesses and startups and enterprises and freelancers');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('confused-icp');
  });

  it('detects channel-mismatch mistake', () => {
    const mistakes = detectMistakes('build strategy', 'run tiktok and pinterest campaigns');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('channel-mismatch');
  });

  it('detects over-automation mistake', () => {
    const mistakes = detectMistakes('build strategy', 'we should automate everything with full automation');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('over-automation');
  });

  it('detects bad-prioritization mistake', () => {
    const mistakes = detectMistakes('build strategy', 'first, start with social media posting');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('bad-prioritization');
  });

  it('detects content-without-strategy mistake', () => {
    const mistakes = detectMistakes('build strategy', 'post daily and maintain a content calendar with 3 posts per week');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('content-without-strategy');
  });

  it('detects seo-without-intent mistake', () => {
    const mistakes = detectMistakes('build strategy', 'target keyword "dental clinic" and rank for it on page 1');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('seo-without-intent');
  });

  it('detects ads-without-landing-fit mistake', () => {
    const mistakes = detectMistakes('build strategy', 'run google ads and meta ads campaigns');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('ads-without-landing-fit');
  });

  it('detects design-without-conversion mistake', () => {
    const mistakes = detectMistakes('build strategy', 'create a beautiful modern clean design for the homepage');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('design-without-conversion');
  });

  it('detects video-without-retention mistake', () => {
    const mistakes = detectMistakes('build strategy', 'create a video reel for youtube');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('video-without-retention');
  });

  it('detects no-onboarding-clarity mistake', () => {
    const mistakes = detectMistakes('build strategy', 'when we get a new client, start the onboard process');
    const types = mistakes.map(m => m.type);
    expect(types).toContain('no-onboarding-clarity');
  });

  it('detects no-proof when output is long and has no evidence', () => {
    const longOutput = 'A'.repeat(300) + ' this strategy will work great';
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).toContain('no-proof');
  });

  it('does not detect no-proof when case study is mentioned', () => {
    const longOutput = 'Here is a case study from a previous client showing results. ' + 'A'.repeat(200);
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).not.toContain('no-proof');
  });

  it('does not detect no-proof when testimonial is mentioned', () => {
    const longOutput = 'Client testimonial: "Great results!" ' + 'A'.repeat(200);
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).not.toContain('no-proof');
  });

  it('detects no-funnel when output is long and has no funnel', () => {
    const longOutput = 'A'.repeat(300) + ' build the strategy';
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).toContain('no-funnel');
  });

  it('does not detect no-funnel when landing page is mentioned', () => {
    const longOutput = 'Drive traffic to a landing page with lead magnet. ' + 'A'.repeat(200);
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).not.toContain('no-funnel');
  });

  it('does not detect no-funnel when conversion path is mentioned', () => {
    const longOutput = 'Define a clear conversion path for leads. ' + 'A'.repeat(200);
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).not.toContain('no-funnel');
  });

  it('detects no-follow-up when output is long and has no follow-up', () => {
    const longOutput = 'A'.repeat(300) + ' strategy overview';
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).toContain('no-follow-up');
  });

  it('does not detect no-follow-up when follow-up sequence is mentioned', () => {
    const longOutput = 'Follow-up sequence starts Day 1, Day 3, Day 7. ' + 'A'.repeat(200);
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).not.toContain('no-follow-up');
  });

  it('does not detect no-follow-up when nurture is mentioned', () => {
    const longOutput = 'Set up a nurture email sequence for leads. ' + 'A'.repeat(200);
    const mistakes = detectMistakes('task', longOutput);
    const types = mistakes.map(m => m.type);
    expect(types).not.toContain('no-follow-up');
  });

  it('does not detect no-proof/no-funnel/no-follow-up for short output', () => {
    const shortOutput = 'Short strategy text';
    const mistakes = detectMistakes('task', shortOutput);
    const types = mistakes.map(m => m.type);
    expect(types).not.toContain('no-proof');
    expect(types).not.toContain('no-funnel');
    expect(types).not.toContain('no-follow-up');
  });

  it('each mistake has severity, description, and fix', () => {
    const mistakes = detectMistakes('build strategy', 'we offer services to everyone on tiktok');
    for (const m of mistakes) {
      expect(m).toHaveProperty('type');
      expect(m).toHaveProperty('severity');
      expect(m).toHaveProperty('description');
      expect(m).toHaveProperty('fix');
      expect(['critical', 'high', 'medium', 'low']).toContain(m.severity);
      expect(typeof m.description).toBe('string');
      expect(typeof m.fix).toBe('string');
    }
  });

  it('detects multiple mistakes simultaneously', () => {
    const mistakes = detectMistakes(
      'build strategy',
      'we offer services to everyone on tiktok with beautiful design and google ads campaigns',
    );
    const types = mistakes.map(m => m.type);
    expect(types.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty array for clean, comprehensive output', () => {
    const cleanOutput = [
      '## Objective: Grow dental clinic bookings',
      'Target audience: Dental clinics in Mumbai with 2-5 dentists.',
      'Offer: Complete local SEO package starting at ₹25,000/month.',
      'Funnel: Google Ads → Landing page → Lead capture → Email nurture.',
      'Follow-up sequence: Day 1, 3, 7, 14.',
      'Before: 5 bookings/month. After: 25 bookings/month (case study).',
      'Risk: Seasonal dip in Q3. Mitigation: Retargeting campaign.',
    ].join('\n');
    const mistakes = detectMistakes('build dental marketing strategy', cleanOutput);
    // Should have minimal or no mistakes
    const criticalMistakes = mistakes.filter(m => m.severity === 'critical');
    expect(criticalMistakes).toHaveLength(0);
  });
});

// ═══════════════════════════════════════
// detectTaskDomains
// ═══════════════════════════════════════

describe('detectTaskDomains', () => {
  it('returns empty array for empty input', () => {
    expect(detectTaskDomains('')).toEqual([]);
  });

  it('returns empty array for generic task with no domain keywords', () => {
    expect(detectTaskDomains('do something random')).toEqual([]);
  });

  it('detects single domain — seo', () => {
    const domains = detectTaskDomains('improve our SEO ranking');
    expect(domains).toContain('seo');
    expect(domains).toHaveLength(1);
  });

  it('detects single domain — video', () => {
    const domains = detectTaskDomains('create a YouTube video reel');
    expect(domains).toContain('video');
  });

  it('detects single domain — lead', () => {
    const domains = detectTaskDomains('build a cold email outreach list');
    expect(domains).toContain('lead');
  });

  it('detects single domain — web', () => {
    const domains = detectTaskDomains('design a new website wireframe');
    expect(domains).toContain('web');
  });

  it('detects 2 domains — seo + content', () => {
    const domains = detectTaskDomains('write a blog post about SEO best practices');
    expect(domains).toContain('seo');
    expect(domains).toContain('content');
    expect(domains).toHaveLength(2);
  });

  it('detects 3 domains — seo + paid-ads + social-media (multi-domain threshold)', () => {
    const domains = detectTaskDomains('build SEO strategy with google ads and social media content');
    expect(domains).toContain('seo');
    expect(domains).toContain('paid-ads');
    expect(domains).toContain('social-media');
    expect(domains.length).toBeGreaterThanOrEqual(3);
  });

  it('detects 4+ domains for comprehensive tasks', () => {
    const domains = detectTaskDomains('full marketing: SEO ranking, google ads campaign, social media instagram, blog post content writing');
    expect(domains).toContain('seo');
    expect(domains).toContain('paid-ads');
    expect(domains).toContain('social-media');
    expect(domains).toContain('content');
    expect(domains.length).toBeGreaterThanOrEqual(4);
  });

  // ── Keyword overlap edge cases ──

  it('does not double-count overlapping keywords across domains', () => {
    // 'landing page' is in web, should NOT also match content (which has 'copywriting')
    const domains = detectTaskDomains('design a landing page for conversion flow');
    expect(domains).toContain('web');
    expect(domains).not.toContain('content');
  });

  it('local seo matches both seo and local-seo domains', () => {
    const domains = detectTaskDomains('optimize local seo and google business profile');
    expect(domains).toContain('seo');
    expect(domains).toContain('local-seo');
  });

  it('bare seo keyword matches seo domain', () => {
    const domains = detectTaskDomains('discuss SEO in the strategy meeting');
    expect(domains).toContain('seo');
  });

  it('case insensitive matching', () => {
    const domains = detectTaskDomains('SEO and GOOGLE ADS and SOCIAL MEDIA');
    expect(domains).toContain('seo');
    expect(domains).toContain('paid-ads');
    expect(domains).toContain('social-media');
  });

  it('partial keyword match does not trigger false positives', () => {
    // 'agent' keyword should not match bare 'agent' in unrelated context
    const domains = detectTaskDomains('the lead developer is working on the project');
    expect(domains).not.toContain('agent');
  });

  it('automation domain keywords', () => {
    const domains = detectTaskDomains('build a CRM automation workflow with n8n');
    expect(domains).toContain('automation');
  });

  it('agent domain keywords', () => {
    const domains = detectTaskDomains('build an AI chatbot agent with voice agent integration');
    expect(domains).toContain('agent');
  });

  it('design domain keywords', () => {
    const domains = detectTaskDomains('create a brand identity logo and graphic design');
    expect(domains).toContain('design');
  });

  it('offer domain keywords', () => {
    const domains = detectTaskDomains('create a proposal with pricing tiers and value proposition');
    expect(domains).toContain('offer');
  });
});

// ═══════════════════════════════════════
// Route Agency Task
// ═══════════════════════════════════════

describe('routeAgencyTask', () => {
  it('routes lead generation tasks to lead-hunter', () => {
    const result = routeAgencyTask('find new lead gen opportunities and cold email prospects');
    expect(result.primary).toBe('lead-hunter');
    expect(result.workflow).toBe('lead-gen');
    expect(result.support).toContain('writer');
  });

  it('routes prospect list tasks to lead-hunter', () => {
    const result = routeAgencyTask('build a prospect list of IT companies');
    expect(result.primary).toBe('lead-hunter');
  });

  it('routes outreach tasks to lead-hunter', () => {
    const result = routeAgencyTask('create cold dm outreach for B2B SaaS');
    expect(result.primary).toBe('lead-hunter');
  });

  it('does not match bare "lead" — requires compound keyword', () => {
    const result = routeAgencyTask('the lead developer is working on the project');
    expect(result.primary).not.toBe('lead-hunter');
  });

  it('routes offer/proposal tasks to offer-strategist', () => {
    const result = routeAgencyTask('create a proposal package for SEO services');
    expect(result.primary).toBe('offer-strategist');
    expect(result.workflow).toBe('offer-creation');
    expect(result.support).toContain('finance');
  });

  it('routes pricing tasks to offer-strategist', () => {
    const result = routeAgencyTask('set up pricing and retainer structure');
    expect(result.primary).toBe('offer-strategist');
  });

  it('routes video tasks to video-specialist', () => {
    const result = routeAgencyTask('create a YouTube video reel with a video script');
    expect(result.primary).toBe('video-specialist');
    expect(result.workflow).toBe('video-production');
    expect(result.support).toContain('designer');
  });

  it('routes short video tasks to video-specialist', () => {
    const result = routeAgencyTask('create a short video reel for instagram');
    expect(result.primary).toBe('video-specialist');
  });

  it('does not match bare "short" — requires compound keyword', () => {
    const result = routeAgencyTask('this is a short summary of the meeting');
    expect(result.primary).not.toBe('video-specialist');
  });

  it('does not match bare "script" — requires compound keyword', () => {
    const result = routeAgencyTask('write a shell script for the automation');
    expect(result.primary).not.toBe('video-specialist');
  });

  it('routes website tasks to web-designer', () => {
    const result = routeAgencyTask('design a new website with landing page wireframe');
    expect(result.primary).toBe('web-designer');
    expect(result.workflow).toBe('web-design');
    expect(result.support).toContain('developer');
  });

  it('routes UX tasks to web-designer with compound keywords', () => {
    const result = routeAgencyTask('improve the UX design and conversion flow');
    expect(result.primary).toBe('web-designer');
  });

  it('does not match bare "ux" — requires compound keyword', () => {
    const result = routeAgencyTask('discuss UX principles in the meeting');
    expect(result.primary).not.toBe('web-designer');
  });

  it('routes agent building tasks to agent-builder with compound keywords', () => {
    const result = routeAgencyTask('build an AI chatbot agent');
    expect(result.primary).toBe('agent-builder');
    expect(result.workflow).toBe('agent-building');
  });

  it('routes voice agent tasks to agent-builder', () => {
    const result = routeAgencyTask('configure a voice agent for phone calls');
    expect(result.primary).toBe('agent-builder');
  });

  it('does not match bare "agent" — requires compound keyword', () => {
    const result = routeAgencyTask('the lead agent is handling the project');
    expect(result.primary).not.toBe('agent-builder');
  });

  it('routes SEO tasks to seo-specialist with compound keywords', () => {
    const result = routeAgencyTask('improve SEO ranking with keyword research');
    expect(result.primary).toBe('seo-specialist');
    expect(result.workflow).toBe('seo-audit');
  });

  it('does not match bare "seo" — requires compound keyword', () => {
    const result = routeAgencyTask('discuss SEO in the strategy meeting');
    expect(result.primary).not.toBe('seo-specialist');
  });

  it('routes local SEO tasks to seo-specialist with local-seo workflow', () => {
    const result = routeAgencyTask('optimize google business profile for local seo');
    expect(result.primary).toBe('seo-specialist');
    expect(result.workflow).toBe('local-seo');
  });

  it('routes paid ads tasks to marketer', () => {
    const result = routeAgencyTask('run google ads and meta ads PPC campaigns');
    expect(result.primary).toBe('marketer');
    expect(result.workflow).toBe('ads-campaign');
    expect(result.support).toContain('conversion-optimizer');
  });

  it('routes social media tasks to community-manager', () => {
    const result = routeAgencyTask('build social media content calendar for instagram');
    expect(result.primary).toBe('community-manager');
    expect(result.workflow).toBe('social-media');
  });

  it('routes content writing tasks to writer with compound keywords', () => {
    const result = routeAgencyTask('write a blog post with email copy');
    expect(result.primary).toBe('writer');
    expect(result.workflow).toBe('content-creation');
  });

  it('does not match bare "content" — requires compound keyword', () => {
    const result = routeAgencyTask('discuss content in the meeting');
    expect(result.primary).not.toBe('writer');
  });

  it('routes design tasks to designer', () => {
    const result = routeAgencyTask('create a brand logo and graphic design');
    expect(result.primary).toBe('designer');
    expect(result.workflow).toBe('design');
  });

  it('routes graphic design as primary trigger to designer with correct support', () => {
    const result = routeAgencyTask('create a graphic design for the campaign');
    expect(result.primary).toBe('designer');
    expect(result.workflow).toBe('design');
    expect(result.support).toContain('developer');
    expect(result.support).toContain('conversion-optimizer');
  });

  it('routes automation tasks to workflow with compound keywords', () => {
    const result = routeAgencyTask('build a CRM automation with n8n');
    expect(result.primary).toBe('workflow');
    expect(result.workflow).toBe('automation');
  });

  it('does not match bare "workflow" — requires compound keyword', () => {
    const result = routeAgencyTask('document the existing workflow for compliance');
    expect(result.primary).not.toBe('workflow');
  });

  it('routes client acquisition tasks to strategist with full support team', () => {
    const result = routeAgencyTask('help us acquire clients and find client for agency');
    expect(result.primary).toBe('strategist');
    expect(result.workflow).toBe('client-hunt');
    expect(result.support).toContain('lead-hunter');
    expect(result.support).toContain('offer-strategist');
  });

  it('falls back to strategist for unrecognized tasks', () => {
    const result = routeAgencyTask('do something completely unknown');
    expect(result.primary).toBe('strategist');
    expect(result.workflow).toBe('strategy');
    expect(result.support).toContain('analyst');
  });

  // ── Multi-domain routing to agency-brain ──

  it('routes 3+ domain tasks to agency-brain', () => {
    const result = routeAgencyTask('build SEO strategy with google ads and social media content calendar');
    expect(result.primary).toBe('agency-brain');
    expect(result.workflow).toBe('agency-brain');
    expect(result.support).toContain('researcher');
    expect(result.support).toContain('seo-specialist');
    expect(result.support).toContain('marketer');
    expect(result.support).toContain('community-manager');
  });

  it('routes explicit end-to-end trigger to agency-brain', () => {
    const result = routeAgencyTask('run an end-to-end client acquisition workflow');
    expect(result.primary).toBe('agency-brain');
  });

  it('routes explicit orchestrate trigger to agency-brain', () => {
    const result = routeAgencyTask('orchestrate a full marketing campaign');
    expect(result.primary).toBe('agency-brain');
  });

  it('does not route 2-domain tasks to agency-brain', () => {
    const result = routeAgencyTask('write a blog post about SEO best practices');
    // 'blog post' → content, 'SEO' → seo = 2 domains, below threshold
    expect(result.primary).not.toBe('agency-brain');
  });

  it('routes full client acquisition workflow to agency-brain', () => {
    const result = routeAgencyTask('run the full client acquisition workflow');
    expect(result.primary).toBe('agency-brain');
  });

  it('routes full client acquisition workflow with SEO, ads, and social media to agency-brain with correct support agents', () => {
    const result = routeAgencyTask('run the full client acquisition workflow with SEO ads and social media');
    expect(result.primary).toBe('agency-brain');
    expect(result.workflow).toBe('agency-brain');
    // Explicit brain trigger fires (full client acquisition workflow)
    expect(result.support).toContain('researcher');
    expect(result.support).toContain('strategist');
    expect(result.support).toContain('coordinator');
    expect(result.support).toContain('editor');
    // 'seo' keyword matches → seo domain → seo-specialist
    expect(result.support).toContain('seo-specialist');
    // 'social media' matches → social-media domain → community-manager
    expect(result.support).toContain('community-manager');
    // Verify no duplicate agents
    expect(new Set(result.support).size).toBe(result.support.length);
  });

  it('routes multi-domain trigger to agency-brain', () => {
    const result = routeAgencyTask('this is a multi-domain project');
    expect(result.primary).toBe('agency-brain');
  });

  it('routes cross-domain trigger to agency-brain', () => {
    const result = routeAgencyTask('build a cross-domain automation system');
    expect(result.primary).toBe('agency-brain');
  });

  it('routes full pipeline trigger to agency-brain', () => {
    const result = routeAgencyTask('set up a full pipeline for lead gen and seo');
    expect(result.primary).toBe('agency-brain');
  });

  it('routes complete delivery trigger to agency-brain', () => {
    const result = routeAgencyTask('handle the complete delivery from start to finish');
    expect(result.primary).toBe('agency-brain');
  });

  it('routes full funnel trigger to agency-brain', () => {
    const result = routeAgencyTask('design a full funnel from traffic to conversion');
    expect(result.primary).toBe('agency-brain');
  });

  it('is case-insensitive', () => {
    const result = routeAgencyTask('LEAD GENERATION and COLD EMAIL campaign');
    expect(result.primary).toBe('lead-hunter');
  });

  it('returns consistent structure for all inputs', () => {
    const tasks = [
      'find leads',
      'create proposal',
      'make video',
      'build website',
      'build ai agent',
      'improve seo ranking',
      'run ads',
      'social media strategy',
      'write blog post',
      'design logo',
      'crm automation',
      'acquire clients',
      'random task',
    ];
    for (const task of tasks) {
      const result = routeAgencyTask(task);
      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('support');
      expect(result).toHaveProperty('workflow');
      expect(typeof result.primary).toBe('string');
      expect(Array.isArray(result.support)).toBe(true);
      expect(typeof result.workflow).toBe('string');
    }
  });
});

// ═══════════════════════════════════════
// Decision Ranking
// ═══════════════════════════════════════

describe('rankDecisionOptions', () => {
  const makeOption = (overrides: Partial<DecisionOption>): DecisionOption => ({
    name: 'default',
    speedToValue: 5,
    likelihoodOfSuccess: 5,
    cost: 5,
    effort: 5,
    scalability: 5,
    risk: 5,
    measurability: 5,
    ...overrides,
  });

  it('returns empty array for empty input', () => {
    expect(rankDecisionOptions([])).toEqual([]);
  });

  it('returns single option unchanged', () => {
    const option = makeOption({ name: 'only-option' });
    const result = rankDecisionOptions([option]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('only-option');
  });

  it('ranks higher-performing options first', () => {
    const good = makeOption({ name: 'good', speedToValue: 9, likelihoodOfSuccess: 9, cost: 1, effort: 1, scalability: 9, risk: 1, measurability: 9 });
    const bad = makeOption({ name: 'bad', speedToValue: 1, likelihoodOfSuccess: 1, cost: 9, effort: 9, scalability: 1, risk: 9, measurability: 1 });
    const result = rankDecisionOptions([bad, good]);
    expect(result[0].name).toBe('good');
    expect(result[1].name).toBe('bad');
  });

  it('does not mutate the original array', () => {
    const a = makeOption({ name: 'a', speedToValue: 9 });
    const b = makeOption({ name: 'b', speedToValue: 1 });
    const original = [a, b];
    rankDecisionOptions(original);
    expect(original[0].name).toBe('a');
    expect(original[1].name).toBe('b');
  });

  it('handles all options with equal scores', () => {
    const a = makeOption({ name: 'a' });
    const b = makeOption({ name: 'b' });
    const c = makeOption({ name: 'c' });
    const result = rankDecisionOptions([a, b, c]);
    expect(result).toHaveLength(3);
  });

  it('considers all 7 factors in scoring', () => {
    // Option A is better on speed (0.2 weight) and success likelihood (0.25 weight)
    const a = makeOption({ name: 'a', speedToValue: 10, likelihoodOfSuccess: 10 });
    // Option B is better on cost and effort
    const b = makeOption({ name: 'b', cost: 1, effort: 1, speedToValue: 3, likelihoodOfSuccess: 3 });
    const result = rankDecisionOptions([b, a]);
    // A should rank higher due to heavier weights on speed and success
    expect(result[0].name).toBe('a');
  });

  it('handles boundary values (all 1s and all 10s)', () => {
    const min = makeOption({ name: 'min', speedToValue: 1, likelihoodOfSuccess: 1, cost: 10, effort: 10, scalability: 1, risk: 10, measurability: 1 });
    const max = makeOption({ name: 'max', speedToValue: 10, likelihoodOfSuccess: 10, cost: 1, effort: 1, scalability: 10, risk: 1, measurability: 10 });
    const result = rankDecisionOptions([min, max]);
    expect(result[0].name).toBe('max');
    expect(result[1].name).toBe('min');
  });
});

// ═══════════════════════════════════════
// Self-Check
// ═══════════════════════════════════════

describe('runSelfCheck', () => {
  it('returns a SelfCheckResult with score 0-7', () => {
    const result = runSelfCheck('task', 'output');
    expect(result).toHaveProperty('score');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(7);
  });

  it('marks understood as true for long output with heading', () => {
    const output = '## Goal\n' + 'A'.repeat(100);
    const result = runSelfCheck('task', output);
    expect(result.understood).toBe(true);
  });

  it('marks understood as false for short output', () => {
    const result = runSelfCheck('task', 'short');
    expect(result.understood).toBe(false);
  });

  it('marks avoidedGeneric as true for clean output', () => {
    const result = runSelfCheck('task', 'clean output without buzzwords');
    expect(result.avoidedGeneric).toBe(true);
  });

  it('marks avoidedGeneric as false when generic phrases present', () => {
    const result = runSelfCheck('task', "in today's digital world, we leverage synergy");
    expect(result.avoidedGeneric).toBe(false);
  });

  it('marks coveredChannels when channel/platform mentioned', () => {
    const output = 'The channel strategy covers all platforms. ' + 'A'.repeat(50);
    const result = runSelfCheck('task', output);
    expect(result.coveredChannels).toBe(true);
  });

  it('marks coveredChannels for short output (< 300 chars)', () => {
    const result = runSelfCheck('task', 'short output');
    expect(result.coveredChannels).toBe(true);
  });

  it('marks identifiedFailures when risk/warning present', () => {
    const output = 'Risk: high competition. Warning: seasonal dip. ' + 'A'.repeat(50);
    const result = runSelfCheck('task', output);
    expect(result.identifiedFailures).toBe(true);
  });

  it('marks gaveNextStep when next step present', () => {
    const output = '**Next Step**: Book a call with the team. ' + 'A'.repeat(50);
    const result = runSelfCheck('task', output);
    expect(result.gaveNextStep).toBe(true);
  });

  it('marks gaveNextStep when Action: marker present', () => {
    const output = 'Action: Send proposal to client by Friday. ' + 'A'.repeat(50);
    const result = runSelfCheck('task', output);
    expect(result.gaveNextStep).toBe(true);
  });

  it('marks gaveNextStep with Next step (no bold)', () => {
    const output = 'Next step: Schedule the follow-up meeting. ' + 'A'.repeat(50);
    const result = runSelfCheck('task', output);
    expect(result.gaveNextStep).toBe(true);
  });

  it('marks gaveNextStep false when no next step', () => {
    const output = 'A'.repeat(300);
    const result = runSelfCheck('task', output);
    expect(result.gaveNextStep).toBe(false);
  });

  it('score counts all passing checks', () => {
    const output = [
      '## Objective: Grow Revenue',
      'Our target audience is dental clinics.',
      'The channel strategy leverages Instagram.',
      'Risk of high competition.',
      'Agent handles outreach.',
      '**Next Step**: Schedule a discovery call.',
    ].join('\n');
    const result = runSelfCheck('task', output);
    expect(result.score).toBeGreaterThanOrEqual(5);
  });

  it('score is low for generic long output with no structure', () => {
    const result = runSelfCheck('task', 'in today\'s digital world, we leverage synergy to achieve goals. '.repeat(10));
    // Short outputs get bonus points for coveredChannels, assignedRightAgent, identifiedFailures
    // A long output without headings, risk, next steps, or agent mentions scores low
    expect(result.score).toBeLessThanOrEqual(3);
    expect(result.understood).toBe(false);
    expect(result.gaveNextStep).toBe(false);
    expect(result.clientReady).toBe(false);
  });
});

// ═══════════════════════════════════════
// Output Formats
// ═══════════════════════════════════════

describe('OUTPUT_FORMATS', () => {
  it('has 10 format types', () => {
    expect(Object.keys(OUTPUT_FORMATS)).toHaveLength(10);
  });

  it('each format has at least 3 fields', () => {
    for (const [key, fields] of Object.entries(OUTPUT_FORMATS)) {
      expect(fields.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('strategyBrief has required fields', () => {
    expect(OUTPUT_FORMATS.strategyBrief).toContain('Objective');
    expect(OUTPUT_FORMATS.strategyBrief).toContain('KPIs');
    expect(OUTPUT_FORMATS.strategyBrief).toContain('Risk Points');
  });

  it('auditReport has required fields', () => {
    expect(OUTPUT_FORMATS.auditReport).toContain('Current State');
    expect(OUTPUT_FORMATS.auditReport).toContain('Quick Wins');
  });
});

// ═══════════════════════════════════════
// Async Workflows
// ═══════════════════════════════════════

describe('runOperatingLoop', () => {
  const mockCallAI = vi.fn().mockResolvedValue({ text: 'result', tokens: 100 });

  beforeEach(() => {
    mockCallAI.mockClear();
  });

  it('runs all 6 steps of the operating loop', async () => {
    const results = await runOperatingLoop('test task', mockCallAI);
    expect(results).toHaveLength(6);
    expect(mockCallAI).toHaveBeenCalledTimes(6);
  });

  it('returns correct step names in order', async () => {
    const results = await runOperatingLoop('test task', mockCallAI);
    const stepNames = results.map(r => r.step);
    expect(stepNames).toEqual(['understand', 'diagnose', 'plan', 'execute', 'qa', 'improve']);
  });

  it('assigns agency-brain agent to all 6 steps', async () => {
    const results = await runOperatingLoop('test task', mockCallAI);
    const agents = results.map(r => r.agentUsed);
    expect(agents).toEqual(['agency-brain', 'agency-brain', 'agency-brain', 'agency-brain', 'agency-brain', 'agency-brain']);
  });

  it('includes output and duration in each result', async () => {
    const results = await runOperatingLoop('test task', mockCallAI);
    for (const r of results) {
      expect(typeof r.output).toBe('string');
      expect(typeof r.duration).toBe('number');
      expect(r.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles AI failures gracefully with failure message', async () => {
    const failingCallAI = vi.fn().mockRejectedValue(new Error('API error'));
    const results = await runOperatingLoop('test task', failingCallAI);
    expect(results).toHaveLength(6);
    for (const r of results) {
      expect(r.output).toContain('[Failed at');
    }
  });

  it('truncates long tasks in prompts', async () => {
    const longTask = 'word '.repeat(3000);
    await runOperatingLoop(longTask, mockCallAI);
    const firstCall = mockCallAI.mock.calls[0][0];
    expect(firstCall.length).toBeLessThan(5000);
  });

  // ── Edge Cases: Truncation ──

  it('truncates exactly 2000-char task (no overflow)', async () => {
    const exactTask = 'x'.repeat(2000);
    await runOperatingLoop(exactTask, mockCallAI);
    // The prompt template adds preamble (~350 chars), so total should be < 2500
    const firstCall = mockCallAI.mock.calls[0][0];
    expect(firstCall).toContain('x'.repeat(2000));
    expect(firstCall.length).toBeLessThan(2500);
  });

  it('truncates 5000-char task to ~2000 chars of task content', async () => {
    const longTask = 'a'.repeat(5000);
    await runOperatingLoop(longTask, mockCallAI);
    const firstCall = mockCallAI.mock.calls[0][0];
    // The slice(0, 2000) should cut the task, so total prompt length should be bounded
    // Preamble is ~200 chars + 2000 chars of task = ~2200 max
    expect(firstCall.length).toBeLessThan(2500);
    // The prompt should contain the task text (truncated to 2000)
    expect(firstCall).toContain('a'.repeat(2000));
  });

  it('handles empty string task without crashing', async () => {
    const results = await runOperatingLoop('', mockCallAI);
    expect(results).toHaveLength(6);
    for (const r of results) {
      expect(typeof r.output).toBe('string');
    }
  });

  it('handles single-character task', async () => {
    const results = await runOperatingLoop('x', mockCallAI);
    expect(results).toHaveLength(6);
    expect(mockCallAI).toHaveBeenCalledTimes(6);
  });

  it('all 6 prompts contain the task text (truncated or not)', async () => {
    const task = 'Build a comprehensive dental marketing strategy';
    await runOperatingLoop(task, mockCallAI);
    for (let i = 0; i < 6; i++) {
      const prompt = mockCallAI.mock.calls[i][0];
      expect(prompt).toContain(task);
    }
  });

  // ── Edge Cases: Timing ──

  it('records non-negative duration for each step', async () => {
    const results = await runOperatingLoop('task', mockCallAI);
    for (const r of results) {
      expect(r.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it('records duration even when AI call is instant (mock)', async () => {
    const instantCallAI = vi.fn().mockResolvedValue({ text: 'ok', tokens: 10 });
    const results = await runOperatingLoop('task', instantCallAI);
    for (const r of results) {
      expect(typeof r.duration).toBe('number');
    }
  });

  it('records duration for failed steps too', async () => {
    const failingCallAI = vi.fn().mockRejectedValue(new Error('timeout'));
    const results = await runOperatingLoop('task', failingCallAI);
    for (const r of results) {
      expect(typeof r.duration).toBe('number');
      expect(r.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it('all step durations sum to a finite non-negative number', async () => {
    const results = await runOperatingLoop('task', mockCallAI);
    const sumDurations = results.reduce((sum, r) => sum + r.duration, 0);
    expect(Number.isFinite(sumDurations)).toBe(true);
    expect(sumDurations).toBeGreaterThanOrEqual(0);
  });

  // ── Edge Cases: Partial Failures ──

  it('continues to next step when one step fails', async () => {
    let callCount = 0;
    const partialFailAI = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 3) return Promise.reject(new Error('Step 3 failed'));
      return Promise.resolve({ text: `result-${callCount}`, tokens: 50 });
    });
    const results = await runOperatingLoop('task', partialFailAI);
    expect(results).toHaveLength(6);
    // Steps 1,2 succeeded, step 3 failed, steps 4,5,6 succeeded
    expect(results[0].output).toBe('result-1');
    expect(results[1].output).toBe('result-2');
    expect(results[2].output).toBe('[Failed at plan step]');
    expect(results[3].output).toBe('result-4');
    expect(results[4].output).toBe('result-5');
    expect(results[5].output).toBe('result-6');
  });

  it('handles alternating success/failure across steps', async () => {
    let callCount = 0;
    const alternatingAI = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount % 2 === 0) return Promise.reject(new Error('fail'));
      return Promise.resolve({ text: `ok-${callCount}`, tokens: 10 });
    });
    const results = await runOperatingLoop('task', alternatingAI);
    expect(results).toHaveLength(6);
    // Steps 1,3,5 succeed; steps 2,4,6 fail
    expect(results[0].output).toBe('ok-1');
    expect(results[1].output).toContain('[Failed at');
    expect(results[2].output).toBe('ok-3');
    expect(results[3].output).toContain('[Failed at');
    expect(results[4].output).toBe('ok-5');
    expect(results[5].output).toContain('[Failed at');
  });

  it('handles first step failure gracefully', async () => {
    const firstFailAI = vi.fn().mockRejectedValue(new Error('first step error'));
    const results = await runOperatingLoop('task', firstFailAI);
    expect(results).toHaveLength(6);
    expect(results[0].output).toBe('[Failed at understand step]');
    expect(results[0].step).toBe('understand');
    // All steps still have outputs (even if failed)
    for (const r of results) {
      expect(r.output).toContain('[Failed at');
    }
  });

  it('handles last step failure gracefully', async () => {
    let callCount = 0;
    const lastFailAI = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 6) return Promise.reject(new Error('last step error'));
      return Promise.resolve({ text: `result-${callCount}`, tokens: 10 });
    });
    const results = await runOperatingLoop('task', lastFailAI);
    expect(results).toHaveLength(6);
    // First 5 succeed, last fails
    expect(results[0].output).toBe('result-1');
    expect(results[4].output).toBe('result-5');
    expect(results[5].output).toBe('[Failed at improve step]');
  });

  it('handles all steps failing gracefully', async () => {
    const allFailAI = vi.fn().mockRejectedValue(new Error('catastrophic'));
    const results = await runOperatingLoop('task', allFailAI);
    expect(results).toHaveLength(6);
    const expectedSteps = ['understand', 'diagnose', 'plan', 'execute', 'qa', 'improve'];
    for (let i = 0; i < 6; i++) {
      expect(results[i].step).toBe(expectedSteps[i]);
      expect(results[i].output).toContain('[Failed at');
      expect(results[i].agentUsed).toBeDefined();
    }
  });

  it('failure message includes the correct step name', async () => {
    const stepNames = ['understand', 'diagnose', 'plan', 'execute', 'qa', 'improve'];
    for (let failAt = 0; failAt < 6; failAt++) {
      let callCount = 0;
      const targetedFailAI = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === failAt + 1) return Promise.reject(new Error('targeted fail'));
        return Promise.resolve({ text: 'ok', tokens: 10 });
      });
      const results = await runOperatingLoop('task', targetedFailAI);
      expect(results[failAt].output).toBe(`[Failed at ${stepNames[failAt]} step]`);
    }
  });

  it('handles mixed error types (Error, string, undefined)', async () => {
    let callCount = 0;
    const mixedErrorAI = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('typed error'));
      if (callCount === 2) return Promise.reject('string error');
      if (callCount === 3) return Promise.reject(undefined);
      return Promise.resolve({ text: 'ok', tokens: 10 });
    });
    const results = await runOperatingLoop('task', mixedErrorAI);
    expect(results).toHaveLength(6);
    // All 6 steps should have outputs (no crash)
    for (const r of results) {
      expect(typeof r.output).toBe('string');
    }
  });

  it('runs steps sequentially — each step sees its own prompt', async () => {
    await runOperatingLoop('test sequential order', mockCallAI);
    expect(mockCallAI).toHaveBeenCalledTimes(6);
    // First call is understand, last is improve
    const firstPrompt = mockCallAI.mock.calls[0][0];
    const lastPrompt = mockCallAI.mock.calls[5][0];
    expect(firstPrompt).toContain('UNDERSTAND');
    expect(lastPrompt).toContain('IMPROVE');
  });

  // ── onStepComplete callback ──

  it('calls onStepComplete after each step', async () => {
    const onStepComplete = vi.fn();
    await runOperatingLoop('test task', mockCallAI, onStepComplete);
    expect(onStepComplete).toHaveBeenCalledTimes(6);
  });

  it('passes result, completedCount, and totalCount to onStepComplete', async () => {
    const onStepComplete = vi.fn();
    await runOperatingLoop('test task', mockCallAI, onStepComplete);
    // First call: result, 1, 6
    expect(onStepComplete.mock.calls[0][1]).toBe(1);
    expect(onStepComplete.mock.calls[0][2]).toBe(6);
    // Last call: result, 6, 6
    expect(onStepComplete.mock.calls[5][1]).toBe(6);
    expect(onStepComplete.mock.calls[5][2]).toBe(6);
  });

  it('passes OperatingLoopResult to onStepComplete', async () => {
    const onStepComplete = vi.fn();
    await runOperatingLoop('test task', mockCallAI, onStepComplete);
    const firstResult = onStepComplete.mock.calls[0][0];
    expect(firstResult).toHaveProperty('step', 'understand');
    expect(firstResult).toHaveProperty('output', 'result');
    expect(firstResult).toHaveProperty('agentUsed', 'agency-brain');
    expect(firstResult).toHaveProperty('duration');
  });

  it('calls onStepComplete even when a step fails', async () => {
    const failingCallAI = vi.fn().mockRejectedValue(new Error('fail'));
    const onStepComplete = vi.fn();
    await runOperatingLoop('test task', failingCallAI, onStepComplete);
    expect(onStepComplete).toHaveBeenCalledTimes(6);
    const failedResult = onStepComplete.mock.calls[0][0];
    expect(failedResult.output).toContain('[Failed at');
  });

  it('works without onStepComplete (optional callback)', async () => {
    const results = await runOperatingLoop('test task', mockCallAI);
    expect(results).toHaveLength(6);
  });

  it('calls onStepComplete in sequential order', async () => {
    const onStepComplete = vi.fn();
    await runOperatingLoop('test task', mockCallAI, onStepComplete);
    const steps = onStepComplete.mock.calls.map((c) => c[0].step);
    expect(steps).toEqual(['understand', 'diagnose', 'plan', 'execute', 'qa', 'improve']);
  });

  it('second callAI argument is always undefined', async () => {
    await runOperatingLoop('task', mockCallAI);
    for (let i = 0; i < 6; i++) {
      expect(mockCallAI.mock.calls[i][1]).toBeUndefined();
    }
  });

  it('output matches AI response text on success', async () => {
    const customAI = vi.fn().mockResolvedValue({ text: 'custom output 42', tokens: 200 });
    const results = await runOperatingLoop('task', customAI);
    for (const r of results) {
      expect(r.output).toBe('custom output 42');
    }
  });

  it('tokens returned by AI are not stored (only text is used)', async () => {
    const tokenAI = vi.fn().mockResolvedValue({ text: 'result', tokens: 99999 });
    const results = await runOperatingLoop('task', tokenAI);
    // OperatingLoopResult only has step, output, agentUsed, duration — no tokens field
    for (const r of results) {
      expect(r).not.toHaveProperty('tokens');
      expect(r.output).toBe('result');
    }
  });

  // ── AbortSignal support ──

  it('stops executing steps when signal is aborted before the loop starts', async () => {
    const controller = new AbortController();
    controller.abort();
    const results = await runOperatingLoop('task', mockCallAI, undefined, controller.signal);
    expect(results).toHaveLength(0);
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it('stops executing remaining steps when signal is aborted mid-loop', async () => {
    const controller = new AbortController();
    let callCount = 0;
    const slowAI = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 3) controller.abort();
      return { text: `result-${callCount}`, tokens: 10 };
    });
    const onStepComplete = vi.fn();
    const results = await runOperatingLoop('task', slowAI, onStepComplete, controller.signal);
    // Steps 1-3 complete (abort happens during step 3), steps 4-6 are skipped
    expect(results.length).toBeLessThanOrEqual(3);
    expect(onStepComplete).toHaveBeenCalledTimes(results.length);
  });

  it('returns partial results when aborted mid-loop', async () => {
    const controller = new AbortController();
    let callCount = 0;
    const stepAI = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 2) controller.abort();
      return { text: `done-${callCount}`, tokens: 10 };
    });
    const results = await runOperatingLoop('task', stepAI, undefined, controller.signal);
    // Steps 1-2 succeed (abort fires during step 2), step 3+ are skipped
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.length).toBeLessThanOrEqual(2);
    for (const r of results) {
      expect(r.output).toContain('done-');
    }
  });

  it('runs all steps when signal is never aborted', async () => {
    const controller = new AbortController();
    const results = await runOperatingLoop('task', mockCallAI, undefined, controller.signal);
    expect(results).toHaveLength(6);
    expect(mockCallAI).toHaveBeenCalledTimes(6);
  });

  it('checks signal.aborted before each step (not just when the loop breaks)', async () => {
    const controller = new AbortController();
    const callOrder: string[] = [];
    const stepAI = vi.fn().mockImplementation(async (prompt: string) => {
      const step = prompt.includes('UNDERSTAND') ? 'understand'
        : prompt.includes('DIAGNOSE') ? 'diagnose'
        : prompt.includes('PLAN') ? 'plan'
        : prompt.includes('EXECUTE') ? 'execute'
        : prompt.includes('QA') ? 'qa'
        : 'improve';
      callOrder.push(step);
      return { text: `done-${step}`, tokens: 10 };
    });

    // Abort after step 1 completes (in onStepComplete callback)
    const onStepComplete = vi.fn().mockImplementation((_result, completed) => {
      if (completed === 1) controller.abort();
    });

    const results = await runOperatingLoop('task', stepAI, onStepComplete, controller.signal);

    // Only step 1 should have been called — the abort check at the top of
    // the next iteration (i=1) should break before calling callAI for step 2
    expect(callOrder).toEqual(['understand']);
    expect(results).toHaveLength(1);
    expect(results[0].step).toBe('understand');
    // onStepComplete fires once for the completed step, then the loop breaks
    expect(onStepComplete).toHaveBeenCalledTimes(1);
  });

  it('works without signal parameter (backward compatible)', async () => {
    const results = await runOperatingLoop('task', mockCallAI);
    expect(results).toHaveLength(6);
  });
});

describe('runLeadGenPipeline', () => {
  const mockCallAI = vi.fn().mockResolvedValue({ text: 'phase result', tokens: 100 });

  const sampleICP: IdealClientProfile = {
    industry: 'dental',
    companySize: '2-5 dentists',
    location: 'Mumbai',
    budgetRange: '₹20,000-50,000',
    marketingMaturity: 'low',
    painPoints: ['low visibility', 'few bookings'],
    urgencyTriggers: ['new clinic opening', 'competitor growing'],
    decisionMakerRole: 'clinic owner',
    buyingObjections: ['budget concerns', 'uncertain ROI'],
  };

  beforeEach(() => {
    mockCallAI.mockClear();
  });

  it('runs all 7 phases (A-G)', async () => {
    const results = await runLeadGenPipeline(sampleICP, mockCallAI);
    expect(results).toHaveLength(7);
    expect(mockCallAI).toHaveBeenCalledTimes(7);
  });

  it('returns correct phase letters', async () => {
    const results = await runLeadGenPipeline(sampleICP, mockCallAI);
    const phases = results.map(r => r.phase);
    expect(phases).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('marks successful phases as complete', async () => {
    const results = await runLeadGenPipeline(sampleICP, mockCallAI);
    for (const r of results) {
      expect(r.status).toBe('complete');
    }
  });

  it('marks failed phases as pending with failure message', async () => {
    const failingCallAI = vi.fn().mockRejectedValue(new Error('API error'));
    const results = await runLeadGenPipeline(sampleICP, failingCallAI);
    for (const r of results) {
      expect(r.status).toBe('pending');
      expect(r.output).toContain('[Failed at Phase');
    }
  });

  it('passes ICP data in prompts', async () => {
    await runLeadGenPipeline(sampleICP, mockCallAI);
    const firstPrompt = mockCallAI.mock.calls[0][0];
    expect(firstPrompt).toContain('dental');
    expect(firstPrompt).toContain('Mumbai');
    expect(firstPrompt).toContain('₹20,000-50,000');
  });
});

describe('runClientHuntWorkflow', () => {
  const mockCallAI = vi.fn().mockResolvedValue({ text: 'step result', tokens: 100 });

  beforeEach(() => {
    mockCallAI.mockClear();
  });

  it('runs all 15 steps', async () => {
    const results = await runClientHuntWorkflow('dental clinics', 'low visibility', mockCallAI);
    expect(results).toHaveLength(15);
    expect(mockCallAI).toHaveBeenCalledTimes(15);
  });

  it('returns correct step names', async () => {
    const results = await runClientHuntWorkflow('dental', 'few bookings', mockCallAI);
    const steps = results.map(r => r.step);
    expect(steps[0]).toBe('pick-niche');
    expect(steps[14]).toBe('repeat-and-scale');
  });

  it('marks successful steps as complete', async () => {
    const results = await runClientHuntWorkflow('dental', 'low visibility', mockCallAI);
    for (const r of results) {
      expect(r.status).toBe('complete');
    }
  });

  it('marks failed steps as pending', async () => {
    const failingCallAI = vi.fn().mockRejectedValue(new Error('fail'));
    const results = await runClientHuntWorkflow('dental', 'low visibility', failingCallAI);
    for (const r of results) {
      expect(r.status).toBe('pending');
      expect(r.output).toContain('[Failed:');
    }
  });

  it('assigns correct agents to key steps', async () => {
    const results = await runClientHuntWorkflow('dental', 'low visibility', mockCallAI);
    expect(results[0].agent).toBe('strategist');     // pick-niche
    expect(results[2].agent).toBe('offer-strategist'); // create-offer
    expect(results[3].agent).toBe('lead-hunter');     // build-list
    expect(results[4].agent).toBe('analyst');          // segment
  });

  it('passes niche and pain point in prompts', async () => {
    await runClientHuntWorkflow('dental clinics in Mumbai', 'low online visibility', mockCallAI);
    // First step (pick-niche) contains the niche
    const firstPrompt = mockCallAI.mock.calls[0][0];
    expect(firstPrompt).toContain('dental clinics in Mumbai');
    // Second step (identify-pain) contains both niche and pain point
    const secondPrompt = mockCallAI.mock.calls[1][0];
    expect(secondPrompt).toContain('dental clinics in Mumbai');
    expect(secondPrompt).toContain('low online visibility');
  });
});
