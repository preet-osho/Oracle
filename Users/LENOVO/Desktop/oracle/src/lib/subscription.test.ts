import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSubscriptionValid,
  getEffectivePlan,
  hasFeatureAccess,
  hasAgentAccess,
  getTodayKey,
  getDailyUsage,
  incrementDailyUsage,
  checkDailyLimit,
  incrementAndCheckDailyLimit,
  getUserSubscription,
  checkSubscription,
  createSubscription,
  startTrial,
  cancelSubscription,
  expireSubscriptions,
  cleanupOldDailyUsage,
  PLANS,
  TRIAL_DURATION_MS,
  GRACE_PERIOD_MS,
  DAILY_USAGE_RETENTION_DAYS,
  PLAN_AGENT_ACCESS,
  type UserSubscription,
} from './subscription';

// ─── Supabase Mock ─────────────────────

// Chainable mock: all chain methods return this object, single() returns data
const mockSingle = vi.fn();
const mockChainMethods: Record<string, ReturnType<typeof vi.fn>> = {};
const mockChain = new Proxy({} as Record<string, unknown>, {
  get(_target, prop) {
    if (prop === 'single') return mockSingle;
    if (prop === Symbol.toPrimitive) return undefined;
    if (typeof prop === 'symbol') return undefined;
    // Return null for data properties so destructuring { data, error } works
    // Return undefined for 'then' to prevent await from treating mockChain as a thenable
    if (prop === 'data' || prop === 'error') return null;
    if (prop === 'then') return undefined;
    if (!(prop in mockChainMethods)) {
      mockChainMethods[prop as string] = vi.fn().mockReturnValue(mockChain);
    }
    return mockChainMethods[prop as string];
  },
});

const mockSupabaseFrom = vi.fn(() => mockChain);

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockSupabaseFrom })),
}));

// Set env vars at module scope so getSubscriptionClient() creates the mock client
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

function resetMockChain() {
  mockSingle.mockReset();
  mockSingle.mockReturnValue({ data: null, error: null });
  for (const fn of Object.values(mockChainMethods)) {
    fn.mockReset();
    fn.mockReturnValue(mockChain);
  }
}

// ─── Helpers ──────────────────────────

