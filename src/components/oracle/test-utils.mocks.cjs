// Shared mock objects for ChatPanel test files (plain JS for require() compatibility with Vitest hoisting)
// This file must be .js (not .ts) because vi.mock() factories use require() at hoist time,
// before TypeScript module resolution is available.
// NOTE: We do NOT import vitest here — newer Vitest blocks require('vitest') in CJS.
// Instead we use plain function stubs. The test files use vi.mock() factories to
// return these objects, and Vitest's mock system handles call tracking.

// Minimal stub factory — returns a callable object with basic mock-like helpers.
// When returned from a vi.mock() factory, Vitest wraps these for assertion support.
function stubFn(returnValue) {
  const fn = function () {
    fn._calls.push(Array.from(arguments));
    if (fn._impl) return fn._impl.apply(null, arguments);
    return fn._value;
  };
  fn._value = returnValue;
  fn._impl = null;
  fn._calls = [];
  fn.mockReturnValue = function (v) { fn._value = v; return fn; };
  fn.mockResolvedValue = function (v) { fn._value = Promise.resolve(v); return fn; };
  fn.mockReturnValueOnce = function (v) {
    const prev = { impl: fn._impl, value: fn._value };
    fn._impl = function () {
      fn._impl = prev.impl; fn._value = prev.value;
      return v;
    };
    return fn;
  };
  fn.mockImplementation = function (impl) { fn._impl = impl; return fn; };
  fn.mockClear = function () { fn._calls = []; };
  fn.mockReset = function () { fn._calls = []; fn._value = undefined; fn._impl = null; };
  return fn;
}

const DESIGN_TOKENS_MOCK = {
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {}, snappy: {} },
  buttonTapProps: {},
  QUICK_START_CARDS: [
    { emoji: '📊', label: 'SEO Audit', description: 'Full site audit', color: 'primary' },
    { emoji: '✍️', label: 'Blog Post', description: 'Write a blog post', color: 'muted' },
  ],
};

const ROUTER_MOCK = {
  NeverStopRouter: {
    calculateCost: stubFn(undefined).mockReturnValue({ usd: 0.001, inr: 0.084 }),
  },
};

const API_MOCK = {
  conversationsApi: {
    list: stubFn(undefined).mockResolvedValue([]),
    get: stubFn(undefined).mockResolvedValue({ id: '1', title: 'Test', messages: [], agent_type: 'orchestrator', created_at: Date.now(), updated_at: Date.now() }),
    create: stubFn(undefined).mockResolvedValue({ id: '1', title: 'Test', messages: [], agent_type: 'orchestrator', created_at: Date.now(), updated_at: Date.now() }),
    update: stubFn(undefined).mockResolvedValue({}),
    delete: stubFn(undefined).mockResolvedValue({}),
    appendMessages: stubFn(undefined).mockResolvedValue({}),
  },
  knowledgeDocsApi: { list: stubFn(undefined).mockResolvedValue([]) },
  projectsApi: { list: stubFn(undefined).mockResolvedValue([]) },
  memoriesApi: { list: stubFn(undefined).mockResolvedValue([]) },
};

const RAG_MOCK = {
  processDocument: stubFn(undefined).mockResolvedValue({ content: 'doc content' }),
  retrieveRelevant: stubFn(undefined).mockReturnValue([]),
  chunkText: stubFn(undefined).mockReturnValue([]),
  indexDocument: stubFn(undefined).mockResolvedValue(undefined),
};

const MEMORY_MOCK = {
  getMemories: stubFn(undefined).mockResolvedValue([]),
  formatMemoryForContext: stubFn(undefined).mockReturnValue(''),
};

const QUALITY_MOCK = { saveQualityScore: stubFn() };

const SYSTEM_PROMPT_MOCK = {
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
};

const OUTPUT_QUALITY_EVALUATOR_MOCK = {
  evaluateOutput: stubFn(undefined).mockReturnValue({ passed: true, overallScore: 85, checks: [], suggestions: [] }),
};

const EDITOR_GATE_MOCK = {
  runEditorGate: stubFn(undefined).mockResolvedValue({ passed: true, confidence: 90, assessment: 'OK', issues: [] }),
  loadEditorConfig: stubFn(undefined).mockReturnValue({ enabled: true, minLength: 100, skipAgentTypes: [] }),
  saveEditorConfig: stubFn(),
  DEFAULT_EDITOR_CONFIG: { enabled: true, minLength: 100, skipAgentTypes: [] },
};

const PROMPT_SANITIZER_MOCK = {
  sanitizeDocumentContent: stubFn(undefined).mockImplementation((content) => ({ sanitized: content, flagged: false })),
  sanitizeSearchResults: stubFn(undefined).mockImplementation((results) => results),
  sanitizeExternalContext: stubFn(undefined).mockImplementation((content) => ({ sanitized: content, flagged: false })),
};

const TOKEN_BUDGET_MOCK = {
  calculateAllCosts: stubFn(undefined).mockReturnValue([{ modelId: 'gpt-4o', fullRequestCostINR: 0.084, fullRequestCostUSD: 0.001, isFree: false }]),
};

const CONTEXT_MANAGER_MOCK = {
  buildOptimizedContext: stubFn(undefined).mockReturnValue({ messages: [], tokenCount: 0 }),
};

const UTILS_MOCK = {
  estimateTokens: stubFn(undefined).mockReturnValue(10),
  cn: (...args) => args.filter(Boolean).join(' '),
};

