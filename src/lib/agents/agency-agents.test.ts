// ═══════════════════════════════════════
// ORACLE — Agency Operations Agent Prompt Tests
// Verify exports, structure, and system prompt usability
// for the 5 new agency operations agents.
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── Named imports (from the centralized registry) ───
import {
  LEAD_HUNTER_AGENT_PROMPT,
  OFFER_STRATEGIST_AGENT_PROMPT,
  VIDEO_SPECIALIST_AGENT_PROMPT,
  WEB_DESIGNER_AGENT_PROMPT,
  AGENT_BUILDER_AGENT_PROMPT,
  AGENT_REGISTRY,
  ALL_AGENT_NAMES,
} from '@/lib/agents/registry';

// ─── Required structural elements ───
const REQUIRED_PROMPT_ELEMENTS = [
  'ORACLE',
  'AI Operating System',
  'OUTPUT FORMAT',
  'VERIFY',
];

// ─── Required prompt sections (role, mission, scope, inputs, outputs) ───
const REQUIRED_SECTIONS = [
  'You are ORACLE',         // role
  'OUTPUT FORMAT',          // outputs
  'VERIFY',                 // quality gate
  'DOMAIN RULES',           // scope/domain constraints
];

// ═══════════════════════════════════════
// Registry Presence Tests
// ═══════════════════════════════════════

describe('Agency Operations Agents — Registry Presence', () => {
  const agencyAgentNames = [
    'lead-hunter',
    'offer-strategist',
    'video-specialist',
    'web-designer',
    'agent-builder',
  ] as const;

  it('all 5 agency agents are listed in ALL_AGENT_NAMES', () => {
    for (const name of agencyAgentNames) {
      expect(ALL_AGENT_NAMES).toContain(name);
    }
  });

  it('all 5 agency agents have entries in AGENT_REGISTRY', () => {
    for (const name of agencyAgentNames) {
      expect(AGENT_REGISTRY[name]).toBeDefined();
      expect(AGENT_REGISTRY[name].prompt).toBeTruthy();
      expect(AGENT_REGISTRY[name].description).toBeTruthy();
      expect(AGENT_REGISTRY[name].category).toBeTruthy();
      expect(AGENT_REGISTRY[name].taskFocus).toBeTruthy();
      expect(AGENT_REGISTRY[name].defaultTier).toBeTruthy();
    }
  });

  it('each agency agent has a unique category and taskFocus', () => {
    const entries = agencyAgentNames.map((name) => ({
      name,
      category: AGENT_REGISTRY[name].category,
      taskFocus: AGENT_REGISTRY[name].taskFocus,
    }));
    // taskFocus should be unique per agent
    const taskFocuses = entries.map((e) => e.taskFocus);
    expect(new Set(taskFocuses).size).toBe(taskFocuses.length);
  });
});

// ═══════════════════════════════════════
// Individual Agent Tests
// ═══════════════════════════════════════

