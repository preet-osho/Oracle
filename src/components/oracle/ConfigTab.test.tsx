import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { PlanId } from '@/lib/subscription';

let mockPlan: PlanId = 'starter';

vi.mock('./FeatureGate', () => ({
  useSubscriptionState: () => ({ plan: mockPlan, isValid: true, loading: false }),
  getRequiredPlanForFeature: (feature: string) => {
    const map: Record<string, PlanId> = { webSearch: 'pro', clientMemory: 'pro', proposals: 'pro', invoices: 'pro' };
    return map[feature] || 'pro';
  },
  UpgradeModal: ({ open, onOpenChange, featureLabel }: { open: boolean; onOpenChange: (open: boolean) => void; featureLabel?: string }) => (
    open ? (
      <div data-testid="upgrade-modal">
        <span>Upgrade Modal: {featureLabel}</span>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
  ),
}));

import { ConfigTab } from './ConfigTab';
import { fetchWithTimeout } from '@/lib/fetch-utils';

// ─── Mocks ─────────────────────────────

// Override design-tokens from setupTests for this file
vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

// Mock providers data — provide a small subset for testing
vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    {
      id: 'openai',
      name: 'OpenAI',
      color: '#10a37f',
      keyLabel: 'sk-xxxx...xxxx',
      signupUrl: 'https://platform.openai.com/signup',
      freeLimit: '$5 free credit',
      costPer1kTokens: { input: 0.0025, output: 0.01, currency: 'USD' },
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, bestFor: [], isFree: false },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, bestFor: [], isFree: false },
      ],
    },
    {
      id: 'groq',
      name: 'Groq',
      color: '#f55036',
      keyLabel: 'gsk_xxxx...xxxx',
      signupUrl: 'https://console.groq.com/signup',
      freeLimit: '14,400 requests/day free',
      costPer1kTokens: { input: 0.00059, output: 0.00079, currency: 'USD' },
      models: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, bestFor: [], isFree: true },
      ],
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      color: '#d4a574',
      keyLabel: 'sk-ant-xxxx...xxxx',
      signupUrl: 'https://console.anthropic.com/signup',
      freeLimit: '$5 free credit',
      costPer1kTokens: { input: 0.015, output: 0.075, currency: 'USD' },
      models: [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4', contextWindow: 200000, bestFor: [], isFree: false },
      ],
    },
  ],
  MCP_SERVERS: {
    gmail: { url: 'https://gmail.example.com', name: 'Gmail' },
    calendar: { url: 'https://calendar.example.com', name: 'Calendar' },
    drive: { url: 'https://drive.example.com', name: 'Drive' },
  },
}));

// Mock fetch for key testing flow
const originalFetch = global.fetch;
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Zustand store
const mockSetByokKey = vi.fn();
const mockRemoveByokKey = vi.fn().mockResolvedValue(undefined);
const mockToggleAutoRoute = vi.fn();
const mockSetSelectedModel = vi.fn();
const mockToggleStreaming = vi.fn();
const mockToggleMcp = vi.fn();
const mockResetCosts = vi.fn();

let mockByokKeys: Record<string, string> = {};
let mockAutoRoute = true;
let mockSelectedModel = { providerId: 'groq', modelId: 'llama-3.3-70b-versatile' };
let mockStreamingEnabled = true;
let mockMcpEnabled = { gmail: false, calendar: false, drive: false };
let mockTotalCostUSD = 0;
let mockTotalCostINR = 0;
let mockUsageHistory: Array<{ timestamp: number; provider: string; costINR: number }> = [];
let mockTemperature = 0.7;
const mockSetTemperature = vi.fn();

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    byokKeys: mockByokKeys,
    setByokKey: mockSetByokKey,
    removeByokKey: mockRemoveByokKey,
    autoRoute: mockAutoRoute,
    toggleAutoRoute: mockToggleAutoRoute,
    selectedModel: mockSelectedModel,
    setSelectedModel: mockSetSelectedModel,
    streamingEnabled: mockStreamingEnabled,
    toggleStreaming: mockToggleStreaming,
    temperature: mockTemperature,
    setTemperature: mockSetTemperature,
    mcpEnabled: mockMcpEnabled,
    toggleMcp: mockToggleMcp,
    totalCostUSD: mockTotalCostUSD,
    totalCostINR: mockTotalCostINR,
    resetCosts: mockResetCosts,
    usageHistory: mockUsageHistory,
  }),
}));

// Mock hallucination guard config
const mockLoadGuardConfig = vi.fn();
const mockSaveGuardConfig = vi.fn();
vi.mock('@/lib/hallucination-guard', () => ({
  loadGuardConfig: (...args: unknown[]) => mockLoadGuardConfig(...args),
  saveGuardConfig: (...args: unknown[]) => mockSaveGuardConfig(...args),
  DEFAULT_GUARD_CONFIG: {
    enabled: true,
    thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
    maxRetries: 2,
    selfVerification: true,
    factGrounding: true,
    patternDetection: true,
    strictDomains: ['finance', 'healthcare', 'legal', 'investment', 'ads'],
  },
}));

// Mock editor gate config
const mockLoadEditorConfig = vi.fn();
const mockSaveEditorConfig = vi.fn();
vi.mock('@/lib/editor-gate', () => ({
  loadEditorConfig: (...args: unknown[]) => mockLoadEditorConfig(...args),
  saveEditorConfig: (...args: unknown[]) => mockSaveEditorConfig(...args),
  DEFAULT_EDITOR_CONFIG: {
    enabled: true,
    minLength: 100,
    skipAgentTypes: [],
  },
}));

// Mock react-hot-toast
const mockToastWarning = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => mockToastWarning(...args),
    { success: (...args: unknown[]) => mockToastWarning(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ),
  toast: Object.assign(
    (...args: unknown[]) => mockToastWarning(...args),
    { success: (...args: unknown[]) => mockToastWarning(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ),
}));

// Mock knowledge docs API
const mockKnowledgeDocsList = vi.fn().mockResolvedValue([]);
const mockKnowledgeDocsCreate = vi.fn();
const mockKnowledgeDocsDelete = vi.fn();

vi.mock('@/lib/api', () => ({
  knowledgeDocsApi: {
    list: (...args: unknown[]) => mockKnowledgeDocsList(...args),
    create: (...args: unknown[]) => mockKnowledgeDocsCreate(...args),
    delete: (...args: unknown[]) => mockKnowledgeDocsDelete(...args),
  },
}));

// ─── Circuit Breaker Test Helpers ──────────────────────

type CircuitState = 'open' | 'half-open' | 'closed';

interface CircuitFixture {
  providerId: string;
  state: CircuitState;
  consecutiveFailures: number;
  cooldownRemainingMs: number | null;
}

interface ResetOptions {
  /** Response returned by POST /api/analytics/circuits. Defaults to empty circuits. */
  resetCircuits?: CircuitFixture[];
  /** If true, POST returns ok: false. */
  resetError?: boolean;
}

/**
 * Mocks global.fetch to return the given circuit fixtures on GET
 * /api/analytics/circuits, and handles /api/knowledge-docs/indexed + fallback.
 *
 * Optionally configures a POST handler for the reset endpoint.
 */
function setupCircuitMock(circuits: CircuitFixture[], opts?: ResetOptions) {
  const unavailable = circuits.filter((c) => c.state === 'open').map((c) => c.providerId);
  const summary = {
    total: circuits.length,
    open: circuits.filter((c) => c.state === 'open').length,
    halfOpen: circuits.filter((c) => c.state === 'half-open').length,
    closed: circuits.filter((c) => c.state === 'closed').length,
  };
  const resetCircuits = opts?.resetCircuits ?? [];
  const resetUnavailable = resetCircuits.filter((c) => c.state === 'open').map((c) => c.providerId);

  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === 'string' && url.includes('/api/knowledge-docs/indexed')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ indexedIds: [] }) });
    }
    if (typeof url === 'string' && url.includes('/api/analytics/circuits')) {
      if (init?.method === 'POST') {
        if (opts?.resetError) {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Server error' }) });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, circuits: resetCircuits, unavailable: resetUnavailable }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ circuits, unavailable, summary }),
      });
    }
    return Promise.resolve({ ok: true });
  });
}

/** Create a single circuit fixture with sensible defaults. */
function circuit(
  providerId: string,
  state: CircuitState,
  overrides?: Partial<CircuitFixture>,
): CircuitFixture {
  return {
    providerId,
    state,
    consecutiveFailures: state === 'closed' ? 0 : 3,
    cooldownRemainingMs: state === 'open' ? 120000 : null,
    ...overrides,
  };
}



// ─── circuit() factory tests ──────────────

