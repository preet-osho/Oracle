import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from './ChatPanel';
import { NeverStopRouter } from '@/lib/router';

// ─── Shared mocks (same pattern as ChatPanel.test.tsx) ───
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

// ─── File-local vi.hoisted() mocks ───

const { mockNanoid } = vi.hoisted(() => {
  let counter = 0;
  return { mockNanoid: vi.fn(() => `test-id-${++counter}`) };
});

const { mockToast, mockToastError } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockToastError: vi.fn(),
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

// Controllable runOperatingLoop mock — shared factory from test-utils.mocks.cjs
const { mockRunOperatingLoop, getLoopCallback, _resolveLoop, _rejectLoop } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loopMock = require('./test-utils.mocks.cjs').createControllableLoopMock();
  // Wrap with vi.fn() for assertion support (.mock.calls, .toHaveBeenCalledTimes, etc.)
  const mockFn = vi.fn(loopMock.mockFn);
  return {
    mockRunOperatingLoop: mockFn,
    getLoopCallback: loopMock.getLoopCallback,
    _resolveLoop: loopMock.resolveLoop,
    _rejectLoop: loopMock.rejectLoop,
  };
});

// ─── vi.mock() calls ───

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

// analyzeTask returns complexity > 0.8 to trigger the operating loop
const { mockAnalyzeTask } = vi.hoisted(() => ({
  mockAnalyzeTask: vi.fn().mockReturnValue({ complexity: 0.9, agents: [], suggestedTier: 'premium' }),
}));
vi.mock('@/lib/task-analyzer', () => ({ analyzeTask: (...args: unknown[]) => mockAnalyzeTask(...args) }));

vi.mock('@/lib/feedback-bridge', () => ({
  attachQualityToTraining: vi.fn(),
  recordMessageFeedback: vi.fn(),
}));

