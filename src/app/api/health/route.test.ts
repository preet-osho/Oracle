import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Mocks ───

const mockGetEmergencyStopStatus = vi.fn();
vi.mock('@/lib/emergency-stop', () => ({
  getEmergencyStopStatus: (...a: any[]) => mockGetEmergencyStopStatus(...a),
}));

const mockGetCircuitStatus = vi.fn();
const mockGetUnavailableProviders = vi.fn();
vi.mock('@/lib/circuit-breaker', () => ({
  getCircuitStatus: (...a: any[]) => mockGetCircuitStatus(...a),
  getUnavailableProviders: (...a: any[]) => mockGetUnavailableProviders(...a),
}));

const mockSupabaseFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (...a: any[]) => mockSupabaseFrom(...a),
  })),
}));

import { GET } from './route';

// ─── Tests ───

describe('Health Check API /api/health', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure Supabase env vars are set so the endpoint creates a client
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    // Defaults
    mockGetEmergencyStopStatus.mockReturnValue({ active: false, reason: null });
    mockGetCircuitStatus.mockReturnValue([]);
    mockGetUnavailableProviders.mockReturnValue([]);
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      }),
    });
  });

  afterEach(() => {
    // Restore original env vars
    if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (origKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('returns healthy status when all checks pass', async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe('healthy');
    expect(body.version).toBe('2.3.0');
    expect(body.timestamp).toBeDefined();
  });

  it('returns circuit breaker check with ok status when no open circuits', async () => {
    mockGetCircuitStatus.mockReturnValue([]);
    mockGetUnavailableProviders.mockReturnValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.checks.circuitBreaker).toEqual({
      status: 'ok',
      open: 0,
      unavailable: [],
    });
  });

  it('returns circuit breaker check with degraded status when circuits are open', async () => {
    mockGetCircuitStatus.mockReturnValue([
      { providerId: 'groq', state: 'open', consecutiveFailures: 3, lastFailureAt: Date.now(), lastSuccessAt: null, cooldownRemainingMs: 120000 },
      { providerId: 'anthropic', state: 'closed', consecutiveFailures: 0, lastFailureAt: null, lastSuccessAt: Date.now(), cooldownRemainingMs: null },
    ]);
    mockGetUnavailableProviders.mockReturnValue(['groq']);

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.circuitBreaker).toEqual({
      status: 'degraded',
      open: 1,
      unavailable: ['groq'],
    });
  });

  it('reports multiple circuit-broken providers', async () => {
    mockGetCircuitStatus.mockReturnValue([
      { providerId: 'groq', state: 'open', consecutiveFailures: 5, lastFailureAt: Date.now(), lastSuccessAt: null, cooldownRemainingMs: 60000 },
      { providerId: 'anthropic', state: 'open', consecutiveFailures: 4, lastFailureAt: Date.now(), lastSuccessAt: null, cooldownRemainingMs: 90000 },
      { providerId: 'openai', state: 'closed', consecutiveFailures: 0, lastFailureAt: null, lastSuccessAt: Date.now(), cooldownRemainingMs: null },
    ]);
    mockGetUnavailableProviders.mockReturnValue(['groq', 'anthropic']);

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.circuitBreaker.status).toBe('degraded');
    expect(body.checks.circuitBreaker.open).toBe(2);
    expect(body.checks.circuitBreaker.unavailable).toEqual(['groq', 'anthropic']);
  });

  it('reports half-open circuits as not open', async () => {
    mockGetCircuitStatus.mockReturnValue([
      { providerId: 'groq', state: 'half-open', consecutiveFailures: 3, lastFailureAt: Date.now(), lastSuccessAt: null, cooldownRemainingMs: 0 },
    ]);
    mockGetUnavailableProviders.mockReturnValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe('healthy');
    expect(body.checks.circuitBreaker.status).toBe('ok');
    expect(body.checks.circuitBreaker.open).toBe(0);
  });

  it('includes all expected checks', async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.checks).toHaveProperty('database');
    expect(body.checks).toHaveProperty('encryption');
    expect(body.checks).toHaveProperty('emergencyStop');
    expect(body.checks).toHaveProperty('providers');
    expect(body.checks).toHaveProperty('circuitBreaker');
  });

  it('returns degraded when emergency stop is active', async () => {
    mockGetEmergencyStopStatus.mockReturnValue({ active: true, reason: 'Manual activation' });

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.emergencyStop.status).toBe('active');
  });

  it('returns down when database throws', async () => {
    mockSupabaseFrom.mockImplementation(() => {
      throw new Error('Connection refused');
    });

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe('down');
    expect(body.checks.database.status).toBe('error');
  });

  it('returns degraded when Supabase env vars are missing', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const res = await GET();
      const body = await res.json();

      expect(body.status).toBe('degraded');
      expect(body.checks.database.status).toBe('not_configured');
    } finally {
      if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    }
  });
});
