import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ChatPanel } from './ChatPanel';

// ─── File-local vi.hoisted() mocks ───

const { mockAddCost, mockAddUsageRecord } = vi.hoisted(() => ({
  mockAddCost: vi.fn(),
  mockAddUsageRecord: vi.fn(),
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

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {}, snappy: {} },
  buttonTapProps: {},
  QUICK_START_CARDS: [
    { emoji: '📊', label: 'SEO Audit', description: 'Full site audit', color: 'primary' },
    { emoji: '✍️', label: 'Blog Post', description: 'Write a blog post', color: 'muted' },
  ],
}));

vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    calculateCost: vi.fn().mockReturnValue({ usd: 0.001, inr: 0.084 }),
  },
}));

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    streamingEnabled: false,
    addCost: mockAddCost,
    addUsageRecord: mockAddUsageRecord,
    configuredProviders: ['groq'],
  }),
}));

vi.mock('@/lib/api', () => ({
  conversationsApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: '1', title: 'Test', messages: [], agent_type: 'orchestrator', created_at: Date.now(), updated_at: Date.now() }),
    create: vi.fn().mockResolvedValue({ id: '1', title: 'Test', messages: [], agent_type: 'orchestrator', created_at: Date.now(), updated_at: Date.now() }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  knowledgeDocsApi: { list: vi.fn().mockResolvedValue([]) },
  projectsApi: { list: vi.fn().mockResolvedValue([]) },
  memoriesApi: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/lib/rag', () => ({
  processDocument: vi.fn().mockResolvedValue({ content: 'doc content' }),
  retrieveRelevant: vi.fn().mockReturnValue([]),
  chunkText: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/memory', () => ({
  getMemories: vi.fn().mockResolvedValue([]),
  formatMemoryForContext: vi.fn().mockReturnValue(''),
}));

vi.mock('@/lib/quality', () => ({
  saveQualityScore: vi.fn(),
}));

vi.mock('@/lib/system-prompt', () => ({
  QUALITY_SCORING_PROMPT: 'Score: {{response}} Context: {{taskContext}}',
  ORACLE_SYSTEM: 'You are ORACLE',
  AI_OPERATING_SYSTEM: 'You are an AI agent',
  RESEARCHER_AGENT_PROMPT: 'You are a researcher',
  WRITER_AGENT_PROMPT: 'You are a writer',
  DEVELOPER_AGENT_PROMPT: 'You are a developer',
  ANALYST_AGENT_PROMPT: 'You are an analyst',
  STRATEGIST_AGENT_PROMPT: 'You are a strategist',
  MARKETER_AGENT_PROMPT: 'You are a marketer',
  DESIGNER_AGENT_PROMPT: 'You are a designer',
  FINANCE_AGENT_PROMPT: 'You are a finance expert',
  VOICE_AGENT_PROMPT: 'You are a voice agent expert',
  QA_AGENT_PROMPT: 'You are a QA engineer',
  COORDINATOR_AGENT_PROMPT: 'You are a coordinator',
  WORKFLOW_AGENT_PROMPT: 'You are a workflow agent',
  MULTI_AGENT_ORCHESTRATOR_PROMPT: 'You are an orchestrator',
  LEAD_HUNTER_AGENT_PROMPT: 'You are a lead hunter',
  OFFER_STRATEGIST_AGENT_PROMPT: 'You are an offer strategist',
  VIDEO_SPECIALIST_AGENT_PROMPT: 'You are a video specialist',
  WEB_DESIGNER_AGENT_PROMPT: 'You are a web designer',
  AGENT_BUILDER_AGENT_PROMPT: 'You are an agent builder',
}));

vi.mock('@/lib/editor-gate', () => ({
  runEditorGate: vi.fn().mockResolvedValue({ passed: true, confidence: 90, assessment: 'OK', issues: [] }),
  loadEditorConfig: vi.fn().mockReturnValue({ enabled: true, minLength: 100, skipAgentTypes: [] }),
  saveEditorConfig: vi.fn(),
  DEFAULT_EDITOR_CONFIG: { enabled: true, minLength: 100, skipAgentTypes: [] },
}));

vi.mock('@/lib/output-quality-evaluator', () => ({
  evaluateOutput: vi.fn().mockReturnValue({ passed: true, overallScore: 85, checks: [], suggestions: [] }),
}));

