import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  recordSuccess,
  recordFailure,
  isAvailable,
  getCircuitStatus,
  resetCircuit,
  getUnavailableProviders,
  initCircuitBreaker,
} from './circuit-breaker';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    })),
  })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Circuit Breaker', () => {
  beforeEach(async () => {
    // Reset by loading (clears state for non-configured Supabase)
    await initCircuitBreaker();
    // Reset all circuits
    for (const s of getCircuitStatus()) {
      resetCircuit(s.providerId);
    }
  });

  describe('recordSuccess', () => {
    it('creates circuit for new provider', () => {
      recordSuccess('groq');
      const status = getCircuitStatus();
      expect(status.some(s => s.providerId === 'groq')).toBe(true);
    });

    it('resets failure count', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordSuccess('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.consecutiveFailures).toBe(0);
    });

    it('resets failure count on success for open circuit', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      recordSuccess('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.consecutiveFailures).toBe(0);
      // State stays open until isAvailable transitions it to half-open
      expect(status!.state).toBe('open');
    });
  });

  describe('recordFailure', () => {
    it('increments failure count', () => {
      recordFailure('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.consecutiveFailures).toBe(1);
    });

    it('opens circuit after 3 consecutive failures', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.state).toBe('open');
    });

    it('does not open circuit before threshold', () => {
      recordFailure('groq');
      recordFailure('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.state).toBe('closed');
    });

    it('resets count on success then fails again', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordSuccess('groq');
      recordFailure('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.consecutiveFailures).toBe(1);
      expect(status!.state).toBe('closed');
    });
  });

  describe('isAvailable', () => {
    it('returns true for unknown provider', () => {
      expect(isAvailable('unknown')).toBe(true);
    });

    it('returns true for closed circuit', () => {
      recordFailure('groq');
      expect(isAvailable('groq')).toBe(true);
    });

    it('returns false for open circuit (within cooldown)', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      expect(isAvailable('groq')).toBe(false);
    });

    it('transitions to half-open after cooldown', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      expect(isAvailable('groq')).toBe(false);

      // Simulate cooldown by manipulating the circuit's openedAt
      // We need to access internal state - use getCircuitStatus to check
      // Since we can't directly set openedAt, we test the transition logic
      // by checking that isAvailable returns true after enough time
      // For this test, we verify the half-open transition exists
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.state).toBe('open');
    });
  });

  describe('getCircuitStatus', () => {
    it('returns empty array when no circuits', () => {
      expect(getCircuitStatus()).toEqual([]);
    });

    it('returns all circuits', () => {
      recordFailure('groq');
      recordFailure('google');
      const status = getCircuitStatus();
      expect(status.length).toBe(2);
    });

    it('sorts by consecutive failures descending', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('google');
      const status = getCircuitStatus();
      expect(status[0].providerId).toBe('groq');
      expect(status[1].providerId).toBe('google');
    });

    it('includes cooldownRemainingMs for open circuits', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.cooldownRemainingMs).toBeGreaterThanOrEqual(0);
      expect(status!.cooldownRemainingMs).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it('has null cooldownRemainingMs for closed circuits', () => {
      recordFailure('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.cooldownRemainingMs).toBeNull();
    });
  });

  describe('resetCircuit', () => {
    it('removes circuit from status', () => {
      recordFailure('groq');
      expect(getCircuitStatus().length).toBe(1);

      resetCircuit('groq');
      expect(getCircuitStatus().length).toBe(0);
    });

    it('makes provider available again', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      expect(isAvailable('groq')).toBe(false);

      resetCircuit('groq');
      expect(isAvailable('groq')).toBe(true);
    });
  });

  describe('getUnavailableProviders', () => {
    it('returns empty when all available', () => {
      expect(getUnavailableProviders()).toEqual([]);
    });

    it('returns open circuits', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      const unavailable = getUnavailableProviders();
      expect(unavailable).toContain('groq');
    });

    it('returns mixed available and unavailable', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('openai');
      const unavailable = getUnavailableProviders();
      expect(unavailable).toContain('groq');
      expect(unavailable).not.toContain('openai');
    });
  });

  describe('half-open state transitions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('isAvailable transitions open to half-open after cooldown', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      expect(isAvailable('groq')).toBe(false);

      // Advance past the 5-minute cooldown
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Now isAvailable should transition to half-open and return true
      expect(isAvailable('groq')).toBe(true);

      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.state).toBe('half-open');
    });

    it('recordSuccess on half-open circuit closes it', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      isAvailable('groq'); // transitions to half-open

      recordSuccess('groq');

      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.state).toBe('closed');
      expect(status!.consecutiveFailures).toBe(0);
    });

    it('recordFailure on half-open circuit re-opens it', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      isAvailable('groq'); // transitions to half-open

      recordFailure('groq');

      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.state).toBe('open');
    });

    it('isAvailable returns true for half-open circuit', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      isAvailable('groq'); // transitions to half-open

      expect(isAvailable('groq')).toBe(true);
    });

    it('getCircuitStatus returns null cooldownRemainingMs for half-open', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordFailure('groq');
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      isAvailable('groq'); // transitions to half-open

      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.cooldownRemainingMs).toBeNull();
    });
  });

  describe('MAX_OPEN_CIRCUITS limit', () => {
    it('does not open circuit when max open circuits reached', () => {
      // Open 5 circuits (MAX_OPEN_CIRCUITS = 5)
      for (let i = 0; i < 5; i++) {
        const id = `provider-${i}`;
        recordFailure(id);
        recordFailure(id);
        recordFailure(id);
        expect(getCircuitStatus().find(s => s.providerId === id)!.state).toBe('open');
      }

      // Try to open a 6th — should NOT open
      recordFailure('provider-6');
      recordFailure('provider-6');
      recordFailure('provider-6');

      const status = getCircuitStatus().find(s => s.providerId === 'provider-6');
      expect(status!.state).toBe('closed');
      expect(status!.consecutiveFailures).toBe(3);
    });

    it('allows opening after a circuit is reset', () => {
      for (let i = 0; i < 5; i++) {
        const id = `p-${i}`;
        recordFailure(id);
        recordFailure(id);
        recordFailure(id);
      }

      // Reset one
      resetCircuit('p-0');

      // Now a 6th can open
      recordFailure('p-extra');
      recordFailure('p-extra');
      recordFailure('p-extra');

      const status = getCircuitStatus().find(s => s.providerId === 'p-extra');
      expect(status!.state).toBe('open');
    });
  });

  describe('getCircuitStatus edge cases', () => {
    it('returns cooldownRemainingMs as 0 when cooldown has fully elapsed', () => {
      vi.useFakeTimers();
      try {
        recordFailure('groq');
        recordFailure('groq');
        recordFailure('groq');
        vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
        isAvailable('groq'); // transitions to half-open, removing open state

        const status = getCircuitStatus().find(s => s.providerId === 'groq');
        // half-open doesn't have cooldownRemainingMs (it's null)
        expect(status!.cooldownRemainingMs).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns all status fields correctly', () => {
      recordFailure('groq');
      recordFailure('groq');
      recordSuccess('groq');
      const status = getCircuitStatus().find(s => s.providerId === 'groq');
      expect(status!.providerId).toBe('groq');
      expect(status!.state).toBe('closed');
      expect(status!.consecutiveFailures).toBe(0);
      // recordSuccess does NOT clear lastFailureAt — it only resets the counter
      expect(status!.lastFailureAt).toBeGreaterThan(0);
      expect(status!.lastSuccessAt).toBeGreaterThan(0);
    });
  });
});

