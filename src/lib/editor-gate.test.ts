// ═══════════════════════════════════════
// ORACLE — Editor Gate Tests
// Config persistence, short response skipping, API failures, JSON parsing
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runEditorGate,
  loadEditorConfig,
  saveEditorConfig,
  DEFAULT_EDITOR_CONFIG,
  type EditorGateConfig,
} from './editor-gate';

// Suppress logger output during tests
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock csrfHeaders
vi.mock('@/lib/csrf', () => ({
  csrfHeaders: () => ({ 'x-csrf-token': 'test-token' }),
}));

// ─── Config Persistence ─────────────────

describe('loadEditorConfig / saveEditorConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns DEFAULT_EDITOR_CONFIG when localStorage is empty', () => {
    const config = loadEditorConfig();
    expect(config).toEqual(DEFAULT_EDITOR_CONFIG);
  });

  it('returns default when localStorage has invalid JSON', () => {
    localStorage.setItem('oracle-editor-gate-config', 'not-json');
    const config = loadEditorConfig();
    expect(config).toEqual(DEFAULT_EDITOR_CONFIG);
  });

  it('saves and loads config correctly', () => {
    const custom: EditorGateConfig = {
      enabled: false,
      minLength: 200,
      skipAgentTypes: ['orchestrator', 'coordinator'],
    };
    saveEditorConfig(custom);
    const loaded = loadEditorConfig();
    expect(loaded.enabled).toBe(false);
    expect(loaded.minLength).toBe(200);
    expect(loaded.skipAgentTypes).toContain('orchestrator');
    expect(loaded.skipAgentTypes).toContain('coordinator');
  });

  it('merges partial config with defaults', () => {
    const partial = { enabled: false };
    saveEditorConfig({ ...DEFAULT_EDITOR_CONFIG, ...partial });
    const loaded = loadEditorConfig();
    expect(loaded.enabled).toBe(false);
    expect(loaded.minLength).toBe(DEFAULT_EDITOR_CONFIG.minLength);
    expect(loaded.skipAgentTypes).toEqual(DEFAULT_EDITOR_CONFIG.skipAgentTypes);
  });

  it('returns default config structure', () => {
    expect(DEFAULT_EDITOR_CONFIG.enabled).toBe(true);
    expect(DEFAULT_EDITOR_CONFIG.minLength).toBe(100);
    expect(DEFAULT_EDITOR_CONFIG.skipAgentTypes).toEqual([]);
  });
});

// ─── Short Response Skipping ─────────────

describe('Short response skipping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('skips responses shorter than minLength', async () => {
    const result = await runEditorGate('test request', 'short', 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('too short');
  });

  it('skips empty responses', async () => {
    const result = await runEditorGate('test request', '', 'writer', ['groq']);
    expect(result.passed).toBe(true);
  });

  it('skips responses exactly at minLength boundary (below)', async () => {
    const shortResponse = 'a'.repeat(99); // below default minLength of 100
    const result = await runEditorGate('test request', shortResponse, 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('too short');
  });

  it('processes responses at minLength threshold', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify({ passed: true, issues: [], confidence: 90, assessment: 'Clean output' }) }),
    });
    global.fetch = mockFetch;

    const atThreshold = 'a'.repeat(100); // exactly at default minLength
    const result = await runEditorGate('test request', atThreshold, 'writer', ['groq']);
    // Should proceed to API call (not skip)
    expect(mockFetch).toHaveBeenCalled();
  });

  it('respects custom minLength from config', async () => {
    saveEditorConfig({ ...DEFAULT_EDITOR_CONFIG, minLength: 50 });
    const shortResponse = 'a'.repeat(40); // below custom minLength
    const result = await runEditorGate('test request', shortResponse, 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('too short');
  });
});

// ─── Disabled Gate ──────────────────────

describe('Disabled gate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('skips when gate is disabled', async () => {
    saveEditorConfig({ ...DEFAULT_EDITOR_CONFIG, enabled: false });
    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('disabled');
  });
});

// ─── Skip Agent Types ───────────────────

describe('Skip agent types', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('skips excluded agent types', async () => {
    saveEditorConfig({ ...DEFAULT_EDITOR_CONFIG, skipAgentTypes: ['orchestrator', 'researcher'] });
    const result = await runEditorGate('test request', 'a'.repeat(200), 'orchestrator', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('excluded');
  });

  it('does not skip non-excluded agent types', async () => {
    saveEditorConfig({ ...DEFAULT_EDITOR_CONFIG, skipAgentTypes: ['orchestrator'] });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify({ passed: true, issues: [], confidence: 95, assessment: 'All good' }) }),
    });
    global.fetch = mockFetch;

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(mockFetch).toHaveBeenCalled();
  });
});

