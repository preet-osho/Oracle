// ═══════════════════════════════════════
// ORACLE — Agency Operations Framework
// Operating Loop · Lead Gen Pipeline · Client Hunt · Quality Gates · Mistake Detection
// ═══════════════════════════════════════

// ─── Operating Loop ────────────────────
// The 6-step process applied to every task.

export type OperatingStep = 'understand' | 'diagnose' | 'plan' | 'execute' | 'qa' | 'improve';

export interface OperatingLoopResult {
  step: OperatingStep;
  output: string;
  agentUsed: string;
  duration: number;
}

// ─── Shared Constants (single source of truth) ────
// These constants are referenced by the operating loop step prompts,
// the agency-brain prompt, and the quality gate checks.

/** The 15 specialist sub-agents the Agency Brain orchestrates. */
export const AGENCY_SUB_AGENTS = [
  'lead hunter', 'offer strategist', 'SEO', 'local SEO', 'paid ads',
  'social media', 'content', 'design', 'video', 'web design',
  'automation', 'agent builder', 'growth', 'performance analyst', 'QA auditor',
] as const;

/** The quality gate checklist applied before delivery. */
export const QUALITY_GATE_CHECKLIST = [
  'objective clear', 'audience clear', 'offer clear', 'desired action clear',
  'output actionable', 'tailored to context', 'no contradictions',
  'includes metrics', 'realistic', 'has next step',
] as const;

/** The common mistakes the Agency Brain must detect. */
export const COMMON_MISTAKES = [
  'wrong niche', 'weak offer', 'no proof', 'confused ICP',
  'channel mismatch', 'no funnel', 'no follow-up', 'no tracking',
  'over-automation', 'bad prioritization',
] as const;

/** The role prefix used in every operating loop step prompt. */
const ROLE_PREFIX = 'You are the Agency Brain.';

/** Truncate a task string for use in step prompts. */
function truncateTask(task: string): string {
  return task.slice(0, 2000);
}

/** Callback fired after each operating loop step completes. */
export type OnStepComplete = (result: OperatingLoopResult, completedCount: number, totalCount: number) => void;

/** Run the full 6-step operating loop for a task. */
export async function runOperatingLoop(
  task: string,
  callAI: (prompt: string, systemPrompt?: string) => Promise<{ text: string; tokens: number }>,
  onStepComplete?: OnStepComplete,
  signal?: AbortSignal,
): Promise<OperatingLoopResult[]> {
  const truncated = truncateTask(task);

  const steps: { step: OperatingStep; prompt: string; agent: string }[] = [
    {
      step: 'understand',
      prompt: `${ROLE_PREFIX} UNDERSTAND this task using the 6-step operating loop.\n\nStep 1 — UNDERSTAND: What is the business? What is being sold? To whom? Why now? What is the current bottleneck? What is the desired outcome?\n\nTask: ${truncated}`,
      agent: 'agency-brain',
    },
    {
      step: 'diagnose',
      prompt: `${ROLE_PREFIX} DIAGNOSE the real problem behind this task.\n\nStep 2 — DIAGNOSE: Is the problem lead flow, conversion, traffic, trust, offer, retention, creative, tracking, or operations? Is the root issue visible or hidden? What is being assumed without proof?\n\nTask: ${truncated}`,
      agent: 'agency-brain',
    },
    {
      step: 'plan',
      prompt: `${ROLE_PREFIX} PLAN the execution for this task.\n\nStep 3 — PLAN: Select the best channel mix. Define the funnel. Assign tasks to the correct specialist sub-agents (${AGENCY_SUB_AGENTS.join(', ')}). Define deliverables and deadlines. Define success metrics.\n\nTask: ${truncated}`,
      agent: 'agency-brain',
    },
    {
      step: 'execute',
      prompt: `${ROLE_PREFIX} EXECUTE the plan for this task.\n\nStep 4 — EXECUTE: Produce tactical outputs. Create assets. Write copy. Build workflow logic. Draft outreach. Design tests. Assign each deliverable to the correct specialist sub-agent.\n\nTask: ${truncated}`,
      agent: 'agency-brain',
    },
    {
      step: 'qa',
      prompt: `${ROLE_PREFIX} QA CHECK this task output.\n\nStep 5 — QA: Check for accuracy, clarity, consistency, and completeness. Spot weak claims, missing proof, broken steps, or bad targeting. Verify: ${QUALITY_GATE_CHECKLIST.join(', ')}. Fix before delivery.\n\nTask: ${truncated}`,
      agent: 'agency-brain',
    },
    {
      step: 'improve',
      prompt: `${ROLE_PREFIX} IMPROVE based on results.\n\nStep 6 — IMPROVE: Evaluate what worked and what failed. Identify optimization opportunities. Update the system with lessons learned. Suggest next experiments. Detect common mistakes: ${COMMON_MISTAKES.join(', ')}.\n\nTask: ${truncated}`,
      agent: 'agency-brain',
    },
  ];

  const results: OperatingLoopResult[] = [];

  for (let i = 0; i < steps.length; i++) {
    // Abort check before each step
    if (signal?.aborted) break;

    const s = steps[i];
    const start = Date.now();
    try {
      const result = await callAI(s.prompt, undefined);
      const stepResult: OperatingLoopResult = {
        step: s.step,
        output: result.text,
        agentUsed: s.agent,
        duration: Date.now() - start,
      };
      results.push(stepResult);
      onStepComplete?.(stepResult, i + 1, steps.length);
    } catch {
      const failResult: OperatingLoopResult = {
        step: s.step,
        output: `[Failed at ${s.step} step]`,
        agentUsed: s.agent,
        duration: Date.now() - start,
      };
      results.push(failResult);
      onStepComplete?.(failResult, i + 1, steps.length);
    }
  }

  return results;
}