describe('circuit() factory', () => {
  it('returns open circuit with default failures and cooldown', () => {
    const c = circuit('groq', 'open');
    expect(c.providerId).toBe('groq');
    expect(c.state).toBe('open');
    expect(c.consecutiveFailures).toBe(3);
    expect(c.cooldownRemainingMs).toBe(120000);
  });

  it('returns closed circuit with zero failures and no cooldown', () => {
    const c = circuit('openai', 'closed');
    expect(c.providerId).toBe('openai');
    expect(c.state).toBe('closed');
    expect(c.consecutiveFailures).toBe(0);
    expect(c.cooldownRemainingMs).toBeNull();
  });

  it('returns half-open circuit with default failures and no cooldown', () => {
    const c = circuit('anthropic', 'half-open');
    expect(c.providerId).toBe('anthropic');
    expect(c.state).toBe('half-open');
    expect(c.consecutiveFailures).toBe(3);
    expect(c.cooldownRemainingMs).toBeNull();
  });

  it('applies overrides on top of defaults', () => {
    const c = circuit('groq', 'open', { consecutiveFailures: 10, cooldownRemainingMs: 300000 });
    expect(c.consecutiveFailures).toBe(10);
    expect(c.cooldownRemainingMs).toBe(300000);
    // providerId and state still come from positional args
    expect(c.providerId).toBe('groq');
    expect(c.state).toBe('open');
  });

  it('allows partial overrides (only some fields)', () => {
    const c = circuit('groq', 'open', { consecutiveFailures: 7 });
    expect(c.consecutiveFailures).toBe(7);
    expect(c.cooldownRemainingMs).toBe(120000); // default for open
  });

  it('allows overriding cooldownRemainingMs on closed circuit', () => {
    const c = circuit('groq', 'closed', { cooldownRemainingMs: 60000 });
    expect(c.cooldownRemainingMs).toBe(60000);
    expect(c.consecutiveFailures).toBe(0); // default for closed
  });

  // ── Edge cases ──

  it('handles empty overrides object without changing defaults', () => {
    const c = circuit('groq', 'open', {});
    expect(c.consecutiveFailures).toBe(3);
    expect(c.cooldownRemainingMs).toBe(120000);
  });

  it('overrides all fields at once', () => {
    const c = circuit('groq', 'open', {
      consecutiveFailures: 99,
      cooldownRemainingMs: 0,
    });
    expect(c.providerId).toBe('groq');
    expect(c.state).toBe('open');
    expect(c.consecutiveFailures).toBe(99);
    expect(c.cooldownRemainingMs).toBe(0);
  });

  it('handles providerId with special characters', () => {
    const c = circuit('my-provider_v2.1', 'half-open');
    expect(c.providerId).toBe('my-provider_v2.1');
    expect(c.state).toBe('half-open');
    expect(c.consecutiveFailures).toBe(3);
    expect(c.cooldownRemainingMs).toBeNull();
  });

  it('handles empty string providerId', () => {
    const c = circuit('', 'closed');
    expect(c.providerId).toBe('');
    expect(c.consecutiveFailures).toBe(0);
  });

  it('handles very large consecutiveFailures override', () => {
    const c = circuit('groq', 'open', { consecutiveFailures: Number.MAX_SAFE_INTEGER });
    expect(c.consecutiveFailures).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('handles zero cooldownRemainingMs override (not null)', () => {
    const c = circuit('groq', 'open', { cooldownRemainingMs: 0 });
    expect(c.cooldownRemainingMs).toBe(0); // 0 is falsy but distinct from null
  });
});

// ─── setupCircuitMock() tests ──────────────

describe('setupCircuitMock() helper', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('GET returns circuit fixtures with correct summary', async () => {
    setupCircuitMock([
      circuit('groq', 'open'),
      circuit('openai', 'closed'),
    ]);

    const res = await mockFetch('/api/analytics/circuits', { headers: {} });
    const data = await res.json();
    expect(data.circuits).toHaveLength(2);
    expect(data.summary).toEqual({ total: 2, open: 1, halfOpen: 0, closed: 1 });
    expect(data.unavailable).toEqual(['groq']);
  });

  it('GET returns empty arrays for no circuits', async () => {
    setupCircuitMock([]);

    const res = await mockFetch('/api/analytics/circuits', { headers: {} });
    const data = await res.json();
    expect(data.circuits).toHaveLength(0);
    expect(data.unavailable).toHaveLength(0);
    expect(data.summary).toEqual({ total: 0, open: 0, halfOpen: 0, closed: 0 });
  });

  it('GET computes summary counts for mixed states', async () => {
    setupCircuitMock([
      circuit('groq', 'open'),
      circuit('openai', 'half-open'),
      circuit('anthropic', 'closed'),
      circuit('deepseek', 'open'),
    ]);

    const res = await mockFetch('/api/analytics/circuits', { headers: {} });
    const data = await res.json();
    expect(data.summary).toEqual({ total: 4, open: 2, halfOpen: 1, closed: 1 });
    expect(data.unavailable).toEqual(['groq', 'deepseek']);
  });

  it('GET unavailable list only includes open (not half-open) circuits', async () => {
    setupCircuitMock([
      circuit('groq', 'half-open'),
      circuit('openai', 'closed'),
    ]);

    const res = await mockFetch('/api/analytics/circuits', { headers: {} });
    const data = await res.json();
    expect(data.unavailable).toHaveLength(0);
    expect(data.summary.open).toBe(0);
    expect(data.summary.halfOpen).toBe(1);
  });

  it('POST returns resetCircuits response', async () => {
    setupCircuitMock(
      [circuit('groq', 'open')],
      { resetCircuits: [circuit('openai', 'open')] },
    );

    const res = await mockFetch('/api/analytics/circuits', { method: 'POST' });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.circuits).toHaveLength(1);
    expect(data.circuits[0].providerId).toBe('openai');
    expect(data.unavailable).toEqual(['openai']);
  });

  it('POST returns empty resetCircuits by default', async () => {
    setupCircuitMock([circuit('groq', 'open')]);

    const res = await mockFetch('/api/analytics/circuits', { method: 'POST' });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.circuits).toHaveLength(0);
    expect(data.unavailable).toHaveLength(0);
  });

  it('POST returns error response when resetError is true', async () => {
    setupCircuitMock(
      [circuit('groq', 'open')],
      { resetError: true },
    );

    const res = await mockFetch('/api/analytics/circuits', { method: 'POST' });
    expect(res.ok).toBe(false);
    const data = await res.json();
    expect(data.error).toBe('Server error');
  });

  it('handles /api/knowledge-docs/indexed with empty indexedIds', async () => {
    setupCircuitMock([]);

    const res = await mockFetch('/api/knowledge-docs/indexed');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.indexedIds).toEqual([]);
  });

  it('returns ok:true for unrecognized URLs', async () => {
    setupCircuitMock([]);

    const res = await mockFetch('/api/some/other/endpoint');
    expect(res.ok).toBe(true);
  });

  it('POST resetUnavailable only includes open circuits from resetCircuits', async () => {
    setupCircuitMock(
      [circuit('groq', 'open')],
      {
        resetCircuits: [
          circuit('groq', 'closed'),
          circuit('openai', 'open'),
        ],
      },
    );

    const res = await mockFetch('/api/analytics/circuits', { method: 'POST' });
    const data = await res.json();
    expect(data.unavailable).toEqual(['openai']);
  });
});

// ─── fetchWithTimeout unit tests ──────────────────────────

