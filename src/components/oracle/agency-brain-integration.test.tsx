/**
 * Integration tests for the Agency Brain end-to-end pipeline:
 *   User sends task → task analyzer → operating loop → AI response → quality gates + editor gate → badges render
 *
 * Verifies the full flow from user input through the Agency Brain's 6-step operating loop,
 * quality gate checks, editor gate auto-correction, and badge rendering in the UI.
 *
 * Uses shared CJS mock factory pattern (test-utils.mocks.cjs) to reduce duplication.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ChatPanel } from './ChatPanel';
import { resetChatPanelMocks } from './chat-panel-mock-setup';

// ─── Shared CJS mocks (loaded via require inside vi.hoisted so they're available to vi.mock() factories) ───
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SHARED = vi.hoisted(() => require('./test-utils.mocks.cjs'));

// ─── File-local vi.hoisted() for creating mock instances and factories ───
const m = vi.hoisted(() => SHARED.createChatPanelMockInstances(vi.fn));
const factories = vi.hoisted(() => SHARED.createChatPanelMockFactories(m, vi.fn));

// ─── vi.mock() calls (must be top-level for Vitest hoisting) ───
vi.mock('nanoid', () => factories.nanoid);
vi.mock('@/styles/design-tokens', () => factories.designTokens);
vi.mock('@/lib/router', () => factories.router);
vi.mock('@/stores/router.store', () => factories.routerStore);
vi.mock('@/lib/api', () => factories.api);
vi.mock('@/lib/rag', () => factories.rag);
vi.mock('@/lib/memory', () => factories.memory);
vi.mock('@/lib/quality', () => factories.quality);
vi.mock('@/lib/system-prompt', () => factories.systemPrompt);
vi.mock('@/lib/hallucination-guard', () => factories.hallucinationGuard);
vi.mock('react-hot-toast', () => factories.toast);
vi.mock('@/lib/token-budget', () => factories.tokenBudget);
vi.mock('@/lib/context-manager', () => factories.contextManager);
vi.mock('@/lib/utils', () => factories.utils);
vi.mock('@/lib/export-utils', () => factories.exportUtils);
vi.mock('@/lib/search', () => factories.search);
vi.mock('@/lib/csrf', () => factories.csrf);
vi.mock('@/lib/self-training', () => factories.selfTraining);
vi.mock('@/lib/cross-domain-thinking', () => factories.crossDomainThinking);
vi.mock('@/lib/pattern-recognition', () => factories.patternRecognition);
vi.mock('@/lib/search-helpers', () => factories.searchHelpers);
vi.mock('@/lib/workflow-validation', () => factories.workflowValidation);
vi.mock('@/lib/toast-config', () => factories.toastConfig);
vi.mock('@/lib/output-quality-evaluator', () => factories.outputQualityEvaluator);
vi.mock('@/lib/editor-gate', () => factories.editorGate);
vi.mock('@/lib/prompt-sanitizer', () => factories.promptSanitizer);
vi.mock('@/lib/agency-operations', () => factories.agencyOperations);
vi.mock('@/lib/task-analyzer', () => factories.taskAnalyzer);
vi.mock('@/lib/feedback-bridge', () => factories.feedbackBridge);
vi.mock('@/lib/provider-health', () => factories.providerHealth);
vi.mock('@/components/oracle/GuardStatsPanel', () => factories.guardStatsPanel);
vi.mock('@/hooks/keyboard-shortcuts-context', () => ({
  useKeyboardShortcuts: vi.fn(),
  useKeyboardShortcutsContext: vi.fn(() => ({
    register: vi.fn(),
    unregister: vi.fn(),
    getRegistrations: vi.fn(() => []),
    getRegistration: vi.fn(() => null),
    isGloballyEnabled: true,
    getShortcutAnalytics: vi.fn(() => ({ totalInvocations: 0, byShortcut: {} })),
    resetAnalytics: vi.fn(),
  })),
  KeyboardShortcutsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── Helpers (shared from test-utils) ──
import { createSSEFetchMock } from './test-utils';

// ─── Tests ───

describe('Agency Brain End-to-End Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetChatPanelMocks(m);
    window.localStorage.clear();
    // Set up default global.fetch mock (streaming SSE response)
    global.fetch = createSSEFetchMock([
      { chunk: 'H', done: false, model: 'gpt-4o' },
      { chunk: 'ello', done: false, model: 'gpt-4o' },
      { chunk: ' from AI', done: false, model: 'gpt-4o' },
    ]);
  });

  // ── Operating Loop: Activation for High-Complexity Tasks ──

  describe('operating loop activation', () => {
    it('runs operating loop when task complexity > 0.8', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      m.mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Dental clinic needs patient acquisition.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Root cause: weak local visibility.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Channel mix: Local SEO + Google Ads.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'GBP audit complete. Ad campaign drafted.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'All checks passed.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Lesson: mobile-first is critical.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Build a comprehensive end-to-end marketing strategy for a dental clinic including SEO, ads, and social media{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(m.analyzeTask).toHaveBeenCalledTimes(1);
      expect(m.mockRunOperatingLoop).toHaveBeenCalledTimes(1);
      const [taskArg] = m.mockRunOperatingLoop.mock.calls[0];
      expect(taskArg).toContain('dental clinic');
    });

    it('does NOT run operating loop when task complexity <= 0.8', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'general',
        complexity: 0.3,
        estimatedTokens: 100,
        agents: [{ role: 'researcher', priority: 1, taskFocus: 'Research', requiredTier: 'standard' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'standard',
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(m.analyzeTask).toHaveBeenCalledTimes(1);
      expect(m.mockRunOperatingLoop).not.toHaveBeenCalled();
    });

    it('operating loop failure does not crash the chat (non-blocking)', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.95,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      // The error from runOperatingLoop propagates to ChatPanel's catch block,
      // which sets an error message instead of the AI response.
      m.mockRunOperatingLoop.mockRejectedValue(new Error('Loop service unavailable'));

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Comprehensive strategy for dental clinic{Enter}');

      await waitFor(() => {
        // Error is displayed (caught by ChatPanel's try/catch)
        expect(screen.getByText('Error: Loop service unavailable')).toBeDefined();
      });

      // Chat is still functional — error doesn't crash the component
      expect(screen.getByLabelText('Chat input')).toBeDefined();
      expect(screen.getByLabelText('Send message')).toBeDefined();
    });
  });

  // ── Operating Loop: Results Flow to MessageBubble ──

  describe('operating loop results in UI', () => {
    it('renders OperatingLoopBadge when loop results are available', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      m.mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Dental clinic needs patients.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Weak local SEO.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Local SEO + Ads.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'GBP audit done.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'Passed.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Mobile-first.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Comprehensive end-to-end strategy for dental clinic{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // The operating loop badge renders: "🔄 6/6 loop · 500ms"
      await waitFor(() => {
        expect(screen.getByText(/6\/6 loop/)).toBeDefined();
      });
    });

    it('does not render OperatingLoopBadge for simple tasks', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'general',
        complexity: 0.3,
        estimatedTokens: 100,
        agents: [{ role: 'researcher', priority: 1, taskFocus: 'Research', requiredTier: 'standard' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'standard',
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(screen.queryByText(/\d+\/\d+ loop/)).toBeNull();
    });
  });

  // ── Quality Gate + Operating Loop Combined ──

  describe('quality gate + operating loop combined', () => {
    it('runs both operating loop and quality gate for complex tasks', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      m.mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Analysis complete.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Diagnosis complete.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Plan ready.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Execution done.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'QA passed.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Improvements noted.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      m.mockRunQualityGates.mockReturnValue({
        passed: true,
        score: 85,
        checks: [
          { name: 'Objective', passed: true, message: 'Objective is clear' },
          { name: 'Audience', passed: true, message: 'Audience identified' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Comprehensive end-to-end strategy for dental clinic{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Both operating loop and quality gate should have been called
      expect(m.mockRunOperatingLoop).toHaveBeenCalledTimes(1);
      expect(m.mockRunQualityGates).toHaveBeenCalledTimes(1);

      // Both badges should render
      await waitFor(() => {
        expect(screen.getByText(/6\/6 loop/)).toBeDefined();
      });
      expect(screen.getByText(/agency QA 85%/)).toBeDefined();
    });

    it('quality gate failure shows warning even when operating loop succeeds', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.85,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      m.mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Done.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Done.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Done.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'Done.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Done.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      m.mockRunQualityGates.mockReturnValue({
        passed: false,
        score: 30,
        checks: [
          { name: 'Objective', passed: false, message: 'Missing objective' },
          { name: 'Audience', passed: false, message: 'Missing audience' },
        ],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Comprehensive end-to-end strategy for dental clinic{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Quality gate should show failing badge
      expect(screen.getByText(/⚠️ agency QA 30%/)).toBeDefined();

      // Warning toast should fire
      expect(m.mockToast).toHaveBeenCalledWith(
        expect.stringContaining('Quality gate'),
        expect.objectContaining({ duration: 4000 }),
      );
    });
  });

  // ── Editor Gate Integration ──

  describe('editor gate integration', () => {
    it('runs editor gate after response and stores result', async () => {
      m.mockRunEditorGate.mockResolvedValue({
        passed: true,
        confidence: 95,
        assessment: 'Professional quality',
        issues: [],
        checkedAt: Date.now(),
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Write a proposal for dental clinic{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(m.mockRunEditorGate).toHaveBeenCalledTimes(1);
      const [userContent, aiContent] = m.mockRunEditorGate.mock.calls[0];
      expect(userContent).toContain('dental clinic');
      expect(aiContent).toBe('Hello from AI');
    });

    it('auto-corrects response when editor gate fails with corrected text', async () => {
      m.mockRunEditorGate.mockResolvedValue({
        passed: false,
        confidence: 60,
        assessment: 'Found placeholder text',
        issues: [
          { severity: 'critical', category: 'placeholder', description: 'Contains [INSERT]' },
        ],
        correctedText: 'Hello from AI (corrected)',
        checkedAt: Date.now(),
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Write proposal{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI (corrected)')).toBeDefined();
      });

      // Editor correction toast should fire
      expect(m.mockToast).toHaveBeenCalledWith(
        expect.stringContaining('Editor gate'),
        expect.objectContaining({ duration: 3000 }),
      );
    });

    it('editor gate error does not crash chat (non-blocking)', async () => {
      m.mockRunEditorGate.mockRejectedValue(new Error('Editor service down'));

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Test{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Response still visible despite editor gate failure
      expect(screen.getByText('Hello from AI')).toBeDefined();
    });
  });

  // ── Multi-Domain Task Routing ──

  describe('multi-domain task routing', () => {
    it('triggers operating loop for multi-domain tasks with complexity > 0.8', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.85,
        estimatedTokens: 600,
        agents: [
          { role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' },
          { role: 'seo-specialist', priority: 2, taskFocus: 'SEO', requiredTier: 'standard' },
          { role: 'marketer', priority: 3, taskFocus: 'Ads', requiredTier: 'standard' },
        ],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      m.mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Multi-domain task understood.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Multiple issues identified.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Cross-domain plan ready.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Execution across domains.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'QA passed across all domains.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Lessons learned.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Help me acquire clients for a dental clinic — I need lead generation, local SEO, paid ads, and a website{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Multi-domain task should trigger operating loop
      expect(m.mockRunOperatingLoop).toHaveBeenCalledTimes(1);
      const [taskArg] = m.mockRunOperatingLoop.mock.calls[0];
      expect(taskArg).toContain('lead generation');
      expect(taskArg).toContain('local SEO');
      expect(taskArg).toContain('paid ads');
    });
  });

  // ── New Conversation Reset ──

  describe('new conversation resets agency state', () => {
    it('clears operating loop results when starting a new conversation', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      m.mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Done.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Done.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Done.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'Done.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Done.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      m.mockRunQualityGates.mockReturnValue({
        passed: true, score: 85,
        checks: [{ name: 'Objective', passed: true, message: 'OK' }],
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      // Send a complex task
      await user.type(screen.getByLabelText('Chat input'), 'Comprehensive end-to-end strategy for dental clinic{Enter}');
      await waitFor(() => {
        expect(screen.getByText(/6\/6 loop/)).toBeDefined();
      });
      expect(screen.getByText(/agency QA 85%/)).toBeDefined();

      // Start new conversation
      await user.click(screen.getByLabelText('Toggle conversation list'));
      await waitFor(() => {
        expect(screen.getByText('+ New Chat')).toBeDefined();
      });
      await user.click(screen.getByText('+ New Chat'));

      // All agency badges should be gone
      await waitFor(() => {
        expect(screen.queryByText(/\d+\/\d+ loop/)).toBeNull();
        expect(screen.queryByText(/agency QA/)).toBeNull();
      });
    });
  });

  // ── Sync Path (non-streaming) ──

  describe('sync path operating loop', () => {
    it('runs operating loop on sync path for complex tasks', async () => {
      m.streamingEnabledRef.current = false;

      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.85,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      m.mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Sync analysis.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Sync diagnosis.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Sync plan.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Sync execution.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'Sync QA.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Sync improve.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Comprehensive end-to-end strategy for dental clinic{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(m.mockRunOperatingLoop).toHaveBeenCalledTimes(1);
    });
  });

  // ── oracle-loop-complete Event Dispatch ──

  describe('oracle-loop-complete event dispatch', () => {
    it('dispatches oracle-loop-complete event after operating loop finishes', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      const loopResults = [
        { step: 'understand', output: 'Analysis.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Diagnosis.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Plan.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Execution.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'QA.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Improvement.', agentUsed: 'agency-brain', duration: 50 },
      ];
      m.mockRunOperatingLoop.mockResolvedValue(loopResults);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Comprehensive end-to-end strategy for dental clinic{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Should have dispatched oracle-loop-complete event
      const loopEvent = dispatchSpy.mock.calls.find(
        (call) => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === 'oracle-loop-complete'
      );
      expect(loopEvent).toBeDefined();
      const detail = (loopEvent![0] as CustomEvent).detail;
      expect(detail.results).toHaveLength(6);
      expect(detail.total).toBe(6);
      expect(detail.task).toContain('dental clinic');
      expect(typeof detail.timestamp).toBe('number');

      dispatchSpy.mockRestore();
    });

    it('does NOT dispatch oracle-loop-complete for simple tasks (no operating loop)', async () => {
      m.analyzeTask.mockReturnValue({
        category: 'general',
        complexity: 0.3,
        estimatedTokens: 100,
        agents: [{ role: 'researcher', priority: 1, taskFocus: 'Research', requiredTier: 'standard' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'standard',
      });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Should NOT have dispatched oracle-loop-complete event
      const loopEvent = dispatchSpy.mock.calls.find(
        (call) => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === 'oracle-loop-complete'
      );
      expect(loopEvent).toBeUndefined();

      dispatchSpy.mockRestore();
    });
  });

  // ── Multiple Messages with Mixed Complexity ──

  describe('multiple messages with different complexity levels', () => {
    it('runs operating loop only for complex tasks, not simple ones', async () => {
      // First message: simple
      m.analyzeTask.mockReturnValueOnce({
        category: 'general',
        complexity: 0.3,
        estimatedTokens: 100,
        agents: [{ role: 'researcher', priority: 1, taskFocus: 'Research', requiredTier: 'standard' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'standard',
      });

      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(m.mockRunOperatingLoop).not.toHaveBeenCalled();

      // Second message: complex
      m.analyzeTask.mockReturnValueOnce({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      m.mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Understood.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Diagnosed.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Planned.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Executed.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'QA done.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Improved.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      await user.type(screen.getByLabelText('Chat input'), 'Comprehensive end-to-end strategy for dental clinic{Enter}');

      await waitFor(() => {
        expect(screen.getAllByText('Hello from AI').length).toBeGreaterThanOrEqual(2);
      });

      // Operating loop should now have been called once (for the complex task only)
      expect(m.mockRunOperatingLoop).toHaveBeenCalledTimes(1);
    });
  });
});