// ─── Lead Generation Pipeline (Phases A–G) ────

export interface IdealClientProfile {
  industry: string;
  companySize: string;
  location: string;
  budgetRange: string;
  marketingMaturity: string;
  painPoints: string[];
  urgencyTriggers: string[];
  decisionMakerRole: string;
  buyingObjections: string[];
}

export interface LeadScore {
  urgency: number;        // 0-10
  budgetFit: number;      // 0-10
  painSeverity: number;   // 0-10
  growthPotential: number; // 0-10
  responsiveness: number; // 0-10
  authorityAccess: number; // 0-10
  trustSignals: number;   // 0-10
  serviceFit: number;     // 0-10
  total: number;          // 0-80
  grade: 'A' | 'B' | 'C' | 'D';
}

export interface OutreachAngle {
  type: 'revenue' | 'visibility' | 'efficiency' | 'credibility' | 'cost-saving' | 'time-saving';
  primary: string;
  backups: string[];
  message: string;
}

export interface LeadGenPhase {
  phase: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  name: string;
  status: 'pending' | 'in-progress' | 'complete';
  output: string;
  duration: number;
}

/** Run the full lead generation pipeline. */
export async function runLeadGenPipeline(
  icp: IdealClientProfile,
  callAI: (prompt: string, systemPrompt?: string) => Promise<{ text: string; tokens: number }>,
): Promise<LeadGenPhase[]> {
  const phases: { phase: LeadGenPhase['phase']; name: string; prompt: string }[] = [
    {
      phase: 'A',
      name: 'Ideal Client Profile',
      prompt: `Create a detailed Ideal Client Profile:\\nIndustry: ${icp.industry}\\nSize: ${icp.companySize}\\nLocation: ${icp.location}\\nBudget: ${icp.budgetRange}\\nPain Points: ${icp.painPoints.join(', ')}\\n\\nOutput a structured ICP document with all fields filled.`,
    },
    {
      phase: 'B',
      name: 'Lead Sourcing',
      prompt: `Find prospects matching this ICP:\\n${JSON.stringify(icp, null, 2)}\\n\\nSearch across: Google Maps, LinkedIn, company websites, directories, job boards, social platforms, local search results, ad libraries.\\n\\nOutput a scored lead list with business name, contact, website, rating, and trigger criterion.`,
    },
    {
      phase: 'C',
      name: 'Lead Scoring',
      prompt: `Score these leads on urgency, budget fit, pain severity, growth potential, responsiveness, authority access, trust signals, and service fit (each 0-10).\\n\\nSegment into A (60+), B (40-59), C (20-39), D (<20).\\nICP: ${JSON.stringify(icp, null, 2)}`,
    },
    {
      phase: 'D',
      name: 'Outreach Angle',
      prompt: `Create one primary + two backup outreach angles for this ICP.\\nICP: ${JSON.stringify(icp, null, 2)}\\n\\nAngles: revenue, visibility, efficiency, credibility, cost-saving, time-saving.\\n\\nFor each angle: the headline, the proof point, and the CTA.`,
    },
    {
      phase: 'E',
      name: 'Outreach Assets',
      prompt: `Generate ready-to-send outreach assets for this ICP:\\n${JSON.stringify(icp, null, 2)}\\n\\nCreate: cold email, cold DM, LinkedIn message, follow-up sequence (Day 1, 3, 7, 14), audit snippet, booking CTA.`,
    },
    {
      phase: 'F',
      name: 'Discovery & Close',
      prompt: `Prepare discovery and close materials for this ICP:\\n${JSON.stringify(icp, null, 2)}\\n\\nCreate: discovery questions, pain discovery map, qualification checklist, proposal structure, pricing frame, close strategy.`,
    },
    {
      phase: 'G',
      name: 'Handoff',
      prompt: `Create an onboarding checklist for when this lead becomes a client.\\nICP: ${JSON.stringify(icp, null, 2)}\\n\\nInclude: access collection, KPI definition, scope documentation, communication cadence, delivery plan.`,
    },
  ];

  const results: LeadGenPhase[] = [];

  for (const p of phases) {
    const start = Date.now();
    try {
      const result = await callAI(p.prompt);
      results.push({
        phase: p.phase,
        name: p.name,
        status: 'complete',
        output: result.text,
        duration: Date.now() - start,
      });
    } catch {
      results.push({
        phase: p.phase,
        name: p.name,
        status: 'pending',
        output: `[Failed at Phase ${p.phase}: ${p.name}]`,
        duration: Date.now() - start,
      });
    }
  }

  return results;
}