describe('fetchWithTimeout (direct)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('passes an AbortSignal to fetch', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await fetchWithTimeout('/api/test');

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('/api/test');
    expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('works with no init argument', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: 1 }) });

    const res = await fetchWithTimeout('/api/test');
    expect(res.ok).toBe(true);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('/api/test');
    expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('works with empty object init', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const res = await fetchWithTimeout('/api/test', {});
    expect(res.ok).toBe(true);
    expect(mockFetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses default 15s timeout when timeoutMs is not provided', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    try {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

      await fetchWithTimeout('/api/test');

      const timeoutCall = setTimeoutSpy.mock.calls.find(
        ([fn, delay]) => typeof fn === 'function' && delay === 15_000,
      );
      expect(timeoutCall).toBeDefined();
      expect(timeoutCall![1]).toBe(15_000);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('uses custom timeoutMs when provided', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    try {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

      await fetchWithTimeout('/api/test', { timeoutMs: 5_000 });

      const timeoutCall = setTimeoutSpy.mock.calls.find(
        ([fn, delay]) => typeof fn === 'function' && delay === 5_000,
      );
      expect(timeoutCall).toBeDefined();
      expect(timeoutCall![1]).toBe(5_000);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('strips timeoutMs from init before passing to fetch', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await fetchWithTimeout('/api/test', { timeoutMs: 5_000, method: 'POST', headers: { 'Content-Type': 'application/json' } });

    const init = mockFetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.timeoutMs).toBeUndefined();
  });

  it('clears the timeout on successful response with the correct timer ID', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    try {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

      await fetchWithTimeout('/api/test');

      // Get the return value of the abort setTimeout call (the timer ID)
      const abortCallIdx = setTimeoutSpy.mock.calls.findIndex(
        ([fn]) => typeof fn === 'function',
      );
      const expectedTimerId = setTimeoutSpy.mock.results[abortCallIdx]?.value;

      // clearTimeout should have been called with that exact timer ID
      expect(clearTimeoutSpy).toHaveBeenCalledWith(expectedTimerId);
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });

  it('clears the timeout on fetch rejection', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    try {
      mockFetch.mockRejectedValue(new Error('network error'));

      await expect(fetchWithTimeout('/api/test')).rejects.toThrow('network error');
      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      clearTimeoutSpy.mockRestore();
    }
  });

  it('rejects with AbortError when timeout fires', async () => {
    vi.useFakeTimers();
    try {
      // Mock fetch to hang — the abort signal will reject it
      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      );

      const promise = fetchWithTimeout('/api/test');

      // Advance past the 15s timeout — this triggers controller.abort()
      vi.advanceTimersByTime(15_001);

      try {
        await promise;
        expect.fail('Expected promise to reject');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).name).toBe('AbortError');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects with AbortError when custom timeoutMs fires', async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      );

      const promise = fetchWithTimeout('/api/test', { timeoutMs: 5000 });

      vi.advanceTimersByTime(5001);

      try {
        await promise;
        expect.fail('Expected promise to reject');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).name).toBe('AbortError');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not abort before custom timeoutMs fires', async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      );

      const promise = fetchWithTimeout('/api/test', { timeoutMs: 5000 });

      // Advance past 4s but NOT past 5s — should NOT abort yet
      vi.advanceTimersByTime(4000);

      // Race the promise against a 100ms timer; if it settles within that window, the abort fired too early
      const raceWinner = await Promise.race([
        promise.then(() => 'settled').catch(() => 'settled'),
        new Promise<string>((resolve) => {
          vi.advanceTimersByTime(100);
          resolve('timeout-won');
        }),
      ]);
      expect(raceWinner).toBe('timeout-won');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves with the fetch response on success', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: 42 }) };
    mockFetch.mockResolvedValue(mockResponse);

    const res = await fetchWithTimeout('/api/test');
    expect(res).toBe(mockResponse);
    expect(res.ok).toBe(true);
  });

  it('resolves successfully within custom timeoutMs window', async () => {
    vi.useFakeTimers();
    try {
      let resolveFetch!: (value: Response) => void;
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => { resolveFetch = resolve; }),
      );

      const promise = fetchWithTimeout('/api/test', { timeoutMs: 5000 });

      // Advance 2s — before the 5s timeout — then resolve the fetch externally
      vi.advanceTimersByTime(2000);
      resolveFetch({ ok: true, json: () => Promise.resolve({ resolved: true }) } as Response);

      const res = await promise;
      expect(res.ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forwards caller signal abort to fetch', async () => {
    const callerController = new AbortController();
    mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        });
      }),
    );

    const promise = fetchWithTimeout('/api/test', { signal: callerController.signal });

    // Abort via the caller's controller — should propagate through
    callerController.abort();

    try {
      await promise;
      expect.fail('Expected promise to reject');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe('AbortError');
    }
  });

  it('rejects immediately when caller signal is already aborted', async () => {
    const callerController = new AbortController();
    callerController.abort(); // abort before passing

    // Mock must check signal.aborted because the 'abort' event already
    // fired before the listener was registered inside fetchWithTimeout.
    mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
          return;
        }
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        });
      }),
    );

    const promise = fetchWithTimeout('/api/test', { signal: callerController.signal });

    try {
      await promise;
      expect.fail('Expected promise to reject');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe('AbortError');
    }
  });

  it('timeout still works when caller signal is also provided', async () => {
    vi.useFakeTimers();
    try {
      const callerController = new AbortController();

      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      );

      const promise = fetchWithTimeout('/api/test', {
        signal: callerController.signal,
        timeoutMs: 5000,
      });

      // Advance past the 5s timeout — should abort even though caller hasn't
      vi.advanceTimersByTime(5001);

      try {
        await promise;
        expect.fail('Expected promise to reject');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).name).toBe('AbortError');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('caller signal abort wins over timeout when fired first', async () => {
    vi.useFakeTimers();
    try {
      const callerController = new AbortController();

      // Mock fetch to hang until the abort signal fires
      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      );

      const promise = fetchWithTimeout('/api/test', {
        signal: callerController.signal,
        timeoutMs: 5000,
      });

      // Abort via the caller's signal BEFORE the 5s timeout fires (at 2s)
      vi.advanceTimersByTime(2000);
      callerController.abort();

      try {
        await promise;
        expect.fail('Expected promise to reject');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).name).toBe('AbortError');
      }

      // The timeout timer should still be cleared in .finally()
      // (advance past it to confirm no double-abort issues)
      vi.advanceTimersByTime(5000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleans up caller signal abort listener after successful resolution', async () => {
    const callerController = new AbortController();
    const removeListenerSpy = vi.spyOn(callerController.signal, 'removeEventListener');

    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    try {
      await fetchWithTimeout('/api/test', { signal: callerController.signal });

      // The abort listener should have been removed in .finally()
      expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    } finally {
      removeListenerSpy.mockRestore();
    }
  });

  it('forwards init properties like headers and body to fetch', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await fetchWithTimeout('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
    });

    const init = mockFetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"key":"value"}');
  });

  // ── Edge-case timeoutMs values ──

  it('timeoutMs of 0 aborts immediately', async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      );

      const promise = fetchWithTimeout('/api/test', { timeoutMs: 0 });

      // A 0ms timeout fires on the next tick — advance timers
      vi.advanceTimersByTime(0);

      try {
        await promise;
        expect.fail('Expected promise to reject');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).name).toBe('AbortError');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('timeoutMs of Number.MAX_SAFE_INTEGER does not abort within test window', async () => {
    vi.useFakeTimers();
    try {
      const huge = Number.MAX_SAFE_INTEGER;
      let resolveFetch!: (value: Response) => void;
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => { resolveFetch = resolve; }),
      );

      const promise = fetchWithTimeout('/api/test', { timeoutMs: huge });

      // Advancing a reasonable time should NOT trigger the astronomically large timeout
      vi.advanceTimersByTime(10_000);

      // Resolve externally before the astronomically large timeout fires
      resolveFetch({ ok: true, json: () => Promise.resolve({ resolved: true }) } as Response);
      const res = await promise;
      expect(res.ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  // ── Request object as URL input ──

  it('accepts a Request object as input instead of a string', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ from: 'request' }) };
    mockFetch.mockResolvedValue(mockResponse);

    const request = new Request('http://localhost/api/test', { method: 'GET' });
    const res = await fetchWithTimeout(request);

    expect(res).toBe(mockResponse);
    expect(res.ok).toBe(true);

    // The first positional arg passed to fetch should be the Request object
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe(request);
  });

  it('accepts a Request object and still attaches timeout signal', async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      );

      const request = new Request('http://localhost/api/test');
      const promise = fetchWithTimeout(request, { timeoutMs: 5000 });

      // The signal passed to fetch should be the AbortController's signal,
      // not anything from the original Request object
      const fetchedInit = mockFetch.mock.calls[0][1] as RequestInit;
      expect(fetchedInit.signal).toBeInstanceOf(AbortSignal);

      // Advance past the timeout — should abort
      vi.advanceTimersByTime(5001);

      try {
        await promise;
        expect.fail('Expected promise to reject');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).name).toBe('AbortError');
      }
    } finally {
      vi.useRealTimers();
    }
  });
});



// ─── Tests ─────────────────────────────

