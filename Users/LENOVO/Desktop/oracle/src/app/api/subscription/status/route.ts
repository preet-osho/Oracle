// ═══════════════════════════════════════
// ORACLE — Subscription Status API
// GET /api/subscription/status — returns current user's subscription
// POST /api/subscription/status — create/activate subscription after payment
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import {
  getUserSubscription,
  checkSubscription,
  createSubscription,
  startTrial,
  cancelSubscription,
  PLANS,
  type PlanId,
} from '@/lib/subscription';

// ─── GET /api/subscription/status ─────

export async function GET() {
  const auth = await validateAuth({ skipSubscriptionCheck: true });
  if ('error' in auth) return auth.error;

  const subscription = await getUserSubscription(auth.user.id);
  const check = await checkSubscription(auth.user.id);

  return NextResponse.json({
    subscription: subscription ? {
      planId: subscription.planId,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      createdAt: subscription.createdAt,
    } : null,
    access: {
      allowed: check.allowed,
      plan: check.plan,
      reason: check.reason,
      upgradeUrl: check.upgradeUrl,
    },
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      features: p.features,
    })),
  });
}

// ─── POST /api/subscription/status ────

export async function POST(request: Request) {
  const auth = await validateAuth({ skipSubscriptionCheck: true });
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const { action, planId, orderId } = body as {
      action: 'activate' | 'trial' | 'cancel';
      planId?: PlanId;
      orderId?: string;
    };

    switch (action) {
      case 'activate': {
        if (!planId || !PLANS[planId]) {
          return NextResponse.json(
            { error: 'Invalid plan ID. Must be starter, pro, or agency.' },
            { status: 400 }
          );
        }
        if (planId === 'starter') {
          return NextResponse.json(
            { error: 'Starter plan is free — no activation needed.' },
            { status: 400 }
          );
        }

        const result = await createSubscription(auth.user.id, planId, orderId);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, planId });
      }

      case 'trial': {
        if (!planId || !PLANS[planId] || planId === 'starter') {
          return NextResponse.json(
            { error: 'Invalid plan ID for trial. Must be pro or agency.' },
            { status: 400 }
          );
        }

        const result = await startTrial(auth.user.id, planId);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, planId, trialDuration: '14 days' });
      }

      case 'cancel': {
        const result = await cancelSubscription(auth.user.id);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be activate, trial, or cancel.' },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid request body' },
      { status: 400 }
    );
  }
}
