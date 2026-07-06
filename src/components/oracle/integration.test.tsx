import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Mock FeatureGate (pro plan so tests see full content) ───
vi.mock('./FeatureGate', () => ({
  useSubscriptionState: () => ({ plan: 'pro', isValid: true, loading: false }),
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UpgradePrompt: () => null,
  UpgradeModal: () => null,
  TierBadge: () => null,
  TierTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  getRequiredPlanForAgent: () => 'starter' as const,
}));

import { ChatPanel } from './ChatPanel';
import { ProjectsTab } from './ProjectsTab';
import { RoadmapTab } from './RoadmapTab';

// ─── File-local vi.hoisted() mocks ───

const {
  mockProjects,
  mockTimeEntries,
  mockProposals,
  mockMemories,
  mockProjectsApi,
  mockTimeEntriesApi,
  mockProposalsApi,
  mockInvoicesApi,
  mockAddCost,
  mockAddUsageRecord,
  mockGetMemories,
} = vi.hoisted(() => {
  const mockProjects: Array<Record<string, unknown>> = [];
  const mockTimeEntries: Array<Record<string, unknown>> = [];
  const mockProposals: Array<Record<string, unknown>> = [];
  const mockMemories: Array<Record<string, unknown>> = [];

  const mockProjectsApi = {
    list: vi.fn().mockImplementation(() => Promise.resolve(mockProjects)),
    create: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
      const project = { id: 'p-' + Date.now(), ...data, created_at: Date.now(), updated_at: Date.now() };
      mockProjects.push(project);
      return project;
    }),
    update: vi.fn().mockImplementation(async (id: string, data: Record<string, unknown>) => {
      const idx = mockProjects.findIndex((p) => p.id === id);
      if (idx >= 0) mockProjects[idx] = { ...mockProjects[idx], ...data };
      return { id, ...data };
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      const idx = mockProjects.findIndex((p) => p.id === id);
      if (idx >= 0) mockProjects.splice(idx, 1);
      return { success: true };
    }),
  };

  const mockTimeEntriesApi = {
    list: vi.fn().mockImplementation(() => Promise.resolve(mockTimeEntries)),
    create: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
      const entry = { id: 't-' + Date.now(), ...data };
      mockTimeEntries.push(entry);
      return entry;
    }),
  };

  const mockProposalsApi = {
    list: vi.fn().mockImplementation(() => Promise.resolve(mockProposals)),
    create: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
      const proposal = { id: 'prop-' + Date.now(), ...data, created_at: Date.now() };
      mockProposals.push(proposal);
      return proposal;
    }),
  };

  const mockInvoicesApi = {
    create: vi.fn().mockResolvedValue({ id: 'inv1' }),
  };

  return {
    mockProjects,
    mockTimeEntries,
    mockProposals,
    mockMemories,
    mockProjectsApi,
    mockTimeEntriesApi,
    mockProposalsApi,
    mockInvoicesApi,
    mockAddCost: vi.fn(),
    mockAddUsageRecord: vi.fn(),
    mockGetMemories: vi.fn(),
  };
});

// ─── vi.mock() calls (must be top-level for Vitest hoisting) ───

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {}, tabContent: {}, scaleIn: {} },
  transitions: { smooth: {}, snappy: {}, popSpring: {} },
  buttonTapProps: {},
  cardHoverProps: {},
  QUICK_START_CARDS: [
    { emoji: '📊', label: 'SEO Audit', description: 'Full site audit', color: 'primary' },
    { emoji: '✍️', label: 'Blog Post', description: 'Write a blog post', color: 'muted' },
  ],
}));

