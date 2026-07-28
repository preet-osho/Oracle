// ═══════════════════════════════════════
// ORACLE — Enhanced Agent Prompt Tests
// Validates prompts, registry metadata, and quality for all 5 newly enhanced agents
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  AGENT_REGISTRY,
  ALL_AGENT_NAMES,
  getAgentPrompt,
  getAgentMetadata,
} from '@/lib/agents/registry';

// ─── Agent Test Config ────────────────

interface AgentTestConfig {
  name: string;
  category: string;
  minPromptLength: number;
  domainKeywords: string[];
  outputFormatKeywords: string[];
  descriptionKeywords: string[];
  domainSections: string[];
}

const AGENTS: AgentTestConfig[] = [
  {
    name: 'product-engineer',
    category: 'technical',
    minPromptLength: 5000,
    domainKeywords: ['codebase', 'production', 'bug', 'test', 'refactor', 'architecture'],
    outputFormatKeywords: ['Project Understanding', 'Current State Diagnosis', 'Priority Issues', 'Recommended Plan'],
    descriptionKeywords: ['codebase', 'production', 'release'],
    domainSections: ['SCOPE', 'PROJECT DISCOVERY CHECKLIST', 'DIAGNOSTIC QUESTIONS', 'DEFAULT EXECUTION LOOP', 'QUALITY BAR', 'PRODUCTION READINESS CHECKLIST', 'CODE QUALITY STANDARDS', 'TECHNICAL DEBT MANAGEMENT', 'FAILURE RECOVERY'],
  },
  {
    name: 'intelligence-architect',
    category: 'strategy',
    minPromptLength: 5000,
    domainKeywords: ['competitive', 'superior', 'orchestration', 'memory', 'QA', 'gap analysis'],
    outputFormatKeywords: ['EXECUTIVE SUMMARY', 'GAP ANALYSIS', 'ARCHITECTURE BLUEPRINT', 'RISK REGISTER'],
    descriptionKeywords: ['competitive', 'superior', 'platform'],
    domainSections: ['COMPETITIVE GAP ANALYSIS', 'DESIGN SUPERIORITY TARGETS', 'ARCHITECTURE BLUEPRINT', 'AGENT MAP', 'MEMORY STRATEGY', 'QA STRATEGY', 'CONTINUOUS IMPROVEMENT STRATEGY'],
  },
  {
    name: 'training-architect',
    category: 'technical',
    minPromptLength: 5000,
    domainKeywords: ['training', 'evaluation', 'rubric', 'humanization', 'scenario', 'learning'],
    outputFormatKeywords: ['TRAINING STRATEGY', 'COMPETENCY MAP', 'EVALUATION RUBRIC', 'IMPLEMENTATION ROADMAP'],
    descriptionKeywords: ['training', 'evaluation', 'rubric'],
    domainSections: ['TRAINING PHILOSOPHY', 'CORE PRINCIPLES', 'TRAINING MODES', 'COMPETENCY MAP', 'SCENARIO LIBRARY', 'EVALUATION RUBRIC', 'HUMANIZATION RULES', 'FAILURE MODE MAP'],
  },
  {
    name: 'product-designer',
    category: 'design',
    minPromptLength: 5000,
    domainKeywords: ['design system', 'component', 'visual', 'accessibility', 'responsive', 'color'],
    outputFormatKeywords: ['DESIGN BRIEF', 'VISUAL SPECIFICATION', 'COMPONENT BREAKDOWN', 'INFORMATION ARCHITECTURE'],
    descriptionKeywords: ['design', 'system', 'component'],
    domainSections: ['CORE DESIGN PRINCIPLES', 'DESIGN METHODOLOGY', 'DESIGN SPECIALIZATIONS', 'DESIGN SYSTEMS', 'COMPONENT SPECIFICATION FORMAT', 'INDIAN MARKET DESIGN CONSIDERATIONS'],
  },
  {
    name: 'seo-specialist',
    category: 'content',
    minPromptLength: 5000,
    domainKeywords: ['SEO', 'keyword', 'technical', 'on-page', 'local SEO', 'AI SEO', 'schema'],
    outputFormatKeywords: ['CURRENT STATE', 'KEYWORD PLAN', 'CONTENT PLAN', 'TECHNICAL FIXES'],
    descriptionKeywords: ['SEO', 'on-page', 'technical'],
    domainSections: ['SEO PHILOSOPHY', 'COMPREHENSIVE SEO KNOWLEDGE', 'SEO AUDIT FRAMEWORK', 'KEYWORD RESEARCH METHODOLOGY', 'CONTENT OPTIMIZATION METHODOLOGY', 'TECHNICAL SEO IMPLEMENTATION', 'AI SEO OPTIMIZATION', 'INDIAN MARKET SEO CONSIDERATIONS'],
  },
];

// ═══════════════════════════════════════
// Parameterized Tests — Prompt Validation
// ═══════════════════════════════════════