function makeSubscription(overrides: Partial<UserSubscription> = {}): UserSubscription {
  return {
    userId: 'user-1',
    planId: 'pro',
    status: 'active',
    trialEndsAt: null,
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    razorpayOrderId: 'order_123',
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────

describe('isSubscriptionValid', () => {
  it('returns true for null subscription (free tier)', () => {
    expect(isSubscriptionValid(null)).toBe(true);
  });

  it('returns true for active subscription within period', () => {
    const sub = makeSubscription({
      status: 'active',
      currentPeriodEnd: Date.now() + 10 * 24 * 60 * 60 * 1000,
    });
    expect(isSubscriptionValid(sub)).toBe(true);
  });

  it('returns true for active subscription within grace period', () => {
    const sub = makeSubscription({
      status: 'active',
      currentPeriodEnd: Date.now() - 1 * 24 * 60 * 60 * 1000,
    });
    expect(isSubscriptionValid(sub)).toBe(true);
  });

  it('returns false for active subscription past grace period', () => {
    const sub = makeSubscription({
      status: 'active',
      currentPeriodEnd: Date.now() - (GRACE_PERIOD_MS + 1),
    });
    expect(isSubscriptionValid(sub)).toBe(false);
  });

  it('returns true for trialing subscription within trial', () => {
    const sub = makeSubscription({
      status: 'trialing',
      trialEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      currentPeriodEnd: null,
    });
    expect(isSubscriptionValid(sub)).toBe(true);
  });

  it('returns true for trialing subscription within grace period', () => {
    const sub = makeSubscription({
      status: 'trialing',
      trialEndsAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
      currentPeriodEnd: null,
    });
    expect(isSubscriptionValid(sub)).toBe(true);
  });

  it('returns false for trialing subscription past grace period', () => {
    const sub = makeSubscription({
      status: 'trialing',
      trialEndsAt: Date.now() - (GRACE_PERIOD_MS + 1),
      currentPeriodEnd: null,
    });
    expect(isSubscriptionValid(sub)).toBe(false);
  });

  it('returns false for expired subscription', () => {
    const sub = makeSubscription({ status: 'expired' });
    expect(isSubscriptionValid(sub)).toBe(false);
  });

  it('returns false for cancelled subscription', () => {
    const sub = makeSubscription({ status: 'cancelled' });
    expect(isSubscriptionValid(sub)).toBe(false);
  });

  it('returns true for none status', () => {
    const sub = makeSubscription({ status: 'none' });
    expect(isSubscriptionValid(sub)).toBe(true);
  });
});

describe('getEffectivePlan', () => {
  it('returns starter for null subscription', () => {
    expect(getEffectivePlan(null)).toBe('starter');
  });

  it('returns the plan for valid subscription', () => {
    const sub = makeSubscription({ planId: 'pro', status: 'active' });
    expect(getEffectivePlan(sub)).toBe('pro');
  });

  it('returns starter for expired subscription', () => {
    const sub = makeSubscription({ planId: 'agency', status: 'expired' });
    expect(getEffectivePlan(sub)).toBe('starter');
  });

  it('returns starter for cancelled subscription', () => {
    const sub = makeSubscription({ planId: 'pro', status: 'cancelled' });
    expect(getEffectivePlan(sub)).toBe('starter');
  });
});

describe('hasFeatureAccess', () => {
  it('returns false for starter plan features', () => {
    const sub = makeSubscription({ planId: 'starter', status: 'active' });
    expect(hasFeatureAccess(sub, 'clientMemory')).toBe(false);
    expect(hasFeatureAccess(sub, 'ragAndSearch')).toBe(false);
    expect(hasFeatureAccess(sub, 'proposals')).toBe(false);
    expect(hasFeatureAccess(sub, 'apiAccess')).toBe(false);
  });

  it('returns true for pro plan features', () => {
    const sub = makeSubscription({ planId: 'pro', status: 'active' });
    expect(hasFeatureAccess(sub, 'clientMemory')).toBe(true);
    expect(hasFeatureAccess(sub, 'ragAndSearch')).toBe(true);
    expect(hasFeatureAccess(sub, 'proposals')).toBe(true);
    expect(hasFeatureAccess(sub, 'invoices')).toBe(true);
    expect(hasFeatureAccess(sub, 'apiAccess')).toBe(false);
  });

  it('returns true for agency plan features', () => {
    const sub = makeSubscription({ planId: 'agency', status: 'active' });
    expect(hasFeatureAccess(sub, 'clientMemory')).toBe(true);
    expect(hasFeatureAccess(sub, 'ragAndSearch')).toBe(true);
    expect(hasFeatureAccess(sub, 'proposals')).toBe(true);
    expect(hasFeatureAccess(sub, 'apiAccess')).toBe(true);
  });

  it('returns false for expired subscription features', () => {
    const sub = makeSubscription({ planId: 'pro', status: 'expired' });
    expect(hasFeatureAccess(sub, 'clientMemory')).toBe(false);
  });

  it('returns starter features for null subscription', () => {
    expect(hasFeatureAccess(null, 'clientMemory')).toBe(false);
    expect(hasFeatureAccess(null, 'ragAndSearch')).toBe(false);
  });
});

describe('PLANS', () => {
  it('has all 3 plans', () => {
    expect(Object.keys(PLANS)).toEqual(['starter', 'pro', 'agency']);
  });

  it('starter is free', () => {
    expect(PLANS.starter.price).toBe(0);
  });

  it('pro has correct price', () => {
    expect(PLANS.pro.price).toBe(2999);
  });

  it('agency has correct price', () => {
    expect(PLANS.agency.price).toBe(9999);
  });

  it('starter has limited features', () => {
    expect(PLANS.starter.limits.aiResponsesPerDay).toBe(50);
    expect(PLANS.starter.limits.clientMemory).toBe(false);
    expect(PLANS.starter.limits.apiAccess).toBe(false);
  });

  it('pro has unlimited AI responses', () => {
    expect(PLANS.pro.limits.aiResponsesPerDay).toBe(-1);
    expect(PLANS.pro.limits.clientMemory).toBe(true);
    expect(PLANS.pro.limits.proposals).toBe(true);
  });

  it('agency has team seats and API access', () => {
    expect(PLANS.agency.limits.teamSeats).toBe(5);
    expect(PLANS.agency.limits.apiAccess).toBe(true);
  });
});

describe('TRIAL_DURATION_MS', () => {
  it('is 14 days', () => {
    expect(TRIAL_DURATION_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});

describe('GRACE_PERIOD_MS', () => {
  it('is 3 days', () => {
    expect(GRACE_PERIOD_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });
});

// ─── hasAgentAccess ─────────────────────

describe('hasAgentAccess', () => {
  it('starter can access orchestrator, researcher, writer, analyst', () => {
    expect(hasAgentAccess('starter', 'orchestrator')).toBe(true);
    expect(hasAgentAccess('starter', 'researcher')).toBe(true);
    expect(hasAgentAccess('starter', 'writer')).toBe(true);
    expect(hasAgentAccess('starter', 'analyst')).toBe(true);
  });

  it('starter cannot access specialist agents', () => {
    expect(hasAgentAccess('starter', 'developer')).toBe(false);
    expect(hasAgentAccess('starter', 'strategist')).toBe(false);
    expect(hasAgentAccess('starter', 'marketer')).toBe(false);
    expect(hasAgentAccess('starter', 'designer')).toBe(false);
    expect(hasAgentAccess('starter', 'finance')).toBe(false);
    expect(hasAgentAccess('starter', 'voice')).toBe(false);
    expect(hasAgentAccess('starter', 'workflow')).toBe(false);
  });

  it('pro can access core + specialist agents', () => {
    expect(hasAgentAccess('pro', 'orchestrator')).toBe(true);
    expect(hasAgentAccess('pro', 'developer')).toBe(true);
    expect(hasAgentAccess('pro', 'strategist')).toBe(true);
    expect(hasAgentAccess('pro', 'marketer')).toBe(true);
    expect(hasAgentAccess('pro', 'designer')).toBe(true);
    expect(hasAgentAccess('pro', 'finance')).toBe(true);
    expect(hasAgentAccess('pro', 'qa')).toBe(true);
  });

  it('pro cannot access agency-only agents', () => {
    expect(hasAgentAccess('pro', 'voice')).toBe(false);
    expect(hasAgentAccess('pro', 'coordinator')).toBe(false);
    expect(hasAgentAccess('pro', 'workflow')).toBe(false);
  });

  it('agency can access all agents', () => {
    for (const agent of PLAN_AGENT_ACCESS.agency) {
      expect(hasAgentAccess('agency', agent)).toBe(true);
    }
  });

  it('returns false for unknown agent type', () => {
    expect(hasAgentAccess('agency', 'nonexistent')).toBe(false);
  });
});

describe('PLAN_AGENT_ACCESS', () => {
  it('has all 3 plans', () => {
    expect(Object.keys(PLAN_AGENT_ACCESS)).toEqual(['starter', 'pro', 'agency']);
  });

  it('agency has more agents than pro', () => {
    expect(PLAN_AGENT_ACCESS.agency.length).toBeGreaterThan(PLAN_AGENT_ACCESS.pro.length);
  });

  it('pro has more agents than starter', () => {
    expect(PLAN_AGENT_ACCESS.pro.length).toBeGreaterThan(PLAN_AGENT_ACCESS.starter.length);
  });
});

// ─── getTodayKey ────────────────────────

describe('getTodayKey', () => {
  it('returns YYYY-MM-DD format', () => {
    const key = getTodayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches current UTC date', () => {
    const key = getTodayKey();
    const expected = new Date().toISOString().split('T')[0];
    expect(key).toBe(expected);
  });
});

// ─── Daily Usage (Supabase-dependent) ───

describe('getDailyUsage', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('returns ai_requests from record', async () => {
    mockSingle.mockReturnValueOnce({ data: { ai_requests: 42 }, error: null });
    const usage = await getDailyUsage('user-1');
    expect(usage).toBe(42);
  });

  it('returns 0 when no record found', async () => {
    mockSingle.mockReturnValueOnce({ data: null, error: null });
    const usage = await getDailyUsage('user-1');
    expect(usage).toBe(0);
  });

  it('returns 0 when record has null ai_requests', async () => {
    mockSingle.mockReturnValueOnce({ data: { ai_requests: null }, error: null });
    const usage = await getDailyUsage('user-1');
    expect(usage).toBe(0);
  });

  it('returns 0 on error', async () => {
    mockSingle.mockReturnValueOnce({ data: null, error: { message: 'db error' } });
    const usage = await getDailyUsage('user-1');
    expect(usage).toBe(0);
  });

  it('returns 0 on exception', async () => {
    mockSingle.mockImplementationOnce(() => { throw new Error('network'); });
    const usage = await getDailyUsage('user-1');
    expect(usage).toBe(0);
  });

  it('calls from with daily_usage table', async () => {
    await getDailyUsage('user-1');
    expect(mockSupabaseFrom).toHaveBeenCalledWith('daily_usage');
  });
});

describe('incrementDailyUsage', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('increments existing record', async () => {
    mockSingle.mockReturnValueOnce({ data: { ai_requests: 5 }, error: null });
    const newCount = await incrementDailyUsage('user-1');
    expect(newCount).toBe(6);
  });

  it('inserts new record when none exists', async () => {
    // First call (existing check) returns null, then insert.select returns 1
    mockSingle
      .mockReturnValueOnce({ data: null, error: null })
      .mockReturnValueOnce({ data: { ai_requests: 1 }, error: null });
    const newCount = await incrementDailyUsage('user-1');
    expect(newCount).toBe(1);
  });

  it('inserts new record when select returns null with error', async () => {
    mockSingle
      .mockReturnValueOnce({ data: null, error: { message: 'no row' } })
      .mockReturnValueOnce({ data: { ai_requests: 1 }, error: null });
    const newCount = await incrementDailyUsage('user-1');
    expect(newCount).toBe(1);
  });

  it('returns 1 on exception (allows request)', async () => {
    mockSingle.mockImplementationOnce(() => { throw new Error('network'); });
    const newCount = await incrementDailyUsage('user-1');
    expect(newCount).toBe(1);
  });

  it('calls from with daily_usage table', async () => {
    await incrementDailyUsage('user-1');
    expect(mockSupabaseFrom).toHaveBeenCalledWith('daily_usage');
  });
});

describe('checkDailyLimit', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('returns unlimited for pro plan', async () => {
    const result = await checkDailyLimit('user-1', 'pro');
    expect(result).toEqual({ allowed: true, remaining: -1, limit: -1, used: 0 });
  });

  it('returns unlimited for agency plan', async () => {
    const result = await checkDailyLimit('user-1', 'agency');
    expect(result).toEqual({ allowed: true, remaining: -1, limit: -1, used: 0 });
  });

  it('returns correct remaining for starter with no usage', async () => {
    mockSingle.mockReturnValueOnce({ data: null, error: null });
    const result = await checkDailyLimit('user-1', 'starter');
    expect(result.limit).toBe(50);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(50);
    expect(result.used).toBe(0);
  });

  it('returns correct remaining for starter with partial usage', async () => {
    mockSingle.mockReturnValueOnce({ data: { ai_requests: 30 }, error: null });
    const result = await checkDailyLimit('user-1', 'starter');
    expect(result.limit).toBe(50);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(20);
    expect(result.used).toBe(30);
  });

  it('returns not allowed when at limit', async () => {
    mockSingle.mockReturnValueOnce({ data: { ai_requests: 50 }, error: null });
    const result = await checkDailyLimit('user-1', 'starter');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.used).toBe(50);
  });

  it('returns not allowed when over limit', async () => {
    mockSingle.mockReturnValueOnce({ data: { ai_requests: 60 }, error: null });
    const result = await checkDailyLimit('user-1', 'starter');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.used).toBe(60);
  });
});

describe('incrementAndCheckDailyLimit', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('returns unlimited for pro plan without incrementing', async () => {
    const result = await incrementAndCheckDailyLimit('user-1', 'pro');
    expect(result).toEqual({ allowed: true, remaining: -1, limit: -1, used: 0 });
  });

  it('returns unlimited for agency plan', async () => {
    const result = await incrementAndCheckDailyLimit('user-1', 'agency');
    expect(result.allowed).toBe(true);
  });

  it('returns not allowed when already at limit', async () => {
    mockSingle.mockReturnValueOnce({ data: { ai_requests: 50 }, error: null });
    const result = await incrementAndCheckDailyLimit('user-1', 'starter');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.used).toBe(50);
  });

  it('increments and returns new count when under limit', async () => {
    mockSingle
      .mockReturnValueOnce({ data: { ai_requests: 10 }, error: null })  // current check
      .mockReturnValueOnce({ data: { ai_requests: 10 }, error: null })  // increment's existing check
      .mockReturnValueOnce({ data: { ai_requests: 11 }, error: null }); // increment result
    const result = await incrementAndCheckDailyLimit('user-1', 'starter');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(11);
    expect(result.remaining).toBe(39);
  });
});

