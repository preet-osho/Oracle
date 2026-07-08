// ═══════════════════════════════════════
// ORACLE — Agent Registry Tests
// Completeness, constants, metadata validation
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  ALL_AGENT_NAMES,
  AGENT_REGISTRY,
  type AgentName,
  type AgentMetadata,
} from './registry';

// ─── ALL_AGENT_NAMES ───────────────────

describe('ALL_AGENT_NAMES', () => {
  it('contains at least 30 agent names', () => {
    expect(ALL_AGENT_NAMES.length).toBeGreaterThanOrEqual(30);
  });

  it('contains no duplicates', () => {
    const unique = new Set(ALL_AGENT_NAMES);
    expect(unique.size).toBe(ALL_AGENT_NAMES.length);
  });

  it('contains all expected core agents', () => {
    const expected = [
      'researcher', 'writer', 'developer', 'analyst', 'strategist',
      'marketer', 'designer', 'finance', 'voice', 'qa',
      'coordinator', 'workflow', 'legal', 'editor', 'localization',
    ];
    for (const name of expected) {
      expect(ALL_AGENT_NAMES).toContain(name);
    }
  });

  it('contains all expected specialist agents', () => {
    const expected = [
      'security-auditor', 'data-scientist', 'competitor-intel',
      'devops', 'ux-researcher', 'growth-hacker', 'seo-specialist',
      'content-strategist', 'conversion-optimizer', 'community-manager',
      'sales-optimizer', 'accessibility-auditor', 'api-docs-writer',
    ];
    for (const name of expected) {
      expect(ALL_AGENT_NAMES).toContain(name);
    }
  });

  it('contains all expected agency operations agents', () => {
    const expected = [
      'agency-brain', 'lead-hunter', 'offer-strategist',
      'video-specialist', 'web-designer', 'agent-builder',
    ];
    for (const name of expected) {
      expect(ALL_AGENT_NAMES).toContain(name);
    }
  });

  it('all names are lowercase kebab-case', () => {
    for (const name of ALL_AGENT_NAMES) {
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});

// ─── AGENT_REGISTRY ────────────────────

describe('AGENT_REGISTRY', () => {
  it('has an entry for every name in ALL_AGENT_NAMES', () => {
    for (const name of ALL_AGENT_NAMES) {
      expect(AGENT_REGISTRY).toHaveProperty(name);
    }
  });

  it('has no extra keys beyond ALL_AGENT_NAMES', () => {
    const registryKeys = Object.keys(AGENT_REGISTRY);
    for (const key of registryKeys) {
      expect(ALL_AGENT_NAMES).toContain(key);
    }
  });

  it('same length as ALL_AGENT_NAMES', () => {
    expect(Object.keys(AGENT_REGISTRY).length).toBe(ALL_AGENT_NAMES.length);
  });
});

// ─── Metadata Validation ───────────────

describe('Agent Metadata', () => {
  const entries = Object.entries(AGENT_REGISTRY) as Array<[AgentName, AgentMetadata]>;

  it('all agents have non-empty prompt', () => {
    for (const [name, meta] of entries) {
      expect(meta.prompt.length).toBeGreaterThan(50);
      expect(meta.prompt).toContain('ORACLE');
    }
  });

  it('all agents have non-empty description', () => {
    for (const [name, meta] of entries) {
      expect(meta.description.length).toBeGreaterThan(10);
    }
  });

  it('all agents have non-empty category', () => {
    for (const [name, meta] of entries) {
      expect(meta.category.length).toBeGreaterThan(0);
    }
  });

  it('all agents have non-empty taskFocus', () => {
    for (const [name, meta] of entries) {
      expect(meta.taskFocus.length).toBeGreaterThan(10);
    }
  });

  it('all agents have valid defaultTier', () => {
    const validTiers = ['standard', 'premium'];
    for (const [name, meta] of entries) {
      expect(validTiers).toContain(meta.defaultTier);
    }
  });

  it('no two agents share the same prompt', () => {
    const prompts = entries.map(([, meta]) => meta.prompt);
    const unique = new Set(prompts);
    expect(unique.size).toBe(prompts.length);
  });

  it('categories are from a consistent set', () => {
    const validCategories = new Set([
      'research', 'content', 'technical', 'analysis', 'strategy',
      'marketing', 'design', 'finance', 'voice', 'quality',
      'coordination', 'compliance', 'security', 'sales',
      'technical-writing',
    ]);

    for (const [name, meta] of entries) {
      expect(validCategories.has(meta.category)).toBe(true);
    }
  });
});

// ─── Specific Agent Prompts ────────────

describe('Specific Agent Prompts', () => {
  it('researcher prompt mentions web search and sources', () => {
    const prompt = AGENT_REGISTRY.researcher.prompt;
    expect(prompt).toContain('research');
    expect(prompt).toContain('source');
  });

  it('developer prompt mentions TypeScript', () => {
    const prompt = AGENT_REGISTRY.developer.prompt;
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('React');
  });

  it('writer prompt mentions content types', () => {
    const prompt = AGENT_REGISTRY.writer.prompt;
    expect(prompt).toContain('content');
    expect(prompt).toContain('copy');
  });

  it('analyst prompt mentions data and metrics', () => {
    const prompt = AGENT_REGISTRY.analyst.prompt;
    expect(prompt).toContain('analysis');
    expect(prompt).toContain('metric');
  });

  it('finance prompt mentions INR', () => {
    const prompt = AGENT_REGISTRY.finance.prompt;
    expect(prompt).toContain('INR');
  });

  it('legal prompt mentions Indian law', () => {
    const prompt = AGENT_REGISTRY.legal.prompt;
    expect(prompt).toContain('Indian');
    expect(prompt).toContain('GST');
  });

  it('seo-specialist prompt mentions SEO', () => {
    const prompt = AGENT_REGISTRY['seo-specialist'].prompt;
    expect(prompt).toContain('SEO');
  });

  it('agency-brain prompt mentions orchestrat', () => {
    const prompt = AGENT_REGISTRY['agency-brain'].prompt;
    expect(prompt.toLowerCase()).toContain('orchestrat');
  });

  it('lead-hunter prompt mentions prospect', () => {
    const prompt = AGENT_REGISTRY['lead-hunter'].prompt;
    expect(prompt.toLowerCase()).toContain('prospect');
  });

  it('editor prompt mentions quality gate', () => {
    const prompt = AGENT_REGISTRY.editor.prompt;
    expect(prompt.toLowerCase()).toContain('quality gate');
  });
});

// ─── Tier Distribution ─────────────────

describe('Tier Distribution', () => {
  it('has both standard and premium agents', () => {
    const tiers = new Set(Object.values(AGENT_REGISTRY).map((m) => m.defaultTier));
    expect(tiers.has('standard')).toBe(true);
    expect(tiers.has('premium')).toBe(true);
  });

  it('premium agents include core strategy/finance roles', () => {
    const premiumNames = Object.entries(AGENT_REGISTRY)
      .filter(([, m]) => m.defaultTier === 'premium')
      .map(([name]) => name);

    expect(premiumNames).toContain('strategist');
    expect(premiumNames).toContain('finance');
    expect(premiumNames).toContain('legal');
  });
});