describe('Enhanced Agents — Prompt Validation', () => {
  for (const agent of AGENTS) {
    describe(agent.name, () => {
      const getPrompt = () => getAgentPrompt(agent.name);

      describe('structural elements', () => {
        it('exports as a non-empty string', () => {
          expect(typeof getPrompt()).toBe('string');
          expect(getPrompt().length).toBeGreaterThan(500);
        });

        it(`is >= ${agent.minPromptLength} chars (enhanced quality gate)`, () => {
          expect(getPrompt().length).toBeGreaterThanOrEqual(agent.minPromptLength);
        });

        it('starts with role definition', () => {
          expect(getPrompt()).toMatch(/^You are /);
        });

        it('starts with ORACLE identity', () => {
          expect(getPrompt()).toContain('ORACLE');
        });

        it('contains MISSION or OBJECTIVE section', () => {
          expect(getPrompt()).toMatch(/MISSION|OBJECTIVE/);
        });

      it('contains core methodology section (PRINCIPLES, PHILOSOPHY, or KNOWLEDGE)', () => {
        expect(getPrompt()).toMatch(/PRINCIPLES|PHILOSOPHY|KNOWLEDGE/);
      });

        it('contains OUTPUT FORMAT section', () => {
          expect(getPrompt()).toMatch(/OUTPUT FORMAT|OUTPUT STYLE/);
        });

        it('contains VERIFY instruction', () => {
          expect(getPrompt()).toContain('VERIFY');
        });

        it('references INR/₹ pricing', () => {
          expect(getPrompt()).toContain('₹');
        });

        it('references ₹50,000+ client tier', () => {
          expect(getPrompt()).toContain('₹50,000');
        });
      });

      describe('domain-specific content', () => {
        it('covers all required domain keywords', () => {
          const prompt = getPrompt();
          for (const keyword of agent.domainKeywords) {
            expect(prompt.toLowerCase()).toContain(keyword.toLowerCase());
          }
        });

        it('has output format with all required sections', () => {
          const prompt = getPrompt();
          for (const section of agent.outputFormatKeywords) {
            expect(
              prompt.includes(section),
              `${agent.name} prompt missing output format section: ${section}`,
            ).toBe(true);
          }
        });

        it('has all domain-specific sections', () => {
          const prompt = getPrompt();
          for (const section of agent.domainSections) {
            expect(
              prompt.includes(section),
              `${agent.name} prompt missing domain section: ${section}`,
            ).toBe(true);
          }
        });
      });

      describe('no placeholders', () => {
        it('does not contain active placeholder markers', () => {
          const lines = getPrompt().split('\n');
          const placeholderLines = lines.filter(
            (l) => /^\s*\[INSERT\]|\s*\[TODO\]|\s*\[TBD\]|\s*\[YOUR_TEXT_HERE\]/.test(l),
          );
          expect(placeholderLines).toHaveLength(0);
        });
      });
    });
  }
});

// ═══════════════════════════════════════
// Parameterized Tests — Registry Metadata
// ═══════════════════════════════════════

describe('Enhanced Agents — Registry Metadata', () => {
  for (const agent of AGENTS) {
    describe(agent.name, () => {
      it('is listed in ALL_AGENT_NAMES', () => {
        expect(ALL_AGENT_NAMES).toContain(agent.name);
      });

      it('has an entry in AGENT_REGISTRY', () => {
        expect(AGENT_REGISTRY[agent.name]).toBeDefined();
      });

      it(`has category "${agent.category}"`, () => {
        expect(AGENT_REGISTRY[agent.name].category).toBe(agent.category);
      });

      it('has a non-empty description', () => {
        expect(AGENT_REGISTRY[agent.name].description.length).toBeGreaterThan(20);
      });

      it('has a non-empty taskFocus', () => {
        expect(AGENT_REGISTRY[agent.name].taskFocus.length).toBeGreaterThan(20);
      });

      it('prompt in AGENT_REGISTRY matches getAgentPrompt', () => {
        expect(AGENT_REGISTRY[agent.name].prompt).toBe(getAgentPrompt(agent.name));
      });

      it('getAgentMetadata returns non-null with correct category', () => {
        const meta = getAgentMetadata(agent.name);
        expect(meta).not.toBeNull();
        expect(meta!.category).toBe(agent.category);
      });

      it('description mentions key domain terms', () => {
        const desc = AGENT_REGISTRY[agent.name].description.toLowerCase();
        for (const keyword of agent.descriptionKeywords) {
          expect(desc).toContain(keyword.toLowerCase());
        }
      });
    });
  }
});

// ═══════════════════════════════════════
// Cross-Agent Uniqueness
// ═══════════════════════════════════════

describe('Enhanced Agents — Uniqueness & Non-Duplication', () => {
  for (const agent of AGENTS) {
    it(`${agent.name} prompt is distinct from all other agent prompts`, () => {
      const prompt = getAgentPrompt(agent.name);
      const otherPrompts = ALL_AGENT_NAMES
        .filter((name) => name !== agent.name)
        .map((name) => getAgentPrompt(name));

      for (const other of otherPrompts) {
        expect(prompt).not.toBe(other);
      }
    });
  }

  it('all 5 enhanced agents are among the longest prompts', () => {
    const allPrompts = ALL_AGENT_NAMES.map((name) => ({
      name,
      length: getAgentPrompt(name).length,
    }));
    const sortedByLength = [...allPrompts].sort((a, b) => b.length - a.length);

    for (const agent of AGENTS) {
      const rank = sortedByLength.findIndex((p) => p.name === agent.name);
      expect(rank).toBeLessThan(20); // Should be in top 20
    }
  });

  it('no duplicate prompts exist across all agents', () => {
    const prompts = ALL_AGENT_NAMES.map((name) => getAgentPrompt(name));
    const uniquePrompts = new Set(prompts);
    expect(uniquePrompts.size).toBe(prompts.length);
  });
});
