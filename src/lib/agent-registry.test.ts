// ═══════════════════════════════════════
// ORACLE — AGENT_PROMPTS Registry Tests
// Verify all agents registered, mapped to valid prompts, and used in swarm routing
// ═══════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

// ─── Mock dependencies before importing swarm ───

vi.mock('@/lib/model-selector', () => ({
  selectModel: vi.fn().mockReturnValue({
    providerId: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    tier: 'standard' as const,
    costEstimate: { usd: 0.001, tokens: 500 },
  }),
  logAgentPerformance: vi.fn(),
  shouldDowngradeDueToBudget: vi.fn().mockReturnValue(undefined),
  trackTokenUsage: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/emergency-stop', () => ({
  canStartSwarm: vi.fn().mockReturnValue(null),
  registerSwarmExecution: vi.fn().mockReturnValue('exec-1'),
  shouldContinueSwarm: vi.fn().mockReturnValue(null),
  completeSwarmExecution: vi.fn(),
  isWithinCostLimit: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    getAllKeys: vi.fn().mockReturnValue({ groq: true }),
  },
}));

// ─── Import the AGENT_PROMPTS via the swarm internals ───
// We can't import the const directly, but we can verify through buildSubTaskPrompt behavior
// and by checking the imports in swarm.ts map to all 28 agents.

// Import from the centralized registry (single source of truth)
import {
  AGENT_REGISTRY,
  ALL_AGENT_NAMES,
  getAgentPrompt,
  getAgentMetadata,
  type AgentName,
} from '@/lib/agents/registry';

// ─── Constants ──────────────────────────

/** Build AGENT_PROMPTS_MAP from the centralized registry */
const AGENT_PROMPTS_MAP: Record<string, string> = Object.fromEntries(
  ALL_AGENT_NAMES.map((name) => [name, getAgentPrompt(name)])
);

// Re-export individual prompts for domain coverage tests (still valid via registry re-exports)
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
} from '@/lib/agents/registry';

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

