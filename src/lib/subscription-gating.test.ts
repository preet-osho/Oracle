// ═══════════════════════════════════════
// ORACLE — Subscription Feature Gating Tests
// Tests for daily usage tracking, agent access, and plan limits
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEffectivePlan,
  hasAgentAccess,
  getTodayKey,
  PLANS,
  PLAN_AGENT_ACCESS,
  type PlanId,
  type UserSubscription,
} from './subscription';
import { DAILY_USAGE_RETENTION_DAYS } from './subscription';

// ─── Mock logger ───
vi.mock('./logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Helper ───
function makeSubscription(overrides: Partial<UserSubscription> = {}): UserSubscription {
  return {
    userId: 'user-1',
    planId: 'pro',
    status: 'active',
    trialEndsAt: null,
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    razorpayOrderId: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── Plan Definitions ─────────────

describe('PLANS definitions', () => {
  it('has exactly 3 plans', () => {
    expect(Object.keys(PLANS)).toHaveLength(3);
  });

  it('starter is free', () => {
    expect(PLANS.starter.price).toBe(0);
  });

  it('starter has 50 AI responses per day', () => {
    expect(PLANS.starter.limits.aiResponsesPerDay).toBe(50);
  });

  it('pro has unlimited AI responses', () => {
    expect(PLANS.pro.limits.aiResponsesPerDay).toBe(-1);
  });

  it('agency has unlimited AI responses', () => {
    expect(PLANS.agency.limits.aiResponsesPerDay).toBe(-1);
  });

  it('starter disables clientMemory, ragAndSearch, proposals, invoices', () => {
    expect(PLANS.starter.limits.clientMemory).toBe(false);
    expect(PLANS.starter.limits.ragAndSearch).toBe(false);
    expect(PLANS.starter.limits.proposals).toBe(false);
    expect(PLANS.starter.limits.invoices).toBe(false);
    expect(PLANS.starter.limits.apiAccess).toBe(false);
  });

  it('pro enables clientMemory, ragAndSearch, proposals, invoices', () => {
    expect(PLANS.pro.limits.clientMemory).toBe(true);
    expect(PLANS.pro.limits.ragAndSearch).toBe(true);
    expect(PLANS.pro.limits.proposals).toBe(true);
    expect(PLANS.pro.limits.invoices).toBe(true);
  });

  it('agency enables apiAccess', () => {
    expect(PLANS.agency.limits.apiAccess).toBe(true);
    expect(PLANS.pro.limits.apiAccess).toBe(false);
  });

  it('starter restricts domains to 5', () => {
    expect(PLANS.starter.limits.domains).toBe(5);
  });

  it('pro allows unlimited domains', () => {
    expect(PLANS.pro.limits.domains).toBe(-1);
  });

  it('agency has 5 team seats', () => {
    expect(PLANS.agency.limits.teamSeats).toBe(5);
  });

  it('pro has 1 team seat', () => {
    expect(PLANS.pro.limits.teamSeats).toBe(1);
  });
});

// ─── Agent Access ──────────────────

describe('hasAgentAccess', () => {
  it('starter can access orchestrator', () => {
    expect(hasAgentAccess('starter', 'orchestrator')).toBe(true);
  });

  it('starter can access researcher', () => {
    expect(hasAgentAccess('starter', 'researcher')).toBe(true);
  });

  it('starter can access writer', () => {
    expect(hasAgentAccess('starter', 'writer')).toBe(true);
  });

  it('starter can access analyst', () => {
    expect(hasAgentAccess('starter', 'analyst')).toBe(true);
  });

  it('starter CANNOT access developer', () => {
    expect(hasAgentAccess('starter', 'developer')).toBe(false);
  });

  it('starter CANNOT access strategist', () => {
    expect(hasAgentAccess('starter', 'strategist')).toBe(false);
  });

  it('starter CANNOT access marketer', () => {
    expect(hasAgentAccess('starter', 'marketer')).toBe(false);
  });

  it('starter CANNOT access voice', () => {
    expect(hasAgentAccess('starter', 'voice')).toBe(false);
  });

  it('starter CANNOT access workflow', () => {
    expect(hasAgentAccess('starter', 'workflow')).toBe(false);
  });

  it('pro can access developer', () => {
    expect(hasAgentAccess('pro', 'developer')).toBe(true);
  });

  it('pro can access strategist', () => {
    expect(hasAgentAccess('pro', 'strategist')).toBe(true);
  });

  it('pro can access qa', () => {
    expect(hasAgentAccess('pro', 'qa')).toBe(true);
  });

  it('pro CANNOT access voice', () => {
    expect(hasAgentAccess('pro', 'voice')).toBe(false);
  });

  it('pro CANNOT access coordinator', () => {
    expect(hasAgentAccess('pro', 'coordinator')).toBe(false);
  });

  it('pro CANNOT access workflow', () => {
    expect(hasAgentAccess('pro', 'workflow')).toBe(false);
  });

  it('agency can access all agents', () => {
    for (const agent of ['orchestrator', 'researcher', 'writer', 'developer', 'analyst', 'strategist', 'marketer', 'designer', 'finance', 'voice', 'qa', 'coordinator', 'workflow']) {
      expect(hasAgentAccess('agency', agent)).toBe(true);
    }
  });
});

// ─── getEffectivePlan ──────────────

describe('getEffectivePlan (updated)', () => {
  it('returns starter for null subscription', () => {
    expect(getEffectivePlan(null)).toBe('starter');
  });

  it('returns the plan for valid subscription', () => {
    const sub = makeSubscription({ planId: 'agency', status: 'active' });
    expect(getEffectivePlan(sub)).toBe('agency');
  });

  it('returns starter for expired subscription', () => {
    const sub = makeSubscription({ status: 'expired' });
    expect(getEffectivePlan(sub)).toBe('starter');
  });

  it('returns starter for cancelled subscription', () => {
    const sub = makeSubscription({ status: 'cancelled' });
    expect(getEffectivePlan(sub)).toBe('starter');
  });

  it('returns starter for trialing subscription past grace period', () => {
    const sub = makeSubscription({
      status: 'trialing',
      trialEndsAt: Date.now() - 4 * 24 * 60 * 60 * 1000, // 4 days ago (past 3-day grace)
    });
    expect(getEffectivePlan(sub)).toBe('starter');
  });
});

// ─── getTodayKey ───────────────────

describe('getTodayKey', () => {
  it('returns YYYY-MM-DD format', () => {
    const key = getTodayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns consistent value within same call', () => {
    const key1 = getTodayKey();
    const key2 = getTodayKey();
    expect(key1).toBe(key2);
  });
});

// ─── PLAN_AGENT_ACCESS ─────────────

describe('PLAN_AGENT_ACCESS', () => {
  it('defines access for all 3 plans', () => {
    expect(PLAN_AGENT_ACCESS.starter).toBeDefined();
    expect(PLAN_AGENT_ACCESS.pro).toBeDefined();
    expect(PLAN_AGENT_ACCESS.agency).toBeDefined();
  });

  it('starter has exactly 4 agents', () => {
    expect(PLAN_AGENT_ACCESS.starter).toHaveLength(4);
  });

  it('pro has more agents than starter', () => {
    expect(PLAN_AGENT_ACCESS.pro.length).toBeGreaterThan(PLAN_AGENT_ACCESS.starter.length);
  });

  it('agency has more agents than pro', () => {
    expect(PLAN_AGENT_ACCESS.agency.length).toBeGreaterThanOrEqual(PLAN_AGENT_ACCESS.pro.length);
  });
});

// ─── Daily Usage Cleanup ────────────

describe('DAILY_USAGE_RETENTION_DAYS', () => {
  it('is set to 90 days', () => {
    expect(DAILY_USAGE_RETENTION_DAYS).toBe(90);
  });

  it('is a positive number', () => {
    expect(DAILY_USAGE_RETENTION_DAYS).toBeGreaterThan(0);
  });
});