// ─── Client Hunt Workflow (15 Steps) ────

export type ClientHuntStep =
  | 'pick-niche'
  | 'identify-pain'
  | 'create-offer'
  | 'build-list'
  | 'segment'
  | 'create-outreach'
  | 'send-outreach'
  | 'book-calls'
  | 'diagnose-on-call'
  | 'present-solution'
  | 'close'
  | 'deliver-fast-wins'
  | 'collect-proof'
  | 'turn-into-case-study'
  | 'repeat-and-scale';

export interface ClientHuntStepResult {
  step: ClientHuntStep;
  status: 'pending' | 'in-progress' | 'complete' | 'skipped';
  output: string;
  agent: string;
}

/** Run the 15-step client hunt workflow. */
export async function runClientHuntWorkflow(
  niche: string,
  painPoint: string,
  callAI: (prompt: string, systemPrompt?: string) => Promise<{ text: string; tokens: number }>,
): Promise<ClientHuntStepResult[]> {
  const stepDefinitions: { step: ClientHuntStep; prompt: string; agent: string }[] = [
    { step: 'pick-niche', prompt: `Pick and validate a niche: ${niche}. Define the ICP, market size, and buying signals.`, agent: 'strategist' },
    { step: 'identify-pain', prompt: `Identify the exact pain point in niche "${niche}": ${painPoint}. Quantify the cost of not solving it.`, agent: 'researcher' },
    { step: 'create-offer', prompt: `Create a clear outcome-focused offer for niche "${niche}" targeting pain: ${painPoint}. Include 3 pricing tiers in INR.`, agent: 'offer-strategist' },
    { step: 'build-list', prompt: `Build a lead list of 20 prospects in niche "${niche}" with contact details and trigger signals.`, agent: 'lead-hunter' },
    { step: 'segment', prompt: `Segment the lead list by fit and priority. Score each on urgency, budget, pain severity, growth potential.`, agent: 'analyst' },
    { step: 'create-outreach', prompt: `Create tailored outreach for each segment in niche "${niche}". Include cold email, DM, LinkedIn message.`, agent: 'writer' },
    { step: 'send-outreach', prompt: `Plan the outreach launch: timing, tracking, A/B subject lines, send limits, compliance.`, agent: 'marketer' },
    { step: 'book-calls', prompt: `Design the booking flow: calendar link, confirmation message, pre-call questionnaire, reminder sequence.`, agent: 'coordinator' },
    { step: 'diagnose-on-call', prompt: `Prepare discovery call script: pain discovery questions, qualification checklist, objection handlers.`, agent: 'sales-optimizer' },
    { step: 'present-solution', prompt: `Create a proposal template for niche "${niche}" with 3-tier pricing, case studies, and risk reversal.`, agent: 'offer-strategist' },
    { step: 'close', prompt: `Build close strategy: urgency creation, payment terms, contract template, onboarding handoff.`, agent: 'sales-optimizer' },
    { step: 'deliver-fast-wins', prompt: `Define the first 3 fast wins to deliver in week 1 after closing. What creates immediate value?`, agent: 'strategist' },
    { step: 'collect-proof', prompt: `Design a proof collection system: testimonials, case studies, before/after metrics, referral prompts.`, agent: 'content-strategist' },
    { step: 'turn-into-case-study', prompt: `Create a case study template: problem, solution, results, metrics, testimonial, CTA.`, agent: 'writer' },
    { step: 'repeat-and-scale', prompt: `Design the scaling playbook: hire plan, SOP creation, client acquisition loop, revenue targets.`, agent: 'growth-hacker' },
  ];

  const results: ClientHuntStepResult[] = [];

  for (const s of stepDefinitions) {
    try {
      const result = await callAI(s.prompt);
      results.push({ step: s.step, status: 'complete', output: result.text, agent: s.agent });
    } catch {
      results.push({ step: s.step, status: 'pending', output: `[Failed: ${s.step}]`, agent: s.agent });
    }
  }

  return results;
}