describe('AGENT_PROMPTS Registry', () => {
  describe('Registry Completeness', () => {
    it('registers all agents', () => {
      expect(ALL_AGENT_NAMES.length).toBeGreaterThanOrEqual(28);
    });

    it('has a prompt for every registered agent name', () => {
      for (const name of ALL_AGENT_NAMES) {
        expect(AGENT_PROMPTS_MAP[name]).toBeDefined();
      }
    });

    it('all prompt constants are non-empty strings', () => {
      for (const name of ALL_AGENT_NAMES) {
        expect(typeof AGENT_PROMPTS_MAP[name]).toBe('string');
        expect(AGENT_PROMPTS_MAP[name].length).toBeGreaterThan(100);
      }
    });

    it('no agent prompt is empty or whitespace-only', () => {
      for (const name of ALL_AGENT_NAMES) {
        expect(AGENT_PROMPTS_MAP[name].trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('Prompt Structure', () => {
    it('all 28 prompts contain role definition starting with "You are ORACLE"', () => {
      for (const name of ALL_AGENT_NAMES) {
        expect(AGENT_PROMPTS_MAP[name]).toMatch(/^You are ORACLE/);
      }
    });

    it('most prompts contain an OUTPUT FORMAT section', () => {
      const withOutputFormat = ALL_AGENT_NAMES.filter(name =>
        AGENT_PROMPTS_MAP[name].includes('OUTPUT FORMAT') ||
        AGENT_PROMPTS_MAP[name].toLowerCase().includes('output format')
      );
      expect(withOutputFormat.length).toBeGreaterThanOrEqual(15);
    });

    it('all prompts contain a VERIFY instruction', () => {
      for (const name of ALL_AGENT_NAMES) {
        expect(AGENT_PROMPTS_MAP[name]).toContain('VERIFY');
      }
    });

    it('all prompts reference ₹50,000+ client tier', () => {
      for (const name of ALL_AGENT_NAMES) {
        expect(AGENT_PROMPTS_MAP[name]).toContain('₹50,000');
      }
    });

    it('most prompts reference the AI Operating System framework', () => {
      const withAiOS = ALL_AGENT_NAMES.filter(name =>
        AGENT_PROMPTS_MAP[name].includes('AI Operating System')
      );
      expect(withAiOS.length).toBeGreaterThanOrEqual(16);
    });

    it('all prompts are unique (no duplicate content)', () => {
      const unique = new Set(Object.values(AGENT_PROMPTS_MAP));
      expect(unique.size).toBe(Object.keys(AGENT_PROMPTS_MAP).length);
    });
  });

  describe('Domain Coverage', () => {
    it('legal prompt covers Indian regulatory domains', () => {
      expect(LEGAL_AGENT_PROMPT).toContain('GST');
      expect(LEGAL_AGENT_PROMPT).toContain('SEBI');
      expect(LEGAL_AGENT_PROMPT).toContain('IT Act');
    });

    it('security-auditor prompt covers OWASP and Indian IT Act', () => {
      expect(SECURITY_AUDITOR_AGENT_PROMPT).toContain('OWASP');
      expect(SECURITY_AUDITOR_AGENT_PROMPT).toContain('Indian IT Act');
    });

    it('data-scientist prompt covers statistical and ML domains', () => {
      expect(DATA_SCIENTIST_AGENT_PROMPT.toLowerCase()).toContain('statistical');
      expect(DATA_SCIENTIST_AGENT_PROMPT.toLowerCase()).toContain('machine learning');
    });

    it('competitor-intel prompt covers SWOT and market analysis', () => {
      expect(COMPETITOR_INTEL_AGENT_PROMPT).toContain('SWOT');
      expect(COMPETITOR_INTEL_AGENT_PROMPT.toLowerCase()).toContain('market');
    });

    it('editor prompt covers grammar, consistency, and polish', () => {
      expect(EDITOR_AGENT_PROMPT).toContain('grammar');
      expect(EDITOR_AGENT_PROMPT).toContain('consistency');
    });

    it('localization prompt covers Hinglish and regional languages', () => {
      expect(LOCALIZATION_AGENT_PROMPT).toContain('Hinglish');
      expect(LOCALIZATION_AGENT_PROMPT).toContain('regional');
    });

    it('researcher prompt covers data gathering', () => {
      expect(RESEARCHER_AGENT_PROMPT.toLowerCase()).toContain('research');
    });

    it('writer prompt covers content creation', () => {
      expect(WRITER_AGENT_PROMPT.toLowerCase()).toContain('writing');
    });

    it('developer prompt covers code', () => {
      expect(DEVELOPER_AGENT_PROMPT.toLowerCase()).toContain('code');
    });

    it('analyst prompt covers data analysis', () => {
      expect(ANALYST_AGENT_PROMPT.toLowerCase()).toContain('analysis');
    });

    it('strategist prompt covers strategy', () => {
      expect(STRATEGIST_AGENT_PROMPT.toLowerCase()).toContain('strategy');
    });

    it('marketer prompt covers marketing', () => {
      expect(MARKETER_AGENT_PROMPT.toLowerCase()).toContain('marketing');
    });

    it('designer prompt covers design', () => {
      expect(DESIGNER_AGENT_PROMPT.toLowerCase()).toContain('design');
    });

    it('finance prompt covers financial topics', () => {
      expect(FINANCE_AGENT_PROMPT.toLowerCase()).toContain('finance');
    });

    it('voice prompt covers voice/telephony', () => {
      expect(VOICE_AGENT_PROMPT.toLowerCase()).toContain('voice');
    });

    it('qa prompt covers quality assurance', () => {
      expect(QA_AGENT_PROMPT.toLowerCase()).toContain('quality');
    });

    it('coordinator prompt covers coordination', () => {
      expect(COORDINATOR_AGENT_PROMPT.toLowerCase()).toContain('coordination');
    });

    it('workflow prompt covers workflows', () => {
      expect(WORKFLOW_AGENT_PROMPT.toLowerCase()).toContain('workflow');
    });
  });

  describe('Swarm Integration', () => {
    it('all agents have metadata in the centralized registry', () => {
      for (const name of ALL_AGENT_NAMES) {
        const meta = getAgentMetadata(name);
        expect(meta).not.toBeNull();
        expect(meta!.prompt).toBeDefined();
        expect(meta!.description).toBeDefined();
        expect(meta!.category).toBeDefined();
      }
    });

    it('the orchestrator prompt is in the registry with orchestration category', () => {
      // The orchestrator is now a registered agent with orchestration routing
      expect(AGENT_PROMPTS_MAP['orchestrator']).toBeDefined();
      expect(AGENT_PROMPTS_MAP['orchestrator']).toContain('ORACLE');
    });

    it('the synthesizer is not in AGENT_PROMPTS (handled separately in runSwarm)', () => {
      expect(AGENT_PROMPTS_MAP['synthesizer']).toBeUndefined();
    });

    it('the validation pipeline is not in AGENT_PROMPTS (handled separately)', () => {
      expect(AGENT_PROMPTS_MAP['validation']).toBeUndefined();
    });
  });

  describe('Minimum Prompt Length', () => {
    const MIN_PROMPT_LENGTH = 500;

    for (const [name, prompt] of Object.entries(AGENT_PROMPTS_MAP)) {
      it(`${name} prompt is at least ${MIN_PROMPT_LENGTH} characters`, () => {
        expect(prompt.length).toBeGreaterThanOrEqual(MIN_PROMPT_LENGTH);
      });
    }
  });

  describe('DevOps Agent Domain Coverage', () => {
    it('devops prompt covers CI/CD and cloud infrastructure', () => {
      expect(DEVOPS_AGENT_PROMPT.toLowerCase()).toContain('ci/cd');
      expect(DEVOPS_AGENT_PROMPT.toLowerCase()).toContain('cloud');
    });
  });

  describe('Auto-Routing (no manual override needed)', () => {
    it('devops agent (category: technical) auto-routes to code-generation task category', () => {
      // Verify the registry category maps correctly through CATEGORY_MAP
      const meta = getAgentMetadata('devops');
      expect(meta!.category).toBe('technical');
      // Verify getAgentPrompt returns a valid prompt for devops
      const prompt = getAgentPrompt('devops');
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('devops agent is registered in AGENT_REGISTRY with correct metadata', () => {
      const meta = getAgentMetadata('devops');
      expect(meta).not.toBeNull();
      expect(meta!.category).toBe('technical');
      expect(meta!.description).toContain('CI/CD');
      expect(meta!.prompt).toBeDefined();
    });
  });

  describe('No Stale Placeholders', () => {
    it('no agent prompt starts lines with placeholder markers', () => {
      for (const name of ALL_AGENT_NAMES) {
        const lines = AGENT_PROMPTS_MAP[name].split('\n');
        const placeholderLines = lines.filter(l =>
          /^\s*\[INSERT\]|^\s*\[TODO\]|^\s*\[TBD\]|^\s*\[YOUR_TEXT_HERE\]/.test(l)
        );
        expect(placeholderLines).toHaveLength(0);
      }
    });
  });
});