describe('Agent Prompt Exports — Agency Operations', () => {
  // ── Lead Hunter ──────────────────────

  describe('lead-hunter', () => {
    it('exports LEAD_HUNTER_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof LEAD_HUNTER_AGENT_PROMPT).toBe('string');
      expect(LEAD_HUNTER_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(LEAD_HUNTER_AGENT_PROMPT).toContain(element);
      }
    });

    it('contains required prompt sections', () => {
      for (const section of REQUIRED_SECTIONS) {
        expect(LEAD_HUNTER_AGENT_PROMPT).toContain(section);
      }
    });

    it('defines lead generation specializations', () => {
      expect(LEAD_HUNTER_AGENT_PROMPT).toContain('ICP');
      expect(LEAD_HUNTER_AGENT_PROMPT).toContain('lead');
      expect(LEAD_HUNTER_AGENT_PROMPT).toContain('outreach');
    });

    it('includes India-specific references', () => {
      expect(LEAD_HUNTER_AGENT_PROMPT).toContain('Indian');
      expect(LEAD_HUNTER_AGENT_PROMPT).toContain('WhatsApp');
      expect(LEAD_HUNTER_AGENT_PROMPT).toContain('INR');
    });
  });

  // ── Offer Strategist ─────────────────

  describe('offer-strategist', () => {
    it('exports OFFER_STRATEGIST_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof OFFER_STRATEGIST_AGENT_PROMPT).toBe('string');
      expect(OFFER_STRATEGIST_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(OFFER_STRATEGIST_AGENT_PROMPT).toContain(element);
      }
    });

    it('contains required prompt sections', () => {
      for (const section of REQUIRED_SECTIONS) {
        expect(OFFER_STRATEGIST_AGENT_PROMPT).toContain(section);
      }
    });

    it('defines offer strategy specializations', () => {
      expect(OFFER_STRATEGIST_AGENT_PROMPT).toContain('pricing');
      expect(OFFER_STRATEGIST_AGENT_PROMPT).toContain('proposal');
      expect(OFFER_STRATEGIST_AGENT_PROMPT.toLowerCase()).toContain('outcome');
    });

    it('includes India-specific references', () => {
      expect(OFFER_STRATEGIST_AGENT_PROMPT).toContain('GST');
      expect(OFFER_STRATEGIST_AGENT_PROMPT).toContain('Indian');
      expect(OFFER_STRATEGIST_AGENT_PROMPT).toContain('₹');
    });
  });

  // ── Video Specialist ─────────────────

  describe('video-specialist', () => {
    it('exports VIDEO_SPECIALIST_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof VIDEO_SPECIALIST_AGENT_PROMPT).toBe('string');
      expect(VIDEO_SPECIALIST_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(VIDEO_SPECIALIST_AGENT_PROMPT).toContain(element);
      }
    });

    it('contains required prompt sections', () => {
      for (const section of REQUIRED_SECTIONS) {
        expect(VIDEO_SPECIALIST_AGENT_PROMPT).toContain(section);
      }
    });

    it('defines video specializations', () => {
      expect(VIDEO_SPECIALIST_AGENT_PROMPT).toContain('Reels');
      expect(VIDEO_SPECIALIST_AGENT_PROMPT).toContain('script');
      expect(VIDEO_SPECIALIST_AGENT_PROMPT.toLowerCase()).toContain('hook');
    });

    it('includes India-specific references', () => {
      expect(VIDEO_SPECIALIST_AGENT_PROMPT).toContain('Indian');
      expect(VIDEO_SPECIALIST_AGENT_PROMPT).toContain('INR');
    });
  });

  // ── Web Designer ─────────────────────

  describe('web-designer', () => {
    it('exports WEB_DESIGNER_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof WEB_DESIGNER_AGENT_PROMPT).toBe('string');
      expect(WEB_DESIGNER_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(WEB_DESIGNER_AGENT_PROMPT).toContain(element);
      }
    });

    it('contains required prompt sections', () => {
      for (const section of REQUIRED_SECTIONS) {
        expect(WEB_DESIGNER_AGENT_PROMPT).toContain(section);
      }
    });

    it('defines web design specializations', () => {
      expect(WEB_DESIGNER_AGENT_PROMPT).toContain('WIREFRAME');
      expect(WEB_DESIGNER_AGENT_PROMPT.toLowerCase()).toContain('conversion');
      expect(WEB_DESIGNER_AGENT_PROMPT).toContain('CTA');
    });

    it('includes India-specific references', () => {
      expect(WEB_DESIGNER_AGENT_PROMPT).toContain('Indian');
      expect(WEB_DESIGNER_AGENT_PROMPT).toContain('INR');
      expect(WEB_DESIGNER_AGENT_PROMPT).toContain('Razorpay');
    });
  });

  // ── Agent Builder ────────────────────

  describe('agent-builder', () => {
    it('exports AGENT_BUILDER_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof AGENT_BUILDER_AGENT_PROMPT).toBe('string');
      expect(AGENT_BUILDER_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(AGENT_BUILDER_AGENT_PROMPT).toContain(element);
      }
    });

    it('contains required prompt sections', () => {
      for (const section of REQUIRED_SECTIONS) {
        expect(AGENT_BUILDER_AGENT_PROMPT).toContain(section);
      }
    });

    it('defines agent building specializations', () => {
      expect(AGENT_BUILDER_AGENT_PROMPT).toContain('role');
      expect(AGENT_BUILDER_AGENT_PROMPT.toLowerCase()).toContain('tool');
      expect(AGENT_BUILDER_AGENT_PROMPT.toLowerCase()).toContain('memory');
    });

    it('includes India-specific references', () => {
      expect(AGENT_BUILDER_AGENT_PROMPT).toContain('Indian');
      expect(AGENT_BUILDER_AGENT_PROMPT).toContain('DPDP');
      expect(AGENT_BUILDER_AGENT_PROMPT).toContain('INR');
    });
  });
});

// ═══════════════════════════════════════
// System Prompt Usability (cross-cutting)
// ═══════════════════════════════════════