// ─── Quality Gates ─────────────────────

export interface QualityGateCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface QualityGateResult {
  passed: boolean;
  checks: QualityGateCheck[];
  score: number; // 0-100
}

/** Run the standard quality gate checks on any output. */
export function runQualityGates(
  output: string,
  originalTask: string,
): QualityGateResult {
  const checks: QualityGateCheck[] = [];

  // 1. Objective clear
  const hasObjective = output.length > 100 && (output.includes('##') || output.includes('Objective') || output.includes('Goal'));
  checks.push({ name: 'Objective', passed: hasObjective, message: hasObjective ? 'Objective is clear' : 'Missing clear objective' });

  // 2. Audience clear
  const hasAudience = output.includes('audience') || output.includes('Audience') || output.includes('target') || output.includes('Target') || output.includes('customer') || output.includes('client');
  checks.push({ name: 'Audience', passed: hasAudience, message: hasAudience ? 'Target audience identified' : 'Missing target audience' });

  // 3. Offer/service clear
  const hasOffer = output.includes('offer') || output.includes('Offer') || output.includes('package') || output.includes('pricing') || output.includes('₹');
  checks.push({ name: 'Offer', passed: hasOffer, message: hasOffer ? 'Offer/service is clear' : 'Missing offer or service definition' });

  // 4. Actionable
  const hasAction = output.includes('**Next Step') || output.includes('Next step') || output.includes('Action') || output.includes('##');
  checks.push({ name: 'Actionable', passed: hasAction, message: hasAction ? 'Includes next steps or actions' : 'Missing actionable next steps' });

  // 5. No placeholders
  const noPlaceholders = !output.includes('[INSERT') && !output.includes('[TODO') && !output.includes('[TBD') && !output.includes('[YOUR_');
  checks.push({ name: 'No Placeholders', passed: noPlaceholders, message: noPlaceholders ? 'No placeholder text found' : 'Contains placeholder text' });

  // 6. INR pricing
  const hasINR = !output.includes('$') || output.includes('₹');
  checks.push({ name: 'INR Pricing', passed: hasINR, message: hasINR ? 'Prices in INR or no pricing' : 'Contains USD pricing instead of INR' });

  // 7. Metrics/KPIs
  const hasMetrics = output.includes('KPI') || output.includes('metric') || output.includes('%') || output.includes('target') || output.includes('ROI');
  checks.push({ name: 'Metrics', passed: hasMetrics, message: hasMetrics ? 'Includes metrics or KPIs' : 'Missing measurable metrics' });

  // 8. Risk points
  const hasRisks = output.includes('risk') || output.includes('Risk') || output.includes('warning') || output.includes('Warning') || output.includes('caution');
  checks.push({ name: 'Risk Points', passed: hasRisks, message: hasRisks ? 'Risk points identified' : 'Missing risk assessment' });

  // 9. No contradictions (basic check)
  const sentences = output.split(/[.!?]\s+/);
  const contradictoryPairs = ['always.*never', 'all.*none', 'every.*no'];
  let hasContradiction = false;
  for (const pattern of contradictoryPairs) {
    const regex = new RegExp(pattern, 'i');
    const matches = sentences.filter(s => regex.test(s));
    if (matches.length > 1) hasContradiction = true;
  }
  checks.push({ name: 'No Contradictions', passed: !hasContradiction, message: hasContradiction ? 'Potential contradictions detected' : 'No contradictions found' });

  // 10. Client-ready quality
  const isClientReady = output.length > 200 && hasObjective && noPlaceholders && hasINR;
  checks.push({ name: 'Client Ready', passed: isClientReady, message: isClientReady ? 'Output is client-ready' : 'Output needs polish before delivery' });

  const passedChecks = checks.filter(c => c.passed).length;
  const score = Math.round((passedChecks / checks.length) * 100);

  return {
    passed: score >= 70,
    checks,
    score,
  };
}

// ─── Common Mistake Detection ──────────

