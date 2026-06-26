import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { PlanId } from '@/lib/subscription';
import type { AgentType } from './agent-config';

// ─── Mocks ───

let mockPlan: PlanId = 'starter';

vi.mock('./FeatureGate', () => ({
  useSubscriptionState: () => ({ plan: mockPlan, isValid: true, loading: false }),
  TierBadge: ({ plan, compact }: { plan: PlanId; compact?: boolean }) => (
    <span data-testid={`tier-badge-${plan}`}>{plan}</span>
  ),
  getRequiredPlanForAgent: (agentType: string) => {
    const map: Record<string, PlanId> = {
      orchestrator: 'starter', researcher: 'starter', writer: 'starter', analyst: 'starter',
      developer: 'pro', strategist: 'pro', marketer: 'pro', designer: 'pro', finance: 'pro', qa: 'pro',
      voice: 'agency', coordinator: 'agency', workflow: 'agency',
    };
    return map[agentType] || 'pro';
  },
  TierTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UpgradeModal: ({ open, onOpenChange, requiredPlan, agentLabel }: {
    open: boolean; onOpenChange: (open: boolean) => void; requiredPlan: PlanId; agentLabel?: string;
  }) => (
    open ? (
      <div data-testid="upgrade-modal">
        <span>Upgrade Modal: {agentLabel} - {requiredPlan}</span>
        <a href="/pricing" data-testid="view-plans-link">View Plans</a>
        <button onClick={() => onOpenChange(false)}>Maybe Later</button>
      </div>
    ) : null
  ),
}));

vi.mock('@/lib/subscription', () => ({
  hasAgentAccess: (plan: PlanId, agentType: string) => {
    const hierarchy: PlanId[] = ['starter', 'pro', 'agency'];
    const requiredPlanMap: Record<string, PlanId> = {
      orchestrator: 'starter', researcher: 'starter', writer: 'starter', analyst: 'starter',
      developer: 'pro', strategist: 'pro', marketer: 'pro', designer: 'pro', finance: 'pro', qa: 'pro',
      voice: 'agency', coordinator: 'agency', workflow: 'agency',
    };
    const required = requiredPlanMap[agentType] || 'starter';
    return hierarchy.indexOf(plan) >= hierarchy.indexOf(required);
  },
}));

vi.mock('./agent-config', () => ({
  AGENT_TYPES: [
    { id: 'orchestrator', label: 'Orchestrator', emoji: '🧠', description: 'Multi-agent orchestrator', group: 'Core' },
    { id: 'researcher', label: 'Researcher', emoji: '🔍', description: 'Deep research', group: 'Core' },
    { id: 'developer', label: 'Developer', emoji: '💻', description: 'Code generation', group: 'Specialist' },
    { id: 'voice', label: 'Voice', emoji: '🎙', description: 'Voice agent', group: 'Specialist' },
  ],
  AGENT_GROUPS: ['Core', 'Specialist'],
  PROJECT_STATUS_COLORS: { Active: '#00ff00' },
}));

vi.mock('@/styles/design-tokens', () => ({
  transitions: { smooth: {}, snappy: {} },
  buttonTapProps: {},
}));

// ─── Import after mocks ───
import { ChatHeader } from './ChatHeader';

const defaultProps = {
  title: 'Test Chat',
  agentType: 'orchestrator' as AgentType,
  projects: [],
  selectedProjectId: null,
  showAgentSelector: false,
  showConversationList: false,
  showProjectSelector: false,
  conversations: [],
  onToggleAgentSelector: vi.fn(),
  onToggleConversationList: vi.fn(),
  onToggleProjectSelector: vi.fn(),
  onSelectAgent: vi.fn(),
  onSelectProject: vi.fn(),
  onSelectConversation: vi.fn(),
  onExportPDF: vi.fn(),
  onExportWord: vi.fn(),
  messageCount: 0,
  onNewChat: vi.fn(),
  onDeleteConversation: vi.fn(),
};

// ─── Tests ───