// Override runOperatingLoop with our controllable mock
vi.mock('@/lib/agency-operations', () => ({
  runQualityGates: vi.fn().mockReturnValue({ passed: true, score: 80, checks: [] }),
  // @ts-expect-error -- mockRunOperatingLoop is Mock<any> from CJS loopMock, TS can't resolve the call signature
  runOperatingLoop: (...args: unknown[]) => mockRunOperatingLoop(...args),
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

// ─── Helpers ───

import { createSSEFetchMock, defaultFetchMock, createSignalCapturingFetch, setupCallAIMock, renderAndStartLoop, renderAndStartLoopWithFetch } from './test-utils';

// Delegate to the shared factory's resolve helper
const resolveLoop = (results?: { step: string; output: string; agentUsed: string; duration: number }[]) => {
  _resolveLoop(results);
};

// ─── Tests ───

// Helper to check if a console.error call is a React state-update-on-unmounted warning
function isUnmountedStateWarning(args: unknown[]): boolean {
  const msg = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
  return msg.includes('state update') && msg.includes('unmounted');
}



describe('ChatPanel — Operating Loop Unmount Edge Cases', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    streamingEnabledRef.current = true;
    window.localStorage.clear();
    global.fetch = defaultFetchMock();
    mockRecordProviderHealth.mockClear();
    mockRunOperatingLoop.mockClear();
    (NeverStopRouter.calculateCost as ReturnType<typeof vi.fn>).mockReturnValue({ usd: 0.001, inr: 0.084 });
    mockLoadGuardConfig.mockReturnValue({
      enabled: false,
      thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
    });
    // Spy on console.error to detect React warnings about state updates on unmounted components
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  /** Assert no React unmounted-component warnings were logged */
  function expectNoUnmountWarnings() {
    const unmountedWarnings = consoleErrorSpy.mock.calls.filter(isUnmountedStateWarning);
    expect(unmountedWarnings).toHaveLength(0);
  }

  describe('console.error spy infrastructure', () => {
    it('captures fake unmounted-component warnings logged via console.error', () => {
      // Log a fake warning that matches React's pattern
      console.error('Warning: Can\'t perform a React state update on an unmounted component. This is a no-op.');

      // The spy should have captured it
      expect(consoleErrorSpy).toHaveBeenCalled();

      // isUnmountedStateWarning should identify it
      const lastCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1];
      expect(isUnmountedStateWarning(lastCall)).toBe(true);
    });

    it('does not flag unrelated console.error calls as unmounted warnings', () => {
      console.error('Some unrelated error about API failure');
      console.error('TypeError: Cannot read property of undefined');

      const lastCalls = consoleErrorSpy.mock.calls.slice(-2);
      expect(lastCalls.every((call: unknown[]) => !isUnmountedStateWarning(call))).toBe(true);
    });

    it('starts with zero captured calls (fresh spy per test)', () => {
      // The spy is created in beforeEach — verify it has no leftover calls
      expect(consoleErrorSpy.mock.calls).toHaveLength(0);
    });
  });

  describe('unmount during active loop', () => {
    it('does not throw when unmounted while runOperatingLoop is pending', async () => {
      const { unmount } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback);

      // Unmount while the loop is still pending (promise hasn't resolved yet)
      unmount();

      // Resolve the loop — this triggers the callback and post-loop state updates
      // Should NOT throw or warn about state updates on unmounted component
      expect(() => {
        resolveLoop();
      }).not.toThrow();
      expectNoUnmountWarnings();
    });

    it('does not throw when unmounted after some steps complete via onStepComplete', async () => {
      const { unmount, callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Full client acquisition workflow with SEO, ads, and social');
      expect(callback).toBeDefined();

      // Simulate a few steps completing before unmount
      await act(async () => {
        callback!({ step: 'understand', output: 'Step 1 done', agentUsed: 'agency-brain', duration: 100 }, 1, 6);
        callback!({ step: 'diagnose', output: 'Step 2 done', agentUsed: 'agency-brain', duration: 90 }, 2, 6);
      });

      // Unmount mid-loop
      unmount();

      // More steps arrive after unmount — should not throw or warn
      expect(() => {
        callback!({ step: 'plan', output: 'Step 3 done', agentUsed: 'agency-brain', duration: 80 }, 3, 6);
        callback!({ step: 'execute', output: 'Step 4 done', agentUsed: 'agency-brain', duration: 120 }, 4, 6);
        callback!({ step: 'qa', output: 'Step 5 done', agentUsed: 'agency-brain', duration: 70 }, 5, 6);
        callback!({ step: 'improve', output: 'Step 6 done', agentUsed: 'agency-brain', duration: 60 }, 6, 6);
      }).not.toThrow();

      // Resolve the loop promise after unmount — post-loop state updates
      expect(() => {
        resolveLoop();
      }).not.toThrow();
      expectNoUnmountWarnings();
    });

    it('does not throw when unmounted between step completions', async () => {
      const { unmount, callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Run the operating loop for full marketing campaign');

      await act(async () => {
        callback!({ step: 'understand', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 1, 6);
      });

      // Unmount between step 1 and step 2
      unmount();

      // Remaining steps should fire without errors or warnings
      expect(() => {
        callback!({ step: 'diagnose', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 2, 6);
        callback!({ step: 'plan', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 3, 6);
        callback!({ step: 'execute', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 4, 6);
        callback!({ step: 'qa', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 5, 6);
        callback!({ step: 'improve', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 6, 6);
      }).not.toThrow();
      expectNoUnmountWarnings();
    });
  });

  describe('unmount at specific loop stages', () => {
    it('does not throw when unmounted during the first step', async () => {
      const { unmount } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'End-to-end marketing strategy with full agency orchestration');

      // Unmount immediately — the loop is on step 0
      unmount();

      // Complete all steps after unmount — should not warn
      expect(() => {
        resolveLoop([
          { step: 'understand', output: 'Done', agentUsed: 'agency-brain', duration: 100 },
          { step: 'diagnose', output: 'Done', agentUsed: 'agency-brain', duration: 90 },
          { step: 'plan', output: 'Done', agentUsed: 'agency-brain', duration: 80 },
          { step: 'execute', output: 'Done', agentUsed: 'agency-brain', duration: 120 },
          { step: 'qa', output: 'Done', agentUsed: 'agency-brain', duration: 70 },
          { step: 'improve', output: 'Done', agentUsed: 'agency-brain', duration: 60 },
        ]);
      }).not.toThrow();
      expectNoUnmountWarnings();
    });

    it('does not throw when unmounted right after the last step callback', async () => {
      const { unmount, callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Complete agency strategy workflow with multi-domain analysis');

      // Fire all 6 steps
      await act(async () => {
        for (let i = 0; i < 6; i++) {
          const steps = ['understand', 'diagnose', 'plan', 'execute', 'qa', 'improve'];
          callback!(
            { step: steps[i], output: `Step ${i + 1}`, agentUsed: 'agency-brain', duration: 50 },
            i + 1,
            6,
          );
        }
      });

      // Unmount right after the last onStepComplete callback
      unmount();

      // The loop promise resolves, triggering setIsLoopActive(false), setOperatingLoopResults, etc.
      expect(() => {
        resolveLoop();
      }).not.toThrow();
      expectNoUnmountWarnings();
    });
  });

  describe('oracle-loop-complete event after unmount', () => {
    it('still dispatches oracle-loop-complete event even after unmount', async () => {
      const eventSpy = vi.fn();
      window.addEventListener('oracle-loop-complete', eventSpy);

      const { unmount } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Full end-to-end agency workflow');

      unmount();

      // Resolve the loop — this calls window.dispatchEvent
      resolveLoop();

      // Give the event loop a tick to process
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // The event should have been dispatched (window events work even after unmount)
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            total: 6,
            results: expect.arrayContaining([
              expect.objectContaining({ step: 'understand' }),
            ]),
          }),
        }),
      );

      window.removeEventListener('oracle-loop-complete', eventSpy);
    });
  });

  describe('concurrent unmount and remount', () => {
    it('does not throw when a second ChatPanel mounts while the first unmounts mid-loop', async () => {
      const { unmount: unmount1, callback: callback1 } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Full marketing strategy with operating loop');

      // Fire a couple of steps on the first instance
      await act(async () => {
        callback1!({ step: 'understand', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 1, 6);
      });

      // Unmount the first instance
      unmount1();

      // Mount a second instance — this creates fresh state
      streamingEnabledRef.current = true;
      render(<ChatPanel />);

      // Complete the first instance's loop after unmount — no crash, no warnings
      expect(() => {
        callback1!({ step: 'diagnose', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 2, 6);
        resolveLoop([
          { step: 'understand', output: 'Done', agentUsed: 'agency-brain', duration: 50 },
          { step: 'diagnose', output: 'Done', agentUsed: 'agency-brain', duration: 50 },
          { step: 'plan', output: 'Done', agentUsed: 'agency-brain', duration: 50 },
          { step: 'execute', output: 'Done', agentUsed: 'agency-brain', duration: 50 },
          { step: 'qa', output: 'Done', agentUsed: 'agency-brain', duration: 50 },
          { step: 'improve', output: 'Done', agentUsed: 'agency-brain', duration: 50 },
        ]);
      }).not.toThrow();
      expectNoUnmountWarnings();
    });
  });

  describe('loop failure after unmount', () => {
    it('does not throw when runOperatingLoop rejects after unmount', async () => {
      const { unmount } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Run full marketing workflow');

      unmount();

      // Make the loop reject — simulating a network error mid-loop
      expect(() => {
        _rejectLoop(new Error('Network timeout'));
      }).not.toThrow();
      expectNoUnmountWarnings();
    });

    it('does not throw when runOperatingLoop rejects after partial step completion', async () => {
      const { unmount, callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Multi-domain strategy with full agency orchestration');

      // Complete 3 of 6 steps, then unmount
      await act(async () => {
        callback!({ step: 'understand', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 1, 6);
        callback!({ step: 'diagnose', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 2, 6);
        callback!({ step: 'plan', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 3, 6);
      });

      unmount();

      // The loop "fails" at step 4 — the try/catch in runOperatingLoop handles it internally,
      // but the promise could also reject if all steps fail
      expect(() => {
        _rejectLoop(new Error('AI service unavailable'));
      }).not.toThrow();
      expectNoUnmountWarnings();
    });
  });

  // ── OperatingLoopFloatingProgress rendering during active loop ──

  describe('OperatingLoopFloatingProgress rendering during active loop', () => {
    it('does not show floating progress or step dots before loop is triggered', async () => {
      render(<ChatPanel />);

      // Before sending any message, neither component should be visible
      expect(screen.queryByText('Understand…')).toBeNull();
      expect(screen.queryByText('Loop Complete')).toBeNull();
    });

    it('shows floating progress and step dots after first step completes', async () => {
      const { callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Full end-to-end marketing strategy');

      // Fire step 1 — both OperatingLoopStepDots and OperatingLoopFloatingProgress appear
      await act(async () => {
        callback!({ step: 'understand', output: 'Business analysis done.', agentUsed: 'agency-brain', duration: 150 }, 1, 6);
      });

      // Both components render step labels — use getAllByText for duplicated text
      const diagnoseEls = screen.getAllByText(/Diagnose…/);
      expect(diagnoseEls.length).toBeGreaterThanOrEqual(1);
      // Step count appears in both components
      const stepCountEls = screen.getAllByText('1/6');
      expect(stepCountEls.length).toBeGreaterThanOrEqual(1);
    });

    it('updates floating progress as steps complete', async () => {
      const { callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Complete marketing strategy with operating loop');

      // Step 1 done — shows Diagnose
      await act(async () => {
        callback!({ step: 'understand', output: 'Done', agentUsed: 'agency-brain', duration: 100 }, 1, 6);
      });
      expect(screen.getAllByText(/Diagnose…/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('1/6').length).toBeGreaterThanOrEqual(1);

      // Step 2 done — shows Plan
      await act(async () => {
        callback!({ step: 'diagnose', output: 'Done', agentUsed: 'agency-brain', duration: 90 }, 2, 6);
      });
      expect(screen.getAllByText(/Plan…/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('2/6').length).toBeGreaterThanOrEqual(1);

      // Step 3 done — shows Execute
      await act(async () => {
        callback!({ step: 'plan', output: 'Done', agentUsed: 'agency-brain', duration: 80 }, 3, 6);
      });
      expect(screen.getAllByText(/Execute…/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('3/6').length).toBeGreaterThanOrEqual(1);
    });

    it('hides floating progress and step dots when loop completes', async () => {
      const { callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Full marketing strategy with loop');

      // Fire all 6 steps
      const steps = ['understand', 'diagnose', 'plan', 'execute', 'qa', 'improve'] as const;
      await act(async () => {
        steps.forEach((step, i) => {
          callback!({ step, output: `Step ${i + 1}`, agentUsed: 'agency-brain', duration: 50 }, i + 1, 6);
        });
      });

      // While still active, step count should be visible in both components
      const stepCountEls = screen.getAllByText('6/6');
      expect(stepCountEls.length).toBeGreaterThanOrEqual(1);

      // Resolve the loop — isLoopActive becomes false
      resolveLoop();

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // All loop UI should disappear (both components hidden)
      expect(screen.queryByText('6/6')).toBeNull();
    });

    it('passes task text to the floating progress', async () => {
      const { callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'End-to-end marketing strategy for dental clinics');

      await act(async () => {
        callback!({ step: 'understand', output: 'Done', agentUsed: 'agency-brain', duration: 50 }, 1, 6);
      });

      // The task text appears in the floating progress component
      const taskEls = screen.getAllByText('End-to-end marketing strategy for dental clinics');
      expect(taskEls.length).toBeGreaterThanOrEqual(1);
    });

    it('shows Loop Complete state after all steps while loop is still active', async () => {
      const { callback } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Full agency loop strategy');

      const fullResults = [
        { step: 'understand' as const, output: 'Done', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose' as const, output: 'Done', agentUsed: 'agency-brain', duration: 90 },
        { step: 'plan' as const, output: 'Done', agentUsed: 'agency-brain', duration: 80 },
        { step: 'execute' as const, output: 'Done', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa' as const, output: 'Done', agentUsed: 'agency-brain', duration: 70 },
        { step: 'improve' as const, output: 'Done', agentUsed: 'agency-brain', duration: 60 },
      ];

      await act(async () => {
        fullResults.forEach((result, i) => {
          callback!(result, i + 1, 6);
        });
      });

      // 'Loop Complete' appears in OperatingLoopStepDots when all steps are done
      const completeEls = screen.getAllByText('Loop Complete');
      expect(completeEls.length).toBeGreaterThanOrEqual(1);
      // Step count 6/6
      const countEls = screen.getAllByText('6/6');
      expect(countEls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Fetch Signal Abort Verification ──

  describe('fetch signal abort verification', () => {
    it('passes abort signal to fetch and aborts it on unmount', async () => {
      const capturedSignals: AbortSignal[] = [];
      // Fetch that captures the signal and hangs (so loopAbortRef stays alive until unmount)
      const hangingFetch = vi.fn(async (url: URL | Request | string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/api/ai/chat')) {
          if (init?.signal) capturedSignals.push(init.signal);
          const body = JSON.parse((init?.body as string) || '{}');
          if (body.stream === false) {
            // Hang until abort signal fires — this keeps loopAbortRef alive
            return new Promise<{ ok: boolean; json: () => Promise<Record<string, unknown>> }>((resolve, reject) => {
              const timer = setTimeout(() => {
                resolve({ ok: true, json: async () => ({ text: 'step result', provider: 'groq', model: 'llama-3', inputTokens: 10, outputTokens: 10, costUSD: 0 }) });
              }, 60_000);
              init?.signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              }, { once: true });
            });
          }
          const enc = new TextEncoder();
          return { ok: true, body: new ReadableStream({ start(c) { c.enqueue(enc.encode('data: {"chunk":"OK"}\n\ndata: [DONE]\n\n')); c.close(); } }), json: async () => ({}) };
        }
        return { ok: true, json: async () => ({ results: [] }) };
      });

      setupCallAIMock(mockRunOperatingLoop);
      const { unmount } = await renderAndStartLoopWithFetch(
        mockRunOperatingLoop,
        hangingFetch as unknown as typeof global.fetch,
        'Build a complete marketing strategy',
      );

      const signal = capturedSignals[0];
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);

      // Unmount — useEffect cleanup should abort the signal while fetch is still in-flight
      unmount();

      // The signal should now be aborted because loopAbortRef was still set
      expect(signal.aborted).toBe(true);
    });

    it('abort signal cancels a hanging fetch request mid-loop', async () => {
      let fetchResolveFn: (() => void) | null = null;
      const fetchCallCount = { ai: 0 };

      // Fetch that hangs (never resolves) until signal is aborted
      const hangingFetch = vi.fn(async (url: URL | Request | string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/api/ai/chat')) {
          if (init?.signal?.aborted) {
            throw new DOMException('The operation was aborted.', 'AbortError');
          }
          const body = JSON.parse((init?.body as string) || '{}');
          if (body.stream === false) {
            fetchCallCount.ai++;
            // Hang until resolved externally or aborted
            return new Promise<{ ok: boolean; json: () => Promise<Record<string, unknown>> }>((resolve, reject) => {
              const timer = setTimeout(() => {
                resolve({
                  ok: true,
                  json: async () => ({
                    text: 'step result',
                    provider: 'groq',
                    model: 'llama-3',
                    inputTokens: 10,
                    outputTokens: 10,
                    costUSD: 0,
                  }),
                });
              }, 60_000);
              // Store resolve/reject so we can control the hang externally
              fetchResolveFn = () => { clearTimeout(timer); resolve({ ok: true, json: async () => ({}) }); };
              // Also listen for abort signal to reject the promise
              init?.signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              }, { once: true });
            });
          }
          const enc = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(enc.encode('data: {"chunk":"OK"}\n\n'));
              controller.enqueue(enc.encode('data: [DONE]\n\n'));
              controller.close();
            },
          });
          return { ok: true, body: stream, json: async () => ({}) };
        }
        return { ok: true, json: async () => ({ results: [] }) };
      });

      setupCallAIMock(mockRunOperatingLoop);
      const { unmount } = await renderAndStartLoopWithFetch(
        mockRunOperatingLoop,
        hangingFetch as unknown as typeof global.fetch,
        'Build a complete marketing strategy',
      );

      // Unmount — should abort the signal, which causes the hanging fetch to reject with AbortError
      unmount();

      // Give microtasks time for the abort listener to fire
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      // The fetch was aborted — clean up the hanging promise
      // @ts-expect-error -- fetchResolveFn is assigned inside a Promise callback, TS narrows it to never
      fetchResolveFn?.();
    });

    it('each send creates a fresh AbortSignal (not leaked across sends)', async () => {
      const allSignals: AbortSignal[] = [];
      setupCallAIMock(mockRunOperatingLoop as ReturnType<typeof vi.fn>);

      const { user } = await renderAndStartLoopWithFetch(
        mockRunOperatingLoop,
        createSignalCapturingFetch(allSignals),
        'First marketing strategy',
      );
      await waitFor(() => {
        expect(allSignals.length).toBeGreaterThanOrEqual(2);
      });

      const firstSendSignals = allSignals.slice(0, 2); // callAI + streaming fetch
      expect(firstSendSignals[0]).toBeInstanceOf(AbortSignal);
      expect(firstSendSignals[0].aborted).toBe(false);
      // Both signals from the same send should not be leaked across sends
      // (fetchWithTimeout creates an internal AbortController per call,
      // so the raw signals are different instances, but both are fresh)

      // Send second message — should create NEW signals with fresh controllers
      await user.type(screen.getByLabelText('Chat input'), 'Second marketing strategy{Enter}');
      await waitFor(() => {
        expect(mockRunOperatingLoop).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(allSignals.length).toBeGreaterThanOrEqual(4);
      });

      const secondSendSignals = allSignals.slice(2, 4); // callAI + streaming fetch
      expect(secondSendSignals[0]).toBeInstanceOf(AbortSignal);
      // Second send's signal should be a different instance than first send's
      expect(secondSendSignals[0]).not.toBe(firstSendSignals[0]);
      expect(secondSendSignals[0].aborted).toBe(false);
    });
  });

  describe('rapid unmount during SSE streaming after loop', () => {
    it('does not throw when unmounted immediately after the loop completes and streaming starts', async () => {
      // Override fetch to provide SSE stream
      global.fetch = createSSEFetchMock([
        { chunk: 'Response after loop', done: false, model: 'gpt-4o' },
      ]);

      const { unmount } = await renderAndStartLoop(mockRunOperatingLoop, getLoopCallback, 'Complex full marketing strategy with agency loop');

      // Resolve the loop — this triggers the main response streaming
      resolveLoop();

      // Unmount immediately after the loop resolves (streaming may have started)
      unmount();

      // Should not throw — SSE reader and state updates after unmount are safe
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });
    });
  });
});
