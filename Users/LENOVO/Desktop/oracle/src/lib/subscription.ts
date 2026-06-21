// ═══════════════════════════════════════
// ORACLE — Subscription Enforcement
// Server-side subscription status checking
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('Subscription');

// ─── Types ────────────────────────────

export type PlanId = 'starter' | 'pro' | 'agency';

export type SubscriptionStatus = 'active' | 'trialing' | 'expired' | 'cancelled' | 'none';

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  price: number; // INR per month
  features: string[];
  limits: PlanLimits;
}

export interface PlanLimits {
  aiResponsesPerDay: number;  // -1 = unlimited
  domains: number;            // -1 = unlimited
  prompts: number;            // -1 = unlimited
  clientMemory: boolean;
  ragAndSearch: boolean;
  qualityScoring: 'basic' | 'advanced';
  proposals: boolean;
  invoices: boolean;
  teamSeats: number;
  apiAccess: boolean;
}

export interface UserSubscription {
  userId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  razorpayOrderId: string | null;
  createdAt: number;
}

export interface SubscriptionCheck {
  allowed: boolean;
  plan: PlanId;
  status: SubscriptionStatus;
  reason?: string;
  upgradeUrl?: string;
}

// ─── Plan Definitions ─────────────────

export const PLANS: Record<PlanId, SubscriptionPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 0,
    features: [
      '50 AI responses per day',
      '5 service domains',
      '10 curated prompts',
      'Basic quality scoring',
      'Community support',
    ],
    limits: {
      aiResponsesPerDay: 50,
      domains: 5,
      prompts: 10,
      clientMemory: false,
      ragAndSearch: false,
      qualityScoring: 'basic',
      proposals: false,
      invoices: false,
      teamSeats: 1,
      apiAccess: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 2999,
    features: [
      'Unlimited AI responses',
      'All 40+ service domains',
      'All 55+ expert prompts',
      'Per-client memory & RAG',
      'Quality scoring & analytics',
      'Proposals & invoicing',
      'Priority support',
    ],
    limits: {
      aiResponsesPerDay: -1,
      domains: -1,
      prompts: -1,
      clientMemory: true,
      ragAndSearch: true,
      qualityScoring: 'advanced',
      proposals: true,
      invoices: true,
      teamSeats: 1,
      apiAccess: false,
    },
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 9999,
    features: [
      'Everything in Pro',
      '5 team seats included',
      'Multi-client management',
      'Custom prompt library',
      'White-label proposals',
      'Dedicated account manager',
      'API access',
    ],
    limits: {
      aiResponsesPerDay: -1,
      domains: -1,
      prompts: -1,
      clientMemory: true,
      ragAndSearch: true,
      qualityScoring: 'advanced',
      proposals: true,
      invoices: true,
      teamSeats: 5,
      apiAccess: true,
    },
  },
};

// Trial duration: 14 days
export const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

// Grace period after trial/payment expiry: 3 days
export const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

// ─── Supabase Client ──────────────────

let subscriptionClient: SupabaseClient | null = null;

function getSubscriptionClient(): SupabaseClient | null {
  if (subscriptionClient) return subscriptionClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  subscriptionClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return subscriptionClient;
}

// ─── Core Functions ───────────────────

/**
 * Get a user's subscription record from the database.
 * Returns null if no subscription exists (defaults to starter/free).
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const supabase = getSubscriptionClient();
    if (!supabase) {
      log.warn('Subscription check skipped — Supabase not configured');
      return null;
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_id, status, trial_ends_at, current_period_end, razorpay_order_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      userId: data.user_id,
      planId: data.plan_id as PlanId,
      status: data.status as SubscriptionStatus,
      trialEndsAt: data.trial_ends_at,
      currentPeriodEnd: data.current_period_end,
      razorpayOrderId: data.razorpay_order_id,
      createdAt: data.created_at,
    };
  } catch (err) {
    log.error('Failed to get user subscription', {
      error: err instanceof Error ? err.message : 'Unknown',
      userId,
    });
    return null;
  }
}

/**
 * Check if a subscription is currently valid (active or within grace period).
 */
export function isSubscriptionValid(subscription: UserSubscription | null): boolean {
  if (!subscription) return true; // No subscription = free tier (always valid)

  const now = Date.now();

  switch (subscription.status) {
    case 'active':
      // Active subscription — check if current period has ended
      if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now) {
        // Period ended — check grace period
        return (now - subscription.currentPeriodEnd) < GRACE_PERIOD_MS;
      }
      return true;

    case 'trialing':
      // Trial in progress — check if trial has ended
      if (subscription.trialEndsAt && subscription.trialEndsAt < now) {
        // Trial ended — check grace period
        return (now - subscription.trialEndsAt) < GRACE_PERIOD_MS;
      }
      return true;

    case 'expired':
    case 'cancelled':
      return false;

    case 'none':
    default:
      return true; // Free tier
  }
}

