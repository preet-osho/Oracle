'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { motionVariants, transitions, cardHoverProps, buttonTapProps } from '@/styles/design-tokens';
import type { Workflow } from '@/types';

// ─── 12 Pre-built Workflows ──────────
const WORKFLOWS: Workflow[] = [
  {
    id: 'wf-1-website-launch',
    name: 'Website Launch',
    description: 'Complete website launch from strategy to deployment with SEO and analytics setup.',
    color: '#3b82f6',
    estimatedTime: '4-6 hours',
    domains: ['Development', 'SEO'],
    steps: [
      { id: 's1', name: 'Strategy & Sitemap', description: 'Define goals, audience, and site structure', prompt: 'Create a complete website strategy for [CLIENT]. Define: target audience, 5 primary goals, full sitemap with page hierarchy, and competitive analysis of top 3 competitor websites.' },
      { id: 's2', name: 'Copywriting', description: 'Write all page copy and CTAs', prompt: 'Write complete website copy for all pages in the sitemap. Include: hero sections, about page, services pages, testimonials, FAQ, and contact page. All copy should be conversion-optimized and India-specific.' },
      { id: 's3', name: 'Design Brief', description: 'Create design specifications and visual direction', prompt: 'Create a detailed website design brief including: color palette, typography choices, layout wireframes for key pages, component library recommendations, and mobile-first responsive approach.' },
      { id: 's4', name: 'Development', description: 'Build the website with clean code', prompt: 'Build a production-ready Next.js website with: responsive design, fast loading (LCP < 2.5s), proper SEO meta tags, analytics integration, contact form, and all pages from the sitemap.' },
      { id: 's5', name: 'Launch & SEO', description: 'Deploy, configure analytics, and verify SEO', prompt: 'Create a launch checklist including: DNS setup, SSL verification, Google Search Console submission, GA4 configuration, sitemap.xml, robots.txt, page speed optimization, and mobile responsiveness testing.' },
    ],
  },
  {
    id: 'wf-2-seo-project',
    name: 'SEO Project',
    description: 'End-to-end SEO project from audit to content pipeline with ranking tracking.',
    color: '#10b981',
    estimatedTime: '3-5 hours',
    domains: ['Digital Marketing', 'Content'],
    steps: [
      { id: 's1', name: 'Technical Audit', description: 'Deep technical SEO audit with fixes', prompt: 'Run a comprehensive technical SEO audit for [WEBSITE]. Cover: Core Web Vitals, crawlability, indexation, schema markup, mobile issues, SSL, and site speed. Provide severity ratings and specific fixes for each issue.' },
      { id: 's2', name: 'Keyword Research', description: 'Map keywords to pages with volume data', prompt: 'Conduct keyword research for [CLIENT INDUSTRY] in [CITY]. Map 100+ keywords to pages, organized by intent (informational, commercial, transactional). Include search volume estimates, keyword difficulty, and priority ranking.' },
      { id: 's3', name: 'On-Page Optimization', description: 'Optimize existing pages with target keywords', prompt: 'Create on-page SEO optimization recommendations for the top 20 pages: title tags (60 chars), meta descriptions (155 chars), header structure, internal linking, image alt text, and content improvements.' },
      { id: 's4', name: 'Content Calendar', description: 'Plan 3 months of SEO content', prompt: 'Create a 3-month content calendar with 12 blog posts targeting long-tail keywords. For each: topic, target keyword, word count, content outline, internal links, and expected ranking timeline.' },
      { id: 's5', name: 'Link Building Plan', description: 'Design outreach strategy for quality backlinks', prompt: 'Create a link building strategy: identify 50 linking opportunities (DR 40+), draft outreach email templates, plan guest post topics, and set up monthly link building targets and tracking.' },
    ],
  },
  {
    id: 'wf-3-ad-campaign',
    name: 'Ad Campaign Launch',
    description: 'Launch profitable ad campaigns across Google and Meta platforms.',
    color: '#f59e0b',
    estimatedTime: '3-4 hours',
    domains: ['Google Ads', 'Meta Ads'],
    steps: [
      { id: 's1', name: 'Audience Research', description: 'Define target audiences and competitor analysis', prompt: 'Research and define target audiences for [CLIENT]. Include: demographic profiles, interest targeting, competitor ad analysis (using Google Ads Library and Meta Ads Library), and audience sizing estimates.' },
      { id: 's2', name: 'Campaign Strategy', description: 'Design campaign structure and budget allocation', prompt: 'Design the full campaign strategy: platform mix (Google/Meta/LinkedIn), campaign objectives, budget allocation by platform, bidding strategy, and expected KPIs with benchmarks for [INDUSTRY] in India.' },
      { id: 's3', name: 'Creative Development', description: 'Write ad copy and creative briefs', prompt: 'Create ad creatives for all campaigns: 5 Google RSAs (15 headlines + 4 descriptions each), 5 Meta ad variations (primary text + headline + description), creative briefs for 10 visual assets, and A/B testing plan.' },
      { id: 's4', name: 'Launch & Monitor', description: 'Set up tracking, launch, and first-week monitoring plan', prompt: 'Create the launch checklist: conversion tracking setup, UTM parameter strategy, A/B test configuration, daily monitoring schedule for first week, optimization triggers (when to pause/adjust), and reporting template.' },
    ],
  },
  {
    id: 'wf-4-investment-setup',
    name: 'Investment Portfolio Setup',
    description: 'Build a diversified investment portfolio with SIP strategy and tax optimization.',
    color: '#16a34a',
    estimatedTime: '2-3 hours',
    domains: ['Finance', 'Investment Analysis'],
    steps: [
      { id: 's1', name: 'Goal Mapping', description: 'Define financial goals and risk profile', prompt: 'Create a comprehensive financial goal map for [INVESTOR]. Include: short-term (1-3 years), medium-term (3-7 years), long-term (7+ years) goals with target amounts, risk tolerance assessment, and time horizon for each.' },
      { id: 's2', name: 'Asset Allocation', description: 'Design optimal portfolio allocation', prompt: 'Design asset allocation strategy based on risk profile: equity/debt/gold/alternatives split, specific fund recommendations (Indian mutual funds with direct plan), and reasoning for each allocation decision. All in INR.' },
      { id: 's3', name: 'SIP Setup', description: 'Plan systematic investment schedule', prompt: 'Create a detailed SIP plan: fund-wise monthly amounts, optimal SIP dates, step-up strategy (10% annual increase), and projected portfolio value at 3/5/10 year milestones. Include tax implications.' },
      { id: 's4', name: 'Tax Optimization', description: 'Maximize tax savings with right instruments', prompt: 'Design tax optimization strategy: Section 80C allocation (ELSS, PPF, NPS), Section 80CCD benefits, LTCG planning, and annual tax-saving calendar. All recommendations in INR with current limits.' },
    ],
  },
  {
    id: 'wf-5-client-onboarding',
    name: 'Client Onboarding',
    description: 'Streamline client onboarding from signed contract to project kickoff.',
    color: '#8b5cf6',
    estimatedTime: '1-2 hours',
    domains: ['Operations', 'CRM & Sales Systems'],
    steps: [
      { id: 's1', name: 'Agreement', description: 'Finalize contract and collect initial payment', prompt: 'Create a client onboarding agreement package: scope of work document, payment terms, milestone schedule, communication plan, and team introduction. Include Indian legal essentials and GST details.' },
      { id: 's2', name: 'Access Collection', description: 'Gather all necessary access and assets', prompt: 'Design an access collection checklist: website admin access, social media credentials, analytics access, brand assets, content library, domain/hosting details, and previous campaign data. Create a secure handover form.' },
      { id: 's3', name: 'Kickoff Meeting Prep', description: 'Prepare and run the kickoff meeting', prompt: 'Create a kickoff meeting package: agenda (30 min), discovery questions (20 questions), project timeline visual, team roles and responsibilities, communication cadence, and meeting notes template.' },
      { id: 's4', name: 'First Deliverable', description: 'Deliver the first tangible output within 7 days', prompt: 'Plan the first deliverable for [CLIENT]: define what it should be (audit/report/strategy), quality standards, format, and how to present it for maximum impact. Include client feedback collection process.' },
    ],
  },
  {
    id: 'wf-6-content-machine',
    name: 'Content Production Machine',
    description: 'Build a repeatable content pipeline from research to distribution.',
    color: '#ec4899',
    estimatedTime: '3-5 hours',
    domains: ['Content', 'Content Marketing'],
    steps: [
      { id: 's1', name: 'Topic Research', description: 'Identify high-impact content topics', prompt: 'Research and identify 30 content topics for [CLIENT INDUSTRY]: keyword gaps, trending topics, competitor content gaps, audience questions (from Quora/Reddit), and seasonal opportunities. Prioritize by search volume and conversion potential.' },
      { id: 's2', name: 'Outline', description: 'Create detailed content outlines', prompt: 'Create detailed outlines for 10 articles: target keyword, secondary keywords, heading structure (H2/H3), key points to cover, internal linking opportunities, word count target, and content format (how-to, listicle, guide).' },
      { id: 's3', name: 'Draft', description: 'Write the first drafts', prompt: 'Write a complete first draft for [ARTICLE TOPIC]: 2000+ words, SEO-optimized structure, engaging introduction with hook, actionable content with examples, FAQ section, and compelling conclusion with CTA. Ready for editing.' },
      { id: 's4', name: 'Edit', description: 'Polish and optimize the content', prompt: 'Edit and polish the draft content: improve readability (Grade 8 level), add power words, optimize for featured snippets, ensure proper formatting, add image suggestions, verify SEO elements, and check for factual accuracy.' },
      { id: 's5', name: 'Distribute', description: 'Publish and promote across channels', prompt: 'Create a distribution plan: publish on website with on-page SEO, repurpose into 5 social media posts, create email newsletter snippet, submit to Medium, answer related Quora questions with links, and schedule promotional posts.' },
    ],
  },
  {
    id: 'wf-7-lead-mining',
    name: 'Lead Mining System',
    description: 'Find businesses without websites or with poor digital presence using Google Maps scraping.',
    color: '#f97316',
    estimatedTime: '2-4 hours',
    domains: ['Lead Generation', 'Local SEO'],
    steps: [
      { id: 's1', name: 'Define Search Parameters', description: 'Set city, categories, and qualification criteria', prompt: 'Configure lead mining parameters: target city, business categories (restaurants, dental clinics, salons, gyms, coaching centres, real estate agents), qualification criteria (no website, low rating <3.8, old reviews >6 months, poor profile photos). Include 10+ business categories.' },
      { id: 's2', name: 'Google Maps Scraping', description: 'Extract business data from Google Maps', prompt: 'Scrape Google Maps for businesses matching the criteria. Extract: business name, phone, address, rating, review count, website URL, Google Maps URL, profile photo quality. Use the search queries: "[category] near me", "[category] in [city]".' },
      { id: 's3', name: 'Qualify Leads', description: 'Filter and score leads based on criteria', prompt: 'Qualify each lead based on: (1) No website = high priority, (2) Rating < 3.8 with 10+ reviews = medium priority, (3) Last review > 6 months = medium priority, (4) Poor profile photos = low priority. Score each lead 1-10.' },
      { id: 's4', name: 'Generate Outreach Messages', description: 'Create personalised WhatsApp/email messages', prompt: 'Generate personalised outreach messages for each qualified lead. Reference their specific issues (no website, low rating, etc.). Write in natural Hinglish. Include a clear CTA and expected outcome. Make it sound human, not salesy.' },
      { id: 's5', name: 'Export Lead List', description: 'Create CSV with all lead data', prompt: 'Export the qualified lead list as CSV with columns: business_name, phone, address, city, category, rating, review_count, website, priority_score, personalised_message, status (New).' },
    ],
  },
  {
    id: 'wf-8-website-audit',
    name: 'Website Quality Audit',
    description: 'Audit client websites for issues and generate improvement proposals.',
    color: '#06b6d4',
    estimatedTime: '2-3 hours',
    domains: ['SEO', 'Website Development'],
    steps: [
      { id: 's1', name: 'Technical Analysis', description: 'Run PageSpeed, mobile, security checks', prompt: 'Run comprehensive technical analysis: Google PageSpeed Insights (mobile + desktop), GTmetrix, SSL check, security headers, mobile responsiveness test across 5 devices. Record all scores and issues.' },
      { id: 's2', name: 'Content Audit', description: 'Analyze content quality and SEO', prompt: 'Audit website content: title tags, meta descriptions, header hierarchy, image alt text, internal linking, thin content pages (<300 words), duplicate content, keyword optimization. Compare with top 3 competitors.' },
      { id: 's3', name: 'Conversion Analysis', description: 'Review CTAs, forms, user flow', prompt: 'Analyze conversion elements: CTA placement and copy, form fields and friction points, trust signals (testimonials, badges), user flow from landing to conversion, mobile conversion path. Identify top 5 improvement opportunities.' },
      { id: 's4', name: 'Competitor Benchmark', description: 'Compare with 3 competitor websites', prompt: 'Benchmark against top 3 competitors: design quality, content depth, SEO scores, conversion elements, unique selling points. Create comparison table with specific metrics.' },
      { id: 's5', name: 'Generate Proposal', description: 'Create improvement proposal with pricing', prompt: 'Generate a professional improvement proposal: executive summary, current state analysis, recommended improvements (prioritised), timeline, 3-tier pricing (Essential/Growth/Premium), expected ROI. All prices in INR. Client-ready format.' },
    ],
  },
  {
    id: 'wf-9-content-machine',
    name: 'Content Machine Retainer',
    description: 'Monthly content production: 30 social posts + 4 blogs + 8 reel scripts.',
    color: '#ec4899',
    estimatedTime: '3-5 hours',
    domains: ['Content Marketing', 'Social Media'],
    steps: [
      { id: 's1', name: 'Content Strategy', description: 'Define pillars, themes, and calendar', prompt: 'Create monthly content strategy: 4 content pillars (educational, entertaining, promotional, UGC), monthly theme alignment, festival/event tie-ins (Diwali, IPL, etc.), trending format suggestions, posting schedule (best times for India).' },
      { id: 's2', name: 'Social Media Calendar', description: 'Write 30 days of Instagram/LinkedIn content', prompt: 'Write complete 30-day social media calendar: post type (Reel/Carousel/Story/Static), caption (ready to post), 15-20 hashtags, visual brief, best posting time, engagement strategy. Mix: 40% educational, 25% entertaining, 20% promotional, 15% UGC.' },
      { id: 's3', name: 'Blog Content', description: 'Write 4 SEO-optimised blog posts', prompt: 'Write 4 complete blog posts (2000+ words each): SEO-optimized structure, engaging hooks, actionable content with examples, FAQ section, internal link suggestions, meta data (title, description, URL slug). Target long-tail keywords.' },
      { id: 's4', name: 'Reel Scripts', description: 'Write 8 video scripts for Reels/Shorts', prompt: 'Write 8 complete video scripts: hook (0-5 sec), intro, main content, CTA, post-production notes. Include: visual direction, text overlays, trending audio suggestions, thumbnail concepts. Format for Instagram Reels and YouTube Shorts.' },
      { id: 's5', name: 'Distribution Plan', description: 'Cross-platform promotion strategy', prompt: 'Create distribution plan: Medium syndication, Quora answers with links, email newsletter snippet, WhatsApp broadcast, LinkedIn article adaptation, Pinterest pins. Include scheduling and tracking.' },
    ],
  },
  {
    id: 'wf-10-voice-agent',
    name: 'Voice Agent Setup',
    description: 'Configure AI voice agent for clinics/restaurants/real estate.',
    color: '#6366f1',
    estimatedTime: '4-6 hours',
    domains: ['AI Agents', 'Voice Technology'],
    steps: [
      { id: 's1', name: 'Intent Mapping', description: 'Define top 20 caller intents', prompt: 'Map top 20 caller intents for [BUSINESS TYPE]: appointment booking, pricing inquiry, location/hours, service details, complaint handling, referral, emergency, etc. For each intent: ideal response, routing rule, escalation path. Include Hindi and English variants.' },
      { id: 's2', name: 'Conversation Flow', description: 'Design natural conversation scripts', prompt: 'Design conversation flows: greeting (warm, professional), qualification questions, routing logic, appointment booking, objection handling, goodbye. Include: natural pauses, filler words, emotional tone, error recovery. Test with 50+ scenarios.' },
      { id: 's3', name: 'Technical Setup', description: 'Configure VAPI/Sarvam with telephony', prompt: 'Set up voice agent: VAPI account configuration, Sarvam AI integration for Hindi, Twilio telephony setup, call forwarding rules, recording and logging, CRM integration (auto-log calls), calendar sync for appointments.' },
      { id: 's4', name: 'Testing & QA', description: 'Test with 100+ simulated calls', prompt: 'Create test scenarios: happy path (10 calls), edge cases (20 calls), error handling (10 calls), Hindi/English mix (10 calls), emotional callers (10 calls), complex requests (10 calls). Record metrics: success rate, avg call duration, customer satisfaction.' },
      { id: 's5', name: 'Go-Live & Monitoring', description: 'Deploy and set up analytics dashboard', prompt: 'Create go-live plan: parallel testing (AI + human), daily monitoring checklist, weekly optimization report, monthly performance review. Dashboard: call volume, success rate, avg duration, top intents, conversion rate. Set up alerts for failures.' },
    ],
  },
  {
    id: 'wf-11-client-proposal',
    name: 'Client Proposal Generator',
    description: 'Generate professional proposals with scope, pricing, and timelines.',
    color: '#84cc16',
    estimatedTime: '1-2 hours',
    domains: ['Operations', 'Sales'],
    steps: [
      { id: 's1', name: 'Client Research', description: 'Research client business and competitors', prompt: 'Research [CLIENT NAME]: company background, industry position, current online presence, competitors, target audience, pain points. Use Google, LinkedIn, company website. Create a 1-page summary.' },
      { id: 's2', name: 'Scope Definition', description: 'Define deliverables and milestones', prompt: 'Define project scope: specific deliverables with quantities, timeline with milestones, team roles, communication cadence, revision policy, success criteria. Create a Gantt-style timeline visual.' },
      { id: 's3', name: 'Pricing Strategy', description: 'Create 3-tier pricing packages', prompt: 'Design 3-tier pricing: Essential (₹XX,XXX) - basic needs, Growth (₹XX,XXX) - recommended, Premium (₹XX,XXX) - full service. For each: what is included, expected outcomes, ROI justification. All prices in INR. Make Growth tier the obvious choice.' },
      { id: 's4', name: 'Proposal Document', description: 'Write complete proposal PDF content', prompt: 'Write complete proposal: cover page, executive summary, current state analysis, strategy overview, detailed work plan, tools and resources, pricing table, KPIs and reporting, team and contacts, terms and conditions, next steps. Professional enough for ₹50,000+ client.' },
      { id: 's5', name: 'Follow-Up Sequence', description: 'Plan proposal follow-up cadence', prompt: 'Create follow-up sequence: Day 1 - Send proposal with personalised email, Day 3 - Check-in call/message, Day 7 - Share relevant case study, Day 14 - Limited-time offer/reminder, Day 21 - Final follow-up. Include WhatsApp and email templates.' },
    ],
  },
  {
    id: 'wf-12-weekly-routine',
    name: 'Agency Weekly Routine',
    description: 'Structured weekly tasks for lead gen, client work, and business growth.',
    color: '#14b8a6',
    estimatedTime: '1-2 hours',
    domains: ['Operations', 'Lead Generation'],
    steps: [
      { id: 's1', name: 'Monday: Lead Generation', description: 'Run lead mining and outreach campaigns', prompt: 'Monday lead gen tasks: (1) Run Google Maps lead mining for 2 cities, (2) Check job listings for digital marketing hires, (3) Monitor Reddit/LinkedIn for pain signals, (4) Send 10 personalised outreach messages, (5) Update lead tracker with new leads and status changes.' },
      { id: 's2', name: 'Tuesday-Thursday: Client Work', description: 'Focus on deliverables and client communication', prompt: 'Client work focus: Tuesday - Content production (blogs, social posts), Wednesday - Technical work (SEO, ads, website), Thursday - Client communication and lead conversion. For each day: priority tasks, time blocks, client updates, deliverable deadlines.' },
      { id: 's3', name: 'Friday: Business Review', description: 'Weekly metrics and strategy adjustment', prompt: 'Friday review: (1) Weekly metrics (leads found, proposals sent, revenue), (2) Client satisfaction check, (3) Pipeline review, (4) Content performance analysis, (5) Next week planning. Create a simple dashboard with 5 key metrics.' },
      { id: 's4', name: 'Lead Follow-Up', description: 'Follow up with warm/hot leads', prompt: 'Follow-up tasks: (1) Check lead tracker for overdue follow-ups, (2) Send follow-up messages to warm leads, (3) Schedule calls with hot leads, (4) Update lead statuses, (5) Generate new outreach messages for cold leads. Template: WhatsApp message + email.' },
      { id: 's5', name: 'Growth Activities', description: 'Business development and networking', prompt: 'Growth tasks: (1) Post thought leadership on LinkedIn, (2) Answer 3 Quora questions in niche, (3) Connect with 5 potential partners/clients, (4) Review and optimise automation workflows, (5) Research new tools/services to offer. Time block: 1 hour.' },
    ],
  },
];

