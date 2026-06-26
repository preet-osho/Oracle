import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ChatPanel } from './ChatPanel';
import { NeverStopRouter } from '@/lib/router';

// ─── Shared mocks (must be in vi.hoisted for Vitest hoisting compatibility) ───
const SHARED_MOCKS = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./test-utils.mocks.cjs');
});
const {
  DESIGN_TOKENS_MOCK, ROUTER_MOCK, API_MOCK, RAG_MOCK, MEMORY_MOCK,
  QUALITY_MOCK, SYSTEM_PROMPT_MOCK, TOKEN_BUDGET_MOCK, CONTEXT_MANAGER_MOCK,
  UTILS_MOCK, EXPORT_UTILS_MOCK, SEARCH_MOCK, CSRF_MOCK, SELF_TRAINING_MOCK,
  CROSS_DOMAIN_THINKING_MOCK, PATTERN_RECOGNITION_MOCK, SEARCH_HELPERS_MOCK,
  WORKFLOW_VALIDATION_MOCK, TOAST_CONFIG_MOCK, GUARD_STATS_PANEL_MOCK,
  createToastMock, createHallucinationGuardMock,
} = SHARED_MOCKS;
// Note: vi.mock() factories below reference SHARED_MOCKS.X directly because
// destructured variables are not initialized at hoist time.

// ─── File-local vi.hoisted() mocks (needed by vi.mock factories in this file) ───

const { mockNanoid, resetNanoid } = vi.hoisted(() => {
  let counter = 0;
  const fn = vi.fn(() => `test-id-${++counter}`);
  return {
    mockNanoid: fn,
    resetNanoid: () => { counter = 0; fn.mockClear(); },
  };
});

const { mockToast, mockToastError, resetToastMocks } = vi.hoisted(() => {
  const mockToastFn = vi.fn();
  const mockToastErrorFn = vi.fn();
  return {
    mockToast: mockToastFn,
    mockToastError: mockToastErrorFn,
    resetToastMocks: () => { mockToastFn.mockClear(); mockToastErrorFn.mockClear(); },
  };
});

const { mockRunOperatingLoop, analyzeTask } = vi.hoisted(() => ({
  mockRunOperatingLoop: vi.fn().mockResolvedValue([]),
  analyzeTask: vi.fn().mockReturnValue({ complexity: 0.3, agents: [], suggestedTier: 'standard' }),
}));

const { mockLoadGuardConfig, mockRunHallucinationGuard, mockRecordLearning } = vi.hoisted(() => ({
  mockLoadGuardConfig: vi.fn().mockReturnValue({
    enabled: false,
    thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
  }),
  mockRunHallucinationGuard: vi.fn().mockResolvedValue({
    confidence: 80,
    assessment: 'Looks good',
    checks: [],
    suggestions: [],
  }),
  mockRecordLearning: vi.fn(),
}));

// ─── vi.mock() calls (must be top-level for Vitest hoisting) ───

vi.mock('nanoid', () => ({ nanoid: mockNanoid }));
vi.mock('@/styles/design-tokens', () => SHARED_MOCKS.DESIGN_TOKENS_MOCK);
vi.mock('@/lib/router', () => SHARED_MOCKS.ROUTER_MOCK);

const mockAddCost = vi.fn();
const mockAddUsageRecord = vi.fn();
const { streamingEnabledRef } = vi.hoisted(() => ({
  streamingEnabledRef: { current: true },
}));

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    streamingEnabled: streamingEnabledRef.current,
    addCost: mockAddCost,
    addUsageRecord: mockAddUsageRecord,
    configuredProviders: ['groq'],
  }),
}));