/**
 * Get the effective plan for a user.
 * Returns 'starter' if no subscription or expired.
 */
export function getEffectivePlan(subscription: UserSubscription | null): PlanId {
  if (!subscription) return 'starter';
  if (!isSubscriptionValid(subscription)) return 'starter';
  return subscription.planId;
}

/**
 * Check if a user has access to a specific feature.
 */
export function hasFeatureAccess(
  subscription: UserSubscription | null,
  feature: keyof PlanLimits
): boolean {
  const planId = getEffectivePlan(subscription);
  const plan = PLANS[planId];
  return Boolean(plan.limits[feature]);
}

/**
 * Full subscription check — returns whether the user is allowed to proceed.
 * Used by middleware and validateAuth.
 */
export async function checkSubscription(userId: string): Promise<SubscriptionCheck> {
  const subscription = await getUserSubscription(userId);
  const planId = getEffectivePlan(subscription);
  const plan = PLANS[planId];

  if (isSubscriptionValid(subscription)) {
    return {
      allowed: true,
      plan: planId,
      status: subscription?.status || 'none',
    };
  }

  // Subscription expired — determine reason
  const now = Date.now();
  let reason = 'Your subscription has expired.';

  if (subscription?.status === 'trialing' && subscription.trialEndsAt) {
    const daysSinceExpiry = Math.floor((now - subscription.trialEndsAt) / (24 * 60 * 60 * 1000));
    reason = `Your ${plan.name} trial expired ${daysSinceExpiry} day(s) ago. Please upgrade to continue.`;
  } else if (subscription?.status === 'expired') {
    reason = `Your ${plan.name} subscription has expired. Please renew to continue.`;
  } else if (subscription?.status === 'cancelled') {
    reason = `Your ${plan.name} subscription has been cancelled. Please renew to continue.`;
  }

  log.warn('Subscription check failed', {
    userId,
    planId: planId,
    status: subscription?.status,
    reason,
  });

  return {
    allowed: false,
    plan: planId,
    status: subscription?.status || 'none',
    reason,
    upgradeUrl: '/pricing',
  };
}

// ─── Subscription Management ──────────

/**
 * Create a new subscription after successful payment.
 */
export async function createSubscription(
  userId: string,
  planId: PlanId,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSubscriptionClient();
    if (!supabase) return { success: false, error: 'Subscription service not configured' };

    const now = Date.now();
    const periodEnd = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

    const { error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        trial_ends_at: null,
        current_period_end: periodEnd,
        razorpay_order_id: orderId || null,
        created_at: now,
      });

    if (error) {
      log.error('Failed to create subscription', { error: error.message, userId, planId });
      return { success: false, error: error.message };
    }

    log.info('Subscription created', { userId, planId, orderId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Start a trial for a user.
 */
export async function startTrial(
  userId: string,
  planId: PlanId
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSubscriptionClient();
    if (!supabase) return { success: false, error: 'Subscription service not configured' };

    const now = Date.now();
    const trialEnds = now + TRIAL_DURATION_MS;

    const { error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'trialing',
        trial_ends_at: trialEnds,
        current_period_end: null,
        razorpay_order_id: null,
        created_at: now,
      });

    if (error) {
      log.error('Failed to start trial', { error: error.message, userId, planId });
      return { success: false, error: error.message };
    }

    log.info('Trial started', { userId, planId, trialEndsAt: new Date(trialEnds).toISOString() });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Cancel a subscription.
 */
export async function cancelSubscription(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSubscriptionClient();
    if (!supabase) return { success: false, error: 'Subscription service not configured' };

    const { error } = await supabase
      .from('user_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .in('status', ['active', 'trialing']);

    if (error) {
      log.error('Failed to cancel subscription', { error: error.message, userId });
      return { success: false, error: error.message };
    }

    log.info('Subscription cancelled', { userId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Check and expire subscriptions that have passed their period end.
 * Called by cron/automation.
 */
export async function expireSubscriptions(): Promise<number> {
  try {
    const supabase = getSubscriptionClient();
    if (!supabase) return 0;

    const now = Date.now();
    const graceCutoff = now - GRACE_PERIOD_MS;

    // Find active subscriptions whose period ended + grace period has passed
    const { data, error } = await supabase
      .from('user_subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('current_period_end', graceCutoff)
      .select('user_id');

    if (error) {
      log.error('Failed to expire subscriptions', { error: error.message });
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      log.info(`Expired ${count} subscriptions`, { userIds: data?.map((d) => d.user_id) });
    }
    return count;
  } catch (err) {
    log.error('Subscription expiry check failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return 0;
  }
}
