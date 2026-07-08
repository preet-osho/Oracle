// ═══════════════════════════════════════
// ORACLE — Provider Health Server Tests
// Supabase-based provider health recording & querying
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted Mocks ─────────────────────

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

// ─── Helpers ──────────────────────────

function setEnv(overrides: Record<string, string>) {
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
}

function cleanEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// ─── Tests ────────────────────────────

describe('Provider Health Server', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service_role_key',
    });
  });

  afterEach(() => {
    cleanEnv();
  });

  describe('recordProviderHealth', () => {
    it('inserts health record to Supabase', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: mockInsert }) });

      const { recordProviderHealth } = await import('./provider-health-server');

      await recordProviderHealth({
        providerId: 'openai',
        modelId: 'gpt-4',
        latencyMs: 1200,
        success: true,
        tokensUsed: 500,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_id: 'openai',
          model_id: 'gpt-4',
          latency_ms: 1200,
          success: true,
          tokens_used: 500,
        }),
      );
    });

    it('skips silently when Supabase is not configured', async () => {
      cleanEnv();
      const { recordProviderHealth } = await import('./provider-health-server');

      // Should not throw
      await recordProviderHealth({
        providerId: 'openai',
        modelId: 'gpt-4',
        latencyMs: 100,
        success: true,
        tokensUsed: 10,
      });

      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('does not throw on database error', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: mockInsert }) });

      const { recordProviderHealth } = await import('./provider-health-server');

      // Should not throw
      await recordProviderHealth({
        providerId: 'openai',
        modelId: 'gpt-4',
        latencyMs: 100,
        success: true,
        tokensUsed: 10,
      });
    });

    it('does not throw on network error', async () => {
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockImplementation(() => { throw new Error('Network error'); }),
      });

      const { recordProviderHealth } = await import('./provider-health-server');

      // Should not throw
      await recordProviderHealth({
        providerId: 'openai',
        modelId: 'gpt-4',
        latencyMs: 100,
        success: true,
        tokensUsed: 10,
      });
    });

    it('includes optional userId and errorMessage', async () => {
      let insertedRow: Record<string, unknown> = {};
      const mockInsert = vi.fn().mockImplementation((row: Record<string, unknown>) => {
        insertedRow = row;
        return { error: null };
      });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: mockInsert }) });

      const { recordProviderHealth } = await import('./provider-health-server');

      await recordProviderHealth({
        userId: 'user_1',
        providerId: 'anthropic',
        modelId: 'claude-3',
        latencyMs: 2000,
        success: false,
        tokensUsed: 0,
        errorMessage: 'Rate limit exceeded',
      });

      expect(insertedRow.user_id).toBe('user_1');
      expect(insertedRow.error_message).toBe('Rate limit exceeded');
    });
  });

  describe('getHealthOverview', () => {
    it('returns empty overview when Supabase is not configured', async () => {
      cleanEnv();
      const { getHealthOverview } = await import('./provider-health-server');
      const overview = await getHealthOverview();

      expect(overview.totalProviders).toBe(0);
      expect(overview.providers).toHaveLength(0);
      expect(overview.overallUptime).toBe(100);
    });

    it('returns empty overview on database error', async () => {
      const mockGte = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const mockSelect = vi.fn().mockReturnValue({ gte: mockGte });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getHealthOverview } = await import('./provider-health-server');
      const overview = await getHealthOverview();

      expect(overview.totalProviders).toBe(0);
    });

    it('returns empty overview on network error', async () => {
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockImplementation(() => { throw new Error('Timeout'); }),
      });

      const { getHealthOverview } = await import('./provider-health-server');
      const overview = await getHealthOverview();

      expect(overview.totalProviders).toBe(0);
    });

    it('groups records by provider and computes stats', async () => {
      const mockGte = vi.fn().mockResolvedValue({
        data: [
          { provider_id: 'openai', latency_ms: 1000, success: true, tokens_used: 500, model_id: 'gpt-4' },
          { provider_id: 'openai', latency_ms: 1500, success: true, tokens_used: 600, model_id: 'gpt-4' },
          { provider_id: 'openai', latency_ms: 2000, success: false, tokens_used: 0, model_id: 'gpt-4' },
          { provider_id: 'anthropic', latency_ms: 800, success: true, tokens_used: 300, model_id: 'claude-3' },
        ],
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ gte: mockGte });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getHealthOverview } = await import('./provider-health-server');
      const overview = await getHealthOverview();

      expect(overview.totalProviders).toBe(2);
      expect(overview.totalRequests24h).toBe(4);

      const openai = overview.providers.find((p) => p.providerId === 'openai');
      expect(openai).toBeDefined();
      expect(openai!.totalRequests).toBe(3);
      expect(openai!.successfulRequests).toBe(2);
      expect(openai!.failedRequests).toBe(1);
      expect(openai!.uptimePct).toBeCloseTo(66.7, 0);
      expect(openai!.status).toBe('down'); // < 70% uptime

      const anthropic = overview.providers.find((p) => p.providerId === 'anthropic');
      expect(anthropic).toBeDefined();
      expect(anthropic!.status).toBe('healthy'); // 100% uptime
    });

    it('marks provider as healthy when uptime >= 95%', async () => {
      const records = Array.from({ length: 20 }, (_, i) => ({
        provider_id: 'openai',
        latency_ms: 1000,
        success: i < 19, // 19/20 = 95%
        tokens_used: 100,
        model_id: 'gpt-4',
      }));

      const mockGte = vi.fn().mockResolvedValue({ data: records, error: null });
      const mockSelect = vi.fn().mockReturnValue({ gte: mockGte });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getHealthOverview } = await import('./provider-health-server');
      const overview = await getHealthOverview();

      expect(overview.providers[0].status).toBe('healthy');
    });

    it('marks provider as degraded when uptime >= 70%', async () => {
      const records = Array.from({ length: 20 }, (_, i) => ({
        provider_id: 'openai',
        latency_ms: 1000,
        success: i < 15, // 15/20 = 75%
        tokens_used: 100,
        model_id: 'gpt-4',
      }));

      const mockGte = vi.fn().mockResolvedValue({ data: records, error: null });
      const mockSelect = vi.fn().mockReturnValue({ gte: mockGte });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getHealthOverview } = await import('./provider-health-server');
      const overview = await getHealthOverview();

      expect(overview.providers[0].status).toBe('degraded');
    });

    it('computes percentile latencies correctly', async () => {
      const records = Array.from({ length: 10 }, (_, i) => ({
        provider_id: 'openai',
        latency_ms: (i + 1) * 100, // 100, 200, ..., 1000
        success: true,
        tokens_used: 100,
        model_id: 'gpt-4',
      }));

      const mockGte = vi.fn().mockResolvedValue({ data: records, error: null });
      const mockSelect = vi.fn().mockReturnValue({ gte: mockGte });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getHealthOverview } = await import('./provider-health-server');
      const overview = await getHealthOverview();

      expect(overview.providers[0].p50LatencyMs).toBe(500);
      expect(overview.providers[0].p95LatencyMs).toBe(1000);
    });

    it('sorts providers by request count descending', async () => {
      const mockGte = vi.fn().mockResolvedValue({
        data: [
          { provider_id: 'small', latency_ms: 100, success: true, tokens_used: 10, model_id: 'm1' },
          { provider_id: 'big', latency_ms: 100, success: true, tokens_used: 10, model_id: 'm2' },
          { provider_id: 'big', latency_ms: 200, success: true, tokens_used: 20, model_id: 'm2' },
          { provider_id: 'big', latency_ms: 300, success: true, tokens_used: 30, model_id: 'm2' },
        ],
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ gte: mockGte });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getHealthOverview } = await import('./provider-health-server');
      const overview = await getHealthOverview();

      expect(overview.providers[0].providerId).toBe('big');
      expect(overview.providers[1].providerId).toBe('small');
    });
  });

  describe('getProviderHealthTimeline', () => {
    it('returns empty when Supabase is not configured', async () => {
      cleanEnv();
      const { getProviderHealthTimeline } = await import('./provider-health-server');
      const timeline = await getProviderHealthTimeline('openai');
      expect(timeline).toHaveLength(0);
    });

    it('returns empty on database error', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getProviderHealthTimeline } = await import('./provider-health-server');
      const timeline = await getProviderHealthTimeline('openai');
      expect(timeline).toHaveLength(0);
    });

    it('returns empty on network error', async () => {
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockImplementation(() => { throw new Error('Timeout'); }),
      });

      const { getProviderHealthTimeline } = await import('./provider-health-server');
      const timeline = await getProviderHealthTimeline('openai');
      expect(timeline).toHaveLength(0);
    });

    it('groups records by hour and computes stats', async () => {
      const now = Date.now();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { latency_ms: 1000, success: true, created_at: now },
          { latency_ms: 1500, success: true, created_at: now },
          { latency_ms: 2000, success: false, created_at: now },
        ],
        error: null,
      });
      const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getProviderHealthTimeline } = await import('./provider-health-server');
      const timeline = await getProviderHealthTimeline('openai');

      expect(timeline).toHaveLength(1); // All records in same hour
      expect(timeline[0].requests).toBe(3);
      expect(timeline[0].successes).toBe(2);
      expect(timeline[0].failures).toBe(1);
      expect(timeline[0].avgLatencyMs).toBe(1250); // (1000+1500)/2
      expect(timeline[0].uptimePct).toBeCloseTo(66.7, 0);
    });
  });
});
