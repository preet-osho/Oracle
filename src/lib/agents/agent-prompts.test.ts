// ═══════════════════════════════════════
// ORACLE — New Agent Prompt Tests
// Verify exports, structure, and system prompt usability
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── Named imports (from the centralized registry — single source of truth) ───
import {
  LEGAL_AGENT_PROMPT,
  SECURITY_AUDITOR_AGENT_PROMPT,
  DATA_SCIENTIST_AGENT_PROMPT,
  COMPETITOR_INTEL_AGENT_PROMPT,
  EDITOR_AGENT_PROMPT,
  LOCALIZATION_AGENT_PROMPT,
} from '@/lib/agents/registry';

// ─── Default imports (individual files still export correctly) ───

// ─── Default imports ───
import LegalDefault from './legal-agent';
import SecurityAuditorDefault from './security-auditor-agent';
import DataScientistDefault from './data-scientist-agent';
import CompetitorIntelDefault from './competitor-intel-agent';
import EditorDefault from './editor-agent';
import LocalizationDefault from './localization-agent';

// ─── Helper ────────────────────────────

/** Every agent prompt must contain these structural elements to be usable as a system prompt. */
const REQUIRED_PROMPT_ELEMENTS = [
  'ORACLE',
  'AI Operating System',
  'OUTPUT FORMAT',
  'VERIFY',
  '₹50,000',
];

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

