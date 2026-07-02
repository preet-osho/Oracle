import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Mock FeatureGate (configurable plan) ───
let mockPlan = 'pro' as string;
vi.mock('./FeatureGate', () => ({
  useSubscriptionState: () => ({ plan: mockPlan, isValid: true, loading: false }),
  FeatureGate: ({ children, feature, fallback }: { children: React.ReactNode; feature?: string; fallback?: React.ReactNode }) => {
    const requiredPlan = feature === 'proposals' ? 'pro' : 'starter';
    const hierarchy = ['starter', 'pro', 'agency'];
    if (hierarchy.indexOf(mockPlan) >= hierarchy.indexOf(requiredPlan)) {
      return <>{children}</>;
    }
    return <>{fallback}</>;
  },
  UpgradePrompt: ({ requiredPlan, feature }: { requiredPlan?: string; feature?: string }) => (
    <div data-testid="upgrade-prompt">
      <div data-testid="upgrade-lock">🔒</div>
      <p>{feature ? `${feature} requires` : 'This feature requires'} the {requiredPlan} plan</p>
      <a href="/pricing">View Plans</a>
    </div>
  ),
  UpgradeModal: () => null,
  TierBadge: () => null,
  TierTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  getRequiredPlanForAgent: () => 'starter' as const,
}));

// ─── Mock design-tokens ───
vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {}, tabContent: {}, scaleIn: {} },
  transitions: { smooth: {}, snappy: {}, popSpring: {} },
  buttonTapProps: {},
  cardHoverProps: {},
}));

// ─── Mock domains ───
vi.mock('@/data/domains', () => ({
  AGENCY_DOMAINS: [
    { id: 'seo', name: 'SEO', emoji: '🔍', category: 'Digital Marketing' },
    { id: 'web', name: 'Web Development', emoji: '🌐', category: 'Development' },
  ],
}));

// ─── Mock system-prompt ───
vi.mock('@/lib/system-prompt', () => ({
  ROADMAP_GENERATION_PROMPT: 'Generate proposal for {{clientBrief}} in domain {{domain}} with budget {{budget}} and timeline {{timeline}}',
}));

// ─── Mock csrf ───
vi.mock('@/lib/csrf', () => ({
  csrfHeaders: vi.fn().mockReturnValue({}),
}));

// ─── Mock toast ───
vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => {},
    { error: (...args: unknown[]) => {}, success: (...args: unknown[]) => {} }
  ),
}));

vi.mock('@/lib/toast-config', () => ({
  TOAST_DEFAULTS: { duration: 3000 },
}));

// ─── Mock proposal-pdf ───
vi.mock('@/lib/proposal-pdf', () => ({
  exportProposalToPDF: vi.fn(),
  exportProposalToWord: vi.fn(),
}));

// ─── Mock API calls ───
const mockProposalsList = vi.fn();
const mockProposalsCreate = vi.fn();

vi.mock('@/lib/api', () => ({
  proposalsApi: {
    list: (...args: unknown[]) => mockProposalsList(...args),
    create: (...args: unknown[]) => mockProposalsCreate(...args),
  },
}));

import { RoadmapTab } from './RoadmapTab';

// ─── Helpers (imported from shared test-utils) ──────────
import { createSSEFetchMock } from './test-utils';

// ─── Tests ─────────────────────────────

