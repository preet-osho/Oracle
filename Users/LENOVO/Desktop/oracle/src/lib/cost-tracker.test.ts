import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env vars BEFORE import so getTrackerClient() passes the null check
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-12345678901234567890';
});

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
const mockGte = vi.fn(() => {
  // Return a thenable (resolves with data) that also has .order() for getDailyCosts/getCostByProvider
  const result: any = { then: undefined };
  const promise = Promise.resolve({ data: [], error: null });
  Object.assign(result, promise);
  result.then = promise.then.bind(promise);
  result.order = mockOrder;
  return result;
});
const mockEq = vi.fn(() => ({ gte: mockGte }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ insert: mockInsert, select: mockSelect }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('cost-tracker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ gte: mockGte });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockGte.mockImplementation(() => {
      const promise = Promise.resolve({ data: [], error: null });
      const result: any = Object.assign({}, promise);
      result.then = promise.then.bind(promise);
      result.order = mockOrder;
      return result;
    });
  });

  describe('recordCost', () => {
    it('inserts cost record to Supabase', async () => {
      const { recordCost } = await import('./cost-tracker');

      await recordCost({
        userId: 'user-1',
        providerId: 'groq',
        modelId: 'llama-3.3-70b',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
        costInr: 0.08,
        latencyMs: 500,
        success: true,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          provider_id: 'groq',
          model_id: 'llama-3.3-70b',
          input_tokens: 100,
          output_tokens: 50,
          cost_usd: 0.001,
          cost_inr: 0.08,
          latency_ms: 500,
          success: true,
        })
      );
    });

    it('defaults agentType to general', async () => {
      const { recordCost } = await import('./cost-tracker');

      await recordCost({
        userId: 'user-1',
        providerId: 'groq',
        modelId: 'llama-3.3-70b',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
        costInr: 0.08,
        latencyMs: 500,
        success: true,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ agent_type: 'general' })
      );
    });

    it('does not throw on Supabase error', async () => {
      mockInsert.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });
      const { recordCost } = await import('./cost-tracker');

      await expect(recordCost({
        userId: 'user-1',
        providerId: 'groq',
        modelId: 'llama-3.3-70b',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
        costInr: 0.08,
        latencyMs: 500,
        success: true,
      })).resolves.toBeUndefined();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('does not throw on exception', async () => {
      mockInsert.mockRejectedValueOnce(new Error('network'));
      const { recordCost } = await import('./cost-tracker');

      await expect(recordCost({
        userId: 'user-1',
        providerId: 'groq',
        modelId: 'llama-3.3-70b',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
        costInr: 0.08,
        latencyMs: 500,
        success: true,
      })).resolves.toBeUndefined();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('includes metadata when provided', async () => {
      const { recordCost } = await import('./cost-tracker');

      await recordCost({
        userId: 'user-1',
        providerId: 'groq',
        modelId: 'llama-3.3-70b',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
        costInr: 0.08,
        latencyMs: 500,
        success: true,
        metadata: { agentType: 'researcher' },
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { agentType: 'researcher' } })
      );
    });
  });

  describe('getCostOverview', () => {
    it('returns empty overview when Supabase not configured', async () => {
      // When no env vars, getTrackerClient returns null
      const { getCostOverview } = await import('./cost-tracker');
      const overview = await getCostOverview('user-1');

      expect(overview.todayCostUsd).toBe(0);
      expect(overview.todayCostInr).toBe(0);
      expect(overview.weekCostUsd).toBe(0);
      expect(overview.monthCostUsd).toBe(0);
      expect(overview.todayRequests).toBe(0);
      expect(overview.topProvider).toBe('none');
      expect(overview.topModel).toBe('none');
    });

    it('aggregates costs from query results', async () => {
      const mockData = [
        { cost_usd: 0.001, cost_inr: 0.08, provider_id: 'groq', model_id: 'llama-3.3' },
        { cost_usd: 0.002, cost_inr: 0.16, provider_id: 'google', model_id: 'gemini-flash' },
      ];
      mockGte.mockImplementation(() => {
        const promise = Promise.resolve({ data: mockData, error: null });
        const result: any = Object.assign({}, promise);
        result.then = promise.then.bind(promise);
        result.order = mockOrder;
        return result;
      });

      const { getCostOverview } = await import('./cost-tracker');
      const overview = await getCostOverview('user-1');

      expect(overview.topProvider).toBe('groq');
      expect(overview.todayRequests).toBe(2);
      expect(overview.todayCostUsd).toBe(0.003);
      expect(overview.todayCostInr).toBe(0.24);
    });
  });

  describe('getDailyCosts', () => {
    it('returns empty array when Supabase not configured', async () => {
      const { getDailyCosts } = await import('./cost-tracker');
      const costs = await getDailyCosts('user-1');
      expect(costs).toEqual([]);
    });
  });

  describe('getCostByProvider', () => {
    it('returns empty array when Supabase not configured', async () => {
      const { getCostByProvider } = await import('./cost-tracker');
      const costs = await getCostByProvider('user-1');
      expect(costs).toEqual([]);
    });
  });
});