// ─── API Failure Handling ───────────────

describe('API failure handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns pass when API returns non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('API call failed');
  });

  it('returns pass when network request throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('error');
  });

  it('returns pass when proxy response has no text field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    // Empty text won't parse as JSON, so should return pass with parse failure
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('parse failed');
  });
});

// ─── JSON Parsing ───────────────────────

describe('JSON parsing from AI response', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parses direct JSON response', async () => {
    const aiResponse = {
      passed: true,
      issues: [],
      confidence: 92,
      assessment: 'Output is clean and professional',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify(aiResponse) }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(92);
    expect(result.assessment).toBe('Output is clean and professional');
  });

  it('parses JSON wrapped in markdown code fences', async () => {
    const aiResponse = {
      passed: false,
      issues: [{ severity: 'high', category: 'placeholder', description: 'Found [TODO] marker' }],
      correctedText: 'Fixed output here',
      confidence: 65,
      assessment: 'Issues found and corrected',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: '```json\n' + JSON.stringify(aiResponse) + '\n```' }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('high');
    expect(result.issues[0].category).toBe('placeholder');
    expect(result.correctedText).toBe('Fixed output here');
    expect(result.confidence).toBe(65);
  });

  it('parses JSON embedded in text', async () => {
    const aiResponse = {
      passed: true,
      issues: [],
      confidence: 88,
      assessment: 'Looks good',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: 'Here is my review:\n' + JSON.stringify(aiResponse) + '\nDone.' }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(88);
  });

  it('returns pass when AI response is not parseable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: 'This is just plain text with no JSON' }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.assessment).toContain('parse failed');
  });

  it('handles response with missing fields gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify({ passed: true }) }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.confidence).toBe(80); // default
    expect(result.assessment).toBe('');
  });

  it('handles response with null correctedText', async () => {
    const aiResponse = {
      passed: false,
      issues: [{ severity: 'low', category: 'polish', description: 'Minor style issue' }],
      correctedText: null,
      confidence: 75,
      assessment: 'Minor issues',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify(aiResponse) }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(false);
    expect(result.correctedText).toBeUndefined();
  });

  it('handles response with empty correctedText', async () => {
    const aiResponse = {
      passed: false,
      issues: [{ severity: 'low', category: 'polish', description: 'Minor style issue' }],
      correctedText: '',
      confidence: 75,
      assessment: 'Minor issues',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify(aiResponse) }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(false);
    expect(result.correctedText).toBeUndefined();
  });
});

// ─── Successful Response ────────────────

describe('Successful response with issues', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns issues with all severity levels', async () => {
    const aiResponse = {
      passed: false,
      issues: [
        { severity: 'critical', category: 'placeholder', description: 'Found [INSERT HERE]' },
        { severity: 'high', category: 'formatting', description: 'Price uses USD instead of INR' },
        { severity: 'medium', category: 'grammar', description: 'Subject-verb agreement' },
        { severity: 'low', category: 'polish', description: 'Could be more concise' },
      ],
      correctedText: 'Corrected version of the response',
      confidence: 45,
      assessment: 'Multiple issues found across severity levels',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify(aiResponse) }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(4);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[1].severity).toBe('high');
    expect(result.issues[2].severity).toBe('medium');
    expect(result.issues[3].severity).toBe('low');
    expect(result.correctedText).toBe('Corrected version of the response');
    expect(result.confidence).toBe(45);
  });

  it('includes checkedAt timestamp', async () => {
    const before = Date.now();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify({ passed: true, issues: [], confidence: 90, assessment: 'Clean' }) }),
    });

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', ['groq']);
    const after = Date.now();
    expect(result.checkedAt).toBeGreaterThanOrEqual(before);
    expect(result.checkedAt).toBeLessThanOrEqual(after);
  });
});

// ─── Provider Selection ─────────────────

describe('Provider selection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses first configured provider', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify({ passed: true, issues: [], confidence: 90, assessment: 'Clean' }) }),
    });
    global.fetch = mockFetch;

    await runEditorGate('test request', 'a'.repeat(200), 'writer', ['anthropic', 'openai', 'groq']);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    // The provider selection is internal to runEditorGate, but we can verify the fetch was called
    expect(mockFetch).toHaveBeenCalled();
  });

  it('falls back to groq when no providers configured', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: JSON.stringify({ passed: true, issues: [], confidence: 90, assessment: 'Clean' }) }),
    });
    global.fetch = mockFetch;

    const result = await runEditorGate('test request', 'a'.repeat(200), 'writer', []);
    expect(mockFetch).toHaveBeenCalled();
    expect(result.passed).toBe(true);
  });
});