// ─── Step Status ──────────────────────
type StepStatus = 'pending' | 'running' | 'done';

// ─── WorkflowsTab ─────────────────────
export function WorkflowsTab({ onRunPrompt }: { onRunPrompt?: (prompt: string) => void }) {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stepOutputs, setStepOutputs] = useState<Record<string, string>>({});

  const activeWorkflow = WORKFLOWS.find((w) => w.id === activeWorkflowId);

  const resetWorkflow = useCallback(() => {
    const statuses: Record<string, StepStatus> = {};
    activeWorkflow?.steps.forEach((s) => { statuses[s.id] = 'pending'; });
    setStepStatuses(statuses);
    setCurrentStepIndex(0);
    setStepOutputs({});
    setIsRunning(false);
    setIsPaused(false);
  }, [activeWorkflow]);

  const startWorkflow = useCallback((wf: Workflow) => {
    setActiveWorkflowId(wf.id);
  }, []);

  // Simulate step execution
  useEffect(() => {
    if (!isRunning || isPaused || !activeWorkflow) return;
    if (currentStepIndex >= activeWorkflow.steps.length) {
      setIsRunning(false);
      return;
    }

    const step = activeWorkflow.steps[currentStepIndex];
    setStepStatuses((prev) => ({ ...prev, [step.id]: 'running' }));

    const timer = setTimeout(() => {
      setStepStatuses((prev) => ({ ...prev, [step.id]: 'done' }));
      setStepOutputs((prev) => ({
        ...prev,
        [step.id]: `[Output from ${step.name}]\n\n${step.prompt}\n\n✓ Step completed successfully. Results ready for next step.`,
      }));
      setCurrentStepIndex((prev) => prev + 1);
    }, 3000);

    return () => { clearTimeout(timer); };
  }, [isRunning, isPaused, currentStepIndex, activeWorkflow]);

  const handlePauseResume = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-5xl">
          {activeWorkflow ? (
            <ActiveWorkflowView
              workflow={activeWorkflow}
              stepStatuses={stepStatuses}
              currentStepIndex={currentStepIndex}
              isPaused={isPaused}
              isRunning={isRunning}
              stepOutputs={stepOutputs}
              onStart={() => { setIsRunning(true); setIsPaused(false); }}
              onPauseResume={handlePauseResume}
              onReset={resetWorkflow}
              onBack={() => { setActiveWorkflowId(null); resetWorkflow(); }}
              onRunPrompt={onRunPrompt}
            />
          ) : (
            <>
              <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🔄 Workflows</h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">{WORKFLOWS.length} automated multi-step workflows to streamline your agency operations</p>
              </motion.div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {WORKFLOWS.map((wf) => (
                  <motion.div key={wf.id} variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} {...cardHoverProps}>
                    <div className="oracle-glass rounded-2xl p-5 transition-all duration-200 hover:border-[var(--oracle-border-strong)]">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${wf.color}20` }}>
                          <span className="text-lg" style={{ color: wf.color }}>🔄</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{wf.name}</h3>
                          <p className="mt-0.5 text-[12px] text-[var(--oracle-text-3)]">{wf.description}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-[11px] text-[var(--oracle-text-muted)]">
                        <span>📋 {wf.steps.length} steps</span>
                        <span>⏱ {wf.estimatedTime}</span>
                      </div>

                      {/* Step Preview */}
                      <div className="mt-3 space-y-1">
                        {wf.steps.slice(0, 3).map((s, i) => (
                          <div key={s.id} className="flex items-center gap-2 text-[11px] text-[var(--oracle-text-3)]">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold" style={{ backgroundColor: `${wf.color}20`, color: wf.color }}>{i + 1}</span>
                            <span className="truncate">{s.name}</span>
                          </div>
                        ))}
                        {wf.steps.length > 3 && <p className="text-[10px] text-[var(--oracle-text-muted)]">+{wf.steps.length - 3} more steps</p>}
                      </div>

                      <motion.button
                        {...buttonTapProps}
                        onClick={() => startWorkflow(wf)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all"
                        style={{ backgroundColor: wf.color }}
                      >
                        ▶ Start Workflow
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Active Workflow View ──────────────
function ActiveWorkflowView({
  workflow,
  stepStatuses,
  currentStepIndex,
  isPaused,
  isRunning,
  stepOutputs,
  onStart,
  onPauseResume,
  onReset,
  onBack,
  onRunPrompt,
}: {
  workflow: Workflow;
  stepStatuses: Record<string, StepStatus>;
  currentStepIndex: number;
  isPaused: boolean;
  isRunning: boolean;
  stepOutputs: Record<string, string>;
  onStart: () => void;
  onPauseResume: () => void;
  onReset: () => void;
  onBack: () => void;
  onRunPrompt?: (prompt: string) => void;
}) {
  const completedSteps = Object.values(stepStatuses).filter((s) => s === 'done').length;
  const progress = (completedSteps / workflow.steps.length) * 100;

  return (
    <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button {...buttonTapProps} onClick={onBack} className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[12px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
            ← Back
          </motion.button>
          <div>
            <h1 className="text-[18px] font-bold text-[var(--oracle-text-1)]">{workflow.name}</h1>
            <p className="text-[12px] text-[var(--oracle-text-3)]">{completedSteps}/{workflow.steps.length} steps completed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isRunning && completedSteps === 0 && (
            <motion.button {...buttonTapProps} onClick={onStart} className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all" style={{ backgroundColor: workflow.color }}>
              ▶ Start
            </motion.button>
          )}
          {isRunning && (
            <motion.button {...buttonTapProps} onClick={onPauseResume} className="rounded-xl border border-[var(--oracle-border)] px-4 py-2 text-[13px] font-medium text-[var(--oracle-text-2)] hover:bg-[var(--oracle-card-hover)] transition-colors">
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </motion.button>
          )}
          <motion.button {...buttonTapProps} onClick={onReset} className="rounded-xl border border-[var(--oracle-border)] px-4 py-2 text-[13px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors">
            ↺ Reset
          </motion.button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[var(--oracle-surface-2)]">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: workflow.color }} animate={{ width: `${progress}%` }} transition={transitions.smooth} />
      </div>

      {/* Main Layout: Timeline + Output */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Timeline */}
        <div className="space-y-2">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">Timeline</h3>
          {workflow.steps.map((step, i) => {
            const status = stepStatuses[step.id] || 'pending';
            const isCurrent = i === currentStepIndex && isRunning;
            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 rounded-xl p-3 transition-all ${
                  isCurrent ? 'oracle-glass ring-1' : ''
                }`}
                style={isCurrent ? { borderColor: `${workflow.color}40` } : undefined}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    status === 'done' ? 'text-white' : status === 'running' ? 'text-white animate-pulse' : 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]'
                  }`}
                  style={status !== 'pending' ? { backgroundColor: workflow.color } : undefined}
                >
                  {status === 'done' ? '✓' : status === 'running' ? '⟳' : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[12px] font-medium ${status === 'done' ? 'text-[var(--oracle-success)]' : isCurrent ? 'text-[var(--oracle-text-1)]' : 'text-[var(--oracle-text-3)]'}`}>
                    {step.name}
                  </p>
                  <p className="text-[11px] text-[var(--oracle-text-muted)] truncate">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Output Panel */}
        <div className="oracle-glass rounded-2xl p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">Output</h3>
          {workflow.steps.map((step) => {
            const output = stepOutputs[step.id];
            const status = stepStatuses[step.id];
            if (!output && status !== 'running') return null;
            return (
              <div key={step.id} className="mb-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] font-semibold" style={{ color: workflow.color }}>{step.name}</span>
                  <span className="rounded-full bg-[var(--oracle-success)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--oracle-success)]">✓ Done</span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-[var(--oracle-surface-2)] p-3 text-[11px] leading-relaxed text-[var(--oracle-text-2)] font-mono">
                  {status === 'running' ? (
                    <span className="oracle-cursor">Processing {step.name}...</span>
                  ) : (
                    output
                  )}
                </pre>
                {status === 'done' && output && onRunPrompt && (
                  <motion.button
                    {...buttonTapProps}
                    onClick={() => onRunPrompt(step.prompt)}
                    className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--oracle-text-3)] transition-colors hover:border-[var(--oracle-primary)]/50 hover:text-[var(--oracle-primary-l)]"
                  >
                    ⚡ Send to Agent
                  </motion.button>
                )}
              </div>
            );
          })}
          {completedSteps === 0 && (
            <div className="py-12 text-center text-[var(--oracle-text-muted)]">
              <p className="text-[32px]">📋</p>
              <p className="mt-2 text-[13px]">Click Start to begin the workflow</p>
              <p className="mt-1 text-[11px]">Each step will execute sequentially with output passed to the next step.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
