import { describe, it, expect } from 'vitest';
import {
  GOD_MODE_ENHANCEMENT,
  GOD_MODE_LEVELS,
  GOD_MODE_OPTIMIZED_AGENTS,
  enhanceWithGodMode,
  hasGodMode,
  removeGodMode,
} from './god-mode';

// ─── GOD_MODE_ENHANCEMENT constant ────

describe('GOD_MODE_ENHANCEMENT', () => {
  it('is a non-empty string', () => {
    expect(typeof GOD_MODE_ENHANCEMENT).toBe('string');
    expect(GOD_MODE_ENHANCEMENT.length).toBeGreaterThan(0);
  });

  it('contains the GOD MODE marker', () => {
    expect(GOD_MODE_ENHANCEMENT).toContain('GOD MODE');
    expect(GOD_MODE_ENHANCEMENT).toContain('HIGH-STAKES PROTOCOL');
  });

  it('contains all 6 verification checks', () => {
    expect(GOD_MODE_ENHANCEMENT).toContain('COMPLETENESS');
    expect(GOD_MODE_ENHANCEMENT).toContain('INDIA CONTEXT');
    expect(GOD_MODE_ENHANCEMENT).toContain('ACCURACY');
    expect(GOD_MODE_ENHANCEMENT).toContain('CONSISTENCY');
    expect(GOD_MODE_ENHANCEMENT).toContain('ACTIONABILITY');
    expect(GOD_MODE_ENHANCEMENT).toContain('QUALITY');
  });

  it('contains the Next Step requirement', () => {
    expect(GOD_MODE_ENHANCEMENT).toContain('**Next Step:**');
  });

  it('contains INR pricing reference', () => {
    expect(GOD_MODE_ENHANCEMENT).toContain('₹');
  });

  it('contains the client quality check', () => {
    expect(GOD_MODE_ENHANCEMENT).toContain('₹50,000+ client');
  });
});

// ─── GOD_MODE_LEVELS ──────────────────

describe('GOD_MODE_LEVELS', () => {
  it('has all three levels', () => {
    expect(GOD_MODE_LEVELS).toHaveProperty('standard');
    expect(GOD_MODE_LEVELS).toHaveProperty('critical');
    expect(GOD_MODE_LEVELS).toHaveProperty('production');
  });

  it('standard level contains base enhancement', () => {
    expect(GOD_MODE_LEVELS.standard).toBe(GOD_MODE_ENHANCEMENT);
  });

  it('critical level extends base enhancement', () => {
    expect(GOD_MODE_LEVELS.critical).toContain('GOD MODE');
    expect(GOD_MODE_LEVELS.critical).toContain('CRITICAL TASK');
  });

  it('production level extends base enhancement', () => {
    expect(GOD_MODE_LEVELS.production).toContain('GOD MODE');
    expect(GOD_MODE_LEVELS.production).toContain('PRODUCTION DEPLOYMENT');
  });

  it('production level mentions Indian regulations', () => {
    expect(GOD_MODE_LEVELS.production).toContain('DPDP Act');
    expect(GOD_MODE_LEVELS.production).toContain('GST');
  });
});

// ─── enhanceWithGodMode ───────────────

describe('enhanceWithGodMode', () => {
  const basePrompt = 'You are a specialist agent. Do good work.';

  it('appends standard GOD MODE to a prompt', () => {
    const enhanced = enhanceWithGodMode(basePrompt);
    expect(enhanced).toBe(basePrompt + GOD_MODE_LEVELS.standard);
    expect(enhanced).toContain(basePrompt);
    expect(enhanced).toContain('GOD MODE');
  });

  it('appends critical GOD MODE when level is specified', () => {
    const enhanced = enhanceWithGodMode(basePrompt, 'critical');
    expect(enhanced).toContain(basePrompt);
    expect(enhanced).toContain('CRITICAL TASK');
  });

  it('appends production GOD MODE when level is specified', () => {
    const enhanced = enhanceWithGodMode(basePrompt, 'production');
    expect(enhanced).toContain(basePrompt);
    expect(enhanced).toContain('PRODUCTION DEPLOYMENT');
  });

  it('preserves the original prompt unchanged', () => {
    const original = basePrompt;
    enhanceWithGodMode(basePrompt);
    expect(basePrompt).toBe(original);
  });

  it('does not modify the base prompt in the result', () => {
    const enhanced = enhanceWithGodMode(basePrompt);
    expect(enhanced.startsWith(basePrompt)).toBe(true);
  });

  it('handles empty base prompt', () => {
    const enhanced = enhanceWithGodMode('');
    expect(enhanced).toBe(GOD_MODE_LEVELS.standard);
  });

  it('handles multi-line base prompt', () => {
    const multiLine = 'Line 1\nLine 2\nLine 3';
    const enhanced = enhanceWithGodMode(multiLine);
    expect(enhanced).toContain('Line 1');
    expect(enhanced).toContain('Line 3');
    expect(enhanced).toContain('GOD MODE');
  });

  it('default level is standard', () => {
    const enhanced = enhanceWithGodMode(basePrompt);
    expect(enhanced).toBe(enhanceWithGodMode(basePrompt, 'standard'));
  });
});