describe('ChatHeader feature gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlan = 'starter';
  });

  it('renders agent selector button', () => {
    render(<ChatHeader {...defaultProps} />);
    expect(screen.getByLabelText('Select agent type')).toBeDefined();
  });

  it('core agents are selectable for starter users', () => {
    const onSelectAgent = vi.fn();
    render(<ChatHeader {...defaultProps} showAgentSelector={true} onSelectAgent={onSelectAgent} />);
    // Use 'Researcher' instead of 'Orchestrator' to avoid duplicate text (header label + dropdown)
    const researcherBtn = screen.getByText('Researcher').closest('button')!;
    fireEvent.click(researcherBtn);
    expect(onSelectAgent).toHaveBeenCalledWith('researcher');
  });

  it('locked agents show lock icon for starter users', () => {
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);
    const lockIcons = screen.getAllByText('🔒');
    expect(lockIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('locked agents have aria-disabled for starter users', () => {
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);
    const disabledButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-disabled') === 'true'
    );
    expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking a locked agent opens the upgrade modal', () => {
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);
    const developerBtn = screen.getByText('Developer').closest('button')!;
    fireEvent.click(developerBtn);
    const modal = screen.getByTestId('upgrade-modal');
    expect(modal).toBeDefined();
    expect(modal.textContent).toContain('Developer');
    expect(modal.textContent).toContain('pro');
  });

  it('clicking a locked agency agent opens upgrade modal with agency plan', () => {
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);
    const voiceBtn = screen.getByText('Voice').closest('button')!;
    fireEvent.click(voiceBtn);
    const modal = screen.getByTestId('upgrade-modal');
    expect(modal).toBeDefined();
    expect(modal.textContent).toContain('Voice');
    expect(modal.textContent).toContain('agency');
  });

  it('no lock icons on pro-level agents for pro users', () => {
    mockPlan = 'pro';
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);
    // Pro users can access all core + pro agents, only agency agents show lock
    // Verify developer (pro-level) has no lock icon
    const developerBtn = screen.getByText('Developer').closest('button')!;
    expect(developerBtn.textContent).not.toContain('🔒');
    // There should be fewer lock icons than total agents (agency agents still locked)
    const allLockIcons = screen.getAllByText('🔒');
    const totalAgents = screen.getAllByRole('button').filter(btn => btn.getAttribute('aria-disabled') !== null).length;
    expect(allLockIcons.length).toBeLessThan(totalAgents);
  });

  it('agency agents show lock for pro users', () => {
    mockPlan = 'pro';
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);
    const lockIcons = screen.getAllByText('🔒');
    expect(lockIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('all agents selectable for agency users', () => {
    mockPlan = 'agency';
    const onSelectAgent = vi.fn();
    render(<ChatHeader {...defaultProps} showAgentSelector={true} onSelectAgent={onSelectAgent} />);
    // Find all buttons containing 'Voice' — click the one in the dropdown (not the header)
    const voiceButtons = screen.getAllByText('Voice').map(el => el.closest('button')).filter(Boolean);
    const dropdownBtn = voiceButtons.find(btn => btn!.getAttribute('aria-disabled') !== null) || voiceButtons[0];
    fireEvent.click(dropdownBtn!);
    expect(onSelectAgent).toHaveBeenCalledWith('voice');
    expect(screen.queryByTestId('upgrade-modal')).toBeNull();
  });

  it('upgrade modal can be closed', () => {
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);
    const developerBtn = screen.getByText('Developer').closest('button')!;
    fireEvent.click(developerBtn);
    expect(screen.getByTestId('upgrade-modal')).toBeDefined();
    fireEvent.click(screen.getByText('Maybe Later'));
    expect(screen.queryByTestId('upgrade-modal')).toBeNull();
  });

  it('e2e: starter clicks locked agent → sees upgrade modal → clicks View Plans → redirects to /pricing', () => {
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);

    // Step 1: starter user opens agent selector (passed via props)
    expect(screen.getByLabelText('Select agent type')).toBeDefined();

    // Step 2: starter user sees locked agents with lock icons
    const lockIcons = screen.getAllByText('🔒');
    expect(lockIcons.length).toBeGreaterThanOrEqual(1);

    // Step 3: starter user clicks a locked agent (Developer requires pro)
    const developerBtn = screen.getByText('Developer').closest('button')!;
    expect(developerBtn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(developerBtn);

    // Step 4: upgrade modal appears with correct info
    const modal = screen.getByTestId('upgrade-modal');
    expect(modal).toBeDefined();
    expect(modal.textContent).toContain('Developer');
    expect(modal.textContent).toContain('pro');

    // Step 5: modal shows 'View Plans' link that points to /pricing
    const viewPlansLink = screen.getByTestId('view-plans-link');
    expect(viewPlansLink).toBeDefined();
    expect(viewPlansLink.textContent).toBe('View Plans');
    expect(viewPlansLink.getAttribute('href')).toBe('/pricing');

    // Step 6: clicking View Plans would navigate to /pricing (link has correct href)
    // In jsdom, <a> clicks don't navigate, but we verify the href is correct
    expect(viewPlansLink).toHaveAttribute('href', '/pricing');

    // Step 7: modal stays open (navigation happens via the link, not modal close)
    expect(screen.getByTestId('upgrade-modal')).toBeDefined();
  });

  it('e2e: starter clicks agency-locked agent → modal shows agency plan → View Plans links to /pricing', () => {
    render(<ChatHeader {...defaultProps} showAgentSelector={true} />);

    // Starter user clicks Voice (requires agency plan)
    const voiceBtn = screen.getByText('Voice').closest('button')!;
    expect(voiceBtn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(voiceBtn);

    // Modal shows agency plan info
    const modal = screen.getByTestId('upgrade-modal');
    expect(modal.textContent).toContain('Voice');
    expect(modal.textContent).toContain('agency');

    // View Plans link still points to /pricing
    const viewPlansLink = screen.getByTestId('view-plans-link');
    expect(viewPlansLink.getAttribute('href')).toBe('/pricing');
  });
});