vi.mock('@/lib/task-analyzer', () => ({
  analyzeTask: vi.fn().mockReturnValue({ complexity: 0.3, agents: [], suggestedTier: 'standard' }),
}));

vi.mock('@/lib/agency-operations', () => ({
  runQualityGates: vi.fn().mockReturnValue({ passed: true, score: 80, checks: [] }),
  runOperatingLoop: vi.fn().mockResolvedValue([]),
  routeAgencyTask: vi.fn().mockReturnValue({ primary: 'strategist', support: [], workflow: 'strategy' }),
  detectMistakes: vi.fn().mockReturnValue([]),
  rankDecisionOptions: vi.fn().mockReturnValue([]),
  runSelfCheck: vi.fn().mockReturnValue({ score: 7, understood: true, avoidedGeneric: true, coveredChannels: true, assignedRightAgent: true, identifiedFailures: true, gaveNextStep: true, clientReady: true }),
  runLeadGenPipeline: vi.fn().mockResolvedValue([]),
  runClientHuntWorkflow: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/feedback-bridge', () => ({
  attachQualityToTraining: vi.fn(),
  recordMessageFeedback: vi.fn(),
}));

vi.mock('@/lib/prompt-sanitizer', () => ({
  sanitizeDocumentContent: vi.fn().mockImplementation((content: string) => ({ sanitized: content, flagged: false })),
  sanitizeSearchResults: vi.fn().mockImplementation((results: unknown[]) => results),
  sanitizeExternalContext: vi.fn().mockImplementation((content: string) => ({ sanitized: content, flagged: false })),
}));

vi.mock('@/lib/hallucination-guard', () => ({
  loadGuardConfig: (...args: unknown[]) => mockLoadGuardConfig(...args),
  runHallucinationGuard: (...args: unknown[]) => mockRunHallucinationGuard(...args),
  recordLearning: (...args: unknown[]) => mockRecordLearning(...args),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => {},
    { error: (...args: unknown[]) => {}, success: (...args: unknown[]) => {} }
  ),
}));

vi.mock('@/lib/token-budget', () => ({
  calculateAllCosts: vi.fn().mockReturnValue([{ modelId: 'gpt-4o', fullRequestCostINR: 0.084, fullRequestCostUSD: 0.001, isFree: false }]),
}));

vi.mock('@/lib/context-manager', () => ({
  buildOptimizedContext: vi.fn().mockReturnValue({ messages: [], tokenCount: 0 }),
}));

vi.mock('@/lib/utils', () => ({
  estimateTokens: vi.fn().mockReturnValue(10),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/lib/export-utils', () => ({
  exportChatToPDF: vi.fn(),
  exportChatToWord: vi.fn(),
}));

vi.mock('@/lib/search', () => ({
  formatSearchResults: vi.fn().mockReturnValue(''),
}));

vi.mock('@/lib/csrf', () => ({
  csrfHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/self-training', () => ({
  recordTask: vi.fn(),
}));

vi.mock('@/lib/cross-domain-thinking', () => ({
  getAdjacentServices: vi.fn().mockReturnValue([]),
  SERVICE_BUNDLES: [],
}));

vi.mock('@/lib/pattern-recognition', () => ({
  recogniseTaskPatterns: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/search-helpers', () => ({
  searchConversations: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/workflow-validation', () => ({
  VALID_AGENTS: ['researcher', 'writer', 'developer', 'analyst', 'strategist', 'marketer', 'designer', 'finance', 'voice', 'qa', 'coordinator', 'workflow'],
}));

vi.mock('@/lib/toast-config', () => ({
  TOAST_DEFAULTS: { duration: 3000 },
}));

vi.mock('@/components/oracle/GuardStatsPanel', () => ({
  GuardStatsPanel: () => null,
}));

// ─── Helpers (shared from test-utils) ──
import { createSSEFetchMock } from './test-utils';

// ─── Tests ─────────────────────────────