vi.mock('@/data/domains', () => ({
  AGENCY_DOMAINS: [
    { id: 'seo', name: 'SEO', emoji: '🔍', category: 'Digital Marketing' },
    { id: 'web', name: 'Web Development', emoji: '🌐', category: 'Development' },
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

vi.mock('@/lib/rag', () => ({
  processDocument: vi.fn().mockResolvedValue({ content: 'doc content' }),
  retrieveRelevant: vi.fn().mockReturnValue([]),
  chunkText: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/memory', () => ({
  getMemories: (...args: unknown[]) => mockGetMemories(...args),
  formatMemoryForContext: vi.fn().mockReturnValue(''),
}));

vi.mock('@/lib/quality', () => ({
  saveQualityScore: vi.fn(),
}));

vi.mock('@/lib/system-prompt', () => ({
  QUALITY_SCORING_PROMPT: 'Score: {{response}} Context: {{taskContext}}',
  ROADMAP_GENERATION_PROMPT: 'Generate proposal for {{clientBrief}} in domain {{domain}} with budget {{budget}} and timeline {{timeline}}',
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
  runOperatingLoop: (...args: unknown[]) => mockRunOperatingLoop(...args),
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

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('@/lib/api', () => ({
  projectsApi: mockProjectsApi,
  timeEntriesApi: mockTimeEntriesApi,
  proposalsApi: mockProposalsApi,
  invoicesApi: mockInvoicesApi,
  conversationsApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: '1', title: 'Test', messages: [], agent_type: 'orchestrator', created_at: Date.now(), updated_at: Date.now() }),
    create: vi.fn().mockResolvedValue({ id: '1', title: 'Test', messages: [], agent_type: 'orchestrator', created_at: Date.now(), updated_at: Date.now() }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  knowledgeDocsApi: { list: vi.fn().mockResolvedValue([]) },
  memoriesApi: {
    list: vi.fn().mockImplementation((projectId?: string) => {
      if (projectId) return Promise.resolve(mockMemories.filter((m) => m.project_id === projectId));
      return Promise.resolve(mockMemories);
    }),
  },
  favouritesApi: { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue({}) },
  customPromptsApi: { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue({}) },
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

// Controllable runOperatingLoop mock for operating loop tests
const { mockRunOperatingLoop } = vi.hoisted(() => ({
  mockRunOperatingLoop: vi.fn().mockResolvedValue([]),
}));

// ─── Tests ───

describe('Integration: Cross-component workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects.length = 0;
    mockTimeEntries.length = 0;
    mockProposals.length = 0;
    mockMemories.length = 0;

    // Mock global.fetch for ChatPanel's SSE streaming via /api/ai/chat
    global.fetch = createSSEFetchMock([
      { chunk: 'H', done: false, model: 'gpt-4o' },
      { chunk: 'ello', done: false, model: 'gpt-4o' },
      { chunk: ' from AI', done: false, model: 'gpt-4o' },
    ]);
    mockGetMemories.mockResolvedValue([]);
  });

  // ── ProjectsTab → ChatPanel: Project Visibility ──

  describe('project creation → chat panel visibility', () => {
    it('project created in ProjectsTab appears in ChatPanel project selector', async () => {
      const user = userEvent.setup();

      const { unmount } = render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('📁 Projects')).toBeDefined();
      });

      await user.click(screen.getByText('+ New Project'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Client Name')).toBeDefined();
      });

      await user.type(screen.getByPlaceholderText('Client Name'), 'Integration Test Corp');
      await user.type(screen.getByPlaceholderText('Service Type (e.g. SEO, Web Dev)'), 'SEO');
      await user.type(screen.getByPlaceholderText('City'), 'Mumbai');
      await user.click(screen.getByText('Create Project'));

      await waitFor(() => {
        expect(mockProjectsApi.create).toHaveBeenCalled();
      });

      expect(mockProjects.length).toBe(1);
      expect(mockProjects[0].client_name).toBe('Integration Test Corp');

      unmount();
      render(<ChatPanel />);

      await waitFor(() => {
        expect(mockProjectsApi.list).toHaveBeenCalled();
      });

      await user.click(screen.getByLabelText('Select project for memory context'));

      await waitFor(() => {
        expect(screen.getByText('Integration Test Corp')).toBeDefined();
      });
    });
  });

  // ── ProjectsTab → ChatPanel: Ask Oracle ──

  describe('ask oracle from projects tab', () => {
    it('calls onAskOracle with project context when Ask Oracle is clicked', async () => {
      const onAskOracle = vi.fn();
      const user = userEvent.setup();

      mockProjects.push({
        id: 'p1',
        client_name: 'Acme Corp',
        industry: 'SEO',
        sector: 'Tech',
        service: 'SEO',
        status: 'Active',
        value: '₹1,50,000',
        deadline: '2026-12-31',
        city: 'Mumbai',
        notes: '',
        requirements: [],
        contact_name: 'John',
        contact_phone: '+919876543210',
        contact_email: 'john@acme.com',
        tags: [],
        total_hours: 0,
        invoice_total: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      render(<ProjectsTab onAskOracle={onAskOracle} />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      const askOracleButtons = screen.getAllByTitle('Ask Oracle');
      await user.click(askOracleButtons[0]);

      expect(onAskOracle).toHaveBeenCalledTimes(1);
      expect(onAskOracle).toHaveBeenCalledWith('Tell me about client Acme Corp in SEO');
    });
  });

  // ── RoadmapTab → ChatPanel: Send to Agent ──

  describe('send proposal to agent from roadmap tab', () => {
    it('calls onAskOracle with proposal brief when Send to Agent is clicked', async () => {
      const onAskOracle = vi.fn();
      const user = userEvent.setup();

      // RoadmapTab uses raw fetch(), not NeverStopRouter — override global.fetch
      // to stream the expected output text.
      global.fetch = createSSEFetchMock([
        { chunk: 'Proposal output here', done: false, model: 'gpt-4o' },
      ]);

      render(<RoadmapTab onAskOracle={onAskOracle} />);

      const textarea = screen.getByPlaceholderText(/Paste a client brief here/);
      await user.type(textarea, 'D2C skincare brand needs Meta Ads scaling');
      await user.click(screen.getByText('🎯 Generate Proposal'));

      await waitFor(() => {
        expect(screen.getByText('Proposal output here')).toBeDefined();
      });

      await user.click(screen.getByText('⚡ Agent'));

      expect(onAskOracle).toHaveBeenCalledTimes(1);
      expect(onAskOracle).toHaveBeenCalledWith('D2C skincare brand needs Meta Ads scaling');
    });
  });

  // ── ChatPanel: Project Selection → Memory Loading ──

  describe('project selection loads memory context', () => {
    it('loads memories when a project is selected', async () => {
      const user = userEvent.setup();

      mockProjects.push({
        id: 'p1',
        client_name: 'Beta Inc',
        industry: 'Web Development',
        sector: 'E-commerce',
        service: 'Web Dev',
        status: 'Active',
        value: '₹2,50,000',
        deadline: '2026-12-31',
        city: 'Delhi',
        notes: '',
        requirements: [],
        contact_name: 'Jane',
        contact_phone: '+919876543211',
        contact_email: 'jane@beta.com',
        tags: [],
        total_hours: 0,
        invoice_total: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const memories = [
        { id: 'm1', project_id: 'p1', content: 'Client prefers formal tone', category: 'preference', created_at: Date.now() },
      ];
      mockMemories.push(...memories);
      mockGetMemories.mockResolvedValue(memories);

      render(<ChatPanel />);

      await waitFor(() => {
        expect(mockProjectsApi.list).toHaveBeenCalled();
      });

      await user.click(screen.getByLabelText('Select project for memory context'));

      await waitFor(() => {
        expect(screen.getByText('Beta Inc')).toBeDefined();
      });

      await user.click(screen.getByText('Beta Inc'));

      await waitFor(() => {
        expect(mockGetMemories).toHaveBeenCalledWith('p1');
      });
    });
  });

  // ── Full Workflow: Create → Select → Chat ──

  describe('end-to-end: create project → select in chat → send message', () => {
    it('completes the full workflow across components', { timeout: 15000 }, async () => {
      const user = userEvent.setup();

      const { unmount } = render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('📁 Projects')).toBeDefined();
      });

      await user.click(screen.getByText('+ New Project'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Client Name')).toBeDefined();
      });

      await user.type(screen.getByPlaceholderText('Client Name'), 'E2E Test Client');
      await user.type(screen.getByPlaceholderText('Service Type (e.g. SEO, Web Dev)'), 'Web Dev');
      await user.type(screen.getByPlaceholderText('City'), 'Bangalore');
      await user.click(screen.getByText('Create Project'));

      await waitFor(() => {
        expect(mockProjectsApi.create).toHaveBeenCalled();
      });

      unmount();

      render(<ChatPanel />);

      await waitFor(() => {
        expect(mockProjectsApi.list).toHaveBeenCalled();
      });

      await user.click(screen.getByLabelText('Select project for memory context'));
      await waitFor(() => {
        expect(screen.getByText('E2E Test Client')).toBeDefined();
      });
      await user.click(screen.getByText('E2E Test Client'));

      await user.type(screen.getByLabelText('Chat input'), 'Tell me about this client{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      expect(screen.getByText('Tell me about this client', { selector: '[aria-label="You said"]' })).toBeDefined();
    });
  });

  // ── Data Consistency ──

  describe('data consistency across components', () => {
    it('project created in ProjectsTab is visible in ChatPanel project list', async () => {
      const user = userEvent.setup();

      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('📁 Projects')).toBeDefined();
      });
      expect(screen.getByText(/No projects yet/)).toBeDefined();

      await user.click(screen.getByText('+ New Project'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Client Name')).toBeDefined();
      });

      await user.type(screen.getByPlaceholderText('Client Name'), 'First Client');
      await user.type(screen.getByPlaceholderText('Service Type (e.g. SEO, Web Dev)'), 'SEO');
      await user.type(screen.getByPlaceholderText('City'), 'Pune');
      await user.click(screen.getByText('Create Project'));

      await waitFor(() => {
        expect(screen.getByText('First Client')).toBeDefined();
      });

      expect(screen.getByText(/h logged/)).toBeDefined();
      expect(screen.getByText(/entries/)).toBeDefined();
    });
  });

  // ── Operating Loop: End-to-End Flow ──

  describe('operating loop: end-to-end project → complex task → loop results', () => {
    afterEach(async () => {
      // Restore vi.mock() fn mocks to their default values
      // (vi.clearAllMocks() only clears call history, not implementations)
      const { analyzeTask } = await import('@/lib/task-analyzer');
      vi.mocked(analyzeTask).mockReturnValue({ complexity: 0.3, agents: [], suggestedTier: 'standard' } as any);
      mockRunOperatingLoop.mockResolvedValue([]);
    });

    it('triggers the operating loop for a complex task and shows step progress', { timeout: 15000 }, async () => {
      // Override analyzeTask to trigger the operating loop (complexity > 0.8)
      const { analyzeTask } = await import('@/lib/task-analyzer');
      vi.mocked(analyzeTask).mockReturnValue({ complexity: 0.9, agents: [{ role: 'strategist', priority: 1, taskFocus: 'strategy', requiredTier: 'premium' }], suggestedTier: 'premium', category: 'general', estimatedTokens: 5000, parallelizable: false, requiresWebSearch: false } as any);

      // Override runOperatingLoop to fire onStepComplete callbacks with real step results
      mockRunOperatingLoop.mockImplementation(
        async (
          task: string,
          callAI: (prompt: string, sysPrompt?: string) => Promise<{ text: string; tokens: number }>,
          onStepComplete?: (step: unknown, completed: number, total: number) => void,
        ) => {
          const steps = [
            { step: 'understand', output: 'Analyzed the project requirements and market positioning.', agentUsed: 'agency-brain', duration: 100 },
            { step: 'diagnose', output: 'Identified key growth bottlenecks in lead flow and conversion.', agentUsed: 'agency-brain', duration: 90 },
            { step: 'plan', output: 'Planned channel mix: SEO + Meta Ads + email nurture.', agentUsed: 'agency-brain', duration: 80 },
            { step: 'execute', output: 'Drafted campaign assets and outreach sequences.', agentUsed: 'agency-brain', duration: 120 },
            { step: 'qa', output: 'QA passed — all deliverables meet quality bar.', agentUsed: 'agency-brain', duration: 70 },
            { step: 'improve', output: 'Suggested A/B testing headlines and retargeting audiences.', agentUsed: 'agency-brain', duration: 60 },
          ];
          for (let i = 0; i < steps.length; i++) {
            onStepComplete?.(steps[i], i + 1, 6);
          }
          return steps;
        },
      );

      const user = userEvent.setup();

      // ── Step 1: Create a project in ProjectsTab ──
      const { unmount } = render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('📁 Projects')).toBeDefined();
      });

      await user.click(screen.getByText('+ New Project'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Client Name')).toBeDefined();
      });

      await user.type(screen.getByPlaceholderText('Client Name'), 'Loop Test Client');
      await user.type(screen.getByPlaceholderText('Service Type (e.g. SEO, Web Dev)'), 'SEO');
      await user.type(screen.getByPlaceholderText('City'), 'Mumbai');
      await user.click(screen.getByText('Create Project'));

      await waitFor(() => {
        expect(mockProjectsApi.create).toHaveBeenCalled();
      });

      unmount();

      // ── Step 2: Render ChatPanel, select project, send complex task ──
      render(<ChatPanel />);

      await waitFor(() => {
        expect(mockProjectsApi.list).toHaveBeenCalled();
      });

      // Select the project
      await user.click(screen.getByLabelText('Select project for memory context'));
      await waitFor(() => {
        expect(screen.getByText('Loop Test Client')).toBeDefined();
      });
      await user.click(screen.getByText('Loop Test Client'));

      // Send a complex task that triggers the operating loop
      await user.type(screen.getByLabelText('Chat input'), 'Full end-to-end marketing strategy with SEO, ads, and social media{Enter}');

      // Verify the user message appears
      await waitFor(() => {
        expect(screen.getByText('Full end-to-end marketing strategy with SEO, ads, and social media', { selector: '[aria-label="You said"]' })).toBeDefined();
      });

      // Verify operating loop was triggered
      await waitFor(() => {
        expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1);
      });

      // Verify the final response appears after the loop completes
      await waitFor(() => {
        expect(screen.getByText('Hello from AI')).toBeDefined();
      });

      // Verify the user message and response coexist
      expect(screen.getByText('Full end-to-end marketing strategy with SEO, ads, and social media', { selector: '[aria-label="You said"]' })).toBeDefined();
      expect(screen.getByText('Hello from AI')).toBeDefined();
    });
  });
});
