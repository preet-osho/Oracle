// ═══════════════════════════════════════
// ORACLE — Agent Configuration Constants
// Extracted from ChatPanel.tsx for reuse
// ═══════════════════════════════════════

import { VALID_AGENTS } from '@/lib/workflow-validation';
import {
  RESEARCHER_AGENT_PROMPT,
  WRITER_AGENT_PROMPT,
  DEVELOPER_AGENT_PROMPT,
  ANALYST_AGENT_PROMPT,
  STRATEGIST_AGENT_PROMPT,
  MARKETER_AGENT_PROMPT,
  DESIGNER_AGENT_PROMPT,
  FINANCE_AGENT_PROMPT,
  VOICE_AGENT_PROMPT,
  QA_AGENT_PROMPT,
  COORDINATOR_AGENT_PROMPT,
  WORKFLOW_AGENT_PROMPT,
  LEGAL_AGENT_PROMPT,
  SECURITY_AUDITOR_AGENT_PROMPT,
  DATA_SCIENTIST_AGENT_PROMPT,
  COMPETITOR_INTEL_AGENT_PROMPT,
  EDITOR_AGENT_PROMPT,
  LOCALIZATION_AGENT_PROMPT,
  DEVOPS_AGENT_PROMPT,
  UX_RESEARCHER_AGENT_PROMPT,
  GROWTH_HACKER_AGENT_PROMPT,
  SEO_SPECIALIST_AGENT_PROMPT,
  CONTENT_STRATEGIST_AGENT_PROMPT,
  CONVERSION_OPTIMIZER_AGENT_PROMPT,
  COMMUNITY_MANAGER_AGENT_PROMPT,
  SALES_OPTIMIZER_AGENT_PROMPT,
  ACCESSIBILITY_AUDITOR_AGENT_PROMPT,
  API_DOCS_WRITER_AGENT_PROMPT,
  ORCHESTRATOR_AGENT_PROMPT,
  AGENCY_BRAIN_AGENT_PROMPT,
  LEAD_HUNTER_AGENT_PROMPT,
  OFFER_STRATEGIST_AGENT_PROMPT,
  VIDEO_SPECIALIST_AGENT_PROMPT,
  WEB_DESIGNER_AGENT_PROMPT,
  AGENT_BUILDER_AGENT_PROMPT,
  SYSTEMS_ARCHITECT_AGENT_PROMPT,
  PRODUCT_ENGINEER_AGENT_PROMPT,
  INTELLIGENCE_ARCHITECT_AGENT_PROMPT,
  TRAINING_ARCHITECT_AGENT_PROMPT,
  SECURITY_ARCHITECT_AGENT_PROMPT,
  SEO_STRATEGIST_AGENT_PROMPT,
  PRODUCT_DESIGNER_AGENT_PROMPT,
  SUPER_ORCHESTRATOR_AGENT_PROMPT,
} from '@/lib/agents/registry';
import {
  enhanceWithGodMode,
  hasGodMode,
  removeGodMode,
  GOD_MODE_OPTIMIZED_AGENTS,
  type GodModeLevel,
} from '@/lib/agents/god-mode';

// ─── Types ─────────────────────────────

export type AgentType = 'orchestrator' | (typeof VALID_AGENTS)[number];
export type AgentGroup = 'Core' | 'Specialist' | 'Meta';

// ─── Shared Types ──────────────────────

export interface ConversationSummary {
  id: string;
  title: string;
  agentType: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  clientName: string;
  industry: string;
  service: string;
  status: 'Active' | 'Paused' | 'Complete' | 'On Hold' | 'Prospect';
  memoryCount: number;
}

// ─── Project Status Colors ─────────────

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  Active: 'var(--oracle-success)',
  Paused: 'var(--oracle-warning)',
  Complete: 'var(--oracle-info)',
  'On Hold': 'var(--oracle-text-muted)',
  Prospect: 'var(--oracle-primary-l)',
};

// ─── Agent Labels ──────────────────────

