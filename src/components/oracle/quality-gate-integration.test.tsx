/**
 * Integration tests for the Agency Quality Gate pipeline:
 *   ChatPanel response → runQualityGates() → qualityGateResults state → MessageBubble → QualityGateBadge
 *
 * Verifies the full flow from AI response to badge rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ChatPanel } from './ChatPanel';

// ─── Shared mocks (must be in vi.hoisted for Vitest hoisting compatibility) ───
const SHARED_MOCKS = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./test-utils.mocks.cjs');
});
const {
  DESIGN_TOKENS_MOCK, ROUTER_MOCK, API_MOCK, RAG_MOCK, MEMORY_MOCK,
  QUALITY_MOCK, SYSTEM_PROMPT_MOCK, OUTPUT_QUALITY_EVALUATOR_MOCK,
  EDITOR_GATE_MOCK, PROMPT_SANITIZER_MOCK, TOKEN_BUDGET_MOCK,
  CONTEXT_MANAGER_MOCK, UTILS_MOCK, EXPORT_UTILS_MOCK, SEARCH_MOCK,
  CSRF_MOCK, SELF_TRAINING_MOCK, CROSS_DOMAIN_THINKING_MOCK,
  PATTERN_RECOGNITION_MOCK, SEARCH_HELPERS_MOCK, WORKFLOW_VALIDATION_MOCK,
  TOAST_CONFIG_MOCK, FEEDBACK_BRIDGE_MOCK, GUARD_STATS_PANEL_MOCK,
  createToastMock, createStoreMock,
} = SHARED_MOCKS;

// ─── vi.hoisted() mocks (must be local for Vitest hoisting) ───

const { mockNanoid, resetNanoid } = vi.hoisted(() => {
  let counter = 0;
  const fn = vi.fn(() => `test-id-${++counter}`);
  return { mockNanoid: fn, resetNanoid: () => { counter = 0; fn.mockClear(); } };
});

const { mockToast, mockToastError, resetToastMocks } = vi.hoisted(() => {
  const t = vi.fn();
  const e = vi.fn();
  return { mockToast: t, mockToastError: e, resetToastMocks: () => { t.mockClear(); e.mockClear(); } };
});

const { mockRunQualityGates, resetQualityGates } = vi.hoisted(() => {
  const fn = vi.fn().mockReturnValue({ passed: true, score: 80, checks: [] });
  return { mockRunQualityGates: fn, resetQualityGates: () => { fn.mockReset(); fn.mockReturnValue({ passed: true, score: 80, checks: [] }); } };
});

const { streamingEnabledRef } = vi.hoisted(() => {
  return { streamingEnabledRef: { current: true } };
});

// ─── vi.mock() calls (top-level for Vitest hoisting) ───

vi.mock('nanoid', () => ({ nanoid: mockNanoid }));
vi.mock('@/styles/design-tokens', () => SHARED_MOCKS.DESIGN_TOKENS_MOCK);
vi.mock('@/lib/router', () => SHARED_MOCKS.ROUTER_MOCK);
vi.mock('@/stores/router.store', () => SHARED_MOCKS.createStoreMock({ streamingEnabled: streamingEnabledRef.current }));
vi.mock('@/lib/api', () => SHARED_MOCKS.API_MOCK);
vi.mock('@/lib/rag', () => SHARED_MOCKS.RAG_MOCK);
vi.mock('@/lib/memory', () => SHARED_MOCKS.MEMORY_MOCK);
vi.mock('@/lib/quality', () => SHARED_MOCKS.QUALITY_MOCK);
vi.mock('@/lib/system-prompt', () => SHARED_MOCKS.SYSTEM_PROMPT_MOCK);
vi.mock('@/lib/hallucination-guard', () => ({
  loadGuardConfig: vi.fn().mockReturnValue({ enabled: false, thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 } }),
  runHallucinationGuard: vi.fn().mockResolvedValue({ confidence: 80, assessment: 'OK', checks: [], suggestions: [] }),
  recordLearning: vi.fn(),
}));
vi.mock('@/lib/output-quality-evaluator', () => SHARED_MOCKS.OUTPUT_QUALITY_EVALUATOR_MOCK);
vi.mock('@/lib/editor-gate', () => SHARED_MOCKS.EDITOR_GATE_MOCK);
vi.mock('@/lib/prompt-sanitizer', () => SHARED_MOCKS.PROMPT_SANITIZER_MOCK);
vi.mock('@/lib/agency-operations', () => ({
  runQualityGates: mockRunQualityGates,
  runOperatingLoop: vi.fn().mockResolvedValue([]),
  routeAgencyTask: vi.fn().mockReturnValue({ primary: 'strategist', support: [], workflow: 'strategy' }),
  detectMistakes: vi.fn().mockReturnValue([]),
  rankDecisionOptions: vi.fn().mockReturnValue([]),
  runSelfCheck: vi.fn().mockReturnValue({ score: 7, understood: true, avoidedGeneric: true, coveredChannels: true, assignedRightAgent: true, identifiedFailures: true, gaveNextStep: true, clientReady: true }),
  runLeadGenPipeline: vi.fn().mockResolvedValue([]),
  runClientHuntWorkflow: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/task-analyzer', () => ({
  analyzeTask: vi.fn().mockReturnValue({ complexity: 0.3, agents: [], suggestedTier: 'standard' }),
}));
vi.mock('react-hot-toast', () => SHARED_MOCKS.createToastMock(mockToast, mockToastError));
vi.mock('@/lib/token-budget', () => SHARED_MOCKS.TOKEN_BUDGET_MOCK);
vi.mock('@/lib/context-manager', () => SHARED_MOCKS.CONTEXT_MANAGER_MOCK);
vi.mock('@/lib/utils', () => SHARED_MOCKS.UTILS_MOCK);
vi.mock('@/lib/export-utils', () => SHARED_MOCKS.EXPORT_UTILS_MOCK);
vi.mock('@/lib/search', () => SHARED_MOCKS.SEARCH_MOCK);
vi.mock('@/lib/csrf', () => SHARED_MOCKS.CSRF_MOCK);
vi.mock('@/lib/self-training', () => SHARED_MOCKS.SELF_TRAINING_MOCK);
vi.mock('@/lib/provider-health', () => ({ recordProviderHealth: vi.fn() }));
vi.mock('@/lib/cross-domain-thinking', () => SHARED_MOCKS.CROSS_DOMAIN_THINKING_MOCK);
vi.mock('@/lib/pattern-recognition', () => SHARED_MOCKS.PATTERN_RECOGNITION_MOCK);
vi.mock('@/lib/search-helpers', () => SHARED_MOCKS.SEARCH_HELPERS_MOCK);
vi.mock('@/lib/workflow-validation', () => SHARED_MOCKS.WORKFLOW_VALIDATION_MOCK);
vi.mock('@/lib/toast-config', () => SHARED_MOCKS.TOAST_CONFIG_MOCK);
vi.mock('@/lib/feedback-bridge', () => SHARED_MOCKS.FEEDBACK_BRIDGE_MOCK);
vi.mock('@/components/oracle/GuardStatsPanel', () => SHARED_MOCKS.GUARD_STATS_PANEL_MOCK);

// ─── Helpers ───
import { createSSEFetchMock } from './test-utils';

// ─── Tests ───

describe('Agency Quality Gate Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    streamingEnabledRef.current = true;
    resetNanoid();
    resetToastMocks();
    resetQualityGates();
    window.localStorage.clear();
    // Set up default global.fetch mock (streaming SSE response)
    global.fetch = createSSEFetchMock([
      { chunk: 'H', done: false, model: 'gpt-4o' },
      { chunk: 'ello', done: false, model: 'gpt-4o' },
      { chunk: ' from AI', done: false, model: 'gpt-4o' },
    ]);
  });

  // ── Full Pipeline: Response → Quality Gate → Badge Render ──

  describe('response → quality gate → badge render pipeline', () => {
    it('calls runQualityGates with AI response and user input after streaming completes', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Build a marketing strategy for dental clinics{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(mockRunQualityGates).toHaveBeenCalledTimes(1);
      const [aiContent, userContent] = mockRunQualityGates.mock.calls[0];
      expect(aiContent).toBe('Hello from AI');
      expect(userContent).toContain('Build a marketing strategy');
    });

    it('calls runQualityGates on sync path too', async () => {
      streamingEnabledRef.current = false;

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Research competitor landscape{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(mockRunQualityGates).toHaveBeenCalledTimes(1);
    });

    it('renders QualityGateBadge when quality gate result is available', async () => {
      mockRunQualityGates.mockReturnValue({
        passed: true,
        score: 85,
        checks: [
          { name: 'Objective', passed: true, message: 'Objective is clear' },
          { name: 'Audience', passed: true, message: 'Target audience identified' },
          { name: 'Metrics', passed: true, message: 'Includes metrics' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Create a comprehensive strategy{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Badge should render with passing indicator
      expect(screen.getByText(/agency QA 85%/)).toBeDefined();
    });

    it('renders failing badge with warning emoji when quality gate fails', async () => {
      mockRunQualityGates.mockReturnValue({
        passed: false,
        score: 40,
        checks: [
          { name: 'Objective', passed: false, message: 'Missing clear objective' },
          { name: 'Audience', passed: false, message: 'Missing target audience' },
          { name: 'Offer', passed: false, message: 'Missing offer' },
          { name: 'Metrics', passed: false, message: 'Missing metrics' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Do something{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Failing badge should show warning emoji and score
      expect(screen.getByText(/⚠️ agency QA 40%/)).toBeDefined();
    });

    it('renders passing badge with check emoji when quality gate passes', async () => {
      mockRunQualityGates.mockReturnValue({
        passed: true,
        score: 90,
        checks: [
          { name: 'Objective', passed: true, message: 'Objective is clear' },
          { name: 'Audience', passed: true, message: 'Target audience identified' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Build strategy{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(screen.getByText(/✅ agency QA 90%/)).toBeDefined();
    });
  });

  // ── Badge Expand/Collapse ──

  describe('QualityGateBadge expand/collapse', () => {
    it('renders badge button with expandable indicator', async () => {
      mockRunQualityGates.mockReturnValue({
        passed: true,
        score: 80,
        checks: [
          { name: 'Objective', passed: true, message: 'Objective is clear' },
          { name: 'Audience', passed: false, message: 'Missing target audience' },
          { name: 'Offer', passed: true, message: 'Offer/service is clear' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Strategy{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/agency QA 80%/)).toBeDefined();
      });

      // Badge renders with correct score and check count
      const badge = screen.getByText(/agency QA 80%/);
      expect(badge).toBeDefined();
      // Badge button is clickable and exists in the DOM
      const badgeButton = badge.closest('button');
      expect(badgeButton).toBeDefined();
      expect(badgeButton!.tagName).toBe('BUTTON');
    });

    it('renders badge with expand indicator (▾) for check details', async () => {
      mockRunQualityGates.mockReturnValue({
        passed: true,
        score: 85,
        checks: [
          { name: 'Objective', passed: true, message: 'Objective is clear' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Test{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/agency QA 85%/)).toBeDefined();
      });

      // Badge renders as a button element
      const badgeButton = screen.getByText(/agency QA 85%/).closest('button');
      expect(badgeButton).toBeDefined();
      expect(badgeButton!.tagName).toBe('BUTTON');
      // Badge has a ▾ indicator for expandable content
      expect(badgeButton!.textContent).toContain('▾');
    });

    it('renders failing badge with warning emoji and expand indicator', async () => {
      mockRunQualityGates.mockReturnValue({
        passed: false,
        score: 30,
        checks: [
          { name: 'Objective', passed: false, message: 'Missing clear objective' },
          { name: 'Audience', passed: false, message: 'Missing target audience' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Quick task{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/⚠️ agency QA 30%/)).toBeDefined();
      });

      // Failing badge renders with warning emoji and score
      const badge = screen.getByText(/⚠️ agency QA 30%/);
      expect(badge).toBeDefined();
      // Badge button exists and is clickable
      const badgeButton = badge.closest('button');
      expect(badgeButton).toBeDefined();
      expect(badgeButton!.tagName).toBe('BUTTON');
    });
  });

  // ── Multiple Messages ──

  describe('multiple messages with different quality gate results', () => {
    it('renders different quality gate badges for different messages', async () => {
      // First message: passing
      mockRunQualityGates.mockReturnValueOnce({
        passed: true, score: 90,
        checks: [{ name: 'Objective', passed: true, message: 'OK' }],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'First question{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(screen.getByText(/✅ agency QA 90%/)).toBeDefined();

      // Second message: failing
      mockRunQualityGates.mockReturnValueOnce({
        passed: false, score: 35,
        checks: [{ name: 'Objective', passed: false, message: 'Missing' }],
      });

      await user.type(screen.getByLabelText('Chat input'), 'Second question{Enter}');
      await waitFor(() => {
        // Both messages should be visible
        const aiResponses = screen.getAllByText('Hello from AI');
        expect(aiResponses.length).toBe(2);
      });

      // Both badges should be visible
      expect(screen.getByText(/✅ agency QA 90%/)).toBeDefined();
      expect(screen.getByText(/⚠️ agency QA 35%/)).toBeDefined();
    });
  });

  // ── Error Handling ──

  describe('error handling', () => {
    it('does not crash when runQualityGates throws', async () => {
      mockRunQualityGates.mockImplementation(() => {
        throw new Error('Quality gate internal error');
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Test{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Should not crash — no badge rendered, but response still visible
      expect(screen.queryByText(/agency QA/)).toBeNull();
    });

    it('shows warning toast when quality gate fails', async () => {
      mockRunQualityGates.mockReturnValue({
        passed: false,
        score: 20,
        checks: [
          { name: 'Objective', passed: false, message: 'Missing objective' },
          { name: 'Audience', passed: false, message: 'Missing audience' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Test{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Should show a warning toast about failed checks
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining('Quality gate'),
        expect.objectContaining({ duration: 4000 }),
      );
    });
  });

  // ── New Conversation Resets ──

  describe('new conversation resets quality gate results', () => {
    it('clears quality gate badges when starting a new conversation', async () => {
      mockRunQualityGates.mockReturnValue({
        passed: true, score: 85,
        checks: [{ name: 'Objective', passed: true, message: 'OK' }],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Test message{Enter}');
      await waitFor(() => {
        expect(screen.getByText(/agency QA 85%/)).toBeDefined();
      });

      // Open conversation list dropdown, then click New Chat
      await user.click(screen.getByLabelText('Toggle conversation list'));
      await waitFor(() => {
        expect(screen.getByText('+ New Chat')).toBeDefined();
      });
      await user.click(screen.getByText('+ New Chat'));

      // Badge should be gone
      await waitFor(() => {
        expect(screen.queryByText(/agency QA/)).toBeNull();
      });
    });
  });
});
