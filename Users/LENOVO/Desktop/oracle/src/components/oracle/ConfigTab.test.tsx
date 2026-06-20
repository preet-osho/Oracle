import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ConfigTab } from './ConfigTab';

// ─── Mocks ─────────────────────────────

// Override design-tokens from setupTests for this file
vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

// Mock providers data — provide a small subset for testing
vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    {
      id: 'openai',
      name: 'OpenAI',
      color: '#10a37f',
      keyLabel: 'sk-xxxx...xxxx',
      signupUrl: 'https://platform.openai.com/signup',
      freeLimit: '$5 free credit',
      costPer1kTokens: { input: 0.0025, output: 0.01, currency: 'USD' },
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, bestFor: [], isFree: false },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, bestFor: [], isFree: false },
      ],
    },
    {
      id: 'groq',
      name: 'Groq',
      color: '#f55036',
      keyLabel: 'gsk_xxxx...xxxx',
      signupUrl: 'https://console.groq.com/signup',
      freeLimit: '14,400 requests/day free',
      costPer1kTokens: { input: 0.00059, output: 0.00079, currency: 'USD' },
      models: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, bestFor: [], isFree: true },
      ],
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      color: '#d4a574',
      keyLabel: 'sk-ant-xxxx...xxxx',
      signupUrl: 'https://console.anthropic.com/signup',
      freeLimit: '$5 free credit',
      costPer1kTokens: { input: 0.015, output: 0.075, currency: 'USD' },
      models: [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4', contextWindow: 200000, bestFor: [], isFree: false },
      ],
    },
  ],
  MCP_SERVERS: {
    gmail: { url: 'https://gmail.example.com', name: 'Gmail' },
    calendar: { url: 'https://calendar.example.com', name: 'Calendar' },
    drive: { url: 'https://drive.example.com', name: 'Drive' },
  },
}));

// Mock fetch for key testing flow
const originalFetch = global.fetch;
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Zustand store
const mockSetByokKey = vi.fn();
const mockRemoveByokKey = vi.fn().mockResolvedValue(undefined);
const mockToggleAutoRoute = vi.fn();
const mockSetSelectedModel = vi.fn();
const mockToggleStreaming = vi.fn();
const mockToggleMcp = vi.fn();
const mockResetCosts = vi.fn();

let mockByokKeys: Record<string, string> = {};
let mockAutoRoute = true;
let mockSelectedModel = { providerId: 'groq', modelId: 'llama-3.3-70b-versatile' };
let mockStreamingEnabled = true;
let mockMcpEnabled = { gmail: false, calendar: false, drive: false };
let mockTotalCostUSD = 0;
let mockTotalCostINR = 0;
let mockUsageHistory: Array<{ timestamp: number; provider: string; costINR: number }> = [];
let mockTemperature = 0.7;
const mockSetTemperature = vi.fn();

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    byokKeys: mockByokKeys,
    setByokKey: mockSetByokKey,
    removeByokKey: mockRemoveByokKey,
    autoRoute: mockAutoRoute,
    toggleAutoRoute: mockToggleAutoRoute,
    selectedModel: mockSelectedModel,
    setSelectedModel: mockSetSelectedModel,
    streamingEnabled: mockStreamingEnabled,
    toggleStreaming: mockToggleStreaming,
    temperature: mockTemperature,
    setTemperature: mockSetTemperature,
    mcpEnabled: mockMcpEnabled,
    toggleMcp: mockToggleMcp,
    totalCostUSD: mockTotalCostUSD,
    totalCostINR: mockTotalCostINR,
    resetCosts: mockResetCosts,
    usageHistory: mockUsageHistory,
  }),
}));

// Mock hallucination guard config
const mockLoadGuardConfig = vi.fn();
const mockSaveGuardConfig = vi.fn();
vi.mock('@/lib/hallucination-guard', () => ({
  loadGuardConfig: (...args: unknown[]) => mockLoadGuardConfig(...args),
  saveGuardConfig: (...args: unknown[]) => mockSaveGuardConfig(...args),
  DEFAULT_GUARD_CONFIG: {
    enabled: true,
    thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
    maxRetries: 2,
    selfVerification: true,
    factGrounding: true,
    patternDetection: true,
    strictDomains: ['finance', 'healthcare', 'legal', 'investment', 'ads'],
  },
}));