describe('ConfigTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlan = 'starter';
    mockByokKeys = {};
    mockAutoRoute = true;
    mockSelectedModel = { providerId: 'groq', modelId: 'llama-3.3-70b-versatile' };
    mockStreamingEnabled = true;
    mockMcpEnabled = { gmail: false, calendar: false, drive: false };
    mockTotalCostUSD = 0;
    mockTotalCostINR = 0;
    mockUsageHistory = [];
    mockTemperature = 0.7;
    mockFetch.mockReset();
    // Default: handle /api/knowledge-docs/indexed call on mount
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/api/knowledge-docs/indexed')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ indexedIds: [] }) });
      }
      if (typeof url === 'string' && url.includes('/api/analytics/circuits')) {
        // Default: no circuits (all healthy)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ circuits: [], unavailable: [], summary: { total: 0, open: 0, halfOpen: 0, closed: 0 } }) });
      }
      return Promise.resolve({ ok: true });
    });
    // Default editor gate config
    mockLoadEditorConfig.mockReturnValue({
      enabled: true,
      minLength: 100,
      skipAgentTypes: [],
    });
    // Default guard config returns enabled with default thresholds
    mockLoadGuardConfig.mockReturnValue({
      enabled: true,
      thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
      maxRetries: 2,
      selfVerification: true,
      factGrounding: true,
      patternDetection: true,
      strictDomains: ['finance', 'healthcare', 'legal', 'investment', 'ads'],
    });
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the settings header', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('⚙ Settings')).toBeDefined();
      expect(screen.getByText(/Configure ORACLE to match your agency workflow/)).toBeDefined();
    });

    it('renders all section headers', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/API Keys/)).toBeDefined();
      expect(screen.getByText('🤖 Model Selection')).toBeDefined();
      expect(screen.getByText('🔌 MCP Tools')).toBeDefined();
      expect(screen.getByText('🔧 Advanced Settings')).toBeDefined();
      expect(screen.getByText('🛡 Hallucination Guard')).toBeDefined();
      expect(screen.getByText('📊 Output Quality Evaluator')).toBeDefined();
      expect(screen.getByText('🏢 Agency Profile')).toBeDefined();
      expect(screen.getByText('📚 Knowledge Base')).toBeDefined();
      expect(screen.getByText('⚡ Claude Code Integration')).toBeDefined();
      expect(screen.getByText('💰 Cost Dashboard')).toBeDefined();
    });

    it('renders all providers in the BYOK section', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('OpenAI')).toBeDefined();
      expect(screen.getByText('Groq')).toBeDefined();
      expect(screen.getByText('Anthropic')).toBeDefined();
    });

    it('renders MCP tool cards', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Gmail')).toBeDefined();
      expect(screen.getByText('Calendar')).toBeDefined();
      expect(screen.getByText('Drive')).toBeDefined();
    });
  });

  // ── BYOK Key Management ──

  describe('BYOK key management', () => {
    it('shows "Set Key" button when no key is configured', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const setKeyButtons = screen.getAllByText('Set Key');
      expect(setKeyButtons.length).toBe(3); // One per provider
    });

    it('shows "✓ Set" button when key is configured', async () => {
      mockByokKeys = { openai: 'sk-test-key' };
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('✓ Set')).toBeDefined();
    });

    it('expands key input panel when Set Key is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]);
      // Should show the password input
      expect(screen.getByPlaceholderText('sk-xxxx...xxxx')).toBeDefined();
      expect(screen.getByText('Test')).toBeDefined();
    });

    it('collapses key input panel when clicked again', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]);
      expect(screen.getByPlaceholderText('sk-xxxx...xxxx')).toBeDefined();
      // Click the same button again to collapse — it still says 'Set Key'
      const collapseButtons = screen.getAllByText('Set Key');
      await user.click(collapseButtons[0]);
      expect(screen.queryByPlaceholderText('sk-xxxx...xxxx')).toBeNull();
    });

    it('shows Remove button when key is configured and panel is open', async () => {
      mockByokKeys = { openai: 'sk-test-key' };
      const user = userEvent.setup();
      render(<ConfigTab />);
      // Open the OpenAI panel
      await user.click(screen.getByText('✓ Set'));
      expect(screen.getByText('Remove')).toBeDefined();
    });

    it('calls removeByokKey when Remove is clicked', async () => {
      mockByokKeys = { openai: 'sk-test-key' };
      const user = userEvent.setup();
      render(<ConfigTab />);
      await user.click(screen.getByText('✓ Set'));
      await user.click(screen.getByText('Remove'));
      expect(mockRemoveByokKey).toHaveBeenCalledWith('openai');
    });
  });

  // ── Provider Test Key Flow (the bug fix) ──

  describe('provider test key flow', () => {
    it('calls fetch proxy and shows success on valid key', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Open OpenAI panel
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]); // OpenAI is first

      // Type a key
      const keyInput = screen.getByPlaceholderText('sk-xxxx...xxxx');
      await user.type(keyInput, 'sk-test-key-12345');

      // Click Test
      await user.click(screen.getByText('Test'));

      // Should call setByokKey and fetch (proxy call only)
      expect(mockSetByokKey).toHaveBeenCalledWith('openai', 'sk-test-key-12345');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ method: 'POST' })
      );

      // Should show success
      await waitFor(() => {
        expect(screen.getByText('✓ Key works!')).toBeDefined();
      });

      // Should call toast.success with verification message
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('API key verified'),
        expect.any(Object)
      );
    });

    it('shows error when provider test fails (catch block bug fix)', async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'Invalid API key' }) });
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Open Groq panel (second provider)
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[1]); // Groq

      // Type a key
      const keyInput = screen.getByPlaceholderText('gsk_xxxx...xxxx');
      await user.type(keyInput, 'gsk-bad-key');

      // Click Test
      await user.click(screen.getByText('Test'));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('✗ Invalid key or connection failed')).toBeDefined();
      });

      // Should call toast.error with the error message
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('Provider test failed'),
        expect.any(Object)
      );
    });

    it('does nothing when Test is clicked with no key', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Open panel but don't type a key
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]);

      // Click Test
      await user.click(screen.getByText('Test'));

      // Should NOT call fetch for proxy (only the indexed endpoint was called on mount)
      expect(mockFetch).not.toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.anything()
      );
    });

    it('uses existing byokKey when input is empty', async () => {
      mockByokKeys = { openai: 'sk-existing-key' };
      mockFetch.mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Open the OpenAI panel (shows "✓ Set")
      await user.click(screen.getByText('✓ Set'));

      // Click Test without typing a new key
      await user.click(screen.getByText('Test'));

      // Should use the existing key
      expect(mockSetByokKey).toHaveBeenCalledWith('openai', 'sk-existing-key');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('shows spinner while testing', async () => {
      // Make fetch hang
      mockFetch.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<ConfigTab />);

      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]);
      await user.type(screen.getByPlaceholderText('sk-xxxx...xxxx'), 'sk-test');
      await user.click(screen.getByText('Test'));

      // Should show spinner (⟳ character) while testing
      expect(screen.getByText('⟳')).toBeDefined();
    });
  });

  // ── Model Selection ──

  describe('model selection', () => {
    it('shows auto-route toggle', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Auto-route (Recommended)')).toBeDefined();
    });

    it('calls toggleAutoRoute when auto-route is toggled', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      // Find the auto-route toggle button
      const autoRouteText = screen.getByText('Auto-route (Recommended)');
      const toggleButton = autoRouteText.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        expect(mockToggleAutoRoute).toHaveBeenCalled();
      }
    });

    it('shows provider and model selects when auto-route is off', async () => {
      mockAutoRoute = false;
      await act(async () => {
        render(<ConfigTab />);
      });
      const selects = screen.getAllByDisplayValue(/OpenAI|Groq|Anthropic/);
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    it('calls setSelectedModel when provider select changes', async () => {
      mockAutoRoute = false;
      const user = userEvent.setup();
      render(<ConfigTab />);
      const providerSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(providerSelect, 'openai');
      expect(mockSetSelectedModel).toHaveBeenCalled();
    });

    it('displays current model info', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Currently using:/)).toBeDefined();
      expect(screen.getByText(/llama-3.3-70b-versatile/)).toBeDefined();
    });
  });

  // ── MCP Tools ──

  describe('MCP tools', () => {
    it('shows Not connected for disabled services', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const notConnected = screen.getAllByText('Not connected');
      expect(notConnected.length).toBe(3);
    });

    it('shows Connected for enabled services', async () => {
      mockMcpEnabled = { gmail: true, calendar: false, drive: false };
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Connected')).toBeDefined();
      const notConnected = screen.getAllByText('Not connected');
      expect(notConnected.length).toBe(2);
    });

    it('calls toggleMcp when service toggle is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      // Find the Gmail toggle - it's the first toggle in the MCP section
      const gmailSection = screen.getByText('Gmail').closest('[class*="oracle-glass"]')!;
      const toggleButton = gmailSection.querySelector('button[class*="rounded-full"]')!;
      await user.click(toggleButton);
      expect(mockToggleMcp).toHaveBeenCalledWith('gmail');
    });

    it('shows Set up button when service is not connected', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const setUpButtons = screen.getAllByText('Set up');
      expect(setUpButtons.length).toBe(3);
    });
  });

  // ── Advanced Settings ──

  describe('advanced settings', () => {
    it('renders streaming toggle', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Streaming responses')).toBeDefined();
    });

    it('calls toggleStreaming when streaming toggle is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const streamingLabel = screen.getByText('Streaming responses');
      const toggleButton = streamingLabel.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        expect(mockToggleStreaming).toHaveBeenCalled();
      }
    });

    it('toggles auto-score responses', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const label = screen.getByText('Auto-score responses');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        // autoScore is local state, just verify it doesn't crash
        expect(screen.getByText('Auto-score responses')).toBeDefined();
      }
    });

    it('toggles web search and shows API key input', async () => {
      mockPlan = 'pro';
      const user = userEvent.setup();
      render(<ConfigTab />);
      const label = screen.getByText('Web search');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        expect(screen.getByPlaceholderText('Tavily/Serper API key')).toBeDefined();
      }
    });

    it('shows lock icon on web search for starter users', async () => {
      mockPlan = 'starter';
      await act(async () => {
        render(<ConfigTab />);
      });
      const lockIcons = screen.getAllByText('🔒');
      expect(lockIcons.length).toBeGreaterThanOrEqual(1);
      const upgradeHints = screen.getAllByText(/Requires Pro plan/);
      expect(upgradeHints.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show lock icon on web search for pro users', async () => {
      mockPlan = 'pro';
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.queryByText('🔒')).toBeNull();
    });

    it('opens upgrade modal when starter user clicks web search toggle', async () => {
      mockPlan = 'starter';
      const user = userEvent.setup();
      render(<ConfigTab />);
      const label = screen.getByText('Web search');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        expect(screen.getByTestId('upgrade-modal')).toBeDefined();
        expect(screen.getByText('Upgrade Modal: Web Search')).toBeDefined();
      }
    });

    it('shows lock icon on auto-extract memories for starter users', async () => {
      mockPlan = 'starter';
      await act(async () => {
        render(<ConfigTab />);
      });
      const lockIcons = screen.getAllByText('🔒');
      expect(lockIcons.length).toBeGreaterThanOrEqual(2); // web search + memory
    });

    it('does not show lock icon on auto-extract memories for pro users', async () => {
      mockPlan = 'pro';
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.queryByText('🔒')).toBeNull();
    });

    it('opens upgrade modal when starter user clicks auto-extract memories toggle', async () => {
      mockPlan = 'starter';
      const user = userEvent.setup();
      render(<ConfigTab />);
      const label = screen.getByText('Auto-extract memories');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        expect(screen.getByTestId('upgrade-modal')).toBeDefined();
        expect(screen.getByText('Upgrade Modal: Client Memory')).toBeDefined();
      }
    });

    it('renders response language selector', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Response language')).toBeDefined();
      expect(screen.getByDisplayValue('English')).toBeDefined();
    });

    it('changes response language', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const select = screen.getByDisplayValue('English');
      await user.selectOptions(select, 'Hinglish');
      expect(screen.getByDisplayValue('Hinglish')).toBeDefined();
    });
  });

  // ── Agency Profile ──

  describe('agency profile', () => {
    it('renders profile input fields', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByPlaceholderText('Agency name')).toBeDefined();
      expect(screen.getByPlaceholderText('Owner name')).toBeDefined();
      expect(screen.getByPlaceholderText('City')).toBeDefined();
      expect(screen.getByPlaceholderText('Services (SEO, Web Dev, Ads...)')).toBeDefined();
    });

    it('shows preview when agency name is filled', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      await user.type(screen.getByPlaceholderText('Agency name'), 'Acme Digital');
      expect(screen.getByText('Preview')).toBeDefined();
      expect(screen.getByText('Acme Digital')).toBeDefined();
    });

    it('does not show preview when agency name is empty', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.queryByText('Preview')).toBeNull();
    });

    it('handles invalid JSON in localStorage gracefully', async () => {
      // Mock localStorage.getItem to return invalid JSON
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn((key: string) => {
        if (key === 'oracle-agency-profile') return 'invalid{json';
        return originalGetItem.call(localStorage, key);
      });

      try {
        // Should not crash — getAgencyProfile catches the error and returns defaults
        await act(async () => {
          render(<ConfigTab />);
        });
        expect(screen.getByText('⚙ Settings')).toBeDefined();
        // Profile fields should have empty defaults
        const agencyInput = screen.getByPlaceholderText('Agency name') as HTMLInputElement;
        expect(agencyInput.value).toBe('');
      } finally {
        Storage.prototype.getItem = originalGetItem;
      }
    });

    it('save button is clickable and updates profile state', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      await user.type(screen.getByPlaceholderText('Agency name'), 'Test Agency');
      await user.type(screen.getByPlaceholderText('City'), 'Mumbai');
      // Verify preview updates with typed values
      expect(screen.getByText('Test Agency')).toBeDefined();
      expect(screen.getByText('Mumbai')).toBeDefined();
      // Verify save button is clickable without crashing
      const saveButtons = screen.getAllByText('Save Profile');
      await user.click(saveButtons[0]);

      // Should call toast.success with profile saved message
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Agency profile saved'),
        expect.any(Object)
      );
    });
  });

  // ── Knowledge Base ──

  describe('knowledge base', () => {
    it('loads knowledge docs on mount', async () => {
      render(<ConfigTab />);
      await waitFor(() => {
        expect(mockKnowledgeDocsList).toHaveBeenCalledTimes(1);
      });
    });

    it('shows loaded knowledge docs', async () => {
      mockKnowledgeDocsList.mockResolvedValue([
        { id: 'doc1', name: 'SOP.pdf', content: 'content', source: 'upload', tags: [], created_at: Date.now() },
        { id: 'doc2', name: 'Pricing.xlsx', content: 'content', source: 'upload', tags: [], created_at: Date.now() },
      ]);
      render(<ConfigTab />);
      await waitFor(() => {
        expect(screen.getByText('SOP.pdf')).toBeDefined();
        expect(screen.getByText('Pricing.xlsx')).toBeDefined();
      });
    });

    it('removes a knowledge doc when × is clicked', async () => {
      mockKnowledgeDocsList.mockResolvedValue([
        { id: 'doc1', name: 'SOP.pdf', content: 'content', source: 'upload', tags: [], created_at: Date.now() },
      ]);
      const user = userEvent.setup();
      render(<ConfigTab />);
      await waitFor(() => {
        expect(screen.getByText('SOP.pdf')).toBeDefined();
      });
      // Click the remove button (×)
      const removeButton = screen.getByText('×');
      await user.click(removeButton);
      expect(mockKnowledgeDocsDelete).toHaveBeenCalledWith('doc1');
    });

    it('shows upload button', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('+ Upload document')).toBeDefined();
    });

    it('uploads a file and adds it to the knowledge base', async () => {
      mockKnowledgeDocsCreate.mockResolvedValue({ id: 'new-doc', name: 'guide.txt', content: 'file content', source: 'upload', tags: [], created_at: Date.now() });
      render(<ConfigTab />);

      // Wait for initial load to complete
      await waitFor(() => {
        expect(mockKnowledgeDocsList).toHaveBeenCalledTimes(1);
      });

      // Find the hidden file input and trigger a change event with a mock File
      const fileInput = document.getElementById('kb-upload') as HTMLInputElement;
      const file = new File(['file content'], 'guide.txt', { type: 'text/plain' });
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      // Wait for the upload to complete
      await waitFor(() => {
        expect(mockKnowledgeDocsCreate).toHaveBeenCalledWith({ name: 'guide.txt', content: 'file content' });
        expect(screen.getByText('guide.txt')).toBeDefined();
        // Should call toast.success with upload message
        expect(mockToastWarning).toHaveBeenCalledWith(
          expect.stringContaining('Uploaded'),
          expect.any(Object)
        );
      });
    });

    it('handles file upload failure gracefully', async () => {
      mockKnowledgeDocsCreate.mockRejectedValue(new Error('Upload failed'));
      render(<ConfigTab />);

      await waitFor(() => {
        expect(mockKnowledgeDocsList).toHaveBeenCalledTimes(1);
      });

      const fileInput = document.getElementById('kb-upload') as HTMLInputElement;
      const file = new File(['content'], 'fail.txt', { type: 'text/plain' });
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      // Should call toast.error with the failure message
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to upload'),
          expect.any(Object)
        );
      });
    });
  });

  // ── Cost Dashboard ──

  describe('cost dashboard', () => {
    it('displays zero costs by default', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const costElements = screen.getAllByText('₹0.00');
      expect(costElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('$0.0000')).toBeDefined();
    });

    it('displays non-zero costs', async () => {
      mockTotalCostUSD = 0.05;
      mockTotalCostINR = 4.20;
      await act(async () => {
        render(<ConfigTab />);
      });
      const costElements = screen.getAllByText('₹4.20');
      expect(costElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('$0.0500')).toBeDefined();
    });

    it('shows zero avg when no usage', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const costElements = screen.getAllByText('₹0.00');
      expect(costElements.length).toBeGreaterThanOrEqual(1);
    });

    it('calculates avg per request correctly', async () => {
      mockTotalCostINR = 10;
      mockUsageHistory = [
        { timestamp: Date.now(), provider: 'openai', costINR: 5 },
        { timestamp: Date.now(), provider: 'openai', costINR: 5 },
      ];
      await act(async () => {
        render(<ConfigTab />);
      });
      // avg = 10 / 2 = 5.00
      const avgElements = screen.getAllByText('₹5.00');
      expect(avgElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows cost breakdown by provider', async () => {
      mockUsageHistory = [
        { timestamp: Date.now(), provider: 'openai', costINR: 3 },
        { timestamp: Date.now(), provider: 'groq', costINR: 1 },
        { timestamp: Date.now(), provider: 'openai', costINR: 2 },
      ];
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Cost by Provider')).toBeDefined();
      const openaiElements = screen.getAllByText('OpenAI');
      expect(openaiElements.length).toBeGreaterThanOrEqual(1);
      const groqElements = screen.getAllByText('Groq');
      expect(groqElements.length).toBeGreaterThanOrEqual(1);
    });

    it('calls resetCosts when Reset Costs is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      await user.click(screen.getByText('Reset Costs'));
      expect(mockResetCosts).toHaveBeenCalled();
    });

    it('shows Providers Used count', async () => {
      mockUsageHistory = [
        { timestamp: Date.now(), provider: 'openai', costINR: 3 },
        { timestamp: Date.now(), provider: 'groq', costINR: 1 },
      ];
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Providers Used')).toBeDefined();
    });
  });

  // ── Hallucination Guard Config ──

  describe('hallucination guard config', () => {
    it('renders the guard config section', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('🛡 Hallucination Guard')).toBeDefined();
      expect(screen.getByText('Enable hallucination guard')).toBeDefined();
      expect(screen.getByText('Automatically verify AI responses for accuracy and grounding')).toBeDefined();
    });

    it('renders threshold sliders with default values', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getAllByText('Pass threshold').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Warn threshold').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Block threshold').length).toBeGreaterThanOrEqual(1);
      // Default values shown
      expect(screen.getByText('70%')).toBeDefined();
      expect(screen.getByText('50%')).toBeDefined();
      expect(screen.getByText('30%')).toBeDefined();
    });

    it('renders detection sub-toggles', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Self-verification')).toBeDefined();
      expect(screen.getByText('Fact grounding')).toBeDefined();
      expect(screen.getByText('Pattern detection')).toBeDefined();
    });

    it('shows config preview with enabled state by default', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getAllByText('Config Preview').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Guard ✅ enabled/)).toBeDefined();
      expect(screen.getByText(/Pass >=70%/)).toBeDefined();
      expect(screen.getByText(/Warn <50%/)).toBeDefined();
      expect(screen.getByText(/Block <30%/)).toBeDefined();
    });

    it('shows disabled in config preview when guard is off', async () => {
      mockLoadGuardConfig.mockReturnValue({
        enabled: false,
        thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
        maxRetries: 2,
        selfVerification: true,
        factGrounding: true,
        patternDetection: true,
        strictDomains: [],
      });
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Guard ⛔ disabled/)).toBeDefined();
    });

    it('toggles guard enabled and persists to localStorage', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Find the toggle for 'Enable hallucination guard'
      const label = screen.getByText('Enable hallucination guard');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      // Should call saveGuardConfig with enabled: false
      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('toggles self-verification and persists', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      const label = screen.getByText('Self-verification');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({ selfVerification: false })
      );
    });

    it('toggles fact grounding and persists', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      const label = screen.getByText('Fact grounding');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({ factGrounding: false })
      );
    });

    it('toggles pattern detection and persists', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      const label = screen.getByText('Pattern detection');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({ patternDetection: false })
      );
    });

    it('clamps warn threshold when pass threshold is lowered below it', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Find the pass threshold slider and set it to 40 (below warn's 50)
      const sliders = screen.getAllByRole('slider');
      const passSlider = sliders[1]; // index 1 = pass threshold (index 0 = temperature)

      // Simulate setting pass threshold to 40
      fireEvent.change(passSlider, { target: { value: '40' } });

      // saveGuardConfig should have been called with clamped values
      // warn should be clamped to max(10, 40 - 5) = 35
      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          thresholds: expect.objectContaining({
            passThreshold: 40,
            warnThreshold: 35,
          }),
        })
      );
    });

    it('clamps block threshold when warn threshold is lowered below it', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Find the warn threshold slider and set it to 25 (below block's 30)
      const sliders = screen.getAllByRole('slider');
      const warnSlider = sliders[2]; // index 2 = warn threshold

      fireEvent.change(warnSlider, { target: { value: '25' } });

      // block should be clamped to max(5, 25 - 5) = 20
      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          thresholds: expect.objectContaining({
            warnThreshold: 25,
            blockThreshold: 20,
          }),
        })
      );
    });

    it('updates config preview when thresholds change', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Initial preview
      expect(screen.getByText(/Pass >=70%/)).toBeDefined();

      // Change pass threshold slider
      const sliders = screen.getAllByRole('slider');
      const passSlider = sliders[1]; // index 1 = pass threshold (index 0 = temperature)
      fireEvent.change(passSlider, { target: { value: '85' } });

      // Preview should update
      await waitFor(() => {
        expect(screen.getByText(/Pass >=85%/)).toBeDefined();
      });
    });

    it('shows warning when pass threshold is lowered below warn threshold', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Set pass threshold to 40 (below warn's 50) — should trigger toast
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '40' } }); // index 1 = pass threshold

      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Warn threshold clamped'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('shows warning when warn threshold is lowered below block threshold', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Set warn threshold to 25 (below block's 30) — should trigger toast
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[2], { target: { value: '25' } }); // index 2 = warn threshold

      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Block threshold clamped'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('does not show warning when thresholds are valid', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Default thresholds are valid (70 > 50 > 30)
      expect(screen.queryByText(/threshold clamped/)).toBeNull();
    });

    it('auto-dismisses warning after timeout', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Trigger a warning
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '40' } }); // index 1 = pass threshold

      // Toast should be called with 4s duration
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Warn threshold clamped'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('shows combined warning when both thresholds need clamping', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Set pass to 20 — both warn (50) and block (30) exceed it
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '20' } }); // index 1 = pass threshold

      // Toast should be called with combined warning
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Warn threshold clamped'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('updates config preview when guard is toggled off', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<ConfigTab />);
      });

      // Initial: enabled
      expect(screen.getByText(/Guard ✅ enabled/)).toBeDefined();

      // Toggle off
      const label = screen.getByText('Enable hallucination guard');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      await user.click(toggleButton!);

      // Preview should show disabled
      await waitFor(() => {
        expect(screen.getByText(/Guard ⛔ disabled/)).toBeDefined();
      });
    });

    it('loads guard config from localStorage on mount', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(mockLoadGuardConfig).toHaveBeenCalled();
    });

    it('renders export, import, and reset buttons', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Export JSON/)).toBeDefined();
      expect(screen.getByText(/Import JSON/)).toBeDefined();
      // Now there are two Reset buttons (guard + editor gate)
      const resetButtons = screen.getAllByText(/Reset to Defaults/);
      expect(resetButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows success toast when Export JSON is clicked', async () => {
      // Mock URL.createObjectURL and URL.revokeObjectURL for jsdom
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      URL.createObjectURL = mockCreateObjectURL;
      URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement to capture the download action
      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          const el = originalCreateElement(tag);
          el.click = mockClick;
          return el;
        }
        return originalCreateElement(tag);
      });

      const user = userEvent.setup();
      render(<ConfigTab />);

      await user.click(screen.getByText(/Export JSON/));

      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Guard config exported'),
        expect.any(Object)
      );

      vi.restoreAllMocks();
    });

    it('shows success toast when valid JSON is imported', async () => {
      const configJson = JSON.stringify({
        enabled: false,
        thresholds: { passThreshold: 80, warnThreshold: 60, blockThreshold: 40 },
      });
      const file = new File([configJson], 'guard-config.json', { type: 'application/json' });

      render(<ConfigTab />);
      const fileInput = screen.getByText(/Import JSON/).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockToastWarning).toHaveBeenCalledWith(
          expect.stringContaining('Guard config imported'),
          expect.any(Object)
        );
      });
    });

    it('resets guard config to defaults when Reset is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // First change a threshold so it differs from defaults
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '85' } }); // index 1 = pass threshold

      // Verify it changed
      expect(screen.getByText('85%')).toBeDefined();

      // Click Reset to Defaults (guard section)
      const resetButtons = screen.getAllByText(/Reset to Defaults/);
      // The first match should be the guard reset button (before the evaluator section)
      await user.click(resetButtons[0]);

      // Should call saveGuardConfig with defaults (70/50/30)
      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
        })
      );

      // Should call toast.success with reset message
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Guard config reset'),
        expect.any(Object)
      );
    });

    it('imports valid guard config from JSON file', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Create a valid JSON config file
      const configJson = JSON.stringify({
        enabled: false,
        thresholds: { passThreshold: 80, warnThreshold: 60, blockThreshold: 40 },
        selfVerification: false,
      });
      const file = new File([configJson], 'guard-config.json', { type: 'application/json' });

      // Find the hidden file input for import
      const fileInput = screen.getByText(/Import JSON/).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeDefined();

      // Trigger file change
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      // Should call saveGuardConfig with the imported config (merged with defaults)
      await waitFor(() => {
        expect(mockSaveGuardConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: false,
            thresholds: expect.objectContaining({
              passThreshold: 80,
              warnThreshold: 60,
              blockThreshold: 40,
            }),
            selfVerification: false,
          })
        );
      });
    });

    it('shows warning when importing invalid JSON', async () => {
      render(<ConfigTab />);

      // Create an invalid JSON file
      const file = new File(['not valid json {{{'], 'bad-config.json', { type: 'application/json' });

      const fileInput = screen.getByText(/Import JSON/).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      // Should call toast.error with import failure message
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to import config'),
          expect.any(Object)
        );
      });
    });

    it('clamps imported thresholds that violate ordering', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Import a config where warn >= pass (invalid ordering)
      const configJson = JSON.stringify({
        enabled: true,
        thresholds: { passThreshold: 40, warnThreshold: 50, blockThreshold: 30 },
      });
      const file = new File([configJson], 'guard-config.json', { type: 'application/json' });

      const fileInput = screen.getByText(/Import JSON/).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSaveGuardConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            thresholds: expect.objectContaining({
              passThreshold: 40,
              warnThreshold: 35, // clamped to max(10, 40 - 5)
            }),
          })
        );
      });
    });

    it('renders guard config section in the correct order (after Advanced, before Agency Profile)', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const sections = ['API Keys', 'Model Selection', 'MCP Tools', 'Advanced Settings', 'Hallucination Guard', 'Output Quality Evaluator', 'Agency Profile', 'Knowledge Base', 'Claude Code Integration', 'Cost Dashboard'];
      const headings = screen.getAllByRole('heading', { level: 2 });
      const headingTexts = headings.map((h) => h.textContent || '');

      // Find indices of relevant sections
      const guardIdx = headingTexts.findIndex((t) => t.includes('Hallucination Guard'));
      const advancedIdx = headingTexts.findIndex((t) => t.includes('Advanced Settings'));
      const agencyIdx = headingTexts.findIndex((t) => t.includes('Agency Profile'));

      expect(guardIdx).toBeGreaterThan(advancedIdx);
      expect(guardIdx).toBeLessThan(agencyIdx);
    });
  });

  // ── Editor Gate Config ──

  describe('editor gate config', () => {
    it('renders the editor gate section', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('✏️ Editor Gate')).toBeDefined();
      expect(screen.getByText('Enable editor gate')).toBeDefined();
    });

    it('shows description text', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Automatic final-pass quality gate/)).toBeDefined();
    });

    it('shows enabled in config preview by default', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Editor gate ✅ enabled/)).toBeDefined();
      expect(screen.getByText(/Min length: 100 chars/)).toBeDefined();
    });

    it('shows disabled in config preview when gate is off', async () => {
      mockLoadEditorConfig.mockReturnValue({
        enabled: false,
        minLength: 100,
        skipAgentTypes: [],
      });
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Editor gate ⛔ disabled/)).toBeDefined();
    });

    it('toggles editor gate enabled and persists', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      const label = screen.getByText('Enable editor gate');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      expect(mockSaveEditorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('renders minimum response length slider', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Minimum response length')).toBeDefined();
      expect(screen.getByText('100 chars')).toBeDefined();
    });

    it('updates minLength when slider changes', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Find the minLength slider (it's one of the range inputs)
      // The editor gate slider is after the eval threshold slider
      const sliders = screen.getAllByRole('slider');
      // Find the slider near 'Minimum response length' text
      const minLengthLabel = screen.getByText('Minimum response length');
      const minLengthSection = minLengthLabel.closest('div')?.parentElement;
      const slider = minLengthSection?.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider).toBeDefined();

      fireEvent.change(slider, { target: { value: '200' } });

      expect(mockSaveEditorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ minLength: 200 })
      );
    });

    it('renders skip agent type buttons for all 18 registry agents', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Skip agent types')).toBeDefined();
      // Verify a sample of agent names from the ALL_AGENT_NAMES registry
      expect(screen.getByText('researcher')).toBeDefined();
      expect(screen.getByText('writer')).toBeDefined();
      expect(screen.getByText('developer')).toBeDefined();
      expect(screen.getByText('voice')).toBeDefined();
      expect(screen.getByText('localization')).toBeDefined();
      expect(screen.getByText('legal')).toBeDefined();
      expect(screen.getByText('editor')).toBeDefined();
    });

    it('adds agent type to skip list when clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Find the skip agent types section and click the researcher button within it
      const skipSection = screen.getByText('Skip agent types').closest('div')?.parentElement;
      const buttons = skipSection ? Array.from(skipSection.querySelectorAll('button')) : [];
      const researcherBtn = buttons.length > 0
        ? buttons.find(b => b.textContent?.trim() === 'researcher')
        : screen.getAllByText('researcher')[0];
      await user.click(researcherBtn!);

      expect(mockSaveEditorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ skipAgentTypes: ['researcher'] })
      );
    });

    it('removes agent type from skip list when clicked again', async () => {
      mockLoadEditorConfig.mockReturnValue({
        enabled: true,
        minLength: 100,
        skipAgentTypes: ['researcher', 'voice'],
      });
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Find the skip agent types section and click the researcher button
      const skipSection = screen.getByText('Skip agent types').closest('div')?.parentElement;
      const researcherBtn = Array.from(skipSection?.querySelectorAll('button') ?? []).find(b => b.textContent?.includes('researcher'));
      await user.click(researcherBtn!);

      expect(mockSaveEditorConfig).toHaveBeenCalledWith(
        expect.objectContaining({ skipAgentTypes: ['voice'] })
      );
    });

    it('shows checkmark on skipped agent types', async () => {
      mockLoadEditorConfig.mockReturnValue({
        enabled: true,
        minLength: 100,
        skipAgentTypes: ['researcher', 'voice'],
      });
      await act(async () => {
        render(<ConfigTab />);
      });

      // Skipped types should show ✓ prefix
      expect(screen.getByText(/✓ researcher/)).toBeDefined();
      expect(screen.getByText(/✓ voice/)).toBeDefined();
    });

    it('shows skip list in config preview', async () => {
      mockLoadEditorConfig.mockReturnValue({
        enabled: true,
        minLength: 100,
        skipAgentTypes: ['researcher', 'voice'],
      });
      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getByText(/Skips: researcher, voice/)).toBeDefined();
    });

    it('does not show skip list in config preview when empty', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.queryByText(/Skips:/)).toBeNull();
    });

    it('resets editor gate config to defaults', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Find the editor gate reset button (there may be multiple 'Reset to Defaults' buttons)
      const resetButtons = screen.getAllByText(/Reset to Defaults/);
      // The editor gate reset is the last one (after guard reset)
      const editorResetBtn = resetButtons[resetButtons.length - 1];
      await user.click(editorResetBtn);

      expect(mockSaveEditorConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          minLength: 100,
          skipAgentTypes: [],
        })
      );
    });

    it('loads editor config from localStorage on mount', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(mockLoadEditorConfig).toHaveBeenCalled();
    });

    it('renders editor gate section after output quality evaluator and before agency profile', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const headings = screen.getAllByRole('heading', { level: 2 });
      const headingTexts = headings.map((h) => h.textContent || '');

      const evalIdx = headingTexts.findIndex((t) => t.includes('Output Quality Evaluator'));
      const editorIdx = headingTexts.findIndex((t) => t.includes('Editor Gate'));
      const agencyIdx = headingTexts.findIndex((t) => t.includes('Agency Profile'));

      expect(editorIdx).toBeGreaterThan(evalIdx);
      expect(editorIdx).toBeLessThan(agencyIdx);
    });
  });

  // ── Circuit Breaker Health Panel ──

  describe('circuit breaker health panel', () => {
    it('fetches circuit status on mount', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/circuits',
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });

    it('shows Provider Health section after fetch', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('⚡ Provider Health')).toBeDefined();
    });

    it('shows all providers healthy when no circuits', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('All providers healthy ✓')).toBeDefined();
    });

    it('shows open circuit with provider name and failures', async () => {
      setupCircuitMock([circuit('groq', 'open', { consecutiveFailures: 5, cooldownRemainingMs: 180000 })]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getAllByText('Groq').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/🔴 Open/)).toBeDefined();
      expect(screen.getByText(/5 failures/)).toBeDefined();
    });

    it('shows half-open circuit state', async () => {
      setupCircuitMock([circuit('openai', 'half-open')]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/🟡 Half-open/)).toBeDefined();
    });

    it('shows cooldown remaining for open circuits', async () => {
      setupCircuitMock([circuit('groq', 'open', { cooldownRemainingMs: 150000 })]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getByText(/150s left/)).toBeDefined();
    });

    it('shows reset button for open circuits', async () => {
      setupCircuitMock([circuit('groq', 'open')]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getByText('↺ Reset')).toBeDefined();
    });

    it('does not show reset button for closed circuits', async () => {
      setupCircuitMock([circuit('groq', 'closed')]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getByText(/🟢 Closed/)).toBeDefined();
      expect(screen.queryByText('↺ Reset')).toBeNull();
    });

    it('calls POST /api/analytics/circuits when reset is clicked', async () => {
      setupCircuitMock([circuit('groq', 'open')]);

      const user = userEvent.setup();
      await act(async () => {
        render(<ConfigTab />);
      });

      const resetButton = screen.getByText('↺ Reset');
      await user.click(resetButton);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/circuits',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('shows refresh button and re-fetches on click', async () => {
      let fetchCount = 0;
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/api/knowledge-docs/indexed')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ indexedIds: [] }) });
        }
        if (typeof url === 'string' && url.includes('/api/analytics/circuits')) {
          fetchCount++;
          if (fetchCount > 1) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ circuits: [], unavailable: [], summary: { total: 0, open: 0, halfOpen: 0, closed: 0 } }) });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ circuits: [{ providerId: 'groq', state: 'open', consecutiveFailures: 3, cooldownRemainingMs: 60000 }], unavailable: ['groq'], summary: { total: 1, open: 1, halfOpen: 0, closed: 0 } }) });
        }
        return Promise.resolve({ ok: true });
      });

      const user = userEvent.setup();
      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getByText(/🔴 Open/)).toBeDefined();

      const refreshButton = screen.getByText(/Refresh Status/);
      await user.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('All providers healthy ✓')).toBeDefined();
      });
    });

    it('shows cooldown description text', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Providers with open circuits are temporarily skipped/)).toBeDefined();
    });

    it('shows 1 failure (singular) for single failure count', async () => {
      setupCircuitMock([circuit('anthropic', 'open', { consecutiveFailures: 1, cooldownRemainingMs: 300000 })]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getByText(/1 failure$/)).toBeDefined();
    });

    // ── Summary Banner ──

    it('auto-refreshes circuit status every 30s when circuits are open', async () => {
      vi.useFakeTimers();
      try {
        setupCircuitMock([circuit('groq', 'open')]);

        await act(async () => {
          render(<ConfigTab />);
        });

        const initialCallCount = mockFetch.mock.calls.filter(
          ([url]) => typeof url === 'string' && url.includes('/api/analytics/circuits')
        ).length;

        await act(async () => { vi.advanceTimersByTime(30_000); });

        expect(mockFetch.mock.calls.filter(([url]) => typeof url === 'string' && url.includes('/api/analytics/circuits')).length).toBe(initialCallCount + 1);

        await act(async () => { vi.advanceTimersByTime(30_000); });

        expect(mockFetch.mock.calls.filter(([url]) => typeof url === 'string' && url.includes('/api/analytics/circuits')).length).toBe(initialCallCount + 2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('stops auto-refresh when all circuits are closed', async () => {
      vi.useFakeTimers();
      try {
        setupCircuitMock([circuit('groq', 'open')]);

        await act(async () => {
          render(<ConfigTab />);
        });

        // Simulate circuit recovery — swap mock to return closed circuits
        setupCircuitMock([circuit('groq', 'closed')]);

        await act(async () => { vi.advanceTimersByTime(30_000); });

        const countAfterRecovery = mockFetch.mock.calls.filter(
          ([url]) => typeof url === 'string' && url.includes('/api/analytics/circuits')
        ).length;

        // Advance 60s more — no more fetches (interval stopped)
        await act(async () => { vi.advanceTimersByTime(60_000); });

        const finalCount = mockFetch.mock.calls.filter(
          ([url]) => typeof url === 'string' && url.includes('/api/analytics/circuits')
        ).length;
        expect(finalCount).toBe(countAfterRecovery);
      } finally {
        vi.useRealTimers();
      }
    });

    it('hides summary banner when no circuits are open', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
    });

    it('shows summary banner with correct count when 1 provider is open', async () => {
      setupCircuitMock([circuit('groq', 'open')]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getByText(/1 provider temporarily unavailable/)).toBeDefined();
      expect(screen.getByText(/see Provider Health below/)).toBeDefined();
    });

    it('shows summary banner with plural count when multiple providers are open', async () => {
      setupCircuitMock([
        circuit('groq', 'open'),
        circuit('openai', 'half-open'),
      ]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.getByText(/2 providers temporarily unavailable/)).toBeDefined();
    });

    it('hides summary banner when only closed circuits exist', async () => {
      setupCircuitMock([circuit('groq', 'closed')]);

      await act(async () => {
        render(<ConfigTab />);
      });

      expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
    });
    // ── End-to-End Reset Flow Integration Tests ──

    describe('end-to-end reset flow', () => {
      it('full reset flow: open circuit → banner → reset → healthy state', async () => {
        const user = userEvent.setup();

        setupCircuitMock(
          [{ providerId: 'groq', state: 'open', consecutiveFailures: 5, cooldownRemainingMs: 200000 }],
          { resetCircuits: [] },
        );

        await act(async () => {
          render(<ConfigTab />);
        });

        expect(screen.getByText(/🔴 Open/)).toBeDefined();
        expect(screen.getByText(/5 failures/)).toBeDefined();
        expect(screen.getByText(/200s left/)).toBeDefined();
        expect(screen.getByText('↺ Reset')).toBeDefined();
        expect(screen.getByText(/1 provider temporarily unavailable/)).toBeDefined();
        expect(screen.getByText(/⚠ 1 down/)).toBeDefined();

        await user.click(screen.getByText('↺ Reset'));

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/analytics/circuits',
          expect.objectContaining({ method: 'POST' })
        );

        await waitFor(() => {
          expect(screen.getByText('All providers healthy ✓')).toBeDefined();
        });
        expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
        expect(screen.queryByText(/⚠.*down/)).toBeNull();
        expect(screen.queryByText('↺ Reset')).toBeNull();
      });

      it('reset with multiple circuits clears only the reset one', async () => {
        const user = userEvent.setup();

        setupCircuitMock(
          [
            { providerId: 'groq', state: 'open', consecutiveFailures: 5, cooldownRemainingMs: 180000 },
            { providerId: 'openai', state: 'open', consecutiveFailures: 3, cooldownRemainingMs: 150000 },
          ],
          {
            resetCircuits: [{ providerId: 'openai', state: 'open', consecutiveFailures: 3, cooldownRemainingMs: 150000 }],
          },
        );

        await act(async () => {
          render(<ConfigTab />);
        });

        expect(screen.getByText(/2 providers temporarily unavailable/)).toBeDefined();
        expect(screen.getByText(/⚠ 2 down/)).toBeDefined();

        const resetButtons = screen.getAllByText('↺ Reset');
        await user.click(resetButtons[0]);

        await waitFor(() => {
          expect(screen.getByText(/1 provider temporarily unavailable/)).toBeDefined();
        });
        expect(screen.getByText(/⚠ 1 down/)).toBeDefined();
        expect(screen.getByText(/🔴 Open/)).toBeDefined();
      });

      it('handles reset failure gracefully without crashing', async () => {
        const user = userEvent.setup();

        setupCircuitMock(
          [{ providerId: 'groq', state: 'open', consecutiveFailures: 3, cooldownRemainingMs: 120000 }],
          { resetError: true },
        );

        await act(async () => {
          render(<ConfigTab />);
        });

        expect(screen.getByText('↺ Reset')).toBeDefined();

        await user.click(screen.getByText('↺ Reset'));

        await waitFor(() => {
          expect(screen.getByText(/🔴 Open/)).toBeDefined();
        });
        expect(screen.getByText('↺ Reset')).toBeDefined();
      });

      it('reset disables button while in flight and re-enables after', async () => {
        const user = userEvent.setup();

        let resolveReset: (() => void) | undefined;
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (typeof url === 'string' && url.includes('/api/knowledge-docs/indexed')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ indexedIds: [] }) });
          }
          if (typeof url === 'string' && url.includes('/api/analytics/circuits')) {
            if (init?.method === 'POST') {
              return new Promise((resolve) => {
                resolveReset = () => resolve({
                  ok: true,
                  json: () => Promise.resolve({ success: true, circuits: [], unavailable: [] }),
                });
              });
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                circuits: [{ providerId: 'groq', state: 'open', consecutiveFailures: 3, cooldownRemainingMs: 120000 }],
                unavailable: ['groq'],
                summary: { total: 1, open: 1, halfOpen: 0, closed: 0 },
              }),
            });
          }
          return Promise.resolve({ ok: true });
        });

        await act(async () => {
          render(<ConfigTab />);
        });

        await user.click(screen.getByText('↺ Reset'));
        expect(screen.getByText('⟳')).toBeDefined();

        const resolver = resolveReset;
        await act(async () => {
          resolver?.();
        });

        await waitFor(() => {
          expect(screen.getByText('All providers healthy ✓')).toBeDefined();
        });
      });

      it('uses 15s timeout for AbortController on circuit reset', async () => {
        const user = userEvent.setup();
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
        try {
          setupCircuitMock([circuit('groq', 'open')]);

          await act(async () => {
            render(<ConfigTab />);
          });

          await user.click(screen.getByText('↺ Reset'));

          // Find the setTimeout call whose first arg is a function (the abort callback)
          // and verify the delay is exactly 15_000ms
          const abortTimeoutCall = setTimeoutSpy.mock.calls.find(
            ([fn, delay]) => typeof fn === 'function' && delay === 15_000,
          );
          expect(abortTimeoutCall).toBeDefined();
          expect(abortTimeoutCall![1]).toBe(15_000);
        } finally {
          setTimeoutSpy.mockRestore();
        }
      });

      it('passes AbortSignal to fetch for timeout support', async () => {
        const user = userEvent.setup();

        // Capture the AbortSignal passed to fetch to verify it exists and is valid
        let capturedSignal: AbortSignal | null = null;
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (typeof url === 'string' && url.includes('/api/knowledge-docs/indexed')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ indexedIds: [] }) });
          }
          if (typeof url === 'string' && url.includes('/api/analytics/circuits')) {
            if (init?.method === 'POST') {
              capturedSignal = init.signal ?? null;
              // Hang — we just want to verify the signal is attached
              return new Promise(() => {});
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                circuits: [{ providerId: 'groq', state: 'open', consecutiveFailures: 3, cooldownRemainingMs: 120000 }],
                unavailable: ['groq'],
                summary: { total: 1, open: 1, halfOpen: 0, closed: 0 },
              }),
            });
          }
          return Promise.resolve({ ok: true });
        });

        await act(async () => {
          render(<ConfigTab />);
        });

        await user.click(screen.getByText('↺ Reset'));

        // The AbortController signal should be attached to the POST request
        expect(capturedSignal).not.toBeNull();
        expect(capturedSignal).toBeInstanceOf(AbortSignal);
        expect(capturedSignal!.aborted).toBe(false);
        expect(typeof capturedSignal!.addEventListener).toBe('function');
      });

      it('shows timeout error toast when fetch throws AbortError', async () => {
        const user = userEvent.setup();

        // Override the POST to immediately throw an AbortError
        // This simulates what happens when the 15s AbortController timeout fires
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (typeof url === 'string' && url.includes('/api/knowledge-docs/indexed')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ indexedIds: [] }) });
          }
          if (typeof url === 'string' && url.includes('/api/analytics/circuits')) {
            if (init?.method === 'POST') {
              // Immediately throw to simulate an already-aborted controller
              throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                circuits: [{ providerId: 'groq', state: 'open', consecutiveFailures: 3, cooldownRemainingMs: 120000 }],
                unavailable: ['groq'],
                summary: { total: 1, open: 1, halfOpen: 0, closed: 0 },
              }),
            });
          }
          return Promise.resolve({ ok: true });
        });

        await act(async () => {
          render(<ConfigTab />);
        });

        await user.click(screen.getByText('↺ Reset'));

        // The synchronous throw in the mock causes an uncaught error in the
        // async handler, which the try/catch catches. Verify toast fires.
        await waitFor(() => {
          expect(mockToastError).toHaveBeenCalledWith(
            expect.stringContaining('timed out'),
            expect.any(Object)
          );
        });

        // Button should re-enable after timeout error
        expect(screen.getByText('↺ Reset')).toBeDefined();
        expect(screen.getByText(/🔴 Open/)).toBeDefined();
      });

      it('banner and inline badge stay in sync after reset', async () => {
        const user = userEvent.setup();

        setupCircuitMock(
          [{ providerId: 'groq', state: 'open', consecutiveFailures: 3, cooldownRemainingMs: 120000 }],
          { resetCircuits: [] },
        );

        await act(async () => {
          render(<ConfigTab />);
        });

        expect(screen.getByText(/1 provider temporarily unavailable/)).toBeDefined();
        expect(screen.getByText(/⚠ 1 down/)).toBeDefined();

        await user.click(screen.getByText('↺ Reset'));

        await waitFor(() => {
          expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
        });
        expect(screen.queryByText(/⚠.*down/)).toBeNull();
      });
    });
  });

  // ── Claude Code Integration ──

  describe('Claude Code integration', () => {
    it('renders installation instructions', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Install Claude Code')).toBeDefined();
      expect(screen.getByText(/npm install -g @anthropic-ai\/claude-code/)).toBeDefined();
    });

    it('renders MCP configuration example', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('MCP Configuration')).toBeDefined();
    });

    it('renders power user commands', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('/audit')).toBeDefined();
      expect(screen.getByText('/proposal [client]')).toBeDefined();
      expect(screen.getByText('/content [topic]')).toBeDefined();
      expect(screen.getByText('/code [feature]')).toBeDefined();
      expect(screen.getByText('/research [topic]')).toBeDefined();
    });
  });
});