// ─── hasGodMode ───────────────────────

describe('hasGodMode', () => {
  it('returns true for a prompt enhanced with GOD MODE', () => {
    const enhanced = enhanceWithGodMode('test prompt');
    expect(hasGodMode(enhanced)).toBe(true);
  });

  it('returns true for a prompt with critical level', () => {
    const enhanced = enhanceWithGodMode('test prompt', 'critical');
    expect(hasGodMode(enhanced)).toBe(true);
  });

  it('returns true for a prompt with production level', () => {
    const enhanced = enhanceWithGodMode('test prompt', 'production');
    expect(hasGodMode(enhanced)).toBe(true);
  });

  it('returns false for a plain prompt', () => {
    expect(hasGodMode('You are a specialist agent.')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasGodMode('')).toBe(false);
  });

  it('returns false for a prompt that mentions "mode" but not "GOD MODE"', () => {
    expect(hasGodMode('Switch to dark mode for better visibility.')).toBe(false);
  });

  it('returns true for a prompt that contains "GOD MODE" anywhere', () => {
    expect(hasGodMode('Enable GOD MODE for testing purposes.')).toBe(true);
  });
});

// ─── removeGodMode ────────────────────

describe('removeGodMode', () => {
  it('removes GOD MODE enhancement from an enhanced prompt', () => {
    const basePrompt = 'You are a specialist agent.';
    const enhanced = enhanceWithGodMode(basePrompt);
    const cleaned = removeGodMode(enhanced);
    expect(cleaned).toBe(basePrompt);
  });

  it('returns the original prompt if no GOD MODE is present', () => {
    const basePrompt = 'You are a specialist agent.';
    const result = removeGodMode(basePrompt);
    expect(result).toBe(basePrompt);
  });

  it('returns empty string for empty input', () => {
    expect(removeGodMode('')).toBe('');
  });

  it('does not affect a prompt without GOD MODE', () => {
    const prompt = 'No GOD MODE here. Just a normal prompt.';
    expect(removeGodMode(prompt)).toBe(prompt);
  });

  it('removes critical level enhancement', () => {
    const base = 'Test prompt';
    const enhanced = enhanceWithGodMode(base, 'critical');
    expect(removeGodMode(enhanced)).toBe(base);
  });

  it('removes production level enhancement', () => {
    const base = 'Test prompt';
    const enhanced = enhanceWithGodMode(base, 'production');
    expect(removeGodMode(enhanced)).toBe(base);
  });

  it('handles prompt with content before GOD MODE', () => {
    const prefix = 'Important instructions before God mode.';
    const enhanced = prefix + enhanceWithGodMode('Test prompt');
    const cleaned = removeGodMode(enhanced);
    expect(cleaned).toBe(prefix + 'Test prompt');
  });
});

// ─── GOD_MODE_OPTIMIZED_AGENTS ────────

describe('GOD_MODE_OPTIMIZED_AGENTS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(GOD_MODE_OPTIMIZED_AGENTS)).toBe(true);
    expect(GOD_MODE_OPTIMIZED_AGENTS.length).toBeGreaterThan(0);
  });

  it('contains key client-facing agents', () => {
    expect(GOD_MODE_OPTIMIZED_AGENTS).toContain('developer');
    expect(GOD_MODE_OPTIMIZED_AGENTS).toContain('strategist');
    expect(GOD_MODE_OPTIMIZED_AGENTS).toContain('seo-specialist');
    expect(GOD_MODE_OPTIMIZED_AGENTS).toContain('seo-strategist');
    expect(GOD_MODE_OPTIMIZED_AGENTS).toContain('product-designer');
    expect(GOD_MODE_OPTIMIZED_AGENTS).toContain('super-orchestrator');
    expect(GOD_MODE_OPTIMIZED_AGENTS).toContain('security-architect');
    expect(GOD_MODE_OPTIMIZED_AGENTS).toContain('agency-brain');
  });

  it('all entries are strings', () => {
    for (const agent of GOD_MODE_OPTIMIZED_AGENTS) {
      expect(typeof agent).toBe('string');
    }
  });

  it('has no duplicate entries', () => {
    const unique = new Set(GOD_MODE_OPTIMIZED_AGENTS);
    expect(unique.size).toBe(GOD_MODE_OPTIMIZED_AGENTS.length);
  });
});

// ─── Round-trip tests ─────────────────

describe('round-trip: enhance then remove', () => {
  it('enhance → hasGodMode → remove restores original', () => {
    const original = 'You are ORACLE specialist agent prompt content.';
    const enhanced = enhanceWithGodMode(original, 'production');
    
    expect(hasGodMode(enhanced)).toBe(true);
    const cleaned = removeGodMode(enhanced);
    expect(hasGodMode(cleaned)).toBe(false);
    expect(cleaned).toBe(original);
  });

  it('double enhance → remove only removes one layer', () => {
    const original = 'Base prompt';
    const once = enhanceWithGodMode(original);
    const twice = enhanceWithGodMode(once);
    
    // removeGodMode finds the first separator and strips from there
    const cleaned = removeGodMode(twice);
    expect(cleaned).toBe(original);
  });
});