export const AGENT_LABELS: Record<
  AgentType,
  { label: string; emoji: string; description: string; group: AgentGroup }
> = {
  // ── Core Agents ──
  orchestrator: { label: 'Orchestrator', emoji: '⚡', description: 'Auto-decompose complex tasks across specialist agents', group: 'Core' },
  researcher: { label: 'Researcher', emoji: '🔍', description: 'Web research, data gathering, competitive analysis', group: 'Core' },
  writer: { label: 'Writer', emoji: '✍️', description: 'Content creation, copywriting, documentation', group: 'Core' },
  developer: { label: 'Developer', emoji: '💻', description: 'Code generation, technical implementation, debugging', group: 'Core' },
  analyst: { label: 'Analyst', emoji: '📊', description: 'Data analysis, SEO audit, ads optimization', group: 'Core' },
  coordinator: { label: 'Coordinator', emoji: '📋', description: 'Project management, delivery, client communication', group: 'Core' },
  workflow: { label: 'Workflow', emoji: '🔗', description: 'Chain multiple agents in sequence for multi-phase projects', group: 'Core' },
  'agency-brain': { label: 'Agency Brain', emoji: '🧠', description: 'Multi-agent orchestration for client acquisition & delivery', group: 'Core' },
  // ── Specialist Domain Agents ──
  strategist: { label: 'Strategist', emoji: '🎯', description: 'Business strategy, growth planning, competitive positioning', group: 'Specialist' },
  marketer: { label: 'Marketer', emoji: '📣', description: 'Digital marketing, campaigns, social media, growth hacking', group: 'Specialist' },
  designer: { label: 'Designer', emoji: '🎨', description: 'UI/UX design, brand identity, visual systems', group: 'Specialist' },
  finance: { label: 'Finance', emoji: '💰', description: 'Pricing strategy, budgeting, ROI, financial modeling', group: 'Specialist' },
  voice: { label: 'Voice', emoji: '🎙️', description: 'Voice agent config, telephony, VAPI/Sarvam/ElevenLabs', group: 'Specialist' },
  qa: { label: 'QA', emoji: '🛡️', description: 'Quality assurance, code review, testing, security', group: 'Specialist' },
  legal: { label: 'Legal', emoji: '⚖️', description: 'GST compliance, contract review, DPDP Act, advertising rules', group: 'Specialist' },
  'security-auditor': { label: 'Security Auditor', emoji: '🔒', description: 'OWASP Top 10, API security, infrastructure security', group: 'Specialist' },
  'data-scientist': { label: 'Data Scientist', emoji: '🔬', description: 'Statistical analysis, ML recommendations, predictive modeling', group: 'Specialist' },
  'competitor-intel': { label: 'Competitor Intel', emoji: '🕵️', description: 'Competitive landscape, SWOT analysis, market positioning', group: 'Specialist' },
  editor: { label: 'Editor', emoji: '📝', description: 'Grammar, consistency, tone alignment, final quality gate', group: 'Specialist' },
  localization: { label: 'Localization', emoji: '🌍', description: 'Translation, cultural adaptation, multilingual content', group: 'Specialist' },
  devops: { label: 'DevOps', emoji: '🚀', description: 'CI/CD pipelines, cloud infrastructure, containerization', group: 'Specialist' },
  'ux-researcher': { label: 'UX Researcher', emoji: '🧑‍🔬', description: 'User interviews, usability testing, journey mapping', group: 'Specialist' },
  'growth-hacker': { label: 'Growth Hacker', emoji: '📈', description: 'Growth loops, acquisition channels, retention optimization', group: 'Specialist' },
  'seo-specialist': { label: 'SEO Specialist', emoji: '🔎', description: 'Technical SEO, on-page, link building, AI Overview optimization', group: 'Specialist' },
  'content-strategist': { label: 'Content Strategist', emoji: '📰', description: 'Content audit, editorial calendar, topic clusters', group: 'Specialist' },
  'conversion-optimizer': { label: 'Conversion Optimizer', emoji: '🎯', description: 'Funnel analysis, A/B testing, checkout optimization', group: 'Specialist' },
  'community-manager': { label: 'Community Manager', emoji: '💬', description: 'Community strategy, engagement loops, brand voice', group: 'Specialist' },
  'sales-optimizer': { label: 'Sales Optimizer', emoji: '💼', description: 'Sales pipeline, enablement, outbound sequences', group: 'Specialist' },
  'accessibility-auditor': { label: 'Accessibility Auditor', emoji: '♿', description: 'WCAG compliance, screen reader testing, inclusive design', group: 'Specialist' },
  'api-docs-writer': { label: 'API Docs Writer', emoji: '📖', description: 'API reference docs, tutorials, OpenAPI specs', group: 'Specialist' },
  'lead-hunter': { label: 'Lead Hunter', emoji: '🎯', description: 'Prospect finding, lead scoring, outreach sequences', group: 'Specialist' },
  'offer-strategist': { label: 'Offer Strategist', emoji: '💎', description: 'Outcome-based offers, pricing tiers, proposals', group: 'Specialist' },
  'video-specialist': { label: 'Video', emoji: '🎬', description: 'Video concepts, scripts, shot plans, repurposing', group: 'Specialist' },
  'web-designer': { label: 'Web Designer', emoji: '🌐', description: 'Website UX, wireframes, conversion flow, CTA strategy', group: 'Specialist' },
  'agent-builder': { label: 'Agent Builder', emoji: '🤖', description: 'AI agent design, tools, memory, routing, quality gates', group: 'Specialist' },
  // ── Meta/System-Level Agents ──
  'systems-architect': { label: 'Systems Architect', emoji: '🏗️', description: 'Multi-agent OS architecture, tool/MCP design, scalability', group: 'Meta' },
  'product-engineer': { label: 'Product Engineer', emoji: '🔧', description: 'Codebase analysis, bug fixing, production readiness', group: 'Meta' },
  'intelligence-architect': { label: 'Intelligence Architect', emoji: '🧬', description: 'Superior AI platform design, competitive gap analysis', group: 'Meta' },
  'training-architect': { label: 'Training Architect', emoji: '🎓', description: 'Agent training systems, evaluation rubrics, continuous improvement', group: 'Meta' },
  'security-architect': { label: 'Security Architect', emoji: '🔐', description: 'Zero Trust architecture, threat modeling, DevSecOps pipelines, incident response', group: 'Meta' },
  // ── Advanced Specialist Variants ──
  'seo-strategist': { label: 'SEO Strategist', emoji: '♟️', description: 'Strategic SEO planning, AI SEO, content architecture, competitive positioning', group: 'Specialist' },
  'product-designer': { label: 'Product Designer', emoji: '🖌️', description: 'Design systems, component libraries, visual design, AI-native UI patterns', group: 'Specialist' },
  'super-orchestrator': { label: 'Super Orchestrator', emoji: '🌌', description: 'GOD MODE universal AI operating partner, invisible complexity, zero-click automation', group: 'Meta' },
};