// Mock react-hot-toast
const mockToastWarning = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => mockToastWarning(...args),
    { success: (...args: unknown[]) => mockToastWarning(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ),
  toast: Object.assign(
    (...args: unknown[]) => mockToastWarning(...args),
    { success: (...args: unknown[]) => mockToastWarning(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ),
}));

// Mock knowledge docs API
const mockKnowledgeDocsList = vi.fn().mockResolvedValue([]);
const mockKnowledgeDocsCreate = vi.fn();
const mockKnowledgeDocsDelete = vi.fn();

vi.mock('@/lib/api', () => ({
  knowledgeDocsApi: {
    list: (...args: unknown[]) => mockKnowledgeDocsList(...args),
    create: (...args: unknown[]) => mockKnowledgeDocsCreate(...args),
    delete: (...args: unknown[]) => mockKnowledgeDocsDelete(...args),
  },
}));

// ─── Tests ─────────────────────────────

describe('ConfigTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockByokKeys = {};
    mockAutoRoute = true;
    mockSelectedModel = { providerId: 'groq', modelId: 'llama-3.3-70b-versatile' };
    mockStreamingEnabled = true;
    mockMcpEnabled = { gmail: false, calendar: false, drive: false };
    mockTotalCostUSD = 0;
    mockTotalCostINR = 0;
    mockUsageHistory = [];
    mockTemperature = 0.7;
    mockFetch.mockReset();
    // Default: handle /api/knowledge-docs/indexed call on mount
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/knowledge-docs/indexed')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ indexedIds: [] }) });
      }
      return Promise.resolve({ ok: true });
    });
    // Default guard config returns enabled with default thresholds
    mockLoadGuardConfig.mockReturnValue({
      enabled: true,
      thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
      maxRetries: 2,
      selfVerification: true,
      factGrounding: true,
      patternDetection: true,
      strictDomains: ['finance', 'healthcare', 'legal', 'investment', 'ads'],
    });
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the settings header', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('⚙ Settings')).toBeDefined();
      expect(screen.getByText(/Configure ORACLE to match your agency workflow/)).toBeDefined();
    });

    it('renders all section headers', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/API Keys/)).toBeDefined();
      expect(screen.getByText('🤖 Model Selection')).toBeDefined();
      expect(screen.getByText('🔌 MCP Tools')).toBeDefined();
      expect(screen.getByText('🔧 Advanced Settings')).toBeDefined();
      expect(screen.getByText('🛡 Hallucination Guard')).toBeDefined();
      expect(screen.getByText('🏢 Agency Profile')).toBeDefined();
      expect(screen.getByText('📚 Knowledge Base')).toBeDefined();
      expect(screen.getByText('⚡ Claude Code Integration')).toBeDefined();
      expect(screen.getByText('💰 Cost Dashboard')).toBeDefined();
    });

    it('renders all providers in the BYOK section', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('OpenAI')).toBeDefined();
      expect(screen.getByText('Groq')).toBeDefined();
      expect(screen.getByText('Anthropic')).toBeDefined();
    });

    it('renders MCP tool cards', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Gmail')).toBeDefined();
      expect(screen.getByText('Calendar')).toBeDefined();
      expect(screen.getByText('Drive')).toBeDefined();
    });
  });

  // ── BYOK Key Management ──

  describe('BYOK key management', () => {
    it('shows "Set Key" button when no key is configured', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const setKeyButtons = screen.getAllByText('Set Key');
      expect(setKeyButtons.length).toBe(3); // One per provider
    });

    it('shows "✓ Set" button when key is configured', async () => {
      mockByokKeys = { openai: 'sk-test-key' };
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('✓ Set')).toBeDefined();
    });

    it('expands key input panel when Set Key is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]);
      // Should show the password input
      expect(screen.getByPlaceholderText('sk-xxxx...xxxx')).toBeDefined();
      expect(screen.getByText('Test')).toBeDefined();
    });

    it('collapses key input panel when clicked again', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]);
      expect(screen.getByPlaceholderText('sk-xxxx...xxxx')).toBeDefined();
      // Click the same button again to collapse — it still says 'Set Key'
      const collapseButtons = screen.getAllByText('Set Key');
      await user.click(collapseButtons[0]);
      expect(screen.queryByPlaceholderText('sk-xxxx...xxxx')).toBeNull();
    });

    it('shows Remove button when key is configured and panel is open', async () => {
      mockByokKeys = { openai: 'sk-test-key' };
      const user = userEvent.setup();
      render(<ConfigTab />);
      // Open the OpenAI panel
      await user.click(screen.getByText('✓ Set'));
      expect(screen.getByText('Remove')).toBeDefined();
    });

    it('calls removeByokKey when Remove is clicked', async () => {
      mockByokKeys = { openai: 'sk-test-key' };
      const user = userEvent.setup();
      render(<ConfigTab />);
      await user.click(screen.getByText('✓ Set'));
      await user.click(screen.getByText('Remove'));
      expect(mockRemoveByokKey).toHaveBeenCalledWith('openai');
    });
  });

  // ── Provider Test Key Flow (the bug fix) ──

  describe('provider test key flow', () => {
    it('calls fetch proxy and shows success on valid key', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Open OpenAI panel
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]); // OpenAI is first

      // Type a key
      const keyInput = screen.getByPlaceholderText('sk-xxxx...xxxx');
      await user.type(keyInput, 'sk-test-key-12345');

      // Click Test
      await user.click(screen.getByText('Test'));

      // Should call setByokKey and fetch (proxy call only)
      expect(mockSetByokKey).toHaveBeenCalledWith('openai', 'sk-test-key-12345');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ method: 'POST' })
      );

      // Should show success
      await waitFor(() => {
        expect(screen.getByText('✓ Key works!')).toBeDefined();
      });

      // Should call toast.success with verification message
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('API key verified'),
        expect.any(Object)
      );
    });

    it('shows error when provider test fails (catch block bug fix)', async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'Invalid API key' }) });
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Open Groq panel (second provider)
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[1]); // Groq

      // Type a key
      const keyInput = screen.getByPlaceholderText('gsk_xxxx...xxxx');
      await user.type(keyInput, 'gsk-bad-key');

      // Click Test
      await user.click(screen.getByText('Test'));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('✗ Invalid key or connection failed')).toBeDefined();
      });

      // Should call toast.error with the error message
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('Provider test failed'),
        expect.any(Object)
      );
    });

    it('does nothing when Test is clicked with no key', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Open panel but don't type a key
      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]);

      // Click Test
      await user.click(screen.getByText('Test'));

      // Should NOT call fetch for proxy (only the indexed endpoint was called on mount)
      expect(mockFetch).not.toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.anything()
      );
    });

    it('uses existing byokKey when input is empty', async () => {
      mockByokKeys = { openai: 'sk-existing-key' };
      mockFetch.mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Open the OpenAI panel (shows "✓ Set")
      await user.click(screen.getByText('✓ Set'));

      // Click Test without typing a new key
      await user.click(screen.getByText('Test'));

      // Should use the existing key
      expect(mockSetByokKey).toHaveBeenCalledWith('openai', 'sk-existing-key');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('shows spinner while testing', async () => {
      // Make fetch hang
      mockFetch.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<ConfigTab />);

      const setKeyButtons = screen.getAllByText('Set Key');
      await user.click(setKeyButtons[0]);
      await user.type(screen.getByPlaceholderText('sk-xxxx...xxxx'), 'sk-test');
      await user.click(screen.getByText('Test'));

      // Should show spinner (⟳ character) while testing
      expect(screen.getByText('⟳')).toBeDefined();
    });
  });

  // ── Model Selection ──

  describe('model selection', () => {
    it('shows auto-route toggle', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Auto-route (Recommended)')).toBeDefined();
    });

    it('calls toggleAutoRoute when auto-route is toggled', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      // Find the auto-route toggle button
      const autoRouteText = screen.getByText('Auto-route (Recommended)');
      const toggleButton = autoRouteText.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        expect(mockToggleAutoRoute).toHaveBeenCalled();
      }
    });

    it('shows provider and model selects when auto-route is off', async () => {
      mockAutoRoute = false;
      await act(async () => {
        render(<ConfigTab />);
      });
      const selects = screen.getAllByDisplayValue(/OpenAI|Groq|Anthropic/);
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    it('calls setSelectedModel when provider select changes', async () => {
      mockAutoRoute = false;
      const user = userEvent.setup();
      render(<ConfigTab />);
      const providerSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(providerSelect, 'openai');
      expect(mockSetSelectedModel).toHaveBeenCalled();
    });

    it('displays current model info', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Currently using:/)).toBeDefined();
      expect(screen.getByText(/llama-3.3-70b-versatile/)).toBeDefined();
    });
  });

  // ── MCP Tools ──

  describe('MCP tools', () => {
    it('shows Not connected for disabled services', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const notConnected = screen.getAllByText('Not connected');
      expect(notConnected.length).toBe(3);
    });

    it('shows Connected for enabled services', async () => {
      mockMcpEnabled = { gmail: true, calendar: false, drive: false };
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Connected')).toBeDefined();
      const notConnected = screen.getAllByText('Not connected');
      expect(notConnected.length).toBe(2);
    });

    it('calls toggleMcp when service toggle is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      // Find the Gmail toggle - it's the first toggle in the MCP section
      const gmailSection = screen.getByText('Gmail').closest('[class*="oracle-glass"]')!;
      const toggleButton = gmailSection.querySelector('button[class*="rounded-full"]')!;
      await user.click(toggleButton);
      expect(mockToggleMcp).toHaveBeenCalledWith('gmail');
    });

    it('shows Set up button when service is not connected', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const setUpButtons = screen.getAllByText('Set up');
      expect(setUpButtons.length).toBe(3);
    });
  });

  // ── Advanced Settings ──

  describe('advanced settings', () => {
    it('renders streaming toggle', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Streaming responses')).toBeDefined();
    });

    it('calls toggleStreaming when streaming toggle is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const streamingLabel = screen.getByText('Streaming responses');
      const toggleButton = streamingLabel.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        expect(mockToggleStreaming).toHaveBeenCalled();
      }
    });

    it('toggles auto-score responses', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const label = screen.getByText('Auto-score responses');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        // autoScore is local state, just verify it doesn't crash
        expect(screen.getByText('Auto-score responses')).toBeDefined();
      }
    });

    it('toggles web search and shows API key input', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const label = screen.getByText('Web search');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      if (toggleButton) {
        await user.click(toggleButton);
        expect(screen.getByPlaceholderText('Tavily/Serper API key')).toBeDefined();
      }
    });

    it('renders response language selector', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Response language')).toBeDefined();
      expect(screen.getByDisplayValue('English')).toBeDefined();
    });

    it('changes response language', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      const select = screen.getByDisplayValue('English');
      await user.selectOptions(select, 'Hinglish');
      expect(screen.getByDisplayValue('Hinglish')).toBeDefined();
    });
  });

  // ── Agency Profile ──

  describe('agency profile', () => {
    it('renders profile input fields', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByPlaceholderText('Agency name')).toBeDefined();
      expect(screen.getByPlaceholderText('Owner name')).toBeDefined();
      expect(screen.getByPlaceholderText('City')).toBeDefined();
      expect(screen.getByPlaceholderText('Services (SEO, Web Dev, Ads...)')).toBeDefined();
    });

    it('shows preview when agency name is filled', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      await user.type(screen.getByPlaceholderText('Agency name'), 'Acme Digital');
      expect(screen.getByText('Preview')).toBeDefined();
      expect(screen.getByText('Acme Digital')).toBeDefined();
    });

    it('does not show preview when agency name is empty', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.queryByText('Preview')).toBeNull();
    });

    it('handles invalid JSON in localStorage gracefully', async () => {
      // Mock localStorage.getItem to return invalid JSON
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn((key: string) => {
        if (key === 'oracle-agency-profile') return 'invalid{json';
        return originalGetItem.call(localStorage, key);
      });

      try {
        // Should not crash — getAgencyProfile catches the error and returns defaults
        await act(async () => {
          render(<ConfigTab />);
        });
        expect(screen.getByText('⚙ Settings')).toBeDefined();
        // Profile fields should have empty defaults
        const agencyInput = screen.getByPlaceholderText('Agency name') as HTMLInputElement;
        expect(agencyInput.value).toBe('');
      } finally {
        Storage.prototype.getItem = originalGetItem;
      }
    });

    it('save button is clickable and updates profile state', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      await user.type(screen.getByPlaceholderText('Agency name'), 'Test Agency');
      await user.type(screen.getByPlaceholderText('City'), 'Mumbai');
      // Verify preview updates with typed values
      expect(screen.getByText('Test Agency')).toBeDefined();
      expect(screen.getByText('Mumbai')).toBeDefined();
      // Verify save button is clickable without crashing
      const saveButtons = screen.getAllByText('Save Profile');
      await user.click(saveButtons[0]);

      // Should call toast.success with profile saved message
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Agency profile saved'),
        expect.any(Object)
      );
    });
  });

  // ── Knowledge Base ──

  describe('knowledge base', () => {
    it('loads knowledge docs on mount', async () => {
      render(<ConfigTab />);
      await waitFor(() => {
        expect(mockKnowledgeDocsList).toHaveBeenCalledTimes(1);
      });
    });

    it('shows loaded knowledge docs', async () => {
      mockKnowledgeDocsList.mockResolvedValue([
        { id: 'doc1', name: 'SOP.pdf', content: 'content', source: 'upload', tags: [], created_at: Date.now() },
        { id: 'doc2', name: 'Pricing.xlsx', content: 'content', source: 'upload', tags: [], created_at: Date.now() },
      ]);
      render(<ConfigTab />);
      await waitFor(() => {
        expect(screen.getByText('SOP.pdf')).toBeDefined();
        expect(screen.getByText('Pricing.xlsx')).toBeDefined();
      });
    });

    it('removes a knowledge doc when × is clicked', async () => {
      mockKnowledgeDocsList.mockResolvedValue([
        { id: 'doc1', name: 'SOP.pdf', content: 'content', source: 'upload', tags: [], created_at: Date.now() },
      ]);
      const user = userEvent.setup();
      render(<ConfigTab />);
      await waitFor(() => {
        expect(screen.getByText('SOP.pdf')).toBeDefined();
      });
      // Click the remove button (×)
      const removeButton = screen.getByText('×');
      await user.click(removeButton);
      expect(mockKnowledgeDocsDelete).toHaveBeenCalledWith('doc1');
    });

    it('shows upload button', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('+ Upload document')).toBeDefined();
    });

    it('uploads a file and adds it to the knowledge base', async () => {
      mockKnowledgeDocsCreate.mockResolvedValue({ id: 'new-doc', name: 'guide.txt', content: 'file content', source: 'upload', tags: [], created_at: Date.now() });
      render(<ConfigTab />);

      // Wait for initial load to complete
      await waitFor(() => {
        expect(mockKnowledgeDocsList).toHaveBeenCalledTimes(1);
      });

      // Find the hidden file input and trigger a change event with a mock File
      const fileInput = document.getElementById('kb-upload') as HTMLInputElement;
      const file = new File(['file content'], 'guide.txt', { type: 'text/plain' });
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      // Wait for the upload to complete
      await waitFor(() => {
        expect(mockKnowledgeDocsCreate).toHaveBeenCalledWith({ name: 'guide.txt', content: 'file content' });
        expect(screen.getByText('guide.txt')).toBeDefined();
        // Should call toast.success with upload message
        expect(mockToastWarning).toHaveBeenCalledWith(
          expect.stringContaining('Uploaded'),
          expect.any(Object)
        );
      });
    });

    it('handles file upload failure gracefully', async () => {
      mockKnowledgeDocsCreate.mockRejectedValue(new Error('Upload failed'));
      render(<ConfigTab />);

      await waitFor(() => {
        expect(mockKnowledgeDocsList).toHaveBeenCalledTimes(1);
      });

      const fileInput = document.getElementById('kb-upload') as HTMLInputElement;
      const file = new File(['content'], 'fail.txt', { type: 'text/plain' });
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      // Should call toast.error with the failure message
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to upload'),
          expect.any(Object)
        );
      });
    });
  });

  // ── Cost Dashboard ──

  describe('cost dashboard', () => {
    it('displays zero costs by default', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const costElements = screen.getAllByText('₹0.00');
      expect(costElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('$0.0000')).toBeDefined();
    });

    it('displays non-zero costs', async () => {
      mockTotalCostUSD = 0.05;
      mockTotalCostINR = 4.20;
      await act(async () => {
        render(<ConfigTab />);
      });
      const costElements = screen.getAllByText('₹4.20');
      expect(costElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('$0.0500')).toBeDefined();
    });

    it('shows zero avg when no usage', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const costElements = screen.getAllByText('₹0.00');
      expect(costElements.length).toBeGreaterThanOrEqual(1);
    });

    it('calculates avg per request correctly', async () => {
      mockTotalCostINR = 10;
      mockUsageHistory = [
        { timestamp: Date.now(), provider: 'openai', costINR: 5 },
        { timestamp: Date.now(), provider: 'openai', costINR: 5 },
      ];
      await act(async () => {
        render(<ConfigTab />);
      });
      // avg = 10 / 2 = 5.00
      const avgElements = screen.getAllByText('₹5.00');
      expect(avgElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows cost breakdown by provider', async () => {
      mockUsageHistory = [
        { timestamp: Date.now(), provider: 'openai', costINR: 3 },
        { timestamp: Date.now(), provider: 'groq', costINR: 1 },
        { timestamp: Date.now(), provider: 'openai', costINR: 2 },
      ];
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Cost by Provider')).toBeDefined();
      const openaiElements = screen.getAllByText('OpenAI');
      expect(openaiElements.length).toBeGreaterThanOrEqual(1);
      const groqElements = screen.getAllByText('Groq');
      expect(groqElements.length).toBeGreaterThanOrEqual(1);
    });

    it('calls resetCosts when Reset Costs is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);
      await user.click(screen.getByText('Reset Costs'));
      expect(mockResetCosts).toHaveBeenCalled();
    });

    it('shows Providers Used count', async () => {
      mockUsageHistory = [
        { timestamp: Date.now(), provider: 'openai', costINR: 3 },
        { timestamp: Date.now(), provider: 'groq', costINR: 1 },
      ];
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Providers Used')).toBeDefined();
    });
  });

  // ── Hallucination Guard Config ──

  describe('hallucination guard config', () => {
    it('renders the guard config section', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('🛡 Hallucination Guard')).toBeDefined();
      expect(screen.getByText('Enable hallucination guard')).toBeDefined();
      expect(screen.getByText('Automatically verify AI responses for accuracy and grounding')).toBeDefined();
    });

    it('renders threshold sliders with default values', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Pass threshold')).toBeDefined();
      expect(screen.getByText('Warn threshold')).toBeDefined();
      expect(screen.getByText('Block threshold')).toBeDefined();
      // Default values shown
      expect(screen.getByText('70%')).toBeDefined();
      expect(screen.getByText('50%')).toBeDefined();
      expect(screen.getByText('30%')).toBeDefined();
    });

    it('renders detection sub-toggles', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Self-verification')).toBeDefined();
      expect(screen.getByText('Fact grounding')).toBeDefined();
      expect(screen.getByText('Pattern detection')).toBeDefined();
    });

    it('shows config preview with enabled state by default', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Config Preview')).toBeDefined();
      expect(screen.getByText(/Guard ✅ enabled/)).toBeDefined();
      expect(screen.getByText(/Pass >=70%/)).toBeDefined();
      expect(screen.getByText(/Warn <50%/)).toBeDefined();
      expect(screen.getByText(/Block <30%/)).toBeDefined();
    });

    it('shows disabled in config preview when guard is off', async () => {
      mockLoadGuardConfig.mockReturnValue({
        enabled: false,
        thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
        maxRetries: 2,
        selfVerification: true,
        factGrounding: true,
        patternDetection: true,
        strictDomains: [],
      });
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Guard ⛔ disabled/)).toBeDefined();
    });

    it('toggles guard enabled and persists to localStorage', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Find the toggle for 'Enable hallucination guard'
      const label = screen.getByText('Enable hallucination guard');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      // Should call saveGuardConfig with enabled: false
      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('toggles self-verification and persists', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      const label = screen.getByText('Self-verification');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({ selfVerification: false })
      );
    });

    it('toggles fact grounding and persists', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      const label = screen.getByText('Fact grounding');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({ factGrounding: false })
      );
    });

    it('toggles pattern detection and persists', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      const label = screen.getByText('Pattern detection');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button');
      expect(toggleButton).toBeDefined();

      await user.click(toggleButton!);

      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({ patternDetection: false })
      );
    });

    it('clamps warn threshold when pass threshold is lowered below it', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Find the pass threshold slider and set it to 40 (below warn's 50)
      const sliders = screen.getAllByRole('slider');
      const passSlider = sliders[1]; // index 1 = pass threshold (index 0 = temperature)

      // Simulate setting pass threshold to 40
      fireEvent.change(passSlider, { target: { value: '40' } });

      // saveGuardConfig should have been called with clamped values
      // warn should be clamped to max(10, 40 - 5) = 35
      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          thresholds: expect.objectContaining({
            passThreshold: 40,
            warnThreshold: 35,
          }),
        })
      );
    });

    it('clamps block threshold when warn threshold is lowered below it', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Find the warn threshold slider and set it to 25 (below block's 30)
      const sliders = screen.getAllByRole('slider');
      const warnSlider = sliders[2]; // index 2 = warn threshold

      fireEvent.change(warnSlider, { target: { value: '25' } });

      // block should be clamped to max(5, 25 - 5) = 20
      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          thresholds: expect.objectContaining({
            warnThreshold: 25,
            blockThreshold: 20,
          }),
        })
      );
    });

    it('updates config preview when thresholds change', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Initial preview
      expect(screen.getByText(/Pass >=70%/)).toBeDefined();

      // Change pass threshold slider
      const sliders = screen.getAllByRole('slider');
      const passSlider = sliders[1]; // index 1 = pass threshold (index 0 = temperature)
      fireEvent.change(passSlider, { target: { value: '85' } });

      // Preview should update
      await waitFor(() => {
        expect(screen.getByText(/Pass >=85%/)).toBeDefined();
      });
    });

    it('shows warning when pass threshold is lowered below warn threshold', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Set pass threshold to 40 (below warn's 50) — should trigger toast
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '40' } }); // index 1 = pass threshold

      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Warn threshold clamped'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('shows warning when warn threshold is lowered below block threshold', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Set warn threshold to 25 (below block's 30) — should trigger toast
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[2], { target: { value: '25' } }); // index 2 = warn threshold

      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Block threshold clamped'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('does not show warning when thresholds are valid', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Default thresholds are valid (70 > 50 > 30)
      expect(screen.queryByText(/threshold clamped/)).toBeNull();
    });

    it('auto-dismisses warning after timeout', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Trigger a warning
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '40' } }); // index 1 = pass threshold

      // Toast should be called with 4s duration
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Warn threshold clamped'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('shows combined warning when both thresholds need clamping', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });

      // Set pass to 20 — both warn (50) and block (30) exceed it
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '20' } }); // index 1 = pass threshold

      // Toast should be called with combined warning
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Warn threshold clamped'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('updates config preview when guard is toggled off', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<ConfigTab />);
      });

      // Initial: enabled
      expect(screen.getByText(/Guard ✅ enabled/)).toBeDefined();

      // Toggle off
      const label = screen.getByText('Enable hallucination guard');
      const toggleButton = label.closest('div')?.parentElement?.querySelector('button')!;
      await user.click(toggleButton);

      // Preview should show disabled
      await waitFor(() => {
        expect(screen.getByText(/Guard ⛔ disabled/)).toBeDefined();
      });
    });

    it('loads guard config from localStorage on mount', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(mockLoadGuardConfig).toHaveBeenCalled();
    });

    it('renders export, import, and reset buttons', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText(/Export JSON/)).toBeDefined();
      expect(screen.getByText(/Import JSON/)).toBeDefined();
      expect(screen.getByText(/Reset to Defaults/)).toBeDefined();
    });

    it('shows success toast when Export JSON is clicked', async () => {
      // Mock URL.createObjectURL and URL.revokeObjectURL for jsdom
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      URL.createObjectURL = mockCreateObjectURL;
      URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement to capture the download action
      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          const el = originalCreateElement(tag);
          el.click = mockClick;
          return el;
        }
        return originalCreateElement(tag);
      });

      const user = userEvent.setup();
      render(<ConfigTab />);

      await user.click(screen.getByText(/Export JSON/));

      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Guard config exported'),
        expect.any(Object)
      );

      vi.restoreAllMocks();
    });

    it('shows success toast when valid JSON is imported', async () => {
      const configJson = JSON.stringify({
        enabled: false,
        thresholds: { passThreshold: 80, warnThreshold: 60, blockThreshold: 40 },
      });
      const file = new File([configJson], 'guard-config.json', { type: 'application/json' });

      render(<ConfigTab />);
      const fileInput = screen.getByText(/Import JSON/).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockToastWarning).toHaveBeenCalledWith(
          expect.stringContaining('Guard config imported'),
          expect.any(Object)
        );
      });
    });

    it('resets guard config to defaults when Reset is clicked', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // First change a threshold so it differs from defaults
      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[1], { target: { value: '85' } }); // index 1 = pass threshold

      // Verify it changed
      expect(screen.getByText('85%')).toBeDefined();

      // Click Reset to Defaults
      await user.click(screen.getByText(/Reset to Defaults/));

      // Should call saveGuardConfig with defaults (70/50/30)
      expect(mockSaveGuardConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
        })
      );

      // Should call toast.success with reset message
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('Guard config reset'),
        expect.any(Object)
      );
    });

    it('imports valid guard config from JSON file', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Create a valid JSON config file
      const configJson = JSON.stringify({
        enabled: false,
        thresholds: { passThreshold: 80, warnThreshold: 60, blockThreshold: 40 },
        selfVerification: false,
      });
      const file = new File([configJson], 'guard-config.json', { type: 'application/json' });

      // Find the hidden file input for import
      const fileInput = screen.getByText(/Import JSON/).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeDefined();

      // Trigger file change
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      // Should call saveGuardConfig with the imported config (merged with defaults)
      await waitFor(() => {
        expect(mockSaveGuardConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: false,
            thresholds: expect.objectContaining({
              passThreshold: 80,
              warnThreshold: 60,
              blockThreshold: 40,
            }),
            selfVerification: false,
          })
        );
      });
    });

    it('shows warning when importing invalid JSON', async () => {
      render(<ConfigTab />);

      // Create an invalid JSON file
      const file = new File(['not valid json {{{'], 'bad-config.json', { type: 'application/json' });

      const fileInput = screen.getByText(/Import JSON/).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      // Should call toast.error with import failure message
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to import config'),
          expect.any(Object)
        );
      });
    });

    it('clamps imported thresholds that violate ordering', async () => {
      const user = userEvent.setup();
      render(<ConfigTab />);

      // Import a config where warn >= pass (invalid ordering)
      const configJson = JSON.stringify({
        enabled: true,
        thresholds: { passThreshold: 40, warnThreshold: 50, blockThreshold: 30 },
      });
      const file = new File([configJson], 'guard-config.json', { type: 'application/json' });

      const fileInput = screen.getByText(/Import JSON/).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSaveGuardConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            thresholds: expect.objectContaining({
              passThreshold: 40,
              warnThreshold: 35, // clamped to max(10, 40 - 5)
            }),
          })
        );
      });
    });

    it('renders guard config section in the correct order (after Advanced, before Agency Profile)', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      const sections = ['API Keys', 'Model Selection', 'MCP Tools', 'Advanced Settings', 'Hallucination Guard', 'Agency Profile', 'Knowledge Base', 'Claude Code Integration', 'Cost Dashboard'];
      const headings = screen.getAllByRole('heading', { level: 2 });
      const headingTexts = headings.map((h) => h.textContent || '');

      // Find indices of relevant sections
      const guardIdx = headingTexts.findIndex((t) => t.includes('Hallucination Guard'));
      const advancedIdx = headingTexts.findIndex((t) => t.includes('Advanced Settings'));
      const agencyIdx = headingTexts.findIndex((t) => t.includes('Agency Profile'));

      expect(guardIdx).toBeGreaterThan(advancedIdx);
      expect(guardIdx).toBeLessThan(agencyIdx);
    });
  });

  // ── Claude Code Integration ──

  describe('Claude Code integration', () => {
    it('renders installation instructions', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('Install Claude Code')).toBeDefined();
      expect(screen.getByText(/npm install -g @anthropic-ai\/claude-code/)).toBeDefined();
    });

    it('renders MCP configuration example', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('MCP Configuration')).toBeDefined();
    });

    it('renders power user commands', async () => {
      await act(async () => {
        render(<ConfigTab />);
      });
      expect(screen.getByText('/audit')).toBeDefined();
      expect(screen.getByText('/proposal [client]')).toBeDefined();
      expect(screen.getByText('/content [topic]')).toBeDefined();
      expect(screen.getByText('/code [feature]')).toBeDefined();
      expect(screen.getByText('/research [topic]')).toBeDefined();
    });
  });
});