vi.mock('@/lib/api', () => SHARED_MOCKS.API_MOCK);
vi.mock('@/lib/rag', () => SHARED_MOCKS.RAG_MOCK);
vi.mock('@/lib/memory', () => SHARED_MOCKS.MEMORY_MOCK);
vi.mock('@/lib/quality', () => SHARED_MOCKS.QUALITY_MOCK);
vi.mock('@/lib/system-prompt', () => SHARED_MOCKS.SYSTEM_PROMPT_MOCK);
vi.mock('@/lib/hallucination-guard', () => SHARED_MOCKS.createHallucinationGuardMock(mockLoadGuardConfig, mockRunHallucinationGuard, mockRecordLearning));
vi.mock('react-hot-toast', () => SHARED_MOCKS.createToastMock(mockToast, mockToastError));
vi.mock('@/lib/token-budget', () => SHARED_MOCKS.TOKEN_BUDGET_MOCK);
vi.mock('@/lib/context-manager', () => SHARED_MOCKS.CONTEXT_MANAGER_MOCK);
vi.mock('@/lib/utils', () => SHARED_MOCKS.UTILS_MOCK);
vi.mock('@/lib/export-utils', () => SHARED_MOCKS.EXPORT_UTILS_MOCK);
vi.mock('@/lib/search', () => SHARED_MOCKS.SEARCH_MOCK);
vi.mock('@/lib/csrf', () => SHARED_MOCKS.CSRF_MOCK);
vi.mock('@/lib/self-training', () => SHARED_MOCKS.SELF_TRAINING_MOCK);
vi.mock('@/lib/cross-domain-thinking', () => SHARED_MOCKS.CROSS_DOMAIN_THINKING_MOCK);
vi.mock('@/lib/pattern-recognition', () => SHARED_MOCKS.PATTERN_RECOGNITION_MOCK);
vi.mock('@/lib/search-helpers', () => SHARED_MOCKS.SEARCH_HELPERS_MOCK);
vi.mock('@/lib/workflow-validation', () => SHARED_MOCKS.WORKFLOW_VALIDATION_MOCK);
vi.mock('@/lib/toast-config', () => SHARED_MOCKS.TOAST_CONFIG_MOCK);

vi.mock('@/lib/task-analyzer', () => ({ analyzeTask }));

const mockRecordProviderHealth = vi.fn();
vi.mock('@/lib/provider-health', () => ({ recordProviderHealth: (...args: unknown[]) => mockRecordProviderHealth(...args) }));
vi.mock('@/lib/editor-gate', () => ({
  runEditorGate: vi.fn().mockResolvedValue({ passed: true, confidence: 90, assessment: 'OK', issues: [] }),
  loadEditorConfig: vi.fn().mockReturnValue({ enabled: true, minLength: 100, skipAgentTypes: [] }),
  saveEditorConfig: vi.fn(),
  DEFAULT_EDITOR_CONFIG: { enabled: true, minLength: 100, skipAgentTypes: [] },
}));
vi.mock('@/lib/output-quality-evaluator', () => ({
  evaluateOutput: vi.fn().mockReturnValue({ passed: true, overallScore: 85, checks: [], suggestions: [] }),
}));

vi.mock('@/lib/feedback-bridge', () => ({
  attachQualityToTraining: vi.fn(),
  recordMessageFeedback: vi.fn(),
}));
vi.mock('@/lib/agency-operations', () => ({
  runOperatingLoop: mockRunOperatingLoop,
  runQualityGates: vi.fn().mockReturnValue({ passed: true, score: 80, checks: [] }),
  routeAgencyTask: vi.fn().mockReturnValue({ primary: 'strategist', support: [], workflow: 'strategy' }),
  detectMistakes: vi.fn().mockReturnValue([]),
  rankDecisionOptions: vi.fn().mockReturnValue([]),
  runSelfCheck: vi.fn().mockReturnValue({ score: 7, understood: true, avoidedGeneric: true, coveredChannels: true, assignedRightAgent: true, identifiedFailures: true, gaveNextStep: true, clientReady: true }),
  runLeadGenPipeline: vi.fn().mockResolvedValue([]),
  runClientHuntWorkflow: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/prompt-sanitizer', () => ({
  sanitizeDocumentContent: vi.fn().mockImplementation((content: string) => ({ sanitized: content, flagged: false })),
  sanitizeSearchResults: vi.fn().mockImplementation((results: unknown[]) => results),
  sanitizeExternalContext: vi.fn().mockImplementation((content: string) => ({ sanitized: content, flagged: false })),
}));
vi.mock('@/components/oracle/GuardStatsPanel', () => SHARED_MOCKS.GUARD_STATS_PANEL_MOCK);