describe('RoadmapTab', () => {
  beforeEach(() => {
    mockPlan = 'pro';
    vi.clearAllMocks();
    mockProposalsList.mockResolvedValue([]);
    mockProposalsCreate.mockResolvedValue({
      id: 'prop1',
      brief: 'Test brief',
      domain: 'SEO',
      output: 'Generated proposal content',
      created_at: Date.now(),
    });

    // Mock global.fetch with SSE streaming for /api/ai/chat
    global.fetch = createSSEFetchMock([
      { chunk: 'Generated proposal content', done: false, model: 'gpt-4o' },
    ]);
  });

  // ── Loading & Rendering ──

  describe('loading and rendering', () => {
    it('renders the roadmap header', async () => {
      await act(async () => {
        render(<RoadmapTab />);
      });
      expect(screen.getByText('🎯 Roadmap & Proposals')).toBeDefined();
      expect(screen.getByText(/Generate comprehensive client proposals/)).toBeDefined();
    });

    it('loads proposals history on mount', async () => {
      mockProposalsList.mockResolvedValue([
        { id: 'p1', brief: 'Previous proposal', domain: 'SEO', output: 'Content', created_at: Date.now() },
      ]);
      render(<RoadmapTab />);
      await waitFor(() => {
        expect(mockProposalsList).toHaveBeenCalledTimes(1);
      });
    });

    it('renders the generate button', async () => {
      await act(async () => {
        render(<RoadmapTab />);
      });
      expect(screen.getByText('🎯 Generate Proposal')).toBeDefined();
    });

    it('renders domain selector', async () => {
      await act(async () => {
        render(<RoadmapTab />);
      });
      expect(screen.getByDisplayValue('Auto-detect domain')).toBeDefined();
    });
  });

  // ── Input ──

  describe('input', () => {
    it('has a textarea for client brief', async () => {
      await act(async () => {
        render(<RoadmapTab />);
      });
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      expect(textarea).toBeDefined();
    });

    it('updates textarea value when typing', async () => {
      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      expect((textarea as HTMLTextAreaElement).value).toBe('Test brief');
    });

    it('disables generate button when brief is empty', async () => {
      await act(async () => {
        render(<RoadmapTab />);
      });
      const button = screen.getByText('🎯 Generate Proposal');
      expect(button).toBeDisabled();
    });

    it('enables generate button when brief has content', async () => {
      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      const button = screen.getByText('🎯 Generate Proposal');
      expect(button).not.toBeDisabled();
    });
  });

  // ── Proposal Generation ──

  describe('proposal generation', () => {
    it('generates proposal when button is clicked', async () => {
      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief for proposal');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/ai/chat',
          expect.objectContaining({ method: 'POST' }),
        );
      });
    });

    it('displays generated proposal output', async () => {
      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(screen.getByText('Generated proposal content')).toBeDefined();
      });
    });

    it('shows generating state while streaming', async () => {
      // Make streaming slow by using a custom fetch that pauses
      let resolveStream: (() => void) | undefined;
      global.fetch = vi.fn(async (url: URL | Request | string, init?: RequestInit): Promise<any> => {
        const body = JSON.parse((init?.body as string) || '{}');
        if (typeof url === 'string' && url.includes('/api/ai/chat') && body.stream === true) {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('data: {"chunk":"Partial","done":false}\n\n'));
              // Pause until we manually resolve
              resolveStream = () => {
                controller.enqueue(encoder.encode('data: {"chunk":"","done":true}\n\n'));
                controller.close();
              };
            },
          });
          return { ok: true, body: stream, json: async () => ({}) };
        }
        return { ok: true, json: async () => ({}) };
      });

      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(screen.getByText('Generating...')).toBeDefined();
      });

      // Resolve the stream
      const resolver = resolveStream;
      await act(async () => {
        resolver?.();
      });
    });

    it('saves proposal to API after generation', async () => {
      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(mockProposalsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            brief: 'Test brief',
            domain: 'General',
          })
        );
      });
    });

    it('displays error when generation fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(screen.getByText(/Error: API Error/)).toBeDefined();
      });
    });
  });

  // ── History ──

  describe('history', () => {
    it('shows history button with count', async () => {
      mockProposalsList.mockResolvedValue([
        { id: 'p1', brief: 'Proposal 1', domain: 'SEO', output: 'Content 1', created_at: Date.now() },
        { id: 'p2', brief: 'Proposal 2', domain: 'Web', output: 'Content 2', created_at: Date.now() },
      ]);
      render(<RoadmapTab />);
      await waitFor(() => {
        expect(screen.getByText('📋 History (2)')).toBeDefined();
      });
    });

    it('toggles history panel when clicked', async () => {
      mockProposalsList.mockResolvedValue([
        { id: 'p1', brief: 'Previous proposal content here', domain: 'SEO', output: 'Content', created_at: Date.now() },
      ]);
      const user = userEvent.setup();
      render(<RoadmapTab />);
      await waitFor(() => {
        expect(screen.getByText('📋 History (1)')).toBeDefined();
      });

      await user.click(screen.getByText('📋 History (1)'));
      expect(screen.getByText('Recent Proposals')).toBeDefined();
    });

    it('shows empty state when no history', async () => {
      const user = userEvent.setup();
      render(<RoadmapTab />);
      await user.click(screen.getByText('📋 History (0)'));
      expect(screen.getByText('No proposals yet.')).toBeDefined();
    });
  });

  // ── Copy ──

  describe('copy', () => {
    it('shows copy button when output exists', async () => {
      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(screen.getByText('📋 Copy')).toBeDefined();
      });
    });

    it('calls clipboard.writeText when copy is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeTextMock);

      const user = userEvent.setup();
      render(<RoadmapTab />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(screen.getByText('📋 Copy')).toBeDefined();
      });

      await user.click(screen.getByText('📋 Copy'));
      expect(writeTextMock).toHaveBeenCalledWith('Generated proposal content');
    });
  });

  // ── Send to Agent ──

  describe('send to agent', () => {
    it('calls onAskOracle when agent button is clicked', async () => {
      const onAskOracle = vi.fn();
      const user = userEvent.setup();
      render(<RoadmapTab onAskOracle={onAskOracle} />);
      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'Test brief');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(screen.getByText('⚡ Agent')).toBeDefined();
      });

      await user.click(screen.getByText('⚡ Agent'));
      expect(onAskOracle).toHaveBeenCalledWith('Test brief');
    });
  });

  // ── Feature Gating (FeatureGate wrapper) ──

  describe('feature gating', () => {
    it('shows UpgradePrompt for starter users', () => {
      mockPlan = 'starter';
      render(<RoadmapTab />);
      expect(screen.getByTestId('upgrade-prompt')).toBeDefined();
      expect(screen.getByText(/Proposals requires/)).toBeDefined();
    });

    it('shows upgrade lock icon for starter users', () => {
      mockPlan = 'starter';
      render(<RoadmapTab />);
      expect(screen.getByTestId('upgrade-lock')).toBeDefined();
      expect(screen.getByText('🔒')).toBeDefined();
    });

    it('shows View Plans link for starter users', () => {
      mockPlan = 'starter';
      render(<RoadmapTab />);
      const link = screen.getByText('View Plans');
      expect(link).toBeDefined();
      expect(link.getAttribute('href')).toBe('/pricing');
    });

    it('does NOT show proposal generator for starter users', () => {
      mockPlan = 'starter';
      render(<RoadmapTab />);
      expect(screen.queryByText('🎯 Roadmap & Proposals')).toBeNull();
      expect(screen.queryByText('🎯 Generate Proposal')).toBeNull();
      expect(screen.queryByPlaceholderText(/Paste a client brief here/)).toBeNull();
    });

    it('shows full proposal generator for pro users', () => {
      mockPlan = 'pro';
      render(<RoadmapTab />);
      expect(screen.getByText('🎯 Roadmap & Proposals')).toBeDefined();
      expect(screen.getByText('🎯 Generate Proposal')).toBeDefined();
      expect(screen.queryByTestId('upgrade-prompt')).toBeNull();
    });

    it('shows full proposal generator for agency users', () => {
      mockPlan = 'agency';
      render(<RoadmapTab />);
      expect(screen.getByText('🎯 Roadmap & Proposals')).toBeDefined();
      expect(screen.getByText('🎯 Generate Proposal')).toBeDefined();
      expect(screen.queryByTestId('upgrade-prompt')).toBeNull();
    });

    it('shows required plan name in upgrade prompt', () => {
      mockPlan = 'starter';
      render(<RoadmapTab />);
      expect(screen.getByText(/Proposals requires the pro plan/)).toBeDefined();
    });
  });
});