// ─── Subscription Queries (Supabase) ───

describe('getUserSubscription', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('returns mapped subscription on success', async () => {
    mockSingle.mockReturnValueOnce({
      data: {
        user_id: 'u1',
        plan_id: 'pro',
        status: 'active',
        trial_ends_at: null,
        current_period_end: 123456,
        razorpay_order_id: 'order_1',
        created_at: 100000,
      },
      error: null,
    });
    const result = await getUserSubscription('u1');
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('u1');
    expect(result!.planId).toBe('pro');
    expect(result!.status).toBe('active');
    expect(result!.currentPeriodEnd).toBe(123456);
    expect(result!.razorpayOrderId).toBe('order_1');
  });

  it('returns null when no record found', async () => {
    mockSingle.mockReturnValueOnce({ data: null, error: null });
    const result = await getUserSubscription('u1');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    mockSingle.mockReturnValueOnce({ data: null, error: { message: 'db error' } });
    const result = await getUserSubscription('u1');
    expect(result).toBeNull();
  });

  it('returns null on exception', async () => {
    mockSingle.mockImplementationOnce(() => { throw new Error('network'); });
    const result = await getUserSubscription('u1');
    expect(result).toBeNull();
  });

  it('calls from with user_subscriptions table', async () => {
    await getUserSubscription('u1');
    expect(mockSupabaseFrom).toHaveBeenCalledWith('user_subscriptions');
  });
});