export type MistakeType =
  | 'wrong-niche'
  | 'weak-offer'
  | 'no-proof'
  | 'confused-icp'
  | 'channel-mismatch'
  | 'no-funnel'
  | 'no-follow-up'
  | 'no-tracking'
  | 'no-qa'
  | 'over-automation'
  | 'bad-prioritization'
  | 'content-without-strategy'
  | 'seo-without-intent'
  | 'ads-without-landing-fit'
  | 'design-without-conversion'
  | 'video-without-retention'
  | 'no-onboarding-clarity'
  | 'no-iteration-loop';

export interface MistakeDetection {
  type: MistakeType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fix: string;
}

/** Detect common agency mistakes in a task description or output. */
export function detectMistakes(
  task: string,
  output: string,
): MistakeDetection[] {
  const combined = `${task} ${output}`.toLowerCase();
  const mistakes: MistakeDetection[] = [];

  const rules: { type: MistakeType; keywords: string[]; severity: MistakeDetection['severity']; description: string; fix: string }[] = [
    { type: 'wrong-niche', keywords: ['everyone', 'all businesses', 'any industry'], severity: 'critical', description: 'Offer targets too broad a market', fix: 'Narrow to a specific industry, size, and location' },
    { type: 'weak-offer', keywords: ['we offer', 'our services', 'we provide'], severity: 'critical', description: 'Service described without outcome framing', fix: 'Reframe as outcome: "Rank #1 for [keyword] in 90 days"' },

    { type: 'confused-icp', keywords: ['small business', 'startup', 'enterprise', 'freelancer'], severity: 'high', description: 'Target audience is too broad', fix: 'Define one specific segment: size, industry, location, budget' },
    { type: 'channel-mismatch', keywords: ['tiktok', 'pinterest'], severity: 'medium', description: 'Channel choice may not match buyer behavior', fix: 'Match channels to where your specific ICP spends time' },

    { type: 'over-automation', keywords: ['automate everything', 'full automation', '100% automated'], severity: 'medium', description: 'Automation added before process is stable', fix: 'Manual first, automate second. Document the process before automating.' },
    { type: 'bad-prioritization', keywords: ['first', 'start with'], severity: 'medium', description: 'Low-impact tasks may be prioritized over revenue blockers', fix: 'Rank by: revenue impact, speed to value, effort required' },
    { type: 'content-without-strategy', keywords: ['post daily', '3 posts per week', 'content calendar'], severity: 'medium', description: 'Content activity without conversion purpose', fix: 'Every content piece must have a conversion role and CTA' },
    { type: 'seo-without-intent', keywords: ['target keyword', 'rank for'], severity: 'medium', description: 'SEO targeting without search intent match', fix: 'Map keywords to intent: informational, navigational, transactional' },
    { type: 'ads-without-landing-fit', keywords: ['google ads', 'meta ads', 'facebook ads'], severity: 'high', description: 'Ad campaign without landing page alignment', fix: 'Ad promise must match landing page headline and CTA exactly' },
    { type: 'design-without-conversion', keywords: ['beautiful', 'modern', 'clean design'], severity: 'medium', description: 'Design focused on aesthetics without conversion', fix: 'Every design element must guide toward a specific action' },
    { type: 'video-without-retention', keywords: ['video', 'reel', 'youtube'], severity: 'medium', description: 'Video without retention editing strategy', fix: 'Hook in first 3s, pattern interrupts every 15s, CTA at peak attention' },
    { type: 'no-onboarding-clarity', keywords: ['new client', 'onboard'], severity: 'medium', description: 'Client onboarding without clear scope', fix: 'Create onboarding checklist: access, KPIs, scope, cadence, delivery plan' },

  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => combined.includes(kw))) {
      mistakes.push({
        type: rule.type,
        severity: rule.severity,
        description: rule.description,
        fix: rule.fix,
      });
    }
  }

  // Always check for no-keyword rules (proof, funnel, follow-up)
  const hasProof = combined.includes('case study') || combined.includes('before') || combined.includes('result') || combined.includes('testimonial') || combined.includes('example');
  if (!hasProof && output.length > 200) {
    mistakes.push({ type: 'no-proof', severity: 'high', description: 'No case studies, examples, or evidence provided', fix: 'Add at least one case study or before/after metric' });
  }

  const hasFunnel = combined.includes('funnel') || combined.includes('landing page') || combined.includes('lead magnet') || combined.includes('conversion path');
  if (!hasFunnel && output.length > 200) {
    mistakes.push({ type: 'no-funnel', severity: 'high', description: 'No clear conversion funnel defined', fix: 'Define: traffic source → landing page → lead capture → nurture → conversion' });
  }

  const hasFollowUp = combined.includes('follow-up') || combined.includes('follow up') || combined.includes('sequence') || combined.includes('nurture');
  if (!hasFollowUp && output.length > 200) {
    mistakes.push({ type: 'no-follow-up', severity: 'high', description: 'No follow-up sequence defined', fix: 'Add Day 1, 3, 7, 14 follow-up sequence for leads' });
  }

  return mistakes;
}

