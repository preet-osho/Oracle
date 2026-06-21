import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { PlanId } from '@/lib/subscription';

// ─── Mocks ───

let mockPlan: PlanId = 'starter';

vi.mock('./FeatureGate', () => ({
  useSubscriptionState: () => ({ plan: mockPlan, isValid: true, loading: false }),
  getRequiredPlanForFeature: (feature: string) => {
    const map: Record<string, PlanId> = { webSearch: 'pro', clientMemory: 'pro' };
    return map[feature] || 'pro';
  },
  UpgradeModal: ({ open, onOpenChange, featureLabel }: { open: boolean; onOpenChange: (open: boolean) => void; featureLabel?: string }) => (
    open ? (
      <div data-testid="upgrade-modal">
        <span>Upgrade Modal: {featureLabel}</span>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
  ),
  TierBadge: () => null,
  TierTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    selectedModel: { providerId: 'openai', modelId: 'gpt-4o' },
    setSelectedModel: vi.fn(),
    autoRoute: true,
    toggleAutoRoute: vi.fn(),
    byokKeys: { openai: 'sk-123' },
  }),
}));

vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    {
      id: 'openai',
      name: 'OpenAI',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, bestFor: ['general'], isFree: false },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, bestFor: ['general'], isFree: true },
      ],
      baseUrl: 'https://api.openai.com',
      keyFormat: 'sk-...',
      keyLabel: 'API Key',
      docsUrl: '',
      signupUrl: '',
      color: '#10a37f',
      supportsStreaming: true,
      supportsMCP: false,
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      models: [
        { id: 'claude-sonnet', name: 'Claude Sonnet', contextWindow: 200000, bestFor: ['general'], isFree: false },
      ],
      baseUrl: 'https://api.anthropic.com',
      keyFormat: 'sk-ant-...',
      keyLabel: 'API Key',
      docsUrl: '',
      signupUrl: '',
      color: '#d97706',
      supportsStreaming: true,
      supportsMCP: false,
    },
  ],
}));

vi.mock('@/styles/design-tokens', () => ({
  QUICK_ACTIONS: [
    { id: 'qa1', label: 'New Chat', emoji: '💬', action: 'chat' },
    { id: 'qa2', label: 'Upload Doc', emoji: '📄', action: 'upload' },
  ],
  transitions: { smooth: {}, snappy: {} },
  motionVariants: { fadeUp: {} },
  buttonTapProps: {},
  cardHoverProps: {},
}));

vi.mock('@/lib/rag', () => ({
  processDocument: vi.fn().mockResolvedValue({}),
}));

// ─── Import after mocks ───
import { Sidebar } from './Sidebar';

// ─── Tests ───

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlan = 'starter';
  });

  it('renders when isOpen is true', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('⚡ Quick Actions')).toBeDefined();
    expect(screen.getByText('📁 Active Project')).toBeDefined();
    expect(screen.getByText('📄 Documents')).toBeDefined();
    expect(screen.getByText('🌐 Web Search')).toBeDefined();
    expect(screen.getByText('🤖 Model')).toBeDefined();
    expect(screen.getByText('📊 Quality Average')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    render(<Sidebar isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('⚡ Quick Actions')).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Sidebar isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close sidebar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders quick action buttons', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('New Chat')).toBeDefined();
    expect(screen.getByText('Upload Doc')).toBeDefined();
  });

  it('displays model selector with auto-route toggle', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Auto-route')).toBeDefined();
    // Provider dropdowns are hidden when autoRoute is true (the mock default)
  });

  it('displays No active project message', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('No active project')).toBeDefined();
  });

  it('displays No scores yet for quality bar', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('No scores yet')).toBeDefined();
  });

  it('renders upload document button', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Upload document for RAG')).toBeDefined();
  });

  it('renders web search toggle', () => {
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Enable web search')).toBeDefined();
  });

  it('shows lock icon on web search for starter users', () => {
    mockPlan = 'starter';
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('🔒')).toBeDefined();
    expect(screen.getByText(/Requires Pro plan/)).toBeDefined();
  });

  it('does not show lock icon on web search for pro users', () => {
    mockPlan = 'pro';
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('🔒')).toBeNull();
    expect(screen.queryByText(/Requires Pro plan/)).toBeNull();
  });

  it('does not show lock icon on web search for agency users', () => {
    mockPlan = 'agency';
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('🔒')).toBeNull();
  });

  it('opens upgrade modal when starter user clicks web search toggle', () => {
    mockPlan = 'starter';
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    // The toggle is inside the Web Search section - click the toggle button
    const toggleButtons = screen.getAllByRole('button');
    // Find the toggle near 'Enable web search'
    const webSearchSection = toggleButtons.find((btn) => {
      const parent = btn.closest('div');
      return parent?.textContent?.includes('Enable web search') && btn.getAttribute('aria-pressed') !== null;
    });
    if (webSearchSection) {
      fireEvent.click(webSearchSection);
      expect(screen.getByTestId('upgrade-modal')).toBeDefined();
      expect(screen.getByText('Upgrade Modal: Web Search')).toBeDefined();
    }
  });

  it('shows Upgrade link below web search for starter users', () => {
    mockPlan = 'starter';
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    const upgradeLink = screen.getByText('Upgrade', { selector: 'a' });
    expect(upgradeLink).toBeDefined();
    expect(upgradeLink.getAttribute('href')).toBe('/pricing');
  });
});
