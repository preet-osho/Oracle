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
} from '@/lib/system-prompt';

// ─── Types ─────────────────────────────

export type AgentType = 'orchestrator' | (typeof VALID_AGENTS)[number];
export type AgentGroup = 'Core' | 'Specialist';

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
  orchestrator: { label: 'Orchestrator', emoji: '⚡', description: 'Auto-decompose complex tasks across specialist agents', group: 'Core' },
  researcher: { label: 'Researcher', emoji: '🔍', description: 'Web research, data gathering, competitive analysis', group: 'Core' },
  writer: { label: 'Writer', emoji: '✍️', description: 'Content creation, copywriting, documentation', group: 'Core' },
  developer: { label: 'Developer', emoji: '💻', description: 'Code generation, technical implementation, debugging', group: 'Core' },
  analyst: { label: 'Analyst', emoji: '📊', description: 'Data analysis, SEO audit, ads optimization', group: 'Core' },
  strategist: { label: 'Strategist', emoji: '🎯', description: 'Business strategy, growth planning, competitive positioning', group: 'Specialist' },
  marketer: { label: 'Marketer', emoji: '📣', description: 'Digital marketing, campaigns, social media, growth hacking', group: 'Specialist' },
  designer: { label: 'Designer', emoji: '🎨', description: 'UI/UX design, brand identity, visual systems', group: 'Specialist' },
  finance: { label: 'Finance', emoji: '💰', description: 'Pricing strategy, budgeting, ROI, financial modeling', group: 'Specialist' },
  voice: { label: 'Voice', emoji: '🎙️', description: 'Voice agent config, telephony, VAPI/Sarvam/ElevenLabs', group: 'Specialist' },
  qa: { label: 'QA', emoji: '🛡️', description: 'Quality assurance, code review, testing, security', group: 'Specialist' },
  coordinator: { label: 'Coordinator', emoji: '📋', description: 'Project management, delivery, client communication', group: 'Specialist' },
  workflow: { label: 'Workflow', emoji: '🔗', description: 'Chain multiple agents in sequence for multi-phase projects', group: 'Specialist' },
};

// ─── Agent Types List ──────────────────

export const AGENT_TYPES = (['orchestrator', ...VALID_AGENTS] as const).map((id) => ({
  id,
  ...AGENT_LABELS[id],
}));

// ─── Agent Groups ──────────────────────

export const AGENT_GROUPS = ['Core', 'Specialist'] as const;

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
};