// ─── Agent Routing for Agency Tasks ────

/** Domain keywords used to detect multi-domain tasks for agency-brain routing. */
export const DOMAIN_KEYWORDS: Record<string, string[]> = {
  seo: ['seo', 'search engine', 'ranking', 'backlink', 'keyword', 'organic traffic'],
  'local-seo': ['local seo', 'google business', 'map pack', 'google my business', 'local search'],
  'paid-ads': ['google ads', 'meta ads', 'facebook ads', 'ppc', 'paid campaign', 'ad campaign'],
  'social-media': ['social media', 'instagram', 'facebook page', 'linkedin post', 'content calendar', 'posting strategy'],
  content: ['blog post', 'article', 'email copy', 'copywriting', 'content writing'],
  web: ['website', 'landing page', 'wireframe', 'web design', 'ux design', 'conversion flow'],
  design: ['graphic design', 'brand design', 'logo', 'brand identity', 'design system', 'ad creative'],
  video: ['video', 'reel', 'youtube', 'video script', 'shot list', 'b-roll', 'video editing'],
  automation: ['automation', 'crm', 'n8n', 'workflow automation', 'lead routing', 'follow-up system'],
  agent: ['voice agent', 'chatbot', 'ai agent', 'build agent', 'agent builder'],
  lead: ['lead gen', 'lead generation', 'lead list', 'cold email', 'cold dm', 'outreach', 'prospect'],
  offer: ['proposal', 'pricing', 'retainer', 'offer', 'package', 'value proposition'],
};

/** Maps each domain to its primary specialist agent. */
export const DOMAIN_AGENT_MAP: Record<string, string> = {
  seo: 'seo-specialist',
  'local-seo': 'seo-specialist',
  'paid-ads': 'marketer',
  'social-media': 'community-manager',
  content: 'writer',
  web: 'web-designer',
  design: 'designer',
  video: 'video-specialist',
  automation: 'workflow',
  agent: 'agent-builder',
  lead: 'lead-hunter',
  offer: 'offer-strategist',
};

/** Detect which agency domains a task touches. */
export function detectTaskDomains(task: string): string[] {
  const lower = task.toLowerCase();
  const matched: string[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(domain);
    }
  }
  return matched;
}

/** Explicit triggers that route to agency-brain regardless of domain count. */
const EXPLICIT_BRAIN_TRIGGERS = [
  'full client acquisition', 'full marketing', 'end-to-end', 'entire workflow',
  'complete strategy', 'full campaign', 'run the operating loop', 'orchestrat',
  'multi-domain', 'cross-domain', 'full agency', 'complete delivery',
  'full pipeline', 'full funnel', 'client acquisition workflow',
];