// ─── Helpers (shared from test-utils) ──
import { createSSEFetchMock, defaultFetchMock, createSignalCapturingFetch, setupCallAIMock, renderAndStartLoopWithFetch } from './test-utils';

// ─── Tests ─────────────────────────────

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    streamingEnabledRef.current = true;
    resetNanoid();
    resetToastMocks();
    window.localStorage.clear();

    // Set up default global.fetch mock
    global.fetch = defaultFetchMock();

    mockRecordProviderHealth.mockClear();
    mockRunOperatingLoop.mockResolvedValue([]);

    // Restore default calculateCost mock
    (NeverStopRouter.calculateCost as ReturnType<typeof vi.fn>).mockReturnValue({ usd: 0.001, inr: 0.084 });
    // Reset hallucination-guard mocks for test isolation
    mockLoadGuardConfig.mockReturnValue({
      enabled: false,
      thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
    });
    mockRunHallucinationGuard.mockResolvedValue({
      confidence: 80,
      assessment: 'Looks good',
      checks: [],
      suggestions: [],
    });
    mockRecordLearning.mockClear();
  });

  // ── Empty State ──

  describe('empty state', () => {
    it('renders the empty state with quick start cards', async () => {
      await act(async () => {
        render(<ChatPanel />);
      });
      expect(screen.getByText('Describe any agency task')).toBeDefined();
      expect(screen.getByText('SEO Audit')).toBeDefined();
      expect(screen.getByText('Blog Post')).toBeDefined();
    });

    it('has correct ARIA attributes', async () => {
      await act(async () => {
        render(<ChatPanel />);
      });
      expect(screen.getByRole('log', { name: 'Chat messages' })).toBeDefined();
      expect(screen.getByRole('list', { name: 'Quick start options' })).toBeDefined();
      expect(screen.getByLabelText('Chat input')).toBeDefined();
      expect(screen.getByLabelText('Send message')).toBeDefined();
    });
  });

  // ── Input & Send ──

  describe('input and send', () => {
    it('updates input value when typing', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      const textarea = screen.getByLabelText('Chat input');
      await user.type(textarea, 'Hello');
      expect((textarea as HTMLTextAreaElement).value).toBe('Hello');
    });

    it('sends message on Enter key', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      const textarea = screen.getByLabelText('Chat input');
      await user.type(textarea, 'Hello{Enter}');
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('does not send on Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      // Clear any fetch calls from component initialization (e.g. /api/subscription/status)
      vi.mocked(global.fetch).mockClear();
      const textarea = screen.getByLabelText('Chat input');
      await user.type(textarea, 'Hello{Shift>}{Enter}{/Shift}');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not send empty messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      // Clear any fetch calls from component initialization (e.g. /api/subscription/status)
      vi.mocked(global.fetch).mockClear();
      const textarea = screen.getByLabelText('Chat input');
      await user.type(textarea, '   ');
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('clears input after sending', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      const textarea = screen.getByLabelText('Chat input');
      await user.type(textarea, 'Hello{Enter}');
      await waitFor(() => {
        expect((textarea as HTMLTextAreaElement).value).toBe('');
      });
    });
  });

  // ── Message Rendering ──

  describe('message rendering', () => {
    it('renders user message after sending', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello', { selector: '[aria-label="You said"]' })).toBeDefined();
      });
    });

    it('renders assistant response after streaming completes', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
    });

    it('renders assistant response from sync path', async () => {
      streamingEnabledRef.current = false;
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
    });

    it('renders provider and model badges for assistant messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getAllByText('groq').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('gpt-4o').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays token count for assistant messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('0k tokens')).toBeDefined();
      });
    });

    it('displays cost for assistant messages with cost > 0', async () => {
      streamingEnabledRef.current = false;
      global.fetch = vi.fn(async (url: URL | Request | string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/api/ai/chat')) {
          return {
            ok: true,
            json: async () => ({ text: 'Reply', provider: 'openai', model: 'gpt-4o', inputTokens: 10, outputTokens: 20, costUSD: 0.05 }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }) as unknown as typeof fetch;

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('₹4.20')).toBeDefined();
      });
    });

    it('renders error message when fetch fails', async () => {
      streamingEnabledRef.current = false;
      global.fetch = vi.fn(async () => {
        throw new Error('Network timeout');
      });
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Error: Network timeout')).toBeDefined();
      });
    });
  });

  // ── recordUsage Callback ──

  describe('recordUsage callback', () => {
    it('calls addUsageRecord after streaming completes', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(mockAddUsageRecord).toHaveBeenCalledTimes(1);
      });
      const record = mockAddUsageRecord.mock.calls[0][0];
      expect(record).toMatchObject({
        provider: 'groq',
        model: 'gpt-4o',
        taskType: 'orchestrator',
      });
      expect(record.id).toBeDefined();
      expect(record.timestamp).toBeGreaterThan(0);
      expect(record.inputTokens).toBeGreaterThan(0);
      expect(record.outputTokens).toBeGreaterThan(0);
    });

    it('calls addUsageRecord after sync completes', async () => {
      streamingEnabledRef.current = false;
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(mockAddUsageRecord).toHaveBeenCalledTimes(1);
      });
      const record = mockAddUsageRecord.mock.calls[0][0];
      expect(record).toMatchObject({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 10,
        outputTokens: 20,
        costUSD: 0.001,
        taskType: 'orchestrator',
      });
    });

    it('calls addCost when cost > 0 (sync path)', async () => {
      streamingEnabledRef.current = false;
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(mockAddCost).toHaveBeenCalledWith(0.001, 0.084);
      });
    });

    it('calls addCost when streaming has non-zero calculated cost', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(mockAddCost).toHaveBeenCalled();
      });
    });

    it('does not call addCost when both costUSD and cost.inr are 0', async () => {
      (NeverStopRouter.calculateCost as ReturnType<typeof vi.fn>).mockReturnValue({ usd: 0, inr: 0 });

      streamingEnabledRef.current = false;
      global.fetch = vi.fn(async (url: URL | Request | string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/api/ai/chat')) {
          return {
            ok: true,
            json: async () => ({ text: 'Reply', provider: 'groq', model: 'llama-3.3-70b-versatile', inputTokens: 10, outputTokens: 20, costUSD: 0 }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }) as unknown as typeof fetch;

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(mockAddUsageRecord).toHaveBeenCalled();
      });
      expect(mockAddCost).not.toHaveBeenCalled();
    });
  });

  // ── Streaming Behavior ──

  describe('streaming behavior', () => {
    it('allows sending again after streaming completes', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await user.type(screen.getByLabelText('Chat input'), 'Second message');
      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).not.toBeDisabled();
    });

    it('allows sending again after fetch error', async () => {
      global.fetch = vi.fn(async () => {
        throw new Error('Stream failed');
      });

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Error: Stream failed')).toBeDefined();
      });

      await user.type(screen.getByLabelText('Chat input'), 'Try again');
      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).not.toBeDisabled();
    });
  });

  // ── Sidebar Toggle ──

  describe('sidebar toggle', () => {
    it('renders sidebar toggle button when onSidebarToggle is provided', async () => {
      const onSidebarToggle = vi.fn();
      await act(async () => {
        render(<ChatPanel onSidebarToggle={onSidebarToggle} sidebarOpen={true} />);
      });
      expect(screen.getByLabelText('Hide sidebar')).toBeDefined();
    });

    it('calls onSidebarToggle when clicked', async () => {
      const onSidebarToggle = vi.fn();
      const user = userEvent.setup();
      render(<ChatPanel onSidebarToggle={onSidebarToggle} sidebarOpen={false} />);
      await user.click(screen.getByLabelText('Show sidebar'));
      expect(onSidebarToggle).toHaveBeenCalledTimes(1);
    });

    it('does not render sidebar toggle when onSidebarToggle is not provided', async () => {
      await act(async () => {
        render(<ChatPanel />);
      });
      expect(screen.queryByLabelText('Show sidebar')).toBeNull();
      expect(screen.queryByLabelText('Hide sidebar')).toBeNull();
    });
  });

  // ── Quick Start Cards ──

  describe('quick start cards', () => {
    it('populates input when a quick start card is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.click(screen.getByText('SEO Audit'));
      const textarea = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
      expect(textarea.value).toBe('SEO Audit');
    });
  });

  // ── Streaming Provider/Model Capture ──

  describe('streaming provider/model capture', () => {
    it('captures model from streaming SSE chunks', async () => {
      global.fetch = createSSEFetchMock([
        { chunk: 'Hi', done: false, model: 'claude-sonnet-4-6', provider: 'anthropic' },
      ]);

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');
      await waitFor(() => {
        expect(screen.getByText('claude-sonnet-4-6')).toBeDefined();
      });
    });

    it('falls back to unknown when no model in chunks', async () => {
      global.fetch = createSSEFetchMock([
        { chunk: 'Hi', done: false },
      ]);

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');
      await waitFor(() => {
        expect(screen.getAllByText('groq').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('unknown')).toBeDefined();
      });
    });
  });

  // ── Regression: Attachment Fix ──

  describe('attachment regression', () => {
    it('sends message with attachments when present', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Test with attachments{Enter}');
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      // Find the POST call with a body (the /api/ai/chat call), not the subscription status GET
      const chatCall = fetchCalls.find((call: unknown[]) => (call[1] as RequestInit | undefined)?.body);
      expect(chatCall).toBeDefined();
      const body = JSON.parse(chatCall![1].body as string);
      expect(body.stream).toBe(true);
    });

    it('does not crash when attachments array changes', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'First message');

      rerender(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), '{Enter}');
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  // ── Regression: ChatHeader Props ──

  describe('ChatHeader without sidebar props', () => {
    it('renders correctly without onSidebarToggle and sidebarOpen', async () => {
      await act(async () => {
        render(<ChatPanel />);
      });
      expect(screen.getByText('New Chat')).toBeDefined();
      expect(screen.getByLabelText('Toggle conversation list')).toBeDefined();
      expect(screen.getByLabelText('Select project for memory context')).toBeDefined();
      expect(screen.getByLabelText('Select agent type')).toBeDefined();
    });
  });

  // ── Regenerate ──

  describe('regenerate', () => {
    it('shows regenerate button on assistant messages only', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
      const regenButtons = screen.getAllByLabelText('Regenerate');
      expect(regenButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('removes assistant message and re-sends user message on regenerate', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'My question{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const regenButton = screen.getByLabelText('Regenerate');
      await user.click(regenButton);

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const chatLog = screen.getByRole('log', { name: 'Chat messages' });
      const myQuestionElements = within(chatLog).getAllByText('My question');
      expect(myQuestionElements.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show regenerate button for user messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
      const userMessages = screen.getAllByText('Hi');
      for (const el of userMessages) {
        const parent = el.closest('[class*="oracle-msg-user"]');
        if (parent) {
          expect(parent.querySelector('[aria-label="Regenerate"]')).toBeNull();
        }
      }
    });
  });

  // ── Feedback (Thumbs Up/Down) ──

  describe('feedback', () => {
    it('renders Good and Bad buttons on assistant messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
      expect(screen.getByLabelText('Good')).toBeDefined();
      expect(screen.getByLabelText('Bad')).toBeDefined();
    });

    it('toggles feedback state when Good is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const goodButton = screen.getByLabelText('Good');
      await user.click(goodButton);
      expect(goodButton.textContent).toContain('👍✓');
    });

    it('persists feedback in localStorage', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await user.click(screen.getByLabelText('Good'));

      const stored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      const values = Object.values(stored);
      expect(values.length).toBe(1);
      expect(values[0]).toBe('good');
    });

    it('toggles off when clicking the same button again', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const goodButton = screen.getByLabelText('Good');
      await user.click(goodButton);
      await user.click(goodButton);

      const stored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      expect(Object.keys(stored).length).toBe(0);
    });

    it('switches from Good to Bad when clicking Bad', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await user.click(screen.getByLabelText('Good'));
      await user.click(screen.getByLabelText('Bad'));

      const stored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      const values = Object.values(stored);
      expect(values.length).toBe(1);
      expect(values[0]).toBe('bad');
    });

    it('does not render feedback buttons on user messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const goodButtons = screen.getAllByLabelText('Good');
      expect(goodButtons.length).toBe(1);
    });

    it('restores active Good button state from localStorage on remount', async () => {
      const user = userEvent.setup();

      const { unmount } = render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await user.click(screen.getByLabelText('Good'));
      expect(screen.getByLabelText('Good').textContent).toContain('✓');

      const stored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      const assistantMsgId = Object.keys(stored)[0];
      expect(stored[assistantMsgId]).toBe('good');

      unmount();

      mockNanoid.mockImplementationOnce(() => 'remount-user-1')
        .mockImplementationOnce(() => assistantMsgId);

      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByLabelText('Good')).toBeDefined();
      });

      expect(screen.getByLabelText('Good').textContent).toContain('✓');
    });

    it('restores active Bad button state from localStorage on remount', async () => {
      const user = userEvent.setup();

      const { unmount } = render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await user.click(screen.getByLabelText('Bad'));
      expect(screen.getByLabelText('Bad').textContent).toContain('✓');

      const stored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      const assistantMsgId = Object.keys(stored)[0];
      expect(stored[assistantMsgId]).toBe('bad');

      unmount();

      mockNanoid.mockImplementationOnce(() => 'remount-user-bad')
        .mockImplementationOnce(() => assistantMsgId);

      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByLabelText('Bad')).toBeDefined();
      });

      expect(screen.getByLabelText('Bad').textContent).toContain('✓');
    });

    it('clears feedback from localStorage after toggle-off across mount/unmount', async () => {
      const user = userEvent.setup();

      const { unmount } = render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const goodButton = screen.getByLabelText('Good');
      await user.click(goodButton);
      await user.click(goodButton);

      const stored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      expect(Object.keys(stored).length).toBe(0);

      unmount();

      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByLabelText('Good')).toBeDefined();
      });

      const restored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      expect(Object.keys(restored).length).toBe(0);
      expect(screen.getByLabelText('Good').textContent).toBe('👍 Good');
    });

    it('does not show active Good button when localStorage has no feedback', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByLabelText('Good')).toBeDefined();
      });

      expect(screen.getByLabelText('Good').textContent).toBe('👍 Good');
    });
  });

  // ── Toast Notifications ──

  describe('toast notifications', () => {
    it('shows warning toast when hallucination guard fails', async () => {
      mockLoadGuardConfig.mockReturnValue({
        enabled: true,
        thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
      });
      mockRunHallucinationGuard.mockRejectedValue(new Error('Guard error'));

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.stringContaining('Hallucination guard'),
          expect.objectContaining({ duration: 3000 })
        );
      });
    });

    it('does not crash when quality scoring fetch fails (silent catch)', async () => {
      global.fetch = vi.fn(async (url: URL | Request | string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/api/ai/chat')) {
          const body = JSON.parse(init?.body as string || '{}');
          if (body.stream === false) {
            throw new Error('Scoring error');
          }
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: 'Hello', done: false, model: 'gpt-4o' })}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            },
          });
          return { ok: true, body: stream, json: async () => ({}) };
        }
        return { ok: true, json: async () => ({}) };
      }) as unknown as typeof fetch;

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeDefined();
      });
    });
  });

  // ── Provider Health Recording ──

  describe('provider health recording', () => {
    it('records health on successful streaming response', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(mockRecordProviderHealth).toHaveBeenCalledTimes(1);
      const call = mockRecordProviderHealth.mock.calls[0][0];
      expect(call.providerId).toBe('groq');
      expect(call.success).toBe(true);
      expect(call.latencyMs).toBe(200); // from _health in SSE chunks
      expect(call.model).toBe('gpt-4o');
      expect(call.tokensUsed).toBeGreaterThan(0);
    });

    it('records health on successful sync response', async () => {
      streamingEnabledRef.current = false;
      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(mockRecordProviderHealth).toHaveBeenCalledTimes(1);
      const call = mockRecordProviderHealth.mock.calls[0][0];
      expect(call.providerId).toBe('openai');
      expect(call.success).toBe(true);
      expect(call.latencyMs).toBe(150); // from _health in sync JSON
      expect(call.model).toBe('gpt-4o');
    });

    it('records health with success: false on fetch failure', async () => {
      global.fetch = vi.fn(async () => {
        throw new Error('Network timeout');
      });

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Error: Network timeout')).toBeDefined();
      });

      expect(mockRecordProviderHealth).toHaveBeenCalledTimes(1);
      const call = mockRecordProviderHealth.mock.calls[0][0];
      expect(call.success).toBe(false);
      expect(call.errorMessage).toBe('Network timeout');
      expect(call.tokensUsed).toBe(0);
    });

    it('records health with latency from server-provided _health metadata (streaming)', async () => {
      global.fetch = createSSEFetchMock([
        { chunk: 'Reply', done: false, model: 'claude-sonnet-4-6' },
      ]);

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Reply')).toBeDefined();
      });

      const call = mockRecordProviderHealth.mock.calls[0][0];
      expect(call.latencyMs).toBe(200); // from _health in SSE
      expect(call.model).toBe('claude-sonnet-4-6');
    });

    it('records health with latency from server-provided _health metadata (sync)', async () => {
      streamingEnabledRef.current = false;
      global.fetch = vi.fn(async (url: URL | Request | string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/api/ai/chat')) {
          return {
            ok: true,
            json: async () => ({
              text: 'Sync reply',
              provider: 'anthropic',
              model: 'claude-opus-4',
              inputTokens: 15,
              outputTokens: 25,
              costUSD: 0.01,
              _health: { latencyMs: 350, success: true },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }) as unknown as typeof fetch;

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Sync reply')).toBeDefined();
      });

      const call = mockRecordProviderHealth.mock.calls[0][0];
      expect(call.latencyMs).toBe(350); // from _health in JSON
      expect(call.providerId).toBe('anthropic');
      expect(call.model).toBe('claude-opus-4');
    });
  });

  // ── Abort Signal Verification ──

  describe('abort signal in fetch calls', () => {
    afterEach(() => {
      // Restore vi.mock() fn mocks to their default values
      // (vi.restoreAllMocks() only restores vi.spyOn spies, not vi.mock fn mocks)
      vi.mocked(analyzeTask).mockReturnValue({ complexity: 0.3, agents: [], suggestedTier: 'standard' });
      mockRunOperatingLoop.mockResolvedValue([]);
    });

    it('passes abort signal to fetch in the operating loop callAI path', async () => {
      // Override task analyzer to trigger the operating loop (complexity > 0.8)
      vi.mocked(analyzeTask).mockReturnValue({ complexity: 0.9, agents: [], suggestedTier: 'premium' });

      // Override runOperatingLoop to actually call callAI
      setupCallAIMock(mockRunOperatingLoop);

      const capturedSignals: AbortSignal[] = [];
      await renderAndStartLoopWithFetch(
        mockRunOperatingLoop,
        createSignalCapturingFetch(capturedSignals),
        'Build a complete marketing strategy',
      );

      const signal = capturedSignals[0];
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });

    it('streaming response path passes an abort signal to fetch', async () => {
      // The AbortController is created at the start of handleSend,
      // so both the streaming and sync paths receive the signal.
      const capturedSignals: AbortSignal[] = [];
      global.fetch = createSignalCapturingFetch(capturedSignals);

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');

      await waitFor(() => {
        expect(vi.mocked(global.fetch)).toHaveBeenCalled();
      });

      // The streaming path fetch should have received a signal
      expect(capturedSignals.length).toBeGreaterThan(0);
      expect(capturedSignals[0]).toBeInstanceOf(AbortSignal);
      expect(capturedSignals[0].aborted).toBe(false);
    });

    it('sync response path passes an abort signal to fetch', async () => {
      streamingEnabledRef.current = false;
      const capturedSignals: AbortSignal[] = [];
      global.fetch = createSignalCapturingFetch(capturedSignals);

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');

      await waitFor(() => {
        expect(vi.mocked(global.fetch)).toHaveBeenCalled();
      });

      // The sync path fetch should have received a signal
      expect(capturedSignals.length).toBeGreaterThan(0);
      expect(capturedSignals[0]).toBeInstanceOf(AbortSignal);
      expect(capturedSignals[0].aborted).toBe(false);
    });
  });

  // ── Regression: hr() markdown component ──

  describe('hr markdown component regression', () => {
    it('renders assistant messages with markdown including hr', async () => {
      global.fetch = createSSEFetchMock([
        { chunk: 'Line 1\n\n---\n\nLine 2', done: false, model: 'gpt-4o' },
      ]);

      const user = userEvent.setup();
      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getAllByText('Line 1').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Line 2').length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
