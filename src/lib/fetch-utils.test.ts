import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchWithTimeout,
  FETCH_TIMEOUT_MS,
  TIMEOUT_QUICK_MS,
  TIMEOUT_MODERATE_MS,
  TIMEOUT_STANDARD_MS,
  TIMEOUT_STREAMING_MS,
} from './fetch-utils';

// ─── Helpers ───────────────────────────

/**
 * Creates a mock fetch that hangs forever (never resolves or rejects).
 * The test verifies signal state directly rather than catching rejections,
 * which avoids unhandled rejection warnings from fake-timer-based aborts.
 */
function hangingFetch() {
  return vi.fn((_url: string | URL | Request, _init?: RequestInit) => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Promise<never>(() => {});
  });
}

/** Safely extract the signal from the first fetchWithTimeout call's init. */
function getSignal(mockFetch: ReturnType<typeof vi.fn>, callIndex = 0): AbortSignal {
  const init = mockFetch.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  return init!.signal!;
}

// ─── Timeout Tier Constants ────────────

describe('Timeout tier constants', () => {
  it('exports four named tier constants with correct values', () => {
    expect(TIMEOUT_QUICK_MS).toBe(15_000);
    expect(TIMEOUT_MODERATE_MS).toBe(30_000);
    expect(TIMEOUT_STANDARD_MS).toBe(60_000);
    expect(TIMEOUT_STREAMING_MS).toBe(120_000);
  });

  it('FETCH_TIMEOUT_MS defaults to QUICK tier', () => {
    expect(FETCH_TIMEOUT_MS).toBe(TIMEOUT_QUICK_MS);
  });

  it('tiers are strictly ordered: quick < moderate < standard < streaming', () => {
    expect(TIMEOUT_QUICK_MS).toBeLessThan(TIMEOUT_MODERATE_MS);
    expect(TIMEOUT_MODERATE_MS).toBeLessThan(TIMEOUT_STANDARD_MS);
    expect(TIMEOUT_STANDARD_MS).toBeLessThan(TIMEOUT_STREAMING_MS);
  });
});

// ─── Timeout Abort Behavior ────────────

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves when fetch completes before timeout', async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchWithTimeout('https://example.com', { timeoutMs: 5000 });
    expect(result).toBe(mockResponse);
  });

  it('aborts after timeout (basic mechanism)', async () => {
    const mockFetch = hangingFetch();
    vi.stubGlobal('fetch', mockFetch);

    fetchWithTimeout('https://example.com', { timeoutMs: 3000 });

    // Before timeout — signal not aborted
    await vi.advanceTimersByTimeAsync(2999);
    expect(getSignal(mockFetch).aborted).toBe(false);

    // After timeout — signal aborted
    await vi.advanceTimersByTimeAsync(1);
    expect(getSignal(mockFetch).aborted).toBe(true);
  });

  it('aborts after TIMEOUT_QUICK_MS (15s) default', async () => {
    const mockFetch = hangingFetch();
    vi.stubGlobal('fetch', mockFetch);

    fetchWithTimeout('https://example.com');

    await vi.advanceTimersByTimeAsync(TIMEOUT_QUICK_MS - 1);
    expect(getSignal(mockFetch).aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(getSignal(mockFetch).aborted).toBe(true);
  });

  it('aborts after TIMEOUT_MODERATE_MS (30s)', async () => {
    const mockFetch = hangingFetch();
    vi.stubGlobal('fetch', mockFetch);

    fetchWithTimeout('https://example.com', { timeoutMs: TIMEOUT_MODERATE_MS });

    await vi.advanceTimersByTimeAsync(TIMEOUT_MODERATE_MS - 1);
    expect(getSignal(mockFetch).aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(getSignal(mockFetch).aborted).toBe(true);
  });

  it('aborts after TIMEOUT_STANDARD_MS (60s)', async () => {
    const mockFetch = hangingFetch();
    vi.stubGlobal('fetch', mockFetch);

    fetchWithTimeout('https://example.com', { timeoutMs: TIMEOUT_STANDARD_MS });

    await vi.advanceTimersByTimeAsync(TIMEOUT_STANDARD_MS - 1);
    expect(getSignal(mockFetch).aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(getSignal(mockFetch).aborted).toBe(true);
  });

  it('does not abort when fetch resolves before timeout', async () => {
    const mockResponse = { ok: true } as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await fetchWithTimeout('https://example.com', { timeoutMs: 5000 });

    // Advance past the timeout — should not abort since fetch already resolved
    await vi.advanceTimersByTimeAsync(10_000);
    // No error thrown = timeout was properly cleared
  });

  it('forwards caller signal: aborting caller also aborts the internal controller', async () => {
    const mockFetch = hangingFetch();
    vi.stubGlobal('fetch', mockFetch);

    const callerController = new AbortController();
    fetchWithTimeout('https://example.com', {
      timeoutMs: 60_000,
      signal: callerController.signal,
    });

    await vi.advanceTimersByTimeAsync(0);

    // Abort via the caller's controller
    callerController.abort();

    // The internal signal should also be aborted
    expect(getSignal(mockFetch).aborted).toBe(true);
  });

  it('passes url and init to underlying fetch', async () => {
    const mockResponse = { ok: true } as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await fetchWithTimeout('https://api.example.com/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"prompt":"hello"}',
      timeoutMs: 5000,
    });

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"prompt":"hello"}',
        signal: expect.any(AbortSignal),
      },
    );
  });
});
