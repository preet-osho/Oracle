import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { PlanId } from '@/lib/subscription';
import type { AgentType } from './agent-config';

// ─── Mocks ───

let mockPlan: PlanId = 'starter';

vi.mock('./FeatureGate', () => ({
  useSubscriptionState: () => ({ plan: mockPlan, isValid: true, loading: false }),
  DailyUsageIndicator: ({ used, limit }: { used: number; limit: number }) => (
    <span data-testid="daily-usage">{used}/{limit}</span>
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
    { id: 'developer', label: 'Developer', emoji: '💻', description: 'Code generation', group: 'Specialist' },
  ],
}));

vi.mock('@/lib/utils', () => ({
  estimateTokens: (text: string) => Math.ceil(text.length / 4),
}));

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, onClick, disabled, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { whileHover?: unknown; whileTap?: unknown }) => (
      <button onClick={onClick} disabled={disabled} className={className} {...props}>{children}</button>
    ),
  },
}));

// ─── Import after mocks ───
import { ChatInputArea } from './ChatInputArea';

const defaultProps = {
  input: '',
  setInput: vi.fn(),
  isStreaming: false,
  agentType: 'orchestrator' as AgentType,
  setAgentType: vi.fn(),
  attachments: [],
  setAttachments: vi.fn(),
  estimatedCost: null,
  detectedPatterns: [],
  crossDomainSuggestions: [],
  dailyUsage: null,
  onSend: vi.fn(),
  onPaste: vi.fn(),
  onFileAttach: vi.fn(),
};

// ─── Tests ───

describe('ChatInputArea feature gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlan = 'starter';
  });

  it('shows lock icon for locked agent on starter plan', () => {
    render(<ChatInputArea {...defaultProps} agentType="developer" />);
    expect(screen.getByText('🔒')).toBeDefined();
  });

  it('shows Requires Pro plan text for locked agent on starter plan', () => {
    render(<ChatInputArea {...defaultProps} agentType="developer" />);
    expect(screen.getByText(/Requires Pro plan/)).toBeDefined();
  });

  it('shows Upgrade link for locked agent', () => {
    render(<ChatInputArea {...defaultProps} agentType="developer" />);
    const upgradeLink = screen.getByText('Upgrade →');
    expect(upgradeLink).toBeDefined();
    expect(upgradeLink.getAttribute('href')).toBe('/pricing');
  });

  it('shows oracle-cta-pulse class on upgrade link', () => {
    render(<ChatInputArea {...defaultProps} agentType="developer" />);
    const upgradeLink = screen.getByText('Upgrade →');
    expect(upgradeLink.className).toContain('oracle-cta-pulse');
  });

  it('does not show lock icon for allowed agent on starter plan', () => {
    render(<ChatInputArea {...defaultProps} agentType="orchestrator" />);
    expect(screen.queryByText('🔒')).toBeNull();
  });

  it('does not show Upgrade link for allowed agent', () => {
    render(<ChatInputArea {...defaultProps} agentType="orchestrator" />);
    expect(screen.queryByText('Upgrade →')).toBeNull();
  });

  it('does not show lock icon for developer on pro plan', () => {
    mockPlan = 'pro';
    render(<ChatInputArea {...defaultProps} agentType="developer" />);
    expect(screen.queryByText('🔒')).toBeNull();
  });

  it('shows Switch to Orchestrator button for non-orchestrator allowed agents', () => {
    mockPlan = 'pro';
    render(<ChatInputArea {...defaultProps} agentType="developer" />);
    expect(screen.getByText('Switch to Orchestrator')).toBeDefined();
  });

  it('does not show Switch to Orchestrator for orchestrator agent', () => {
    render(<ChatInputArea {...defaultProps} agentType="orchestrator" />);
    expect(screen.queryByText('Switch to Orchestrator')).toBeNull();
  });

  it('shows orchestrator emoji for orchestrator agent', () => {
    render(<ChatInputArea {...defaultProps} agentType="orchestrator" />);
    expect(screen.getByText('🧠')).toBeDefined();
  });

  it('shows lock icon instead of agent emoji for locked agent', () => {
    render(<ChatInputArea {...defaultProps} agentType="developer" />);
    expect(screen.getByText('🔒')).toBeDefined();
    expect(screen.queryByText('💻')).toBeNull();
  });

  it('renders textarea for chat input', () => {
    render(<ChatInputArea {...defaultProps} />);
    expect(screen.getByLabelText('Chat input')).toBeDefined();
  });

  it('renders send button', () => {
    render(<ChatInputArea {...defaultProps} />);
    expect(screen.getByLabelText('Send message')).toBeDefined();
  });

  it('send button is disabled when input is empty', () => {
    render(<ChatInputArea {...defaultProps} />);
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('send button is enabled when input has text', () => {
    render(<ChatInputArea {...defaultProps} input="hello" />);
    expect(screen.getByLabelText('Send message')).not.toBeDisabled();
  });

  it('shows daily usage indicator when provided', () => {
    render(<ChatInputArea {...defaultProps} dailyUsage={{ used: 5, limit: 50 }} />);
    expect(screen.getByTestId('daily-usage')).toBeDefined();
    expect(screen.getByText('5/50')).toBeDefined();
  });

  it('shows upgrade link when daily limit is reached', () => {
    render(<ChatInputArea {...defaultProps} dailyUsage={{ used: 50, limit: 50 }} />);
    const upgradeLinks = screen.getAllByText('Upgrade →');
    expect(upgradeLinks.length).toBeGreaterThanOrEqual(1);
  });
});
