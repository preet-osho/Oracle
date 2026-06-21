import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSubscriptionValid,
  getEffectivePlan,
  hasFeatureAccess,
  PLANS,
  TRIAL_DURATION_MS,
  GRACE_PERIOD_MS,
  type UserSubscription,
} from './subscription';

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
      currentPeriodEnd: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
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
      trialEndsAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
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
    const sub = makeSubscription({
      planId: 'agency',
      status: 'expired',
    });
    expect(getEffectivePlan(sub)).toBe('starter');
  });

  it('returns starter for cancelled subscription', () => {
    const sub = makeSubscription({
      planId: 'pro',
      status: 'cancelled',
    });
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