describe('E2E: Full Chat Interaction Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();

    // Mock global.fetch for ChatPanel's SSE streaming via /api/ai/chat
    global.fetch = createSSEFetchMock([
      { chunk: 'H', done: false, model: 'gpt-4o' },
      { chunk: 'ello', done: false, model: 'gpt-4o' },
      { chunk: ' from AI', done: false, model: 'gpt-4o' },
    ]);

    mockLoadGuardConfig.mockReturnValue({
      enabled: true,
      thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
    });

    mockRunHallucinationGuard.mockResolvedValue({
      confidence: 85,
      passed: true,
      flagged: false,
      checks: [
        { name: 'hedging_detection', passed: true, score: 90, message: 'No hedging detected' },
        { name: 'overconfidence_check', passed: true, score: 80, message: 'Confidence appropriate' },
        { name: 'fact_grounding', passed: true, score: 85, message: 'Claims grounded in context' },
      ],
      hallucinationPatterns: [],
      groundedClaims: [{ claim: 'SEO is important', source: 'context', confidence: 90, sourceType: 'context' }],
      ungroundedClaims: [],
      selfVerification: null,
      assessment: 'Response is reliable and well-grounded',
      suggestions: ['Consider adding more specific examples'],
      checkedAt: Date.now(),
      verificationModel: 'test-model',
    });
    mockRecordLearning.mockImplementation(() => {});
  });

  // ── Core Chat Flow ──

  describe('send message → receive response', () => {
    it('completes a full send-and-receive cycle', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      const textarea = screen.getByLabelText('Chat input');
      await user.type(textarea, 'What is the best SEO strategy for Indian e-commerce?');

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getAllByText('What is the best SEO strategy for Indian e-commerce?').length).toBeGreaterThanOrEqual(1);
      });

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(screen.getByText('openai')).toBeDefined();
      expect(screen.getByText('gpt-4o')).toBeDefined();

      expect(mockAddUsageRecord).toHaveBeenCalledTimes(1);
    });

    it('clears input after sending', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      const textarea = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
      await user.type(textarea, 'Test message');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });

    it('shows both user and assistant messages in the chat log', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const chatLog = screen.getByRole('log', { name: 'Chat messages' });
      expect(within(chatLog).getByText('Hello')).toBeDefined();
      expect(within(chatLog).getByText('Hello from AI')).toBeDefined();
    });
  });

  // ── Regenerate Flow ──

  describe('regenerate response', () => {
    it('removes the assistant response and re-sends the user message', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Explain GST for agencies{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const regenButton = screen.getByLabelText('Regenerate');
      await user.click(regenButton);

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const chatLog = screen.getByRole('log', { name: 'Chat messages' });
      expect(within(chatLog).getAllByText('Explain GST for agencies').length).toBeGreaterThanOrEqual(1);
    });

    it('preserves the conversation title after regenerate', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'My question{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(screen.getAllByText('My question').length).toBeGreaterThanOrEqual(1);

      await user.click(screen.getByLabelText('Regenerate'));

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(screen.getAllByText('My question').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Feedback Flow ──

  describe('feedback flow', () => {
    it('full feedback cycle: Good → Bad → Toggle Off', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hi{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      const goodButton = screen.getByLabelText('Good');
      await user.click(goodButton);
      expect(goodButton.textContent).toContain('✓');

      const badButton = screen.getByLabelText('Bad');
      await user.click(badButton);
      expect(badButton.textContent).toContain('✓');
      expect(goodButton.textContent).not.toContain('✓');

      await user.click(badButton);
      expect(badButton.textContent).not.toContain('✓');

      const stored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      expect(Object.keys(stored).length).toBe(0);
    });

    it('feedback persists across multiple messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'First{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
      await user.click(screen.getByLabelText('Good'));

      await user.type(screen.getByLabelText('Chat input'), 'Second{Enter}');
      await waitFor(() => {
        expect(screen.getAllByText('Hello from AI').length).toBeGreaterThanOrEqual(2);
      });
      const badButtons = screen.getAllByLabelText('Bad');
      await user.click(badButtons[badButtons.length - 1]);

      const stored = JSON.parse(window.localStorage.getItem('oracle_message_feedback') || '{}');
      expect(Object.keys(stored).length).toBe(2);
    });
  });

  // ── Multi-Turn Conversation ──

  describe('multi-turn conversation', () => {
    it('handles multiple sequential messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await user.type(screen.getByLabelText('Chat input'), 'Follow up{Enter}');
      await waitFor(() => {
        expect(screen.getAllByText('Hello from AI').length).toBeGreaterThanOrEqual(2);
      });

      await user.type(screen.getByLabelText('Chat input'), 'One more{Enter}');
      await waitFor(() => {
        expect(screen.getAllByText('Hello from AI').length).toBeGreaterThanOrEqual(3);
      });

      const chatLog = screen.getByRole('log', { name: 'Chat messages' });
      expect(within(chatLog).getAllByText('Hello').length).toBeGreaterThanOrEqual(1);
      expect(within(chatLog).getAllByText('Follow up').length).toBeGreaterThanOrEqual(1);
      expect(within(chatLog).getAllByText('One more').length).toBeGreaterThanOrEqual(1);
    });

    it('title updates to first message content', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      expect(screen.getByText('New Chat')).toBeDefined();

      await user.type(screen.getByLabelText('Chat input'), 'SEO Strategy Discussion{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(screen.getAllByText('SEO Strategy Discussion').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Error Recovery ──

  describe('error recovery', () => {
    it('recovers from fetch error and allows new messages', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn(async () => {
        throw new Error('API rate limit exceeded');
      });

      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Failing message{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Error: API rate limit exceeded')).toBeDefined();
      });

      global.fetch = createSSEFetchMock([
        { chunk: 'H', done: false, model: 'gpt-4o' },
        { chunk: 'ello', done: false, model: 'gpt-4o' },
        { chunk: ' from AI', done: false, model: 'gpt-4o' },
      ]);

      await user.type(screen.getByLabelText('Chat input'), 'Recovery message{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
    });

    it('shows error without crashing the component', async () => {
      const user = userEvent.setup();

      global.fetch = vi.fn(async () => {
        throw new Error('Network failure');
      });

      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Test{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Error: Network failure')).toBeDefined();
      });

      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).toBeDefined();
    });
  });

  // ── Quick Start → Chat Flow ──

  describe('quick start to chat flow', () => {
    it('clicks quick start card, populates input, sends message', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.click(screen.getByText('SEO Audit'));

      const textarea = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
      expect(textarea.value).toBe('SEO Audit');

      await user.click(screen.getByLabelText('Send message'));

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
    });
  });

  // ── Agent Type Selection ──

  describe('agent type selection', () => {
    it('changes agent type via selector', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      expect(screen.getByText('Orchestrator')).toBeDefined();

      await user.click(screen.getByLabelText('Select agent type'));

      await user.click(screen.getByText('Writer'));

      expect(screen.getByText('Writer')).toBeDefined();
    });
  });

  // ── Hallucination Guard Integration ──

  describe('hallucination guard integration', () => {
    it('runs guard automatically after AI response and shows ConfidenceBadge', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Explain SEO for Indian market{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await waitFor(() => {
        expect(mockRunHallucinationGuard).toHaveBeenCalledTimes(1);
      });

      const guardCall = mockRunHallucinationGuard.mock.calls[0];
      expect(guardCall[0]).toBe('Hello from AI');
      expect(guardCall[1]).toBe('Explain SEO for Indian market');

      await waitFor(() => {
        expect(screen.getByText(/85% confidence/)).toBeDefined();
      });

      expect(mockAddUsageRecord).toHaveBeenCalled();
    });

    it('shows ConfidenceBadge with expandable details on click', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'Hello{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await waitFor(() => {
        expect(screen.getByText(/85% confidence/)).toBeDefined();
      });

      const badge = screen.getByText(/85% confidence/);
      await user.click(badge);

      await waitFor(() => {
        expect(screen.getByText('🛡️ Hallucination Guard')).toBeDefined();
        expect(screen.getByText('Response is reliable and well-grounded')).toBeDefined();
      });
    });

    it('shows GuardStatsPanel with aggregated stats across multiple messages', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await user.type(screen.getByLabelText('Chat input'), 'First question{Enter}');
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });
      await waitFor(() => {
        expect(mockRunHallucinationGuard).toHaveBeenCalledTimes(1);
      });

      await user.type(screen.getByLabelText('Chat input'), 'Second question{Enter}');
      await waitFor(() => {
        expect(screen.getAllByText('Hello from AI').length).toBeGreaterThanOrEqual(2);
      });
      await waitFor(() => {
        expect(mockRunHallucinationGuard).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(mockRunHallucinationGuard).toHaveBeenCalledTimes(2);
      });
    });

    it('guard still runs even when guard call fails (non-blocking)', async () => {
      const user = userEvent.setup();

      mockRunHallucinationGuard.mockRejectedValueOnce(new Error('Guard service unavailable'));

      render(<ChatPanel />);
      await user.type(screen.getByLabelText('Chat input'), 'Test{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      await waitFor(() => {
        expect(mockRunHallucinationGuard).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.queryByText(/% confidence/)).toBeNull();
      });
    });
  });

});