/** Map agency-specific tasks to the right specialist agents. */
export function routeAgencyTask(
  task: string,
): { primary: string; support: string[]; workflow: string } {
  const lower = task.toLowerCase();

  // ── Explicit agency-brain triggers: full workflow, end-to-end, orchestrate ──
  const isExplicitBrain = EXPLICIT_BRAIN_TRIGGERS.some((trigger) => lower.includes(trigger));

  // ── Multi-domain detection: if the task touches 3+ domains, route to agency-brain ──
  const domains = detectTaskDomains(task);
  const isMultiDomain = domains.length >= 3;

  if (isExplicitBrain || isMultiDomain) {
    const base = ['researcher', 'strategist', 'coordinator', 'editor'];
    const domainSpecific = domains.map((d) => DOMAIN_AGENT_MAP[d] || 'analyst');
    const uniqueSupport = [...new Set([...base, ...domainSpecific])];
    return { primary: 'agency-brain', support: uniqueSupport, workflow: 'agency-brain' };
  }

  // ── Local SEO tasks (must be checked before general SEO since 'local seo' contains 'seo') ──
  if (lower.includes('local seo') || lower.includes('google business') || lower.includes('map pack') || lower.includes('google my business')) {
    return { primary: 'seo-specialist', support: ['content-strategist', 'researcher'], workflow: 'local-seo' };
  }

  // ── Paid ads tasks (specific before general marketing) ──
  if (lower.includes('google ads') || lower.includes('meta ads') || lower.includes('facebook ads') || lower.includes('ppc') || lower.includes('paid campaign')) {
    return { primary: 'marketer', support: ['conversion-optimizer', 'designer'], workflow: 'ads-campaign' };
  }

  // ── Lead generation tasks (compound: lead gen, lead generation, lead list, lead pipeline, not bare 'lead') ──
  if (lower.includes('lead gen') || lower.includes('lead generation') || lower.includes('lead list') || lower.includes('lead pipeline') || lower.includes('prospect list') || lower.includes('outreach') || lower.includes('cold email') || lower.includes('cold dm')) {
    return { primary: 'lead-hunter', support: ['writer', 'sales-optimizer'], workflow: 'lead-gen' };
  }

  // ── Agent building tasks (compound: voice agent, chatbot agent, build agent, ai agent — not bare 'agent') ──
  if (lower.includes('voice agent') || lower.includes('chatbot agent') || lower.includes('build agent') || lower.includes('ai agent') || lower.includes('ai chatbot') || lower.includes('chatbot')) {
    return { primary: 'agent-builder', support: ['developer', 'workflow'], workflow: 'agent-building' };
  }

  // ── SEO tasks (compound: seo audit, seo ranking, seo strategy — not bare 'seo') ──
  if (lower.includes('seo audit') || lower.includes('seo ranking') || lower.includes('seo strategy') || lower.includes('seo optimization') || lower.includes('search engine optimization') || lower.includes('keyword research') || lower.includes('backlink')) {
    return { primary: 'seo-specialist', support: ['content-strategist', 'developer'], workflow: 'seo-audit' };
  }

  // ── Website/web design tasks (compound: web design, ux design, ux flow — not bare 'ux') ──
  if (lower.includes('website') || lower.includes('landing page') || lower.includes('wireframe') || lower.includes('web design') || lower.includes('ux design') || lower.includes('ux flow') || lower.includes('ux improvement') || lower.includes('conversion flow')) {
    return { primary: 'web-designer', support: ['developer', 'designer', 'conversion-optimizer'], workflow: 'web-design' };
  }

  // ── Video tasks (compound: video script, video production, short video, short reel — not bare 'short') ──
  if (lower.includes('video') || lower.includes('reel') || lower.includes('youtube') || lower.includes('short video') || lower.includes('short reel') || lower.includes('short form') || lower.includes('video script') || lower.includes('shot list') || lower.includes('b-roll')) {
    return { primary: 'video-specialist', support: ['designer', 'writer'], workflow: 'video-production' };
  }

  // ── Social media tasks (compound before general content) ──
  if (lower.includes('social media') || lower.includes('instagram') || lower.includes('content calendar') || lower.includes('posting') || lower.includes('social strategy')) {
    return { primary: 'community-manager', support: ['writer', 'designer', 'video-specialist'], workflow: 'social-media' };
  }

  // ── Offer/proposal tasks ──
  if (lower.includes('offer') || lower.includes('proposal') || lower.includes('pricing') || lower.includes('package') || lower.includes('retainer') || lower.includes('value proposition')) {
    return { primary: 'offer-strategist', support: ['finance', 'writer'], workflow: 'offer-creation' };
  }

  // ── Automation tasks (compound: automation workflow, crm automation — not bare 'workflow') ──
  if (lower.includes('automation') || lower.includes('crm') || lower.includes('n8n') || lower.includes('pipeline automation') || lower.includes('workflow automation')) {
    return { primary: 'workflow', support: ['developer', 'coordinator'], workflow: 'automation' };
  }

  // ── Content writing tasks (compound: content writing, blog post, email copy — not bare 'content') ──
  if (lower.includes('blog post') || lower.includes('blog article') || lower.includes('article') || lower.includes('email') || lower.includes('copywriting') || lower.includes('content writing') || lower.includes('blog')) {
    return { primary: 'writer', support: ['seo-specialist', 'content-strategist'], workflow: 'content-creation' };
  }

  // ── Design tasks (compound: graphic design, brand design — not bare 'creative') ──
  if (lower.includes('graphic design') || lower.includes('brand design') || lower.includes('logo') || lower.includes('brand identity') || lower.includes('design system') || lower.includes('design')) {
    return { primary: 'designer', support: ['developer', 'conversion-optimizer'], workflow: 'design' };
  }

  // ── Client acquisition full workflow (compound before generic) ──
  if (lower.includes('client') && (lower.includes('acquire') || lower.includes('hunt') || lower.includes('get client') || lower.includes('find client'))) {
    return { primary: 'strategist', support: ['lead-hunter', 'offer-strategist', 'writer', 'sales-optimizer'], workflow: 'client-hunt' };
  }

  // ── General strategy (fallback) ──
  return { primary: 'strategist', support: ['analyst', 'coordinator'], workflow: 'strategy' };
}

