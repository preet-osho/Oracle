import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  FeatureGate,
  UpgradePrompt,
  UpgradeModal,
  TierBadge,
  TierTooltip,
  DailyUsageIndicator,
  useSubscriptionState,
  setSubscriptionState,
  getRequiredPlanForAgent,
  getRequiredPlanForFeature,
  isAgentAllowed,
  TIER_BENEFITS,
} from './FeatureGate';

// ─── Mock Dialog (radix portal) ───
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

// ─── Tests ───

describe('FeatureGate', () => {
  const originalState = { plan: 'starter' as const, isValid: true, loading: false };

  beforeEach(() => {
    setSubscriptionState({ plan: 'starter', isValid: true, loading: false });
  });

  afterEach(() => {
    setSubscriptionState(originalState);
  });

  // ── FeatureGate Component ──

  describe('FeatureGate component', () => {
    it('renders children when plan meets required plan', () => {
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      render(
        <FeatureGate requiredPlan="pro">
          <div>Premium Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Premium Content')).toBeDefined();
    });

    it('shows fallback when plan does not meet required plan', () => {
      render(
        <FeatureGate requiredPlan="pro" fallback={<div>Upgrade Required</div>}>
          <div>Premium Content</div>
        </FeatureGate>
      );
      expect(screen.queryByText('Premium Content')).toBeNull();
      expect(screen.getByText('Upgrade Required')).toBeDefined();
    });

    it('renders children for agency plan when required is pro', () => {
      setSubscriptionState({ plan: 'agency', isValid: true, loading: false });
      render(
        <FeatureGate requiredPlan="pro">
          <div>Pro Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Pro Content')).toBeDefined();
    });

    it('resolves required plan from feature name', () => {
      // proposals requires pro — starter should see fallback
      render(
        <FeatureGate feature="proposals" fallback={<div>No Proposals</div>}>
          <div>Proposal Generator</div>
        </FeatureGate>
      );
      expect(screen.queryByText('Proposal Generator')).toBeNull();
      expect(screen.getByText('No Proposals')).toBeDefined();
    });

    it('resolves required plan from agent type', () => {
      // voice requires agency — pro user should see fallback
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      render(
        <FeatureGate agentType="voice" fallback={<div>Voice Locked</div>}>
          <div>Voice Agent</div>
        </FeatureGate>
      );
      expect(screen.queryByText('Voice Agent')).toBeNull();
      expect(screen.getByText('Voice Locked')).toBeDefined();
    });

    it('renders children for pro user accessing pro-level agent', () => {
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      render(
        <FeatureGate agentType="developer">
          <div>Developer Agent</div>
        </FeatureGate>
      );
      expect(screen.getByText('Developer Agent')).toBeDefined();
    });

    it('shows null fallback by default when plan is insufficient', () => {
      const { container } = render(
        <FeatureGate requiredPlan="agency">
          <div>Agency Only</div>
        </FeatureGate>
      );
      expect(screen.queryByText('Agency Only')).toBeNull();
      // Default fallback is null — container should have no meaningful content
      expect(container.innerHTML).not.toContain('Agency Only');
    });

    // ── showDisabled mode ──

    it('renders children with disabled overlay in showDisabled mode', () => {
      render(
        <FeatureGate requiredPlan="pro" showDisabled>
          <div>Locked Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Locked Content')).toBeDefined();
      expect(screen.getByText('Pro')).toBeDefined(); // TierBadge in overlay
    });

    it('showDisabled overlay has opacity and pointer-events-none', () => {
      render(
        <FeatureGate requiredPlan="pro" showDisabled>
          <div>Locked</div>
        </FeatureGate>
      );
      const overlay = screen.getByText('Locked').closest('div[title]');
      expect(overlay).toBeDefined();
      expect(overlay?.getAttribute('title')).toBe('Requires pro plan');
    });

    it('showDisabled shows children when plan meets requirement', () => {
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      render(
        <FeatureGate requiredPlan="pro" showDisabled>
          <div>Unlocked Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Unlocked Content')).toBeDefined();
      // No overlay TierBadge since plan meets requirement
      expect(screen.queryByText('Pro')).toBeNull();
    });

    // ── Plan hierarchy edge cases ──

    it('starter plan does NOT meet pro requirement', () => {
      render(
        <FeatureGate requiredPlan="pro" fallback={<div>Blocked</div>}>
          <div>Pro Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Blocked')).toBeDefined();
    });

    it('pro plan meets agency requirement? No', () => {
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      render(
        <FeatureGate requiredPlan="agency" fallback={<div>Agency Only</div>}>
          <div>Agency Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Agency Only')).toBeDefined();
    });

    it('agency plan meets pro requirement', () => {
      setSubscriptionState({ plan: 'agency', isValid: true, loading: false });
      render(
        <FeatureGate requiredPlan="pro">
          <div>Pro Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Pro Content')).toBeDefined();
    });
  });

  // ── UpgradePrompt ──

  describe('UpgradePrompt', () => {
    it('renders lock icon and feature text', () => {
      render(<UpgradePrompt requiredPlan="pro" feature="Web Search" />);
      expect(screen.getByText('🔒')).toBeDefined();
      expect(screen.getByText(/Web Search requires/)).toBeDefined();
    });

    it('shows current plan name', () => {
      render(<UpgradePrompt requiredPlan="pro" />);
      expect(screen.getByText(/You are currently on the Starter/)).toBeDefined();
    });

    it('shows View Plans link to /pricing', () => {
      render(<UpgradePrompt requiredPlan="pro" />);
      const link = screen.getByText('View Plans');
      expect(link.getAttribute('href')).toBe('/pricing');
    });

    it('shows "requires" text without feature name', () => {
      render(<UpgradePrompt requiredPlan="agency" />);
      expect(screen.getByText(/This feature requires/)).toBeDefined();
      expect(screen.getByText(/Agency/)).toBeDefined();
    });

    // ── Compact mode ──

    it('renders compact mode with upgrade link', () => {
      render(<UpgradePrompt requiredPlan="pro" compact />);
      const link = screen.getByText(/🔒 Upgrade to Pro/);
      expect(link).toBeDefined();
      expect(link.getAttribute('href')).toBe('/pricing');
    });

    it('compact mode shows "Agency" for agency plan', () => {
      render(<UpgradePrompt requiredPlan="agency" compact />);
      expect(screen.getByText(/🔒 Upgrade to Agency/)).toBeDefined();
    });
  });

  // ── TierBadge ──

  describe('TierBadge', () => {
    it('shows "Free" for starter plan', () => {
      render(<TierBadge plan="starter" />);
      expect(screen.getByText('Free')).toBeDefined();
    });

    it('shows "Pro" for pro plan', () => {
      render(<TierBadge plan="pro" />);
      expect(screen.getByText('Pro')).toBeDefined();
    });

    it('shows "Agency" for agency plan', () => {
      render(<TierBadge plan="agency" />);
      expect(screen.getByText('Agency')).toBeDefined();
    });

    it('renders compact variant', () => {
      const { container } = render(<TierBadge plan="pro" compact />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('px-1.5');
    });

    it('renders default (non-compact) variant', () => {
      const { container } = render(<TierBadge plan="pro" />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('px-2');
    });
  });

  // ── DailyUsageIndicator ──

  describe('DailyUsageIndicator', () => {
    it('shows "Unlimited" when limit is -1', () => {
      render(<DailyUsageIndicator used={50} limit={-1} />);
      expect(screen.getByText('Unlimited')).toBeDefined();
    });

    it('shows usage count', () => {
      render(<DailyUsageIndicator used={25} limit={50} />);
      expect(screen.getByText('25/50')).toBeDefined();
    });

    it('shows usage at 100% (critical)', () => {
      render(<DailyUsageIndicator used={50} limit={50} />);
      expect(screen.getByText('50/50')).toBeDefined();
    });

    it('shows usage at 80% (warning)', () => {
      render(<DailyUsageIndicator used={40} limit={50} />);
      expect(screen.getByText('40/50')).toBeDefined();
    });

    it('shows normal usage under 80%', () => {
      render(<DailyUsageIndicator used={10} limit={50} />);
      expect(screen.getByText('10/50')).toBeDefined();
    });
  });

  // ── TierTooltip ──

  describe('TierTooltip', () => {
    it('renders children', () => {
      render(
        <TierTooltip requiredPlan="pro">
          <span>Hover me</span>
        </TierTooltip>
      );
      expect(screen.getByText('Hover me')).toBeDefined();
    });

    it('shows plan name and price in tooltip', () => {
      render(
        <TierTooltip requiredPlan="pro">
          <span>Hover me</span>
        </TierTooltip>
      );
      expect(screen.getByText('Pro')).toBeDefined();
      expect(screen.getByText('₹2,999/mo')).toBeDefined();
    });

    it('shows benefits list', () => {
      render(
        <TierTooltip requiredPlan="pro">
          <span>Hover me</span>
        </TierTooltip>
      );
      expect(screen.getByText('Unlimited AI responses')).toBeDefined();
      expect(screen.getByText('All 40+ service domains')).toBeDefined();
    });

    it('shows "more features" text when > 4 benefits', () => {
      render(
        <TierTooltip requiredPlan="agency">
          <span>Hover me</span>
        </TierTooltip>
      );
      // Agency has 9 benefits, so 5 more after showing 4
      expect(screen.getByText(/\+ \d+ more features/)).toBeDefined();
    });

    it('shows upgrade link in tooltip', () => {
      render(
        <TierTooltip requiredPlan="pro">
          <span>Hover me</span>
        </TierTooltip>
      );
      const upgradeLink = screen.getByText(/Upgrade to Pro/);
      expect(upgradeLink.getAttribute('href')).toBe('/pricing');
    });
  });

  // ── UpgradeModal ──

  describe('UpgradeModal', () => {
    it('renders when open', () => {
      render(
        <UpgradeModal open={true} onOpenChange={vi.fn()} requiredPlan="pro" />
      );
      expect(screen.getByText(/Upgrade to Pro/)).toBeDefined();
      expect(screen.getByText('View Plans')).toBeDefined();
    });

    it('does NOT render when closed', () => {
      render(
        <UpgradeModal open={false} onOpenChange={vi.fn()} requiredPlan="pro" />
      );
      expect(screen.queryByText(/Upgrade to Pro/)).toBeNull();
    });

    it('shows agent label when provided', () => {
      render(
        <UpgradeModal
          open={true}
          onOpenChange={vi.fn()}
          requiredPlan="pro"
          agentLabel="Developer"
        />
      );
      // The <strong> tag breaks the text across elements, so check for the label and "requires" separately
      expect(screen.getByText('Developer')).toBeDefined();
      expect(screen.getByText(/agent requires/)).toBeDefined();
    });

    it('shows feature label when provided', () => {
      render(
        <UpgradeModal
          open={true}
          onOpenChange={vi.fn()}
          requiredPlan="pro"
          featureLabel="Proposals"
        />
      );
      // The <strong> tag breaks the text across elements, so check for the label and "requires" separately
      expect(screen.getByText('Proposals')).toBeDefined();
      expect(screen.getByText(/requires the/)).toBeDefined();
    });

    it('shows generic message when no labels provided', () => {
      render(
        <UpgradeModal open={true} onOpenChange={vi.fn()} requiredPlan="pro" />
      );
      expect(screen.getByText(/This feature requires/)).toBeDefined();
    });

    it('shows current plan badge', () => {
      render(
        <UpgradeModal open={true} onOpenChange={vi.fn()} requiredPlan="pro" />
      );
      expect(screen.getByText('Free')).toBeDefined(); // starter plan badge
    });

    it('shows required plan benefits', () => {
      render(
        <UpgradeModal open={true} onOpenChange={vi.fn()} requiredPlan="pro" />
      );
      expect(screen.getByText('Unlimited AI responses')).toBeDefined();
      expect(screen.getByText('₹2,999/mo')).toBeDefined();
    });

    it('View Plans link points to /pricing', () => {
      render(
        <UpgradeModal open={true} onOpenChange={vi.fn()} requiredPlan="pro" />
      );
      const link = screen.getByText('View Plans');
      expect(link.getAttribute('href')).toBe('/pricing');
    });

    it('Maybe Later button calls onOpenChange(false)', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(
        <UpgradeModal open={true} onOpenChange={onClose} requiredPlan="pro" />
      );
      await user.click(screen.getByText('Maybe Later'));
      expect(onClose).toHaveBeenCalledWith(false);
    });

    it('shows "Agency" for agency required plan', () => {
      render(
        <UpgradeModal open={true} onOpenChange={vi.fn()} requiredPlan="agency" />
      );
      expect(screen.getByText(/Upgrade to Agency/)).toBeDefined();
      expect(screen.getByText('₹9,999/mo')).toBeDefined();
    });
  });

  // ── Helper Functions ──

  describe('getRequiredPlanForAgent', () => {
    it('returns starter for core agents', () => {
      expect(getRequiredPlanForAgent('orchestrator')).toBe('starter');
      expect(getRequiredPlanForAgent('researcher')).toBe('starter');
      expect(getRequiredPlanForAgent('writer')).toBe('starter');
      expect(getRequiredPlanForAgent('analyst')).toBe('starter');
    });

    it('returns pro for pro-level agents', () => {
      expect(getRequiredPlanForAgent('developer')).toBe('pro');
      expect(getRequiredPlanForAgent('strategist')).toBe('pro');
      expect(getRequiredPlanForAgent('marketer')).toBe('pro');
      expect(getRequiredPlanForAgent('designer')).toBe('pro');
      expect(getRequiredPlanForAgent('finance')).toBe('pro');
      expect(getRequiredPlanForAgent('qa')).toBe('pro');
    });

    it('returns agency for agency-level agents', () => {
      expect(getRequiredPlanForAgent('voice')).toBe('agency');
      expect(getRequiredPlanForAgent('coordinator')).toBe('agency');
      expect(getRequiredPlanForAgent('workflow')).toBe('agency');
    });

    it('returns starter for unknown agents', () => {
      expect(getRequiredPlanForAgent('unknown-agent')).toBe('starter');
    });
  });

  describe('getRequiredPlanForFeature', () => {
    it('returns pro for pro features', () => {
      expect(getRequiredPlanForFeature('webSearch')).toBe('pro');
      expect(getRequiredPlanForFeature('clientMemory')).toBe('pro');
      expect(getRequiredPlanForFeature('proposals')).toBe('pro');
      expect(getRequiredPlanForFeature('invoices')).toBe('pro');
    });

    it('returns agency for agency features', () => {
      expect(getRequiredPlanForFeature('workflows')).toBe('agency');
      expect(getRequiredPlanForFeature('voiceAgent')).toBe('agency');
      expect(getRequiredPlanForFeature('apiAccess')).toBe('agency');
    });

    it('returns starter for unknown features', () => {
      expect(getRequiredPlanForFeature('unknown-feature')).toBe('starter');
    });
  });

  describe('isAgentAllowed', () => {
    it('allows core agents for starter plan', () => {
      setSubscriptionState({ plan: 'starter', isValid: true, loading: false });
      expect(isAgentAllowed('orchestrator')).toBe(true);
      expect(isAgentAllowed('researcher')).toBe(true);
    });

    it('denies pro agents for starter plan', () => {
      setSubscriptionState({ plan: 'starter', isValid: true, loading: false });
      expect(isAgentAllowed('developer')).toBe(false);
    });

    it('allows pro agents for pro plan', () => {
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      expect(isAgentAllowed('developer')).toBe(true);
    });

    it('denies agency agents for pro plan', () => {
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      expect(isAgentAllowed('voice')).toBe(false);
    });

    it('allows all agents for agency plan', () => {
      setSubscriptionState({ plan: 'agency', isValid: true, loading: false });
      expect(isAgentAllowed('orchestrator')).toBe(true);
      expect(isAgentAllowed('developer')).toBe(true);
      expect(isAgentAllowed('voice')).toBe(true);
    });
  });

  // ── TIER_BENEFITS ──

  describe('TIER_BENEFITS', () => {
    it('has benefits for all plans', () => {
      expect(TIER_BENEFITS.starter).toBeDefined();
      expect(TIER_BENEFITS.pro).toBeDefined();
      expect(TIER_BENEFITS.agency).toBeDefined();
    });

    it('starter is free', () => {
      expect(TIER_BENEFITS.starter.price).toBe('₹0/mo');
    });

    it('pro has more benefits than starter', () => {
      expect(TIER_BENEFITS.pro.benefits.length).toBeGreaterThan(TIER_BENEFITS.starter.benefits.length);
    });

    it('agency has more benefits than pro', () => {
      expect(TIER_BENEFITS.agency.benefits.length).toBeGreaterThanOrEqual(TIER_BENEFITS.pro.benefits.length);
    });
  });

  // ── Edge Cases ──

  describe('edge cases', () => {
    it('last setSubscriptionState call wins (sequential updates)', () => {
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      setSubscriptionState({ plan: 'agency', isValid: true, loading: false });
      render(
        <FeatureGate requiredPlan="agency">
          <div>Agency Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Agency Content')).toBeDefined();
    });

    it('requiredPlan takes precedence over feature name', () => {
      // feature='webSearch' requires pro, but requiredPlan='agency' overrides
      setSubscriptionState({ plan: 'pro', isValid: true, loading: false });
      render(
        <FeatureGate feature="webSearch" requiredPlan="agency" fallback={<div>Blocked</div>}>
          <div>Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Blocked')).toBeDefined();
    });

    it('requiredPlan takes precedence over agentType', () => {
      // agentType='orchestrator' requires starter, but requiredPlan='agency' overrides
      render(
        <FeatureGate agentType="orchestrator" requiredPlan="agency" fallback={<div>Blocked</div>}>
          <div>Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Blocked')).toBeDefined();
    });

    it('unknown feature name defaults to starter requirement', () => {
      render(
        <FeatureGate feature="nonexistent-feature">
          <div>Always Allowed</div>
        </FeatureGate>
      );
      expect(screen.getByText('Always Allowed')).toBeDefined();
    });

    it('unknown agent type defaults to starter requirement', () => {
      render(
        <FeatureGate agentType="nonexistent-agent">
          <div>Always Allowed</div>
        </FeatureGate>
      );
      expect(screen.getByText('Always Allowed')).toBeDefined();
    });

    it('UpgradeModal returns null for unknown plan', () => {
      const { container } = render(
        <UpgradeModal open={true} onOpenChange={vi.fn()} requiredPlan={'typo' as never} />
      );
      expect(container.innerHTML).not.toContain('Upgrade');
    });

    it('TierTooltip renders children only for unknown plan', () => {
      render(
        <TierTooltip requiredPlan={'typo' as never}>
          <span>Fallback Content</span>
        </TierTooltip>
      );
      expect(screen.getByText('Fallback Content')).toBeDefined();
      // No tooltip content should appear
      expect(screen.queryByText('Upgrade to')).toBeNull();
    });

    it('DailyUsageIndicator at exactly 80% boundary shows warning', () => {
      render(<DailyUsageIndicator used={40} limit={50} />);
      expect(screen.getByText('40/50')).toBeDefined();
    });

    it('DailyUsageIndicator with 0 used shows normal state', () => {
      render(<DailyUsageIndicator used={0} limit={50} />);
      expect(screen.getByText('0/50')).toBeDefined();
    });

    it('DailyUsageIndicator with used > limit shows critical', () => {
      render(<DailyUsageIndicator used={60} limit={50} />);
      expect(screen.getByText('60/50')).toBeDefined();
    });

    it('agentType takes precedence over feature name', () => {
      // precedence is: requiredPlan > agentType > feature
      // agentType='orchestrator' requires starter, feature='webSearch' requires pro
      // orchestrator wins → starter plan can access it
      render(
        <FeatureGate agentType="orchestrator" feature="webSearch">
          <div>Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Content')).toBeDefined();
    });

    it('getRequiredPlanForAgent is case-sensitive', () => {
      expect(getRequiredPlanForAgent('Developer')).toBe('starter'); // unknown
      expect(getRequiredPlanForAgent('developer')).toBe('pro'); // known
    });

    it('getRequiredPlanForFeature is case-sensitive', () => {
      expect(getRequiredPlanForFeature('WebSearch')).toBe('starter'); // unknown
      expect(getRequiredPlanForFeature('webSearch')).toBe('pro'); // known
    });

    it('isAgentAllowed returns true for unknown agents on any plan', () => {
      setSubscriptionState({ plan: 'starter', isValid: true, loading: false });
      expect(isAgentAllowed('nonexistent')).toBe(true);
    });

    it('showDisabled does not affect children rendering when plan meets requirement', () => {
      setSubscriptionState({ plan: 'agency', isValid: true, loading: false });
      render(
        <FeatureGate requiredPlan="pro" showDisabled>
          <div>Accessible Content</div>
        </FeatureGate>
      );
      expect(screen.getByText('Accessible Content')).toBeDefined();
      expect(screen.queryByText('Pro')).toBeNull(); // No overlay badge
    });
  });
});