// ─── Agent Types List ──────────────────

export const AGENT_TYPES = (['orchestrator', ...VALID_AGENTS] as const).map((id) => ({
  id,
  ...AGENT_LABELS[id],
}));

// ─── Agent Groups ──────────────────────

export const AGENT_GROUPS = ['Core', 'Specialist', 'Meta'] as const;

// ─── GOD MODE Support ─────────────────

/** Get a prompt enhanced with GOD MODE for high-stakes tasks */
export function getGodModePrompt(agentType: AgentType, level: GodModeLevel = 'standard'): string | null {
  const basePrompt = AGENT_SYSTEM_PROMPTS[agentType];
  if (!basePrompt) return null;
  return enhanceWithGodMode(basePrompt, level);
}

/** Check if an agent supports GOD MODE enhancement */
export function supportsGodMode(agentType: AgentType): boolean {
  return GOD_MODE_OPTIMIZED_AGENTS.includes(agentType as typeof GOD_MODE_OPTIMIZED_AGENTS[number]);
}

/** Get the appropriate prompt (with or without GOD MODE) */
export function getPromptWithGodMode(
  agentType: AgentType,
  godModeEnabled: boolean = false,
  level: GodModeLevel = 'standard'
): string | null {
  const basePrompt = AGENT_SYSTEM_PROMPTS[agentType];
  if (!basePrompt) return null;
  if (!godModeEnabled || !supportsGodMode(agentType)) return basePrompt;
  return enhanceWithGodMode(basePrompt, level);
}