describe('checkSubscription', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('allows access for null subscription (starter)', async () => {
    mockSingle.mockReturnValueOnce({ data: null, error: null });
    const result = await checkSubscription('user-1');
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('starter');
  });

  it('allows access for active subscription', async () => {
    mockSingle.mockReturnValueOnce({
      data: {
        user_id: 'u1',
        plan_id: 'pro',
        status: 'active',
        trial_ends_at: null,
        current_period_end: Date.now() + 30 * 86400000,
        razorpay_order_id: null,
        created_at: Date.now(),
      },
      error: null,
    });
    const result = await checkSubscription('u1');
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('pro');
  });

  it('denies access for expired subscription', async () => {
    mockSingle.mockReturnValueOnce({
      data: {
        user_id: 'u1',
        plan_id: 'pro',
        status: 'expired',
        trial_ends_at: null,
        current_period_end: null,
        razorpay_order_id: null,
        created_at: Date.now(),
      },
      error: null,
    });
    const result = await checkSubscription('u1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('expired');
    expect(result.upgradeUrl).toBe('/pricing');
  });

  it('denies access for cancelled subscription with reason', async () => {
    mockSingle.mockReturnValueOnce({
      data: {
        user_id: 'u1',
        plan_id: 'pro',
        status: 'cancelled',
        trial_ends_at: null,
        current_period_end: null,
        razorpay_order_id: null,
        created_at: Date.now(),
      },
      error: null,
    });
    const result = await checkSubscription('u1');
    expect(result.allowed).toBe(false);
    // getEffectivePlan returns 'starter' for cancelled subs, so plan name is "Starter"
    expect(result.reason).toContain('cancelled');
    expect(result.reason).toContain('Starter');
  });

  it('denies access for expired trial with days count', async () => {
    mockSingle.mockReturnValueOnce({
      data: {
        user_id: 'u1',
        plan_id: 'pro',
        status: 'trialing',
        trial_ends_at: Date.now() - 10 * 86400000,
        current_period_end: null,
        razorpay_order_id: null,
        created_at: Date.now(),
      },
      error: null,
    });
    const result = await checkSubscription('u1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('trial expired');
    expect(result.reason).toMatch(/\d+ day/);
  });

  it('allows access for active subscription within grace period', async () => {
    mockSingle.mockReturnValueOnce({
      data: {
        user_id: 'u1',
        plan_id: 'pro',
        status: 'active',
        trial_ends_at: null,
        current_period_end: Date.now() - 1 * 86400000,
        razorpay_order_id: null,
        created_at: Date.now(),
      },
      error: null,
    });
    const result = await checkSubscription('u1');
    expect(result.allowed).toBe(true);
  });
});

// ─── Subscription Management ────────────

describe('createSubscription', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('creates subscription successfully', async () => {
    const result = await createSubscription('u1', 'pro', 'order_123');
    expect(result.success).toBe(true);
  });

  it('creates subscription without orderId', async () => {
    const result = await createSubscription('u1', 'agency');
    expect(result.success).toBe(true);
  });

  it('returns error on insert failure', async () => {
    // Override insert to return error via the chain's .single() or chain terminal
    // The function calls .insert({...}) — chain.insert returns mockChain, then nothing else is called
    // Actually, insert returns mockChain which is used as the resolved value
    // We need to make insert return something with error
    const originalInsert = mockChainMethods.insert;
    mockChainMethods.insert = vi.fn().mockReturnValue({ error: { message: 'insert failed' } });
    const result = await createSubscription('u1', 'pro');
    expect(result.success).toBe(false);
    expect(result.error).toBe('insert failed');
    mockChainMethods.insert = originalInsert;
  });

  it('returns error on exception', async () => {
    mockChainMethods.insert = vi.fn().mockImplementation(() => { throw new Error('network'); });
    const result = await createSubscription('u1', 'pro');
    expect(result.success).toBe(false);
    expect(result.error).toBe('network');
    mockChainMethods.insert = vi.fn().mockReturnValue(mockChain);
  });
});

