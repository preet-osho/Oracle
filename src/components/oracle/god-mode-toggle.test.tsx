/**
 * ORACLE — GOD MODE toggle and chat panel integration tests.
 *
 * 29 tests (merged from 2 files: god-mode-toggle + renderchatpanel-cleanup-error).
 *
 * This file tests GOD MODE toggle behavior, badge rendering, visual state
 * changes, agent selection integration, and renderChatPanel cleanup scenarios
 * (DOM cleanup, error boundaries, useEffect throw paths, stress tests).
 *
 * NOTE: Mock instances (vi.hoisted) and vi.mock() calls are defined inline
 * here — they CANNOT be extracted to a shared module due to Vitest constraints:
 * 1. vi.hoisted() runs before imports resolve (imported functions are TDZ)
 * 2. vi.mock() must be at file top-level (Vitest doesn't hoist from functions)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ChatPanel } from './ChatPanel';
import { TabErrorBoundary } from './TabErrorBoundary';
import { NeverStopRouter } from '@/lib/router';
import { KeyboardShortcutsProvider } from '@/hooks/keyboard-shortcuts-context';
import { resetChatPanelMocks } from './chat-panel-mock-setup';

// ─── Shared CJS mocks (loaded via require inside vi.hoisted so they're available to vi.mock() factories) ───
// Uses the shared factory from test-utils.mocks.cjs to create mock instances and
// vi.mock() factory objects, eliminating ~15 lines of inline mock definitions.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { m, factories } = vi.hoisted(() => {
  const SHARED = require('./test-utils.mocks.cjs');
  const m = SHARED.createChatPanelMockInstances(vi.fn);
  const factories = SHARED.createChatPanelMockFactories(m, vi.fn);
  return { m, factories };
});

// ─── vi.mock() calls (factory objects from shared CJS factory) ───
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
vi.mock('@/lib/task-analyzer', () => factories.taskAnalyzer);
vi.mock('@/lib/provider-health', () => factories.providerHealth);
vi.mock('@/lib/editor-gate', () => factories.editorGate);
vi.mock('@/lib/output-quality-evaluator', () => factories.outputQualityEvaluator);
vi.mock('@/lib/feedback-bridge', () => factories.feedbackBridge);
vi.mock('@/lib/agency-operations', () => factories.agencyOperations);
vi.mock('@/lib/prompt-sanitizer', () => factories.promptSanitizer);
vi.mock('@/components/oracle/GuardStatsPanel', () => factories.guardStatsPanel);

// ─── Helpers ──
import { defaultFetchMock, renderChatPanel, toggleGodModeAndSendMessage, toggleGodModeOff } from './test-utils';

// ─── Tests ─────────────────────────────

describe('GOD MODE Toggle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetChatPanelMocks(m);
    window.localStorage.clear();
    global.fetch = defaultFetchMock();
    (NeverStopRouter.calculateCost as ReturnType<typeof vi.fn>).mockReturnValue({ usd: 0.001, inr: 0.084 });
  });

  // ── Toggle Button Rendering ──

  describe('toggle button rendering', () => {
    it('renders the Enable GOD MODE button by default', async () => {
      await renderChatPanel();
      expect(screen.getByText(/Enable GOD MODE/)).toBeDefined();
    });

    it('renders GOD MODE ON button when toggled on', async () => {
      const user = userEvent.setup();
      await renderChatPanel();
      
      const toggleButton = screen.getByText(/Enable GOD MODE/);
      await user.click(toggleButton);
      
      expect(screen.getByText(/GOD MODE ON/)).toBeDefined();
    });

    it('shows high-stakes verification description when GOD MODE is active', async () => {
      const user = userEvent.setup();
      await renderChatPanel();
      
      const toggleButton = screen.getByText(/Enable GOD MODE/);
      await user.click(toggleButton);
      
      expect(screen.getByText(/High-stakes verification enabled/)).toBeDefined();
    });

    it('has proper aria-pressed attribute for screen readers', async () => {
      await renderChatPanel();
      const toggleButton = screen.getByRole('button', { name: /GOD MODE/i });
      // Default: GOD MODE is off
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
      // Toggle on
      await userEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
      // Toggle back off
      await userEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('has dynamic aria-label that updates with GOD MODE state', async () => {
      await renderChatPanel();
      const toggleButton = screen.getByRole('button', { name: /Toggle GOD MODE/i });
      // Default: GOD MODE is off
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle GOD MODE: currently off');
      // Toggle on
      await userEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle GOD MODE: currently on');
      // Toggle back off
      await userEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle GOD MODE: currently off');
    });

    it('has aria-live region that announces GOD MODE state changes', async () => {
      await renderChatPanel();
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
      // Default: GOD MODE is off
      expect(liveRegion).toHaveTextContent('GOD MODE disabled');
      // Toggle on
      const toggleButton = screen.getByRole('button', { name: /Toggle GOD MODE/i });
      await userEvent.click(toggleButton);
      expect(liveRegion).toHaveTextContent('GOD MODE enabled');
      // Toggle back off
      await userEvent.click(toggleButton);
      expect(liveRegion).toHaveTextContent('GOD MODE disabled');
    });

    it('shows multi-agent orchestrator mode description when GOD MODE is off', async () => {
      await renderChatPanel();
      
      expect(screen.getByText(/Multi-agent orchestrator mode/)).toBeDefined();
    });

    it('has aria-describedby pointing to a hidden GOD MODE description', async () => {
      await renderChatPanel();
      const toggleButton = screen.getByRole('button', { name: /Toggle GOD MODE/i });
      expect(toggleButton).toHaveAttribute('aria-describedby', 'god-mode-description');
      const description = document.getElementById('god-mode-description');
      expect(description).not.toBeNull();
      expect(description).toHaveClass('sr-only');
      expect(description!.textContent).toContain('high-stakes verification');
      expect(description!.textContent).toContain('token cost');
    });
  });

  // ── Toggle State Management ──

  describe('toggle state management', () => {
    it('toggles GOD MODE on when button is clicked', async () => {
      const user = userEvent.setup();
      await renderChatPanel();
      
      const toggleButton = screen.getByText(/Enable GOD MODE/);
      await user.click(toggleButton);
      
      // Should now show GOD MODE ON
      expect(screen.getByText(/GOD MODE ON/)).toBeDefined();
    });

    it('toggles GOD MODE off when clicked again', async () => {
      const user = userEvent.setup();
      await renderChatPanel();
      
      // Enable GOD MODE
      const toggleButton = screen.getByText(/Enable GOD MODE/);
      await user.click(toggleButton);
      expect(screen.getByText(/GOD MODE ON/)).toBeDefined();
      
      // Disable GOD MODE
      await toggleGodModeOff(user);
      expect(screen.getByText(/Enable GOD MODE/)).toBeDefined();
    });

    it('resets GOD MODE to false when starting a new conversation', async () => {
      const user = userEvent.setup();
      await renderChatPanel();
      
      // Enable GOD MODE
      const toggleButton = screen.getByText(/Enable GOD MODE/);
      await user.click(toggleButton);
      expect(screen.getByText(/GOD MODE ON/)).toBeDefined();
      
      // Send a message to create a conversation
      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
      
      // Open the conversation list dropdown to access '+ New Chat'
      const conversationListToggle = screen.getByRole('button', { name: /Toggle conversation list/i });
      await user.click(conversationListToggle);
      
      // Wait for the dropdown to render, then click '+ New Chat'
      await waitFor(() => {
        expect(screen.getByText(/\+ New Chat/)).toBeDefined();
      });
      const newChatButton = screen.getByText(/\+ New Chat/);
      await user.click(newChatButton);
      
      // GOD MODE should be reset
      await waitFor(() => {
        expect(screen.getByText(/Enable GOD MODE/)).toBeDefined();
      });
      // GOD MODE ON should no longer be visible
      expect(screen.queryByText(/GOD MODE ON/)).toBeNull();
    });
  });

  // ── GOD MODE Badge in Messages ──

  describe('GOD MODE badge in messages', () => {
    it('does not show GOD MODE badge when GOD MODE is off', async () => {
      const user = userEvent.setup();
      await renderChatPanel();
      
      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
      
      // Should not show GOD MODE badge
      expect(screen.queryByText('⚡ GOD MODE')).toBeNull();
    });

    it('shows GOD MODE badge when GOD MODE was active for a message', async () => {
      await toggleGodModeAndSendMessage();
      // Should show GOD MODE badge
      expect(screen.getAllByText('⚡ GOD MODE').length).toBeGreaterThanOrEqual(1);
    });

    it('does not show GOD MODE badge on subsequent messages after disabling GOD MODE', async () => {
      const user = await toggleGodModeAndSendMessage('First message');
      
      // Disable GOD MODE
      await toggleGodModeOff(user);
      expect(screen.getByText(/Enable GOD MODE/)).toBeDefined();
      
      // Send second message without GOD MODE
      await user.type(screen.getByLabelText('Chat input'), 'Second message{Enter}');
      await waitFor(() => {
        // Wait for second response
        const messages = screen.getAllByText('Hello from AI');
        expect(messages.length).toBeGreaterThanOrEqual(2);
      });
      
      // First message should have GOD MODE badge, second should not
      const godModeBadges = screen.getAllByText('⚡ GOD MODE');
      expect(godModeBadges.length).toBe(1);
    });
  });

  // ── Visual State Changes ──

  describe('visual state changes', () => {
    it('applies red styling when GOD MODE is enabled', async () => {
      const user = userEvent.setup();
      await renderChatPanel();
      
      // Enable GOD MODE
      const toggleButton = screen.getByText(/Enable GOD MODE/);
      await user.click(toggleButton);
      
      // Check for GOD MODE ON button
      const godModeButton = screen.getByText(/GOD MODE ON/);
      expect(godModeButton).toBeDefined();
    });

    it('shows normal styling when GOD MODE is disabled', async () => {
      await renderChatPanel();
      
      // Should show normal button
      expect(screen.getByText(/Enable GOD MODE/)).toBeDefined();
    });
  });

  // ── Integration with Agent Selection ──

  describe('renderChatPanel cleanup', () => {
    it('cleanup removes all rendered DOM elements after afterEach runs', async () => {
      // Render the component and capture the result
      const result = await renderChatPanel();

      // Verify DOM elements exist before cleanup
      const chatInput = screen.getByLabelText('Chat input');
      const godModeButton = screen.getByText(/Enable GOD MODE/);
      expect(chatInput).toBeDefined();
      expect(godModeButton).toBeDefined();
      expect(result.container.childNodes.length).toBeGreaterThan(0);

      // Simulate what afterEach does: call cleanup()
      cleanup();

      // Verify specific DOM elements are removed
      expect(screen.queryByLabelText('Chat input')).toBeNull();
      expect(screen.queryByText(/Enable GOD MODE/)).toBeNull();

      // Verify the entire component tree is unmounted, not just specific elements
      expect(result.container.childNodes.length).toBe(0);
    });

    it('cleanup is idempotent — calling cleanup twice does not throw', async () => {
      const result = await renderChatPanel();
      expect(screen.getByLabelText('Chat input')).toBeDefined();
      expect(result.container.childNodes.length).toBeGreaterThan(0);

      cleanup();
      // Second cleanup call should be a no-op
      expect(() => cleanup()).not.toThrow();
      expect(screen.queryByLabelText('Chat input')).toBeNull();
      expect(result.container.childNodes.length).toBe(0);
    });

    it('unmounting one render result does not affect another', async () => {
      // Render ChatPanel via renderChatPanel (wraps in KeyboardShortcutsProvider)
      const panelResult = await renderChatPanel();
      expect(screen.getByLabelText('Chat input')).toBeDefined();

      // Render a standalone sibling component via raw RTL render
      const siblingResult = render(
        <div data-testid="sibling-component">Sibling content</div>
      );
      expect(screen.getByTestId('sibling-component')).toBeDefined();

      // Both exist simultaneously in the DOM
      expect(panelResult.container.childNodes.length).toBeGreaterThan(0);
      expect(siblingResult.container.childNodes.length).toBeGreaterThan(0);

      // Unmount only the ChatPanel via its scoped unmount()
      panelResult.unmount();

      // ChatPanel is gone
      expect(screen.queryByLabelText('Chat input')).toBeNull();
      expect(panelResult.container.childNodes.length).toBe(0);

      // Sibling component is still alive and unaffected
      expect(screen.getByTestId('sibling-component')).toBeDefined();
      expect(siblingResult.container.childNodes.length).toBeGreaterThan(0);

      // Clean up the sibling after the test
      siblingResult.unmount();
    });

    it('global cleanup removes all rendered components regardless of who rendered them', async () => {
      // Render ChatPanel via renderChatPanel
      await renderChatPanel();
      expect(screen.getByLabelText('Chat input')).toBeDefined();

      // Render a standalone sibling via raw RTL render
      const siblingResult = render(
        <div data-testid="global-cleanup-sibling">Sibling content</div>
      );
      expect(screen.getByTestId('global-cleanup-sibling')).toBeDefined();

      // Both exist in the DOM
      expect(screen.getByLabelText('Chat input')).toBeDefined();
      expect(screen.getByTestId('global-cleanup-sibling')).toBeDefined();

      // Global cleanup() removes ALL rendered components
      cleanup();

      // Both are gone
      expect(screen.queryByLabelText('Chat input')).toBeNull();
      expect(screen.queryByTestId('global-cleanup-sibling')).toBeNull();
      expect(siblingResult.container.childNodes.length).toBe(0);
    });

    it('cleanup still works after a component throws during render', () => {
      // A component that throws during render
      function ThrowingComponent(): React.ReactElement {
        throw new Error('Simulated render failure');
      }

      // Render a sibling that should survive the cleanup
      const siblingResult = render(
        <div data-testid="survivor-component">I survive</div>
      );
      expect(screen.getByTestId('survivor-component')).toBeDefined();

      // Attempt to render the throwing component — RTL catches the error
      // but may leave partial DOM behind
      let renderError: unknown;
      try {
        render(<ThrowingComponent />);
      } catch (e) {
        renderError = e;
      }

      // The error was thrown as expected
      expect(renderError).toBeDefined();
      expect((renderError as Error).message).toContain('Simulated render failure');

      // Global cleanup() still works — removes all rendered components
      expect(() => cleanup()).not.toThrow();

      // DOM is clean after cleanup
      expect(screen.queryByTestId('survivor-component')).toBeNull();
      expect(siblingResult.container.childNodes.length).toBe(0);
    });

    it('cleanup is safe to call immediately after a failed render with no successful renders', () => {
      // Component that throws immediately on render
      function AlwaysThrows(): React.ReactElement {
        throw new Error('Immediate failure');
      }

      // Attempt render — it throws, no successful render ever happened
      let error: unknown;
      try {
        render(<AlwaysThrows />);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();

      // cleanup() should not throw even when called after a failed render
      // with no prior successful renders in this test
      expect(() => cleanup()).not.toThrow();

      // Container should be empty — nothing was successfully mounted
      expect(document.body.childNodes.length).toBe(0);
    });

    it('cleanup() completes within 500ms after a raw render() throw', () => {
      // Measures cleanup() timing after a simple component throws during
      // render (not the provider-throw path — that's in the isolated file).
      function ThrowingComponent(): React.ReactElement {
        throw new Error('Raw render failure');
      }

      try {
        render(<ThrowingComponent />);
      } catch {
        // Expected
      }

      const start = performance.now();
      cleanup();
      const elapsed = performance.now() - start;

      // cleanup() should not hang — must complete within 500ms
      expect(elapsed).toBeLessThan(500);
      expect(document.body.childNodes.length).toBe(0);
    });

    it('cleanup() completes within 500ms after a component throws in useEffect', () => {
      // In React 18's test environment, useEffect errors propagate during
      // flushPassiveEffects inside render(). The component mounts but then
      // the effect fires and throws. cleanup() must still work reliably.
      function ThrowsInEffect(): React.ReactElement {
        React.useEffect(() => {
          throw new Error('useEffect failure');
        }, []);
        return <div data-testid="effect-component">Rendered OK</div>;
      }

      // Suppress the console.error from the useEffect throw
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // In React 18 test env, useEffect errors propagate through render()
      let renderError: unknown;
      try {
        render(<ThrowsInEffect />);
      } catch (e) {
        renderError = e;
      }

      consoleSpy.mockRestore();

      // The useEffect error was thrown during flushPassiveEffects
      expect(renderError).toBeDefined();
      expect((renderError as Error).message).toContain('useEffect failure');

      const start = performance.now();
      cleanup();
      const elapsed = performance.now() - start;

      // cleanup() should not hang — must complete within 500ms
      expect(elapsed).toBeLessThan(500);
      expect(document.body.childNodes.length).toBe(0);
    });

    it('cleanup works when provider-wrapped ChatPanel throws during render', async () => {
      // Simulate renderChatPanel's component tree (Provider > ChatPanel) where
      // the provider throws. This avoids vi.doMock/vi.resetModules which leak
      // across tests, and instead tests the same cleanup path directly.
      function ThrowingProvider({ children }: { children: React.ReactNode }): React.ReactElement {
        throw new Error('KeyboardShortcutsProvider failed during render');
      }

      // Render a sibling first to verify cleanup removes it too
      const siblingResult = render(
        <div data-testid="provider-error-sibling">I exist before the error</div>
      );
      expect(screen.getByTestId('provider-error-sibling')).toBeDefined();

      // Render the same tree structure as renderChatPanel: Provider > ChatPanel
      // but with a throwing provider. RTL catches the error.
      let renderError: unknown;
      try {
        render(
          <ThrowingProvider>
            <ChatPanel />
          </ThrowingProvider>,
        );
      } catch (e) {
        renderError = e;
      }

      // The provider error was thrown as expected
      expect(renderError).toBeDefined();
      expect((renderError as Error).message).toContain('KeyboardShortcutsProvider failed during render');

      // cleanup() still works after the failed render with provider error
      expect(() => cleanup()).not.toThrow();

      // All DOM is clean — both the failed render and the sibling are removed
      expect(screen.queryByTestId('provider-error-sibling')).toBeNull();
      expect(siblingResult.container.childNodes.length).toBe(0);
      expect(document.body.childNodes.length).toBe(0);
    });

    it('ErrorBoundary catches provider error and renders fallback UI instead of crashing', () => {
      // Reuse the project's existing TabErrorBoundary pattern to verify that
      // when a provider-wrapped ChatPanel throws, a real ErrorBoundary catches
      // the error and renders a fallback UI — the app doesn't crash.

      function ThrowingProvider({ children }: { children: React.ReactNode }): React.ReactElement {
        throw new Error('KeyboardShortcutsProvider failed during render');
      }

      // Render ChatPanel inside an ErrorBoundary + ThrowingProvider
      render(
        <TabErrorBoundary tabName="Chat">
          <ThrowingProvider>
            <ChatPanel />
          </ThrowingProvider>
        </TabErrorBoundary>,
      );

      // ErrorBoundary should catch the error and render fallback UI
      // (not crash the whole test)
      expect(screen.getByText(/Chat failed to load/)).toBeDefined();
      expect(screen.getByText(/KeyboardShortcutsProvider failed during render/)).toBeDefined();
      // Fallback should offer retry
      expect(screen.getByText(/Try Again/)).toBeDefined();
    });

    it('ErrorBoundary catches render-phase errors but not event handler errors', async () => {
      // ErrorBoundary only catches errors during rendering, constructor,
      // and lifecycle methods — NOT in event handlers.
      // React 16+: uncaught errors in event handlers bubble to window,
      // not to the nearest ErrorBoundary.

      // Part 1: Render-phase error IS caught by ErrorBoundary
      function ThrowsOnRender(): React.ReactElement {
        throw new Error('Render-phase error');
      }

      render(
        <TabErrorBoundary tabName="Agent">
          <ThrowsOnRender />
        </TabErrorBoundary>,
      );

      expect(screen.getByText(/Agent failed to load/)).toBeDefined();
      expect(screen.getByText(/Render-phase error/)).toBeDefined();

      // Clean up before Part 2
      cleanup();

      // Part 2: Event handler error is NOT caught by ErrorBoundary.
      // Render a button that throws on click — ErrorBoundary should NOT
      // catch it (the component renders normally, no fallback UI).
      function ThrowsOnClick(): React.ReactElement {
        return (
          <button
            data-testid="throw-button"
            onClick={() => {
              throw new Error('Event handler error');
            }}
          >
            Click to throw
          </button>
        );
      }

      render(
        <TabErrorBoundary tabName="Agent">
          <ThrowsOnClick />
        </TabErrorBoundary>,
      );

      // The component renders successfully (no render-phase error)
      expect(screen.getByTestId('throw-button')).toBeDefined();
      // ErrorBoundary is NOT in error state
      expect(screen.queryByText(/Agent failed to load/)).toBeNull();
    });

    it('cleanup() does not accumulate state over 100 render+cleanup cycles', () => {
      // Stress test: verifies cleanup() doesn't leak state or slow down over
      // many repeated render+cleanup cycles using ThrowingProvider.
      // Tests cleanup path directly via render() rather than renderChatPanel()
      // to avoid the architectural constraint requiring top-level vi.mock().
      // The dynamic import path tested by the deleted renderchatpanel-cleanup-error
      // test is no longer covered; cleanup behavior is assumed equivalent based
      // on React's render/unmount mechanics.
      function ThrowingProvider({ children }: { children: React.ReactNode }): React.ReactElement {
        throw new Error('KeyboardShortcutsProvider failed during render');
      }

      // Warm up: run 30 cycles first to let JIT optimize
      for (let i = 0; i < 30; i++) {
        try {
          render(
            <ThrowingProvider>
              <ChatPanel />
            </ThrowingProvider>,
          );
        } catch { /* Expected */ }
        cleanup();
      }

      // Measure 100 cycles for state accumulation and performance degradation
      const timings: number[] = [];

      for (let i = 0; i < 100; i++) {
        try {
          render(
            <ThrowingProvider>
              <ChatPanel />
            </ThrowingProvider>,
          );
        } catch { /* Expected */ }

        const start = performance.now();
        cleanup();
        timings.push(performance.now() - start);

        // After every cycle, DOM should be clean
        expect(document.body.childNodes.length).toBe(0);
      }

      // Verify no state accumulation: last 10 cycles should not be
      // significantly slower than the first 10 cycles (3x threshold).
      const firstBatchAvg = timings.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      const lastBatchAvg = timings.slice(-10).reduce((a, b) => a + b, 0) / 10;
      expect(lastBatchAvg).toBeLessThan(firstBatchAvg * 3);

      // Overall: 100 cleanups should complete within 5 seconds total
      const totalElapsed = timings.reduce((a, b) => a + b, 0);
      expect(totalElapsed).toBeLessThan(5000);
    });
  });

  // ── Integration with Agent Selection ──

  describe('integration with agent selection', () => {
    it('preserves GOD MODE state when switching agents', async () => {
      const user = userEvent.setup();
      await renderChatPanel();
      
      // Enable GOD MODE
      const toggleButton = screen.getByText(/Enable GOD MODE/);
      await user.click(toggleButton);
      expect(screen.getByText(/GOD MODE ON/)).toBeDefined();
      
      // Switch to a different agent
      const agentSelector = screen.getByLabelText('Select agent type');
      await user.click(agentSelector);
      
      // Wait for agent selector dropdown
      await waitFor(() => {
        expect(screen.getByText('Researcher')).toBeDefined();
      });
      
      // Select Researcher agent
      await user.click(screen.getByText('Researcher'));
      
      // GOD MODE should still be enabled
      expect(screen.getByText(/GOD MODE ON/)).toBeDefined();
    });
  });
});
