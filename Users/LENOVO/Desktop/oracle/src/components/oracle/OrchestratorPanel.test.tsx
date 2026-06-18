import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { OrchestratorPanel } from './OrchestratorPanel';

// ─── Mocks ─────────────────────────────

// Mock react-hot-toast
const mockToast = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    { success: (...args: unknown[]) => mockToast(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ) as any,
  toast: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    { success: (...args: unknown[]) => mockToast(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ) as any,
}));

// Mock NeverStopRouter
const mockCallSync = vi.fn();
vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    callSync: (...args: unknown[]) => mockCallSync(...args),
  },
}));

// ─── Helpers ───────────────────────────

function createOrchestratorResponse(overrides: Record<string, unknown> = {}) {
  return {
    analysis: 'This task requires market research, brand strategy, and content creation.',
    plan: [
      {
        agent: 'researcher',
        task: 'Research the D2C skincare market in India',
        inputs: 'Client brief, target audience details',
        expectedOutput: 'Market analysis report with competitor landscape',
        dependsOn: [],
      },
      {
        agent: 'strategist',
        task: 'Develop brand positioning strategy',
        inputs: 'Market research from researcher',
        expectedOutput: 'Brand positioning document with key messages',
        dependsOn: [0],
      },
      {
        agent: 'writer',
        task: 'Create content calendar and social media posts',
        inputs: 'Brand strategy from strategist',
        expectedOutput: '30-day content calendar with post drafts',
        dependsOn: [1],
      },
    ],
    synthesisInstructions: 'Combine all outputs into a comprehensive digital marketing strategy document.',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────

describe('OrchestratorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
    mockToastError.mockClear();
    mockCallSync.mockResolvedValue({
      text: JSON.stringify(createOrchestratorResponse()),
      provider: 'openai',
      model: 'gpt-4o',
    });
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the orchestrator header', () => {
      render(<OrchestratorPanel />);
      expect(screen.getByText('⚡ Agent Orchestrator')).toBeDefined();
      expect(screen.getByText(/Decompose complex tasks across specialist agents/)).toBeDefined();
    });

    it('renders the analyze button', () => {
      render(<OrchestratorPanel />);
      expect(screen.getByText('⚡ Analyze & Decompose')).toBeDefined();
    });

    it('renders empty state when no task is analyzed', () => {
      render(<OrchestratorPanel />);
      expect(screen.getByText('No Task Analyzed Yet')).toBeDefined();
      expect(screen.getByText(/Describe a complex task above/)).toBeDefined();
    });

    it('has a textarea for task input', () => {
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      expect(textarea).toBeDefined();
    });
  });

  // ── Input ──

  describe('input', () => {
    it('updates textarea value when typing', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      expect((textarea as HTMLTextAreaElement).value).toBe('Create a marketing strategy');
    });

    it('shows character count when text is entered', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Hello');
      expect(screen.getByText('5 characters')).toBeDefined();
    });

    it('disables analyze button when textarea is empty', () => {
      render(<OrchestratorPanel />);
      const button = screen.getByText('⚡ Analyze & Decompose');
      expect(button).toBeDisabled();
    });

    it('enables analyze button when textarea has content', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Some task');
      const button = screen.getByText('⚡ Analyze & Decompose');
      expect(button).not.toBeDisabled();
    });
  });

  // ── Task Analysis ──

  describe('task analysis', () => {
    it('calls NeverStopRouter.callSync when analyze is clicked', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy for a D2C brand');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(mockCallSync).toHaveBeenCalledTimes(1);
      });
    });

    it('displays task analysis after analysis completes', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('📋 Task Analysis')).toBeDefined();
        expect(screen.getByText(/This task requires market research/)).toBeDefined();
      });
    });

    it('displays execution plan with agent cards', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText(/Execution Plan \(3 agents\)/)).toBeDefined();
        expect(screen.getByText(/Agent 1: Researcher/)).toBeDefined();
        expect(screen.getByText(/Agent 2: Strategist/)).toBeDefined();
        expect(screen.getByText(/Agent 3: Writer/)).toBeDefined();
      });
    });

    it('shows agent task descriptions', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('Research the D2C skincare market in India')).toBeDefined();
        expect(screen.getByText('Develop brand positioning strategy')).toBeDefined();
        expect(screen.getByText('Create content calendar and social media posts')).toBeDefined();
      });
    });

    it('shows dependency information', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText(/Depends on: 1/)).toBeDefined();
        expect(screen.getByText(/Depends on: 2/)).toBeDefined();
      });
    });

    it('shows synthesis instructions', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('🔗 Synthesis Instructions')).toBeDefined();
        expect(screen.getByText(/Combine all outputs/)).toBeDefined();
      });
    });

    it('shows loading state during analysis', async () => {
      let resolvePromise: ((value: unknown) => void) | undefined;
      mockCallSync.mockImplementation(() =>
        new Promise((resolve) => { resolvePromise = resolve; })
      );

      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('Analyzing...')).toBeDefined();
      });

      resolvePromise?.(undefined);
    });

    it('handles analysis failure gracefully', async () => {
      mockCallSync.mockRejectedValue(new Error('API Error'));

      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeDefined();
        // Verify it's in the styled error container
        const errorEl = screen.getByText('API Error');
        expect(errorEl.closest('[class*="oracle-error"]')).toBeDefined();
      });
      // Empty state and result should not appear
      expect(screen.queryByText('No Task Analyzed Yet')).toBeNull();
      expect(screen.queryByText('📋 Task Analysis')).toBeNull();
    });

    it('handles invalid JSON response', async () => {
      mockCallSync.mockResolvedValue({
        text: 'This is not valid JSON',
        provider: 'openai',
        model: 'gpt-4o',
      });

      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        const errorEl = screen.getByText(/Failed to parse orchestrator response/);
        expect(errorEl).toBeDefined();
        // Verify it's in the styled error container
        expect(errorEl.closest('[class*="oracle-error"]')).toBeDefined();
      });
      expect(screen.queryByText('No Task Analyzed Yet')).toBeNull();
      expect(screen.queryByText('📋 Task Analysis')).toBeNull();
    });

    it('shows warning toast when JSON parsing fails', async () => {
      mockCallSync.mockResolvedValue({
        text: '{broken json content',
        provider: 'openai',
        model: 'gpt-4o',
      });

      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse orchestrator response'),
          expect.objectContaining({ duration: 3000 })
        );
      });
    });

    it('handles response with no plan array', async () => {
      mockCallSync.mockResolvedValue({
        text: JSON.stringify({ analysis: 'Some analysis', synthesisInstructions: 'Some instructions' }),
        provider: 'openai',
        model: 'gpt-4o',
      });

      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        const errorEl = screen.getByText(/Failed to parse orchestrator response/);
        expect(errorEl).toBeDefined();
        expect(errorEl.closest('[class*="oracle-error"]')).toBeDefined();
      });
      expect(screen.queryByText('No Task Analyzed Yet')).toBeNull();
    });

    it('clears error on successful retry', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');

      // First attempt fails
      mockCallSync.mockRejectedValue(new Error('Network error'));
      await user.click(screen.getByText('⚡ Analyze & Decompose'));
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeDefined();
      });

      // Second attempt succeeds
      mockCallSync.mockResolvedValue({
        text: JSON.stringify(createOrchestratorResponse()),
        provider: 'openai',
        model: 'gpt-4o',
      });
      await user.click(screen.getByText('⚡ Analyze & Decompose'));
      await waitFor(() => {
        expect(screen.queryByText('Network error')).toBeNull();
        expect(screen.getByText('📋 Task Analysis')).toBeDefined();
      });
    });

    it('shows non-Error rejection as generic message', async () => {
      mockCallSync.mockRejectedValue('something weird');

      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('Analysis failed')).toBeDefined();
        const errorEl = screen.getByText('Analysis failed');
        expect(errorEl.closest('[class*="oracle-error"]')).toBeDefined();
      });
    });
  });

  // ── Execute Plan ──

  describe('execute plan', () => {
    it('shows execute button when onAskOracle is provided', async () => {
      const onAskOracle = vi.fn();
      const user = userEvent.setup();
      render(<OrchestratorPanel onAskOracle={onAskOracle} />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('⚡ Execute Plan')).toBeDefined();
      });
    });

    it('hides execute button when onAskOracle is not provided', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('📋 Task Analysis')).toBeDefined();
      });

      expect(screen.queryByText('⚡ Execute Plan')).toBeNull();
    });

    it('calls onAskOracle with formatted plan when execute is clicked', async () => {
      const onAskOracle = vi.fn();
      const user = userEvent.setup();
      render(<OrchestratorPanel onAskOracle={onAskOracle} />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy for D2C brand');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('⚡ Execute Plan')).toBeDefined();
      });

      await user.click(screen.getByText('⚡ Execute Plan'));

      await waitFor(() => {
        expect(onAskOracle).toHaveBeenCalled();
      }, { timeout: 5000 });

      const prompt = onAskOracle.mock.calls[0][0] as string;
      expect(prompt).toContain('Research the D2C skincare market in India');
      expect(prompt).toContain('Create a marketing strategy for D2C brand');
    });
  });

  // ── Agent Visual ──

  describe('agent visualization', () => {
    it('shows correct agent emojis', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        // Emojis appear multiple times (agent cards + execution order), so use getAllByText
        expect(screen.getAllByText('🔍').length).toBeGreaterThanOrEqual(1); // researcher
        expect(screen.getAllByText('🎯').length).toBeGreaterThanOrEqual(1); // strategist
        expect(screen.getAllByText('✍️').length).toBeGreaterThanOrEqual(1); // writer
      });
    });

    it('shows inputs and outputs for each agent', async () => {
      const user = userEvent.setup();
      render(<OrchestratorPanel />);
      const textarea = screen.getByPlaceholderText(/Describe a complex task/);
      await user.type(textarea, 'Create a marketing strategy');
      await user.click(screen.getByText('⚡ Analyze & Decompose'));

      await waitFor(() => {
        expect(screen.getByText('Client brief, target audience details')).toBeDefined();
        expect(screen.getByText('Market analysis report with competitor landscape')).toBeDefined();
      });
    });
  });
});
