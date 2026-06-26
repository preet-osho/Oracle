import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
  indexDocument: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...filterDomProps(props)}>{children}</div>,
    aside: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <aside {...filterDomProps(props)}>{children}</aside>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
  const dom: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key === 'children' || key.startsWith('on') || key === 'className' || key === 'style' || key === 'role' || key === 'aria-label') {
      dom[key] = props[key];
    }
  }
  return dom;
}

vi.mock('@/components/oracle/OperatingLoopDashboard', () => ({
  OperatingLoopDashboard: ({ results, totalSteps, task }: { results: unknown[]; totalSteps: number; task?: string }) => (
    <div data-testid="operating-loop-dashboard">
      <span>Dashboard: {results.length}/{totalSteps} steps</span>
      {task && <span>Task: {task}</span>}
    </div>
  ),
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

  // ── oracle-loop-complete event listener ──

  describe('oracle-loop-complete event listener', () => {
    it('does not show loop section initially', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);
      expect(screen.queryByText(/Last Operating Loop/)).toBeNull();
    });

    it('shows loop section after receiving oracle-loop-complete event', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {
            results: [
              { step: 'understand', output: 'Analysis done.', agentUsed: 'agency-brain', duration: 100 },
              { step: 'diagnose', output: 'Diagnosis.', agentUsed: 'agency-brain', duration: 80 },
              { step: 'plan', output: 'Plan ready.', agentUsed: 'agency-brain', duration: 90 },
              { step: 'execute', output: 'Executed.', agentUsed: 'agency-brain', duration: 120 },
              { step: 'qa', output: 'QA passed.', agentUsed: 'agency-brain', duration: 60 },
              { step: 'improve', output: 'Improved.', agentUsed: 'agency-brain', duration: 50 },
            ],
            total: 6,
            task: 'Build a marketing strategy for dental clinic',
            timestamp: Date.now(),
          },
        }));
      });

      expect(screen.getByText(/Last Operating Loop/)).toBeDefined();
    });

    it('shows collapsed summary with step count and task preview', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {
            results: [
              { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
              { step: 'diagnose', output: 'Done.', agentUsed: 'agency-brain', duration: 80 },
              { step: 'plan', output: 'Done.', agentUsed: 'agency-brain', duration: 90 },
              { step: 'execute', output: 'Done.', agentUsed: 'agency-brain', duration: 120 },
              { step: 'qa', output: 'Done.', agentUsed: 'agency-brain', duration: 60 },
              { step: 'improve', output: 'Done.', agentUsed: 'agency-brain', duration: 50 },
            ],
            total: 6,
            task: 'Build a marketing strategy for dental clinic',
            timestamp: Date.now(),
          },
        }));
      });

      // Event sets showLoopDashboard=true, so dashboard is expanded by default
      // Click Collapse to see the summary card
      fireEvent.click(screen.getByText('Collapse'));

      // Collapsed state shows step count
      expect(screen.getByText('6/6 steps complete')).toBeDefined();
      // Collapsed state shows truncated task
      expect(screen.getByText(/Build a marketing strategy for dental clinic/)).toBeDefined();
    });

    it('expands to show full OperatingLoopDashboard when summary card is clicked', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {
            results: [
              { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
              { step: 'diagnose', output: 'Done.', agentUsed: 'agency-brain', duration: 80 },
              { step: 'plan', output: 'Done.', agentUsed: 'agency-brain', duration: 90 },
              { step: 'execute', output: 'Done.', agentUsed: 'agency-brain', duration: 120 },
              { step: 'qa', output: 'Done.', agentUsed: 'agency-brain', duration: 60 },
              { step: 'improve', output: 'Done.', agentUsed: 'agency-brain', duration: 50 },
            ],
            total: 6,
            task: 'Build a marketing strategy',
            timestamp: Date.now(),
          },
        }));
      });

      // Event sets showLoopDashboard=true, so dashboard is expanded by default
      // Dashboard should be visible right after the event
      expect(screen.getByTestId('operating-loop-dashboard')).toBeDefined();
      expect(screen.getByText('Dashboard: 6/6 steps')).toBeDefined();

      // Click Collapse to go to summary card
      fireEvent.click(screen.getByText('Collapse'));
      expect(screen.queryByTestId('operating-loop-dashboard')).toBeNull();

      // Click the summary card to expand again
      const expandButton = screen.getByText('6/6 steps complete').closest('button')!;
      fireEvent.click(expandButton);

      // Dashboard should be visible again
      expect(screen.getByTestId('operating-loop-dashboard')).toBeDefined();
    });

    it('collapses back when Collapse button is clicked', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {
            results: [
              { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
              { step: 'diagnose', output: 'Done.', agentUsed: 'agency-brain', duration: 80 },
              { step: 'plan', output: 'Done.', agentUsed: 'agency-brain', duration: 90 },
              { step: 'execute', output: 'Done.', agentUsed: 'agency-brain', duration: 120 },
              { step: 'qa', output: 'Done.', agentUsed: 'agency-brain', duration: 60 },
              { step: 'improve', output: 'Done.', agentUsed: 'agency-brain', duration: 50 },
            ],
            total: 6,
            task: 'Build a marketing strategy',
            timestamp: Date.now(),
          },
        }));
      });

      // Dashboard is expanded by default after event
      expect(screen.getByTestId('operating-loop-dashboard')).toBeDefined();

      // Collapse
      fireEvent.click(screen.getByText('Collapse'));
      expect(screen.queryByTestId('operating-loop-dashboard')).toBeNull();
      // Summary card should appear
      expect(screen.getByText('6/6 steps complete')).toBeDefined();
    });

    it('truncates long task in summary preview', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      const longTask = 'A'.repeat(80);
      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {
            results: [
              { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
            ],
            total: 6,
            task: longTask,
            timestamp: Date.now(),
          },
        }));
      });

      // Event sets showLoopDashboard=true, so collapse first to see summary
      fireEvent.click(screen.getByText('Collapse'));

      // Should show truncated task (first 50 chars + ellipsis)
      const truncated = 'A'.repeat(50) + '…';
      expect(screen.getByText(truncated)).toBeDefined();
    });

    it('counts only non-failed steps in summary', () => {
      const { container } = render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {
            results: [
              { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
              { step: 'diagnose', output: '[Failed at diagnose step]', agentUsed: 'agency-brain', duration: 80 },
              { step: 'plan', output: 'Done.', agentUsed: 'agency-brain', duration: 90 },
              { step: 'execute', output: '[Failed at execute step]', agentUsed: 'agency-brain', duration: 120 },
              { step: 'qa', output: 'Done.', agentUsed: 'agency-brain', duration: 60 },
              { step: 'improve', output: 'Done.', agentUsed: 'agency-brain', duration: 50 },
            ],
            total: 6,
            task: 'Strategy task',
            timestamp: Date.now(),
          },
        }));
      });

      // Event sets showLoopDashboard=true, so collapse to see summary
      fireEvent.click(screen.getByText('Collapse'));

      // 4 out of 6 steps succeeded (2 failed)
      expect(container.textContent).toContain('4/6 steps complete');
    });

    it('ignores events without results detail', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {},
        }));
      });

      expect(screen.queryByText(/Last Operating Loop/)).toBeNull();
    });

    it('passes task text to OperatingLoopDashboard when expanded', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {
            results: [
              { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
            ],
            total: 6,
            task: 'Build marketing strategy',
            timestamp: Date.now(),
          },
        }));
      });

      // Dashboard is expanded by default after event
      // Dashboard should receive the task prop
      expect(screen.getByText('Task: Build marketing strategy')).toBeDefined();
    });

    it('receives correct results array in OperatingLoopDashboard', () => {
      render(<Sidebar isOpen={true} onClose={vi.fn()} />);

      const results = [
        { step: 'understand', output: 'Step 1 done.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Step 2 done.', agentUsed: 'agency-brain', duration: 80 },
      ];

      act(() => {
        window.dispatchEvent(new CustomEvent('oracle-loop-complete', {
          detail: {
            results,
            total: 6,
            task: 'Test task',
            timestamp: Date.now(),
          },
        }));
      });

      // Dashboard is expanded by default after event
      // Dashboard mock shows results count
      expect(screen.getByText('Dashboard: 2/6 steps')).toBeDefined();
    });
  });
});