describe('startTrial', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('starts trial successfully', async () => {
    const result = await startTrial('u1', 'pro');
    expect(result.success).toBe(true);
  });

  it('returns error on insert failure', async () => {
    mockChainMethods.insert = vi.fn().mockReturnValue({ error: { message: 'trial insert failed' } });
    const result = await startTrial('u1', 'agency');
    expect(result.success).toBe(false);
    expect(result.error).toBe('trial insert failed');
    mockChainMethods.insert = vi.fn().mockReturnValue(mockChain);
  });

  it('returns error on exception', async () => {
    mockChainMethods.insert = vi.fn().mockImplementation(() => { throw new Error('timeout'); });
    const result = await startTrial('u1', 'pro');
    expect(result.success).toBe(false);
    expect(result.error).toBe('timeout');
    mockChainMethods.insert = vi.fn().mockReturnValue(mockChain);
  });
});

describe('cancelSubscription', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('cancels subscription successfully', async () => {
    // cancelSubscription: from().update().eq().in() — in() is terminal
    // Default mockChain.in returns { data: null, error: null } after reset
    const result = await cancelSubscription('u1');
    expect(result.success).toBe(true);
  });

  it('returns error on failure', async () => {
    mockChainMethods.in = vi.fn().mockReturnValue({ data: null, error: { message: 'cancel failed' } });
    const result = await cancelSubscription('u1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('cancel failed');
    mockChainMethods.in = vi.fn().mockReturnValue(mockChain);
  });

  it('returns error on exception', async () => {
    mockChainMethods.update = vi.fn().mockImplementation(() => { throw new Error('db error'); });
    const result = await cancelSubscription('u1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('db error');
    mockChainMethods.update = vi.fn().mockReturnValue(mockChain);
  });
});

describe('expireSubscriptions', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('returns count of expired subscriptions', async () => {
    // expireSubscriptions: from().update().eq().lt().select() — select() is terminal
    mockChainMethods.select = vi.fn().mockReturnValue({ data: [{ user_id: 'u1' }, { user_id: 'u2' }], error: null });
    const count = await expireSubscriptions();
    expect(count).toBe(2);
    mockChainMethods.select = vi.fn().mockReturnValue(mockChain);
  });

  it('returns 0 when no subscriptions to expire', async () => {
    mockChainMethods.select = vi.fn().mockReturnValue({ data: [], error: null });
    const count = await expireSubscriptions();
    expect(count).toBe(0);
    mockChainMethods.select = vi.fn().mockReturnValue(mockChain);
  });

  it('returns 0 on error', async () => {
    mockChainMethods.select = vi.fn().mockReturnValue({ data: null, error: { message: 'expire failed' } });
    const count = await expireSubscriptions();
    expect(count).toBe(0);
    mockChainMethods.select = vi.fn().mockReturnValue(mockChain);
  });

  it('returns 0 on exception', async () => {
    mockChainMethods.update = vi.fn().mockImplementation(() => { throw new Error('network'); });
    const count = await expireSubscriptions();
    expect(count).toBe(0);
    mockChainMethods.update = vi.fn().mockReturnValue(mockChain);
  });
});