describe('System Prompt Usability — Agency Operations', () => {
  const prompts = [
    { name: 'lead-hunter', prompt: LEAD_HUNTER_AGENT_PROMPT },
    { name: 'offer-strategist', prompt: OFFER_STRATEGIST_AGENT_PROMPT },
    { name: 'video-specialist', prompt: VIDEO_SPECIALIST_AGENT_PROMPT },
    { name: 'web-designer', prompt: WEB_DESIGNER_AGENT_PROMPT },
    { name: 'agent-builder', prompt: AGENT_BUILDER_AGENT_PROMPT },
  ];

  for (const { name, prompt } of prompts) {
    describe(`${name} agent prompt`, () => {
      it('is a valid non-empty string suitable for system prompt', () => {
        expect(typeof prompt).toBe('string');
        expect(prompt.trim().length).toBeGreaterThan(0);
      });

      it('is long enough to contain meaningful instructions (500+ chars)', () => {
        expect(prompt.length).toBeGreaterThanOrEqual(500);
      });

      it('contains role definition (starts with "You are")', () => {
        expect(prompt).toMatch(/^You are ORACLE/);
      });

      it('contains a method/workflow section', () => {
        expect(prompt).toMatch(/method|METHOD|workflow|WORKFLOW/i);
      });

      it('contains output format specification', () => {
        expect(prompt).toContain('OUTPUT FORMAT');
      });

      it('contains verification instruction', () => {
        expect(prompt).toContain('VERIFY');
      });

      it('references INR pricing', () => {
        expect(prompt).toMatch(/INR|₹/);
      });

      it('does not start lines with placeholder markers', () => {
        const lines = prompt.split('\n');
        const placeholderLines = lines.filter(
          (l) => /^\s*\[INSERT\]|^\s*\[TODO\]|^\s*\[TBD\]|^\s*\[YOUR_TEXT_HERE\]/.test(l),
        );
        expect(placeholderLines).toHaveLength(0);
      });

      it('contains a domain rules section', () => {
        expect(prompt).toContain('DOMAIN RULES');
      });

      it('mentions India or Indian market context', () => {
        expect(prompt.toLowerCase()).toMatch(/india|indian/);
      });
    });
  }
});

// ═══════════════════════════════════════
// Uniqueness & Non-Duplication
// ═══════════════════════════════════════

describe('All 5 Agency Agent Prompts Are Distinct', () => {
  const prompts = [
    LEAD_HUNTER_AGENT_PROMPT,
    OFFER_STRATEGIST_AGENT_PROMPT,
    VIDEO_SPECIALIST_AGENT_PROMPT,
    WEB_DESIGNER_AGENT_PROMPT,
    AGENT_BUILDER_AGENT_PROMPT,
  ];

  it('each prompt is a unique string (no copy-paste errors)', () => {
    const unique = new Set(prompts);
    expect(unique.size).toBe(5);
  });

  it('all prompts are at least 500 characters', () => {
    for (const p of prompts) {
      expect(p.length).toBeGreaterThanOrEqual(500);
    }
  });

  it('each prompt is at least 1500 characters (substantial system prompt)', () => {
    for (const p of prompts) {
      expect(p.length).toBeGreaterThanOrEqual(1500);
    }
  });

  it('no agency agent prompt is identical to a non-agency agent prompt', () => {
    const nonAgencyPrompts = [
      AGENT_REGISTRY.researcher.prompt,
      AGENT_REGISTRY.writer.prompt,
      AGENT_REGISTRY.developer.prompt,
      AGENT_REGISTRY.analyst.prompt,
      AGENT_REGISTRY.strategist.prompt,
      AGENT_REGISTRY.marketer.prompt,
      AGENT_REGISTRY.designer.prompt,
      AGENT_REGISTRY.finance.prompt,
      AGENT_REGISTRY.voice.prompt,
      AGENT_REGISTRY.qa.prompt,
    ];

    for (const agencyPrompt of prompts) {
      for (const nonAgencyPrompt of nonAgencyPrompts) {
        expect(agencyPrompt).not.toBe(nonAgencyPrompt);
      }
    }
  });
});

// ═══════════════════════════════════════
// Registry Metadata Tests
// ═══════════════════════════════════════

describe('Agency Agent Registry Metadata', () => {
  it('lead-hunter is in the sales category', () => {
    expect(AGENT_REGISTRY['lead-hunter'].category).toBe('sales');
  });

  it('offer-strategist is in the strategy category', () => {
    expect(AGENT_REGISTRY['offer-strategist'].category).toBe('strategy');
  });

  it('video-specialist is in the content category', () => {
    expect(AGENT_REGISTRY['video-specialist'].category).toBe('content');
  });

  it('web-designer is in the design category', () => {
    expect(AGENT_REGISTRY['web-designer'].category).toBe('design');
  });

  it('agent-builder is in the technical category', () => {
    expect(AGENT_REGISTRY['agent-builder'].category).toBe('technical');
  });

  it('agency agents have valid default tiers', () => {
    const validTiers = ['free', 'budget', 'standard', 'premium', 'elite'];
    for (const name of ['lead-hunter', 'offer-strategist', 'video-specialist', 'web-designer', 'agent-builder'] as const) {
      expect(validTiers).toContain(AGENT_REGISTRY[name].defaultTier);
    }
  });

  it('agency agent prompts match their AGENT_REGISTRY entry', () => {
    expect(AGENT_REGISTRY['lead-hunter'].prompt).toBe(LEAD_HUNTER_AGENT_PROMPT);
    expect(AGENT_REGISTRY['offer-strategist'].prompt).toBe(OFFER_STRATEGIST_AGENT_PROMPT);
    expect(AGENT_REGISTRY['video-specialist'].prompt).toBe(VIDEO_SPECIALIST_AGENT_PROMPT);
    expect(AGENT_REGISTRY['web-designer'].prompt).toBe(WEB_DESIGNER_AGENT_PROMPT);
    expect(AGENT_REGISTRY['agent-builder'].prompt).toBe(AGENT_BUILDER_AGENT_PROMPT);
  });
});
