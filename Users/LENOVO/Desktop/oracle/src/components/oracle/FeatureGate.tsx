'use client';

// ═══════════════════════════════════════
// ORACLE — Feature Gate Component
// Restricts UI elements by subscription tier
// ═══════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import type { PlanId } from '@/lib/subscription';

// ─── Subscription State (reactive via hooks) ───

interface SubscriptionState {
  plan: PlanId;
  isValid: boolean;
  loading: boolean;
}

let _state: SubscriptionState = { plan: 'starter', isValid: true, loading: true };
let _listeners: Array<() => void> = [];

/** Update global subscription state and notify all subscribers */
export function setSubscriptionState(state: SubscriptionState) {
  _state = state;
  _listeners.forEach((l) => l());
}

/** React hook — subscribe to subscription state changes */
export function useSubscriptionState(): SubscriptionState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const unsub = onSubscriptionChange(() => forceRender((n) => n + 1));
    return unsub;
  }, []);

  return _state;
}

function onSubscriptionChange(listener: () => void): () => void {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}

// ─── Tier Badge ────────────────────────

const TIER_COLORS: Record<PlanId, { bg: string; text: string; border: string }> = {
  starter: { bg: 'var(--oracle-surface-2)', text: 'var(--oracle-text-muted)', border: 'var(--oracle-border)' },
  pro: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  agency: { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
};

export function TierBadge({ plan, compact = false }: { plan: PlanId; compact?: boolean }) {
  const colors = TIER_COLORS[plan];
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {plan === 'starter' ? 'Free' : plan === 'pro' ? 'Pro' : 'Agency'}
    </span>
  );
}

// ─── Plan Hierarchy ───────────────────

const PLAN_HIERARCHY: PlanId[] = ['starter', 'pro', 'agency'];

function planMeetsRequired(current: PlanId, required: PlanId): boolean {
  return PLAN_HIERARCHY.indexOf(current) >= PLAN_HIERARCHY.indexOf(required);
}

// ─── Required Plan Mappings ───────────

const AGENT_REQUIRED_PLAN: Record<string, PlanId> = {
  orchestrator: 'starter',
  researcher: 'starter',
  writer: 'starter',
  analyst: 'starter',
  developer: 'pro',
  strategist: 'pro',
  marketer: 'pro',
  designer: 'pro',
  finance: 'pro',
  qa: 'pro',
  voice: 'agency',
  coordinator: 'agency',
  workflow: 'agency',
};

const FEATURE_REQUIRED_PLAN: Record<string, PlanId> = {
  webSearch: 'pro',
  clientMemory: 'pro',
  ragSearch: 'pro',
  qualityScoring: 'pro',
  proposals: 'pro',
  invoices: 'pro',
  multiAgent: 'pro',
  workflows: 'agency',
  voiceAgent: 'agency',
  apiAccess: 'agency',
};

// ─── FeatureGate Wrapper ───────────────

interface FeatureGateProps {
  feature?: string;
  agentType?: string;
  requiredPlan?: PlanId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showDisabled?: boolean;
}

export function FeatureGate({
  feature,
  agentType,
  requiredPlan,
  children,
  fallback = null,
  showDisabled = false,
}: FeatureGateProps) {
  const { plan } = useSubscriptionState();

  let minPlan: PlanId = 'starter';
  if (requiredPlan) minPlan = requiredPlan;
  else if (agentType) minPlan = AGENT_REQUIRED_PLAN[agentType] || 'starter';
  else if (feature) minPlan = FEATURE_REQUIRED_PLAN[feature] || 'starter';

  if (planMeetsRequired(plan, minPlan)) {
    return <>{children}</>;
  }

  if (showDisabled) {
    return (
      <div className="relative opacity-50 pointer-events-none" title={`Requires ${minPlan} plan`}>
        {children}
        <div className="absolute inset-0 flex items-center justify-center">
          <TierBadge plan={minPlan} compact />
        </div>
      </div>
    );
  }

  return <>{fallback}</>;
}

// ─── Upgrade Prompt ────────────────────