describe('cleanupOldDailyUsage', () => {
  beforeEach(() => {
    resetMockChain();
  });

  it('returns count of deleted rows', async () => {
    // cleanupOldDailyUsage: from().delete().lt().select() — select() is terminal
    mockChainMethods.select = vi.fn().mockReturnValue({ data: [{ user_id: 'u1' }], error: null });
    const count = await cleanupOldDailyUsage();
    expect(count).toBe(1);
    mockChainMethods.select = vi.fn().mockReturnValue(mockChain);
  });

  it('returns 0 when no rows to delete', async () => {
    mockChainMethods.select = vi.fn().mockReturnValue({ data: [], error: null });
    const count = await cleanupOldDailyUsage();
    expect(count).toBe(0);
    mockChainMethods.select = vi.fn().mockReturnValue(mockChain);
  });

  it('returns 0 on error', async () => {
    mockChainMethods.select = vi.fn().mockReturnValue({ data: null, error: { message: 'delete failed' } });
    const count = await cleanupOldDailyUsage();
    expect(count).toBe(0);
    mockChainMethods.select = vi.fn().mockReturnValue(mockChain);
  });

  it('returns 0 on exception', async () => {
    mockChainMethods.delete = vi.fn().mockImplementation(() => { throw new Error('network'); });
    const count = await cleanupOldDailyUsage();
    expect(count).toBe(0);
    mockChainMethods.delete = vi.fn().mockReturnValue(mockChain);
  });
});

// ─── Constants ─────────────────────────

describe('DAILY_USAGE_RETENTION_DAYS', () => {
  it('is 90 days', () => {
    expect(DAILY_USAGE_RETENTION_DAYS).toBe(90);
  });
});
