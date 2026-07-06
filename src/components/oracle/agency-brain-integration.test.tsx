/**
 * Integration tests for the Agency Brain end-to-end pipeline:
 *   User sends task → task analyzer → operating loop → AI response → quality gates + editor gate → badges render
 *
 * Verifies the full flow from user input through the Agency Brain's 6-step operating loop,
 * quality gate checks, editor gate auto-correction, and badge rendering in the UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ChatPanel } from './ChatPanel';

// ─── File-local vi.hoisted() mocks (needed by vi.mock factories in this file) ───

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

const { mockRunQualityGates, resetQualityGates } = vi.hoisted(() => {
  const fn = vi.fn().mockReturnValue({ passed: true, score: 80, checks: [] });
  return { mockRunQualityGates: fn, resetQualityGates: () => { fn.mockReset(); fn.mockReturnValue({ passed: true, score: 80, checks: [] }); } };
});

const { mockRunOperatingLoop, resetOperatingLoop } = vi.hoisted(() => {
  const fn = vi.fn().mockResolvedValue([]);
  return { mockRunOperatingLoop: fn, resetOperatingLoop: () => { fn.mockReset(); fn.mockResolvedValue([]); } };
});

const { mockRunEditorGate, resetEditorGate } = vi.hoisted(() => {
  const fn = vi.fn().mockResolvedValue({ passed: true, confidence: 90, assessment: 'OK', issues: [], checkedAt: Date.now() });
  return { mockRunEditorGate: fn, resetEditorGate: () => { fn.mockReset(); fn.mockResolvedValue({ passed: true, confidence: 90, assessment: 'OK', issues: [], checkedAt: Date.now() }); } };
});

const { mockAnalyzeTask, resetAnalyzeTask } = vi.hoisted(() => {
  const fn = vi.fn().mockReturnValue({
    category: 'general',
    complexity: 0.3,
    estimatedTokens: 100,
    agents: [{ role: 'researcher', priority: 1, taskFocus: 'Research', requiredTier: 'standard' }],
    parallelizable: false,
    requiresWebSearch: false,
    suggestedTier: 'standard',
  });
  return { mockAnalyzeTask: fn, resetAnalyzeTask: () => {
    fn.mockReset();
    fn.mockReturnValue({
      category: 'general',
      complexity: 0.3,
      estimatedTokens: 100,
      agents: [{ role: 'researcher', priority: 1, taskFocus: 'Research', requiredTier: 'standard' }],
      parallelizable: false,
      requiresWebSearch: false,
      suggestedTier: 'standard',
    });
  } };
});

const mockAddCost = vi.hoisted(() => vi.fn());
const mockAddUsageRecord = vi.hoisted(() => vi.fn());

let mockStreamingEnabled = true;

// ─── vi.mock() calls (must be top-level for Vitest hoisting) ───

vi.mock('nanoid', () => ({ nanoid: mockNanoid }));

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
    streamingEnabled: mockStreamingEnabled,
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
    appendMessages: vi.fn().mockResolvedValue({}),
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
  SOCIAL_MEDIA_TOOL_CONTEXT: 'Social media tools available',
}));

vi.mock('@/lib/hallucination-guard', () => ({
  loadGuardConfig: (...args: unknown[]) => mockLoadGuardConfig(...args),
  runHallucinationGuard: (...args: unknown[]) => mockRunHallucinationGuard(...args),
  recordLearning: (...args: unknown[]) => mockRecordLearning(...args),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    { error: (...args: unknown[]) => mockToastError(...args) }
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

vi.mock('@/lib/output-quality-evaluator', () => ({
  evaluateOutput: vi.fn().mockReturnValue({ passed: true, overallScore: 85, checks: [], suggestions: [] }),
}));

vi.mock('@/lib/editor-gate', () => ({
  runEditorGate: (...args: unknown[]) => mockRunEditorGate(...args),
  loadEditorConfig: vi.fn().mockReturnValue({ enabled: true, minLength: 100, skipAgentTypes: [] }),
  saveEditorConfig: vi.fn(),
  DEFAULT_EDITOR_CONFIG: { enabled: true, minLength: 100, skipAgentTypes: [] },
}));

vi.mock('@/lib/prompt-sanitizer', () => ({
  sanitizeDocumentContent: vi.fn().mockImplementation((content: string) => ({ sanitized: content, flagged: false })),
  sanitizeSearchResults: vi.fn().mockImplementation((results: unknown[]) => results),
  sanitizeExternalContext: vi.fn().mockImplementation((content: string) => ({ sanitized: content, flagged: false })),
}));

// ── Agency Operations mock (wired to our controllable mocks) ──
vi.mock('@/lib/agency-operations', () => ({
  runQualityGates: (...args: unknown[]) => mockRunQualityGates(...args),
  runOperatingLoop: (...args: unknown[]) => mockRunOperatingLoop(...args),
  routeAgencyTask: vi.fn().mockReturnValue({ primary: 'strategist', support: [], workflow: 'strategy' }),
  detectMistakes: vi.fn().mockReturnValue([]),
  rankDecisionOptions: vi.fn().mockReturnValue([]),
  runSelfCheck: vi.fn().mockReturnValue({ score: 7, understood: true, avoidedGeneric: true, coveredChannels: true, assignedRightAgent: true, identifiedFailures: true, gaveNextStep: true, clientReady: true }),
  runLeadGenPipeline: vi.fn().mockResolvedValue([]),
  runClientHuntWorkflow: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/task-analyzer', () => ({
  analyzeTask: (...args: unknown[]) => mockAnalyzeTask(...args),
}));

vi.mock('@/lib/feedback-bridge', () => ({
  attachQualityToTraining: vi.fn(),
  recordMessageFeedback: vi.fn(),
  recordGuardVerdict: vi.fn(),
}));

vi.mock('@/lib/provider-health', () => ({
  recordProviderHealth: vi.fn(),
}));

vi.mock('@/components/oracle/GuardStatsPanel', () => ({
  GuardStatsPanel: () => null,
}));

// ─── Helpers (shared from test-utils) ──
import { createSSEFetchMock } from './test-utils';

// ─── Tests ───

describe('Agency Brain End-to-End Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockStreamingEnabled = true;
    resetNanoid();
    resetToastMocks();
    resetQualityGates();
    resetOperatingLoop();
    resetEditorGate();
    resetAnalyzeTask();
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
      mockAnalyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      mockRunOperatingLoop.mockResolvedValue([
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

      expect(mockAnalyzeTask).toHaveBeenCalledTimes(1);
      expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1);
      const [taskArg] = mockRunOperatingLoop.mock.calls[0];
      expect(taskArg).toContain('dental clinic');
    });

    it('does NOT run operating loop when task complexity <= 0.8', async () => {
      mockAnalyzeTask.mockReturnValue({
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

      expect(mockAnalyzeTask).toHaveBeenCalledTimes(1);
      expect(mockRunOperatingLoop).not.toHaveBeenCalled();
    });

    it('operating loop failure does not crash the chat (non-blocking)', async () => {
      mockAnalyzeTask.mockReturnValue({
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
      mockRunOperatingLoop.mockRejectedValue(new Error('Loop service unavailable'));

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
      mockAnalyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      mockRunOperatingLoop.mockResolvedValue([
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
      mockAnalyzeTask.mockReturnValue({
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
      mockAnalyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Analysis complete.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Diagnosis complete.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Plan ready.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Execution done.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'QA passed.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Improvements noted.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      mockRunQualityGates.mockReturnValue({
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
      expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1);
      expect(mockRunQualityGates).toHaveBeenCalledTimes(1);

      // Both badges should render
      await waitFor(() => {
        expect(screen.getByText(/6\/6 loop/)).toBeDefined();
      });
      expect(screen.getByText(/agency QA 85%/)).toBeDefined();
    });

    it('quality gate failure shows warning even when operating loop succeeds', async () => {
      mockAnalyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.85,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Done.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Done.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Done.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'Done.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Done.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      mockRunQualityGates.mockReturnValue({
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
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining('Quality gate'),
        expect.objectContaining({ duration: 4000 }),
      );
    });
  });

  // ── Editor Gate Integration ──

  describe('editor gate integration', () => {
    it('runs editor gate after response and stores result', async () => {
      mockRunEditorGate.mockResolvedValue({
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

      expect(mockRunEditorGate).toHaveBeenCalledTimes(1);
      const [userContent, aiContent] = mockRunEditorGate.mock.calls[0];
      expect(userContent).toContain('dental clinic');
      expect(aiContent).toBe('Hello from AI');
    });

    it('auto-corrects response when editor gate fails with corrected text', async () => {
      mockRunEditorGate.mockResolvedValue({
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
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining('Editor gate'),
        expect.objectContaining({ duration: 3000 }),
      );
    });

    it('editor gate error does not crash chat (non-blocking)', async () => {
      mockRunEditorGate.mockRejectedValue(new Error('Editor service down'));

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
      mockAnalyzeTask.mockReturnValue({
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

      mockRunOperatingLoop.mockResolvedValue([
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
      expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1);
      const [taskArg] = mockRunOperatingLoop.mock.calls[0];
      expect(taskArg).toContain('lead generation');
      expect(taskArg).toContain('local SEO');
      expect(taskArg).toContain('paid ads');
    });
  });

  // ── New Conversation Reset ──

  describe('new conversation resets agency state', () => {
    it('clears operating loop results when starting a new conversation', async () => {
      mockAnalyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      mockRunOperatingLoop.mockResolvedValue([
        { step: 'understand', output: 'Done.', agentUsed: 'agency-brain', duration: 100 },
        { step: 'diagnose', output: 'Done.', agentUsed: 'agency-brain', duration: 80 },
        { step: 'plan', output: 'Done.', agentUsed: 'agency-brain', duration: 90 },
        { step: 'execute', output: 'Done.', agentUsed: 'agency-brain', duration: 120 },
        { step: 'qa', output: 'Done.', agentUsed: 'agency-brain', duration: 60 },
        { step: 'improve', output: 'Done.', agentUsed: 'agency-brain', duration: 50 },
      ]);

      mockRunQualityGates.mockReturnValue({
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
      mockStreamingEnabled = false;

      mockAnalyzeTask.mockReturnValue({
        category: 'strategic-planning',
        complexity: 0.85,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      mockRunOperatingLoop.mockResolvedValue([
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

      expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1);
    });
  });

  // ── oracle-loop-complete Event Dispatch ──

  describe('oracle-loop-complete event dispatch', () => {
    it('dispatches oracle-loop-complete event after operating loop finishes', async () => {
      mockAnalyzeTask.mockReturnValue({
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
      mockRunOperatingLoop.mockResolvedValue(loopResults);

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
      mockAnalyzeTask.mockReturnValue({
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
      mockAnalyzeTask.mockReturnValueOnce({
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

      expect(mockRunOperatingLoop).not.toHaveBeenCalled();

      // Second message: complex
      mockAnalyzeTask.mockReturnValueOnce({
        category: 'strategic-planning',
        complexity: 0.9,
        estimatedTokens: 500,
        agents: [{ role: 'strategist', priority: 1, taskFocus: 'Strategy', requiredTier: 'premium' }],
        parallelizable: false,
        requiresWebSearch: false,
        suggestedTier: 'premium',
      });

      mockRunOperatingLoop.mockResolvedValue([
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
      expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1);
    });
  });
});