const EXPORT_UTILS_MOCK = { exportChatToPDF: stubFn(), exportChatToWord: stubFn() };
const SEARCH_MOCK = { formatSearchResults: stubFn(undefined).mockReturnValue('') };
const CSRF_MOCK = { csrfHeaders: stubFn(undefined).mockReturnValue({}) };
const SELF_TRAINING_MOCK = { recordTask: stubFn() };
const CROSS_DOMAIN_THINKING_MOCK = { getAdjacentServices: stubFn(undefined).mockReturnValue([]), SERVICE_BUNDLES: [] };
const PATTERN_RECOGNITION_MOCK = { recogniseTaskPatterns: stubFn(undefined).mockReturnValue([]) };
const SEARCH_HELPERS_MOCK = { searchConversations: stubFn(undefined).mockReturnValue([]) };
const WORKFLOW_VALIDATION_MOCK = {
  VALID_AGENTS: ['researcher', 'writer', 'developer', 'analyst', 'strategist', 'marketer', 'designer', 'finance', 'voice', 'qa', 'coordinator', 'workflow', 'lead-hunter', 'offer-strategist', 'video-specialist', 'web-designer', 'agent-builder'],
};
const TOAST_CONFIG_MOCK = { TOAST_DEFAULTS: { duration: 3000 } };
const FEEDBACK_BRIDGE_MOCK = { attachQualityToTraining: stubFn(), recordMessageFeedback: stubFn(), recordGuardVerdict: stubFn() };
const GUARD_STATS_PANEL_MOCK = { GuardStatsPanel: () => null };

function createToastMock(mockToast, mockToastError) {
  return {
    __esModule: true,
    default: Object.assign(
      (...args) => mockToast(...args),
      { error: (...args) => mockToastError(...args) },
    ),
  };
}

function createHallucinationGuardMock(mockLoadGuardConfig, mockRunHallucinationGuard, mockRecordLearning) {
  return {
    loadGuardConfig: (...args) => mockLoadGuardConfig(...args),
    runHallucinationGuard: (...args) => mockRunHallucinationGuard(...args),
    recordLearning: (...args) => mockRecordLearning(...args),
  };
}



function createStoreMock(opts) {
  return {
    useRouterStore: () => ({
      streamingEnabled: opts?.streamingEnabled ?? true,
      addCost: opts?.addCost ?? stubFn(),
      addUsageRecord: opts?.addUsageRecord ?? stubFn(),
      configuredProviders: ['groq'],
    }),
  };
}

// Controllable runOperatingLoop mock factory.
// Returns a callable stub that returns a pending promise, allowing tests to
// control when it resolves/rejects and to fire the onStepComplete callback.
//
// Usage in test files (inside vi.hoisted()):
//   const loopMock = require('./test-utils.mocks.cjs').createControllableLoopMock();
//   const mockRunOperatingLoop = vi.fn(loopMock.mockFn);  // wrap with vi.fn() for assertion support
//   // In vi.mock: runOperatingLoop: (...args) => mockRunOperatingLoop(...args)
//   // After render + send message:
//   const cb = loopMock.getLoopCallback();
//   cb({ step: 'understand', output: '...', agentUsed: 'agency-brain', duration: 100 }, 1, 6);
//   loopMock.resolveLoop();  // resolves with 6-step defaults
function createControllableLoopMock() {
  var capturedCallback = null;

  var defaultResults = [
    { step: 'understand', output: 'Understood the task.', agentUsed: 'agency-brain', duration: 100 },
    { step: 'diagnose', output: 'Diagnosed the problem.', agentUsed: 'agency-brain', duration: 90 },
    { step: 'plan', output: 'Planned the execution.', agentUsed: 'agency-brain', duration: 80 },
    { step: 'execute', output: 'Executed the plan.', agentUsed: 'agency-brain', duration: 120 },
    { step: 'qa', output: 'QA passed.', agentUsed: 'agency-brain', duration: 70 },
    { step: 'improve', output: 'Improvement suggestions ready.', agentUsed: 'agency-brain', duration: 60 },
  ];

  // Plain callable — NOT a vi.fn(), so it works in CJS.
  // The test file wraps it with vi.fn() for assertion support (.mock.calls, etc.)
  var fn = function (_task, _callAI, onStepComplete) {
    capturedCallback = onStepComplete || null;
    return new Promise(function (resolve, reject) {
      fn._resolve = resolve;
      fn._reject = reject;
    });
  };

  return {
    mockFn: fn,
    getLoopCallback: function () { return capturedCallback; },
    resolveLoop: function (results) {
      return fn._resolve(results || defaultResults);
    },
    rejectLoop: function (err) {
      return fn._reject(err || new Error('Loop failed'));
    },
    reset: function () {
      capturedCallback = null;
      fn._resolve = undefined;
      fn._reject = undefined;
    },
  };
}

module.exports = {
  DESIGN_TOKENS_MOCK, ROUTER_MOCK, API_MOCK, RAG_MOCK, MEMORY_MOCK,
  QUALITY_MOCK, SYSTEM_PROMPT_MOCK, OUTPUT_QUALITY_EVALUATOR_MOCK,
  EDITOR_GATE_MOCK, PROMPT_SANITIZER_MOCK, TOKEN_BUDGET_MOCK,
  CONTEXT_MANAGER_MOCK, UTILS_MOCK, EXPORT_UTILS_MOCK, SEARCH_MOCK,
  CSRF_MOCK, SELF_TRAINING_MOCK, CROSS_DOMAIN_THINKING_MOCK,
  PATTERN_RECOGNITION_MOCK, SEARCH_HELPERS_MOCK, WORKFLOW_VALIDATION_MOCK,
  TOAST_CONFIG_MOCK, FEEDBACK_BRIDGE_MOCK, GUARD_STATS_PANEL_MOCK,
  createToastMock, createHallucinationGuardMock, createStoreMock,
  createControllableLoopMock,
};