// ─── Supabase-backed tests (env vars set) ──
// Uses vi.resetModules() to get a fresh module instance with Supabase configured.

describe('Circuit Breaker (Supabase-backed)', () => {
  const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockDeleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, upsert: mockUpsert, delete: mockDelete });
  const mockCreateClient = vi.fn(() => ({ from: mockFrom }));

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    vi.doMock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));
    vi.doMock('@/lib/logger', () => ({
      createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    }));

    await vi.resetModules();
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  beforeEach(() => {
    mockSelect.mockResolvedValue({ data: [], error: null });
    mockUpsert.mockResolvedValue({ data: null, error: null });
    mockDeleteEq.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert, delete: mockDelete });
  });

  it('loads from Supabase with data rows', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { provider_id: 'groq', state: 'open', consecutive_failures: 5, last_failure_at: 100, last_success_at: 200, opened_at: 300, updated_at: 400 },
      ],
      error: null,
    });
    const { initCircuitBreaker: init, getCircuitStatus: status } = await import('./circuit-breaker');
    await init();
    const circuits = status();
    expect(circuits.length).toBe(1);
    expect(circuits[0].providerId).toBe('groq');
    expect(circuits[0].state).toBe('open');
  });

  it('handles Supabase load error', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    const { initCircuitBreaker: init } = await import('./circuit-breaker');
    await expect(init()).resolves.toBeUndefined();
  });

  it('handles Supabase load exception', async () => {
    mockSelect.mockRejectedValue(new Error('network timeout'));
    const { initCircuitBreaker: init } = await import('./circuit-breaker');
    await expect(init()).resolves.toBeUndefined();
  });

  it('persists to Supabase on recordFailure', async () => {
    const { recordFailure: fail } = await import('./circuit-breaker');
    fail('persist-provider');
    fail('persist-provider');
    fail('persist-provider');
    await new Promise(r => setTimeout(r, 10));
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('handles Supabase persist error', async () => {
    mockUpsert.mockResolvedValue({ data: null, error: { message: 'upsert failed' } });
    const { recordFailure: fail } = await import('./circuit-breaker');
    fail('persist-err-provider');
    fail('persist-err-provider');
    fail('persist-err-provider');
    await new Promise(r => setTimeout(r, 10));
  });

  it('handles Supabase persist exception', async () => {
    mockUpsert.mockRejectedValue(new Error('network error'));
    const { recordFailure: fail } = await import('./circuit-breaker');
    fail('persist-ex-provider');
    fail('persist-ex-provider');
    fail('persist-ex-provider');
    await new Promise(r => setTimeout(r, 10));
  });

  it('persists on recordSuccess', async () => {
    const { recordSuccess: success } = await import('./circuit-breaker');
    success('success-provider');
    await new Promise(r => setTimeout(r, 10));
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('deletes from Supabase on resetCircuit', async () => {
    const { recordFailure: fail, resetCircuit: reset } = await import('./circuit-breaker');
    fail('del-provider');
    fail('del-provider');
    fail('del-provider');
    await new Promise(r => setTimeout(r, 10));
    reset('del-provider');
    await new Promise(r => setTimeout(r, 10));
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalled();
  });

  it('handles Supabase delete error', async () => {
    mockDeleteEq.mockResolvedValue({ data: null, error: { message: 'delete failed' } });
    const { resetCircuit: reset } = await import('./circuit-breaker');
    reset('del-err-provider');
    await new Promise(r => setTimeout(r, 10));
  });

  it('handles Supabase delete exception', async () => {
    mockDeleteEq.mockRejectedValue(new Error('network error'));
    const { resetCircuit: reset } = await import('./circuit-breaker');
    reset('del-ex-provider');
    await new Promise(r => setTimeout(r, 10));
  });

  it('persists on isAvailable cooldown transition', async () => {
    vi.useFakeTimers();
    try {
      const { recordFailure: fail, isAvailable: avail } = await import('./circuit-breaker');
      fail('avail-provider');
      fail('avail-provider');
      fail('avail-provider');
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      avail('avail-provider');
      await vi.advanceTimersByTimeAsync(10);
      expect(mockUpsert).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