describe('Agent Prompt Exports', () => {
  describe('legal-agent', () => {
    it('exports LEGAL_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof LEGAL_AGENT_PROMPT).toBe('string');
      expect(LEGAL_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('default export matches named export', () => {
      expect(LegalDefault).toBe(LEGAL_AGENT_PROMPT);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(LEGAL_AGENT_PROMPT).toContain(element);
      }
    });

    it('defines legal specializations', () => {
      expect(LEGAL_AGENT_PROMPT).toContain('GST');
      expect(LEGAL_AGENT_PROMPT).toContain('SEBI');
      expect(LEGAL_AGENT_PROMPT).toContain('IT Act');
      expect(LEGAL_AGENT_PROMPT.toLowerCase()).toContain('data protection');
    });

    it('includes India-specific legal references', () => {
      expect(LEGAL_AGENT_PROMPT).toContain('GSTIN');
      expect(LEGAL_AGENT_PROMPT).toContain('Indian');
    });
  });

  describe('security-auditor-agent', () => {
    it('exports SECURITY_AUDITOR_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof SECURITY_AUDITOR_AGENT_PROMPT).toBe('string');
      expect(SECURITY_AUDITOR_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('default export matches named export', () => {
      expect(SecurityAuditorDefault).toBe(SECURITY_AUDITOR_AGENT_PROMPT);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(SECURITY_AUDITOR_AGENT_PROMPT).toContain(element);
      }
    });

    it('defines security specializations', () => {
      expect(SECURITY_AUDITOR_AGENT_PROMPT).toContain('OWASP');
      expect(SECURITY_AUDITOR_AGENT_PROMPT.toLowerCase()).toContain('vulnerability');
      expect(SECURITY_AUDITOR_AGENT_PROMPT).toContain('XSS');
    });

    it('includes Indian IT Act references', () => {
      expect(SECURITY_AUDITOR_AGENT_PROMPT).toContain('Indian IT Act');
      expect(SECURITY_AUDITOR_AGENT_PROMPT).toContain('DPDP Act');
    });
  });

  describe('data-scientist-agent', () => {
    it('exports DATA_SCIENTIST_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof DATA_SCIENTIST_AGENT_PROMPT).toBe('string');
      expect(DATA_SCIENTIST_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('default export matches named export', () => {
      expect(DataScientistDefault).toBe(DATA_SCIENTIST_AGENT_PROMPT);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(DATA_SCIENTIST_AGENT_PROMPT).toContain(element);
      }
    });

    it('defines data science specializations', () => {
      expect(DATA_SCIENTIST_AGENT_PROMPT).toContain('statistical');
      expect(DATA_SCIENTIST_AGENT_PROMPT.toLowerCase()).toContain('machine learning');
      expect(DATA_SCIENTIST_AGENT_PROMPT).toContain('visualization');
    });

    it('includes Indian market context', () => {
      expect(DATA_SCIENTIST_AGENT_PROMPT).toContain('Indian');
      expect(DATA_SCIENTIST_AGENT_PROMPT).toContain('Indian SME');
    });
  });

  describe('competitor-intel-agent', () => {
    it('exports COMPETITOR_INTEL_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof COMPETITOR_INTEL_AGENT_PROMPT).toBe('string');
      expect(COMPETITOR_INTEL_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('default export matches named export', () => {
      expect(CompetitorIntelDefault).toBe(COMPETITOR_INTEL_AGENT_PROMPT);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(COMPETITOR_INTEL_AGENT_PROMPT).toContain(element);
      }
    });

    it('defines competitive intelligence specializations', () => {
      expect(COMPETITOR_INTEL_AGENT_PROMPT).toContain('SWOT');
      expect(COMPETITOR_INTEL_AGENT_PROMPT).toContain('market');
      expect(COMPETITOR_INTEL_AGENT_PROMPT).toContain('pricing');
    });

    it('includes India-specific platforms', () => {
      expect(COMPETITOR_INTEL_AGENT_PROMPT).toContain('JustDial');
      expect(COMPETITOR_INTEL_AGENT_PROMPT).toContain('Google My Business');
    });
  });

  describe('editor-agent', () => {
    it('exports EDITOR_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof EDITOR_AGENT_PROMPT).toBe('string');
      expect(EDITOR_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('default export matches named export', () => {
      expect(EditorDefault).toBe(EDITOR_AGENT_PROMPT);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(EDITOR_AGENT_PROMPT).toContain(element);
      }
    });

    it('defines editor specializations', () => {
      expect(EDITOR_AGENT_PROMPT).toContain('grammar');
      expect(EDITOR_AGENT_PROMPT).toContain('consistency');
      expect(EDITOR_AGENT_PROMPT.toLowerCase()).toContain('polish');
    });

    it('includes India formatting rules', () => {
      expect(EDITOR_AGENT_PROMPT).toContain('₹1,50,000');
      expect(EDITOR_AGENT_PROMPT).toContain('Next Step');
    });
  });

  describe('localization-agent', () => {
    it('exports LOCALIZATION_AGENT_PROMPT as a non-empty string', () => {
      expect(typeof LOCALIZATION_AGENT_PROMPT).toBe('string');
      expect(LOCALIZATION_AGENT_PROMPT.length).toBeGreaterThan(100);
    });

    it('default export matches named export', () => {
      expect(LocalizationDefault).toBe(LOCALIZATION_AGENT_PROMPT);
    });

    it('contains required structural elements', () => {
      for (const element of REQUIRED_PROMPT_ELEMENTS) {
        expect(LOCALIZATION_AGENT_PROMPT).toContain(element);
      }
    });

    it('defines localization specializations', () => {
      expect(LOCALIZATION_AGENT_PROMPT).toContain('Hinglish');
      expect(LOCALIZATION_AGENT_PROMPT).toContain('regional');
      expect(LOCALIZATION_AGENT_PROMPT).toContain('WhatsApp');
    });

    it('includes Indian tier references', () => {
      expect(LOCALIZATION_AGENT_PROMPT).toContain('tier');
      expect(LOCALIZATION_AGENT_PROMPT).toContain('UPI');
    });
  });
});

describe('System Prompt Usability', () => {
  const prompts = [
    { name: 'legal', prompt: LEGAL_AGENT_PROMPT },
    { name: 'security-auditor', prompt: SECURITY_AUDITOR_AGENT_PROMPT },
    { name: 'data-scientist', prompt: DATA_SCIENTIST_AGENT_PROMPT },
    { name: 'competitor-intel', prompt: COMPETITOR_INTEL_AGENT_PROMPT },
    { name: 'editor', prompt: EDITOR_AGENT_PROMPT },
    { name: 'localization', prompt: LOCALIZATION_AGENT_PROMPT },
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
        expect(prompt).toContain('₹');
      });

      it('does not start sections with placeholder markers (instruction-only use is OK)', () => {
        // Prompts may mention placeholders as examples to catch, but should not begin lines with them
        const lines = prompt.split('\n');
        const placeholderLines = lines.filter(l => /^\s*\[INSERT\]|^\s*\[TODO\]|^\s*\[TBD\]|^\s*\[YOUR_TEXT_HERE\]/.test(l));
        expect(placeholderLines).toHaveLength(0);
      });
    });
  }
});

describe('All 6 Prompts Are Distinct', () => {
  const prompts = [
    LEGAL_AGENT_PROMPT,
    SECURITY_AUDITOR_AGENT_PROMPT,
    DATA_SCIENTIST_AGENT_PROMPT,
    COMPETITOR_INTEL_AGENT_PROMPT,
    EDITOR_AGENT_PROMPT,
    LOCALIZATION_AGENT_PROMPT,
  ];

  it('each prompt is a unique string (no copy-paste errors)', () => {
    const unique = new Set(prompts);
    expect(unique.size).toBe(6);
  });

  it('all prompts are at least 500 characters', () => {
    for (const p of prompts) {
      expect(p.length).toBeGreaterThanOrEqual(500);
    }
  });
});