export function UpgradePrompt({
  requiredPlan,
  feature,
  compact = false,
}: {
  requiredPlan?: PlanId;
  feature?: string;
  compact?: boolean;
}) {
  const { plan } = useSubscriptionState();
  const minPlan = requiredPlan || 'pro';
  const planLabels: Record<PlanId, string> = { starter: 'Starter (Free)', pro: 'Pro (₹2,999/mo)', agency: 'Agency (₹9,999/mo)' };

  if (compact) {
    return (
      <a
        href="/pricing"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--oracle-primary)] hover:bg-[var(--oracle-surface-2)] transition-colors"
      >
        🔒 Upgrade to {minPlan === 'agency' ? 'Agency' : 'Pro'}
      </a>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--oracle-border)] bg-[var(--oracle-surface)] p-6 text-center">
      <div className="text-2xl">🔒</div>
      <p className="text-sm font-medium text-[var(--oracle-text-1)]">
        {feature ? `${feature} requires` : 'This feature requires'} the {planLabels[minPlan]} plan
      </p>
      <p className="text-xs text-[var(--oracle-text-muted)]">
        You are currently on the {planLabels[plan]} plan.
      </p>
      <a
        href="/pricing"
        className="rounded-lg bg-[var(--oracle-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
      >
        View Plans
      </a>
    </div>
  );
}

// ─── Usage Indicator ───────────────────

export function DailyUsageIndicator({
  used,
  limit,
}: {
  used: number;
  limit: number;
}) {
  if (limit === -1) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--oracle-text-muted)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--oracle-success)]" />
        Unlimited
      </div>
    );
  }

  const percentage = Math.min(100, (used / limit) * 100);
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 100;

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--oracle-surface-2)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: isCritical
              ? 'var(--oracle-error)'
              : isWarning
                ? 'var(--oracle-warning)'
                : 'var(--oracle-success)',
          }}
        />
      </div>
      <span className={isCritical ? 'text-[var(--oracle-error)]' : 'text-[var(--oracle-text-muted)]'}>
        {used}/{limit}
      </span>
    </div>
  );
}

// ─── Helper: check if an agent is allowed ──

export function isAgentAllowed(agentType: string): boolean {
  const { plan } = _state;
  return planMeetsRequired(plan, AGENT_REQUIRED_PLAN[agentType] || 'starter');
}

/** Get the required plan for a given agent type */
export function getRequiredPlanForAgent(agentType: string): PlanId {
  return AGENT_REQUIRED_PLAN[agentType] || 'starter';
}

/** Get the required plan for a given feature */
export function getRequiredPlanForFeature(feature: string): PlanId {
  return FEATURE_REQUIRED_PLAN[feature] || 'starter';
}

// ─── Tier Benefits (for tooltip display) ────

export const TIER_BENEFITS: Record<PlanId, { name: string; price: string; benefits: string[] }> = {
  starter: {
    name: 'Starter (Free)',
    price: '₹0/mo',
    benefits: ['50 AI responses/day', '5 service domains', '10 curated prompts', 'Basic quality scoring'],
  },
  pro: {
    name: 'Pro',
    price: '₹2,999/mo',
    benefits: ['Unlimited AI responses', 'All 40+ service domains', 'All 55+ expert prompts', 'Per-client memory & RAG', 'Web search', 'Quality scoring & analytics', 'Proposals & invoicing', '10 AI agents'],
  },
  agency: {
    name: 'Agency',
    price: '₹9,999/mo',
    benefits: ['Everything in Pro', '5 team seats', 'Multi-client management', 'Custom prompt library', 'White-label proposals', 'Voice agents', 'Workflow automation', 'API access', 'All 13 AI agents'],
  },
};

// ─── Tier Tooltip ──────────────────────

export function TierTooltip({ requiredPlan, children }: { requiredPlan: PlanId; children: React.ReactNode }) {
  const benefits = TIER_BENEFITS[requiredPlan];
  if (!benefits) return <>{children}</>;

  return (
    <div className="group/tooltip relative inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 pointer-events-none">
        <div className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <TierBadge plan={requiredPlan} />
            <span className="text-[11px] font-medium text-[var(--oracle-text-muted)]">{benefits.price}</span>
          </div>
          <ul className="space-y-1">
            {benefits.benefits.slice(0, 4).map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] text-[var(--oracle-text-3)]">
                <span className="text-[var(--oracle-success)] mt-0.5">✓</span>
                {b}
              </li>
            ))}
          </ul>
          {benefits.benefits.length > 4 && (
            <p className="mt-1.5 text-[9px] text-[var(--oracle-text-muted)]">+ {benefits.benefits.length - 4} more features</p>
          )}
          <a
            href="/pricing"
            className="mt-2 block w-full rounded-lg bg-[var(--oracle-primary)] py-1.5 text-center text-[10px] font-semibold text-white hover:opacity-90 transition-opacity pointer-events-auto"
          >
            Upgrade to {requiredPlan === 'agency' ? 'Agency' : 'Pro'}
          </a>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--oracle-bg)] border-r border-b border-[var(--oracle-border)] -mt-1" />
      </div>
    </div>
  );
}