// ─── Agent-Specific System Prompts ─────

export const AGENT_SYSTEM_PROMPTS: Record<AgentType, string | null> = {
  orchestrator: null,
  researcher: RESEARCHER_AGENT_PROMPT,
  writer: WRITER_AGENT_PROMPT,
  developer: DEVELOPER_AGENT_PROMPT,
  analyst: ANALYST_AGENT_PROMPT,
  strategist: STRATEGIST_AGENT_PROMPT,
  marketer: MARKETER_AGENT_PROMPT,
  designer: DESIGNER_AGENT_PROMPT,
  finance: FINANCE_AGENT_PROMPT,
  voice: VOICE_AGENT_PROMPT,
  qa: QA_AGENT_PROMPT,
  coordinator: COORDINATOR_AGENT_PROMPT,
  workflow: WORKFLOW_AGENT_PROMPT,
  legal: LEGAL_AGENT_PROMPT,
  'security-auditor': SECURITY_AUDITOR_AGENT_PROMPT,
  'data-scientist': DATA_SCIENTIST_AGENT_PROMPT,
  'competitor-intel': COMPETITOR_INTEL_AGENT_PROMPT,
  editor: EDITOR_AGENT_PROMPT,
  localization: LOCALIZATION_AGENT_PROMPT,
  devops: DEVOPS_AGENT_PROMPT,
  'ux-researcher': UX_RESEARCHER_AGENT_PROMPT,
  'growth-hacker': GROWTH_HACKER_AGENT_PROMPT,
  'seo-specialist': SEO_SPECIALIST_AGENT_PROMPT,
  'content-strategist': CONTENT_STRATEGIST_AGENT_PROMPT,
  'conversion-optimizer': CONVERSION_OPTIMIZER_AGENT_PROMPT,
  'community-manager': COMMUNITY_MANAGER_AGENT_PROMPT,
  'sales-optimizer': SALES_OPTIMIZER_AGENT_PROMPT,
  'accessibility-auditor': ACCESSIBILITY_AUDITOR_AGENT_PROMPT,
  'api-docs-writer': API_DOCS_WRITER_AGENT_PROMPT,
  'agency-brain': AGENCY_BRAIN_AGENT_PROMPT,
  'lead-hunter': LEAD_HUNTER_AGENT_PROMPT,
  'offer-strategist': OFFER_STRATEGIST_AGENT_PROMPT,
  'video-specialist': VIDEO_SPECIALIST_AGENT_PROMPT,
  'web-designer': WEB_DESIGNER_AGENT_PROMPT,
  'agent-builder': AGENT_BUILDER_AGENT_PROMPT,
  'systems-architect': SYSTEMS_ARCHITECT_AGENT_PROMPT,
  'product-engineer': PRODUCT_ENGINEER_AGENT_PROMPT,
  'intelligence-architect': INTELLIGENCE_ARCHITECT_AGENT_PROMPT,
  'training-architect': TRAINING_ARCHITECT_AGENT_PROMPT,
  'security-architect': SECURITY_ARCHITECT_AGENT_PROMPT,
  'seo-strategist': SEO_STRATEGIST_AGENT_PROMPT,
  'product-designer': PRODUCT_DESIGNER_AGENT_PROMPT,
  'super-orchestrator': SUPER_ORCHESTRATOR_AGENT_PROMPT,
};