// ─── Standard Output Formats ───────────

export const OUTPUT_FORMATS = {
  strategyBrief: ['Objective', 'Target Audience', 'Offer', 'Channel', 'Funnel Stage', 'Execution Steps', 'KPIs', 'Risk Points', 'QA Checklist'],
  executionChecklist: ['Task', 'Owner', 'Deadline', 'Dependencies', 'Acceptance Criteria', 'Status'],
  taskBreakdown: ['Agent', 'Task', 'Inputs', 'Expected Output', 'Dependencies', 'Estimated Time'],
  auditReport: ['Current State', 'Problems Found', 'Priority Order', 'Expected Impact', 'Risk Factors', 'Quick Wins'],
  clientProposal: ['Executive Summary', 'Current State', 'Strategy', 'Work Plan', 'Tools', 'Pricing', 'KPIs', 'Terms'],
  outreachSequence: ['Subject Line', 'Body', 'CTA', 'Follow-Up (Day 3)', 'Follow-Up (Day 7)', 'Follow-Up (Day 14)'],
  contentPlan: ['Content Pillars', 'Topics', 'Formats', 'Channels', 'Calendar', 'CTA Strategy'],
  funnelMap: ['Traffic Source', 'Landing Page', 'Lead Capture', 'Nurture', 'Conversion', 'Post-Sale'],
  workflowDiagram: ['Step', 'Agent', 'Input', 'Output', 'Quality Gate', 'Estimated Time'],
  optimizationReport: ['Current Metrics', 'Bottlenecks', 'Recommendations', 'Expected Impact', 'Priority'],
} as const;

export type OutputFormatKey = keyof typeof OUTPUT_FORMATS;

// ─── Reasoning Model for Decisions ─────

export interface DecisionOption {
  name: string;
  speedToValue: number;    // 1-10
  likelihoodOfSuccess: number; // 1-10
  cost: number;            // 1-10 (lower = cheaper)
  effort: number;          // 1-10 (lower = less effort)
  scalability: number;     // 1-10
  risk: number;            // 1-10 (lower = less risk)
  measurability: number;   // 1-10
}

/** Rank decision options using the agency reasoning model. */
export function rankDecisionOptions(options: DecisionOption[]): DecisionOption[] {
  return [...options].sort((a, b) => {
    const scoreA = a.speedToValue * 0.2 + a.likelihoodOfSuccess * 0.25 + (10 - a.cost) * 0.1 + (10 - a.effort) * 0.1 + a.scalability * 0.1 + (10 - a.risk) * 0.1 + a.measurability * 0.15;
    const scoreB = b.speedToValue * 0.2 + b.likelihoodOfSuccess * 0.25 + (10 - b.cost) * 0.1 + (10 - b.effort) * 0.1 + b.scalability * 0.1 + (10 - b.risk) * 0.1 + b.measurability * 0.15;
    return scoreB - scoreA;
  });
}

// ─── Internal Self-Check ───────────────

export interface SelfCheckResult {
  understood: boolean;
  avoidedGeneric: boolean;
  coveredChannels: boolean;
  assignedRightAgent: boolean;
  identifiedFailures: boolean;
  gaveNextStep: boolean;
  clientReady: boolean;
  score: number; // 0-7
}

/** Run the internal self-check before finalizing any response. */
export function runSelfCheck(
  task: string,
  output: string,
): SelfCheckResult {
  const lower = `${task} ${output}`.toLowerCase();

  const understood = output.length > 100 && (output.includes('##') || output.includes('Goal') || output.includes('Objective'));
  const avoidedGeneric = !output.includes('in today\'s digital world') && !output.includes('leverage') && !output.includes('synergy');
  const coveredChannels = output.includes('channel') || output.includes('Channel') || output.includes('platform') || output.includes('Platform') || output.length < 300;
  const assignedRightAgent = output.includes('agent') || output.includes('Agent') || output.includes('specialist') || output.length < 300;
  const identifiedFailures = output.includes('risk') || output.includes('Risk') || output.includes('mistake') || output.includes('warning') || output.length < 300;
  const gaveNextStep = output.includes('**Next Step') || output.includes('Next step') || output.includes('Action:');
  const clientReady = output.length > 200 && understood && avoidedGeneric && gaveNextStep;

  const score = [understood, avoidedGeneric, coveredChannels, assignedRightAgent, identifiedFailures, gaveNextStep, clientReady].filter(Boolean).length;

  return { understood, avoidedGeneric, coveredChannels, assignedRightAgent, identifiedFailures, gaveNextStep, clientReady, score };
}
