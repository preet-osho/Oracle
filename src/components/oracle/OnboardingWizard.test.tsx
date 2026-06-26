import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───

const mockSetByokKey = vi.fn().mockResolvedValue(undefined);
const mockSetSelectedModel = vi.fn();
const mockCompleteOnboarding = vi.fn();

let mockConfiguredProviders: string[] = [];

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    setByokKey: mockSetByokKey,
    setSelectedModel: mockSetSelectedModel,
    configuredProviders: mockConfiguredProviders,
    completeOnboarding: mockCompleteOnboarding,
  }),
}));

vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    {
      id: 'groq',
      name: 'Groq',
      models: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, bestFor: ['general'], isFree: true },
      ],
      baseUrl: 'https://api.groq.com',
      keyFormat: 'gsk_...',
      keyLabel: 'Groq API Key',
      docsUrl: '',
      signupUrl: 'https://console.groq.com',
      color: '#f55036',
      freeLimit: '14,400 req/day free',
      supportsStreaming: true,
      supportsMCP: false,
    },
    {
      id: 'google',
      name: 'Google',
      models: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, bestFor: ['general'], isFree: true },
      ],
      baseUrl: 'https://generativelanguage.googleapis.com',
      keyFormat: 'AIza...',
      keyLabel: 'Google AI Key',
      docsUrl: '',
      signupUrl: 'https://aistudio.google.com',
      color: '#4285f4',
      freeLimit: '1M tokens/day free',
      supportsStreaming: true,
      supportsMCP: false,
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      models: [
        { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B', contextWindow: 8192, bestFor: ['general'], isFree: true },
      ],
      baseUrl: 'https://openrouter.ai',
      keyFormat: 'sk-or-...',
      keyLabel: 'OpenRouter Key',
      docsUrl: '',
      signupUrl: 'https://openrouter.ai/keys',
      color: '#6366f1',
      freeLimit: '200+ free models',
      supportsStreaming: true,
      supportsMCP: false,
    },
    {
      id: 'cerebras',
      name: 'Cerebras',
      models: [
        { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', contextWindow: 128000, bestFor: ['general'], isFree: true },
      ],
      baseUrl: 'https://api.cerebras.ai',
      keyFormat: 'csk-...',
      keyLabel: 'Cerebras Key',
      docsUrl: '',
      signupUrl: 'https://cloud.cerebras.ai',
      color: '#10b981',
      freeLimit: '600 req/min free',
      supportsStreaming: true,
      supportsMCP: false,
    },
  ],
}));

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {}, snappy: {} },
  buttonTapProps: {},
}));

// ─── Import after mocks ───
import { OnboardingWizard } from './OnboardingWizard';

// ─── Helpers ───

function renderWizard(onComplete?: () => void) {
  const defaultProps = {
    onComplete: onComplete ?? vi.fn(),
  };
  return { ...render(<OnboardingWizard {...defaultProps} />), ...defaultProps };
}

// ─── Tests ───

describe('OnboardingWizard', () => {
  const mockSetItem = vi.fn();

  beforeEach(() => {
    mockConfiguredProviders = [];
    mockSetItem.mockClear();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: mockSetItem,
        removeItem: vi.fn(),
        clear: vi.fn(),
        get length() { return 0; },
        key: vi.fn().mockReturnValue(null),
      },
      writable: true,
    });
  });

  // ── Auto-complete ──

  describe('auto-complete for existing users', () => {
    it('calls onComplete immediately when user already has API keys', () => {
      mockConfiguredProviders = ['groq'];
      const onComplete = vi.fn();
      renderWizard(onComplete);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('does not call onComplete when user has no API keys', () => {
      mockConfiguredProviders = [];
      const onComplete = vi.fn();
      renderWizard(onComplete);
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  // ── Step Navigation ──

  describe('step navigation', () => {
    it('starts on the Welcome step', () => {
      renderWizard();
      expect(screen.getByText('Welcome to ORACLE')).toBeDefined();
      expect(screen.getByText("Let's set up your agency in 30 seconds")).toBeDefined();
    });

    it('disables Continue button when agency name is empty', () => {
      renderWizard();
      const continueBtn = screen.getByText('Continue →');
      expect(continueBtn.closest('button')).toHaveProperty('disabled', true);
    });

    it('enables Continue button when agency name is filled', () => {
      renderWizard();
      const input = screen.getByPlaceholderText('e.g. DigitalKraft Agency');
      fireEvent.change(input, { target: { value: 'Test Agency' } });
      const continueBtn = screen.getByText('Continue →');
      expect(continueBtn.closest('button')).toHaveProperty('disabled', false);
    });

    it('navigates from Welcome to Provider step on Continue click', () => {
      renderWizard();
      const input = screen.getByPlaceholderText('e.g. DigitalKraft Agency');
      fireEvent.change(input, { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      expect(screen.getByText('Connect an AI Provider')).toBeDefined();
      expect(screen.getByText('Add one API key to get started. You can add more later.')).toBeDefined();
    });

    it('navigates from Provider to Ready step when no API key entered', () => {
      renderWizard();
      // Fill agency name and go to provider step
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      // Continue without API key (canProceed is true when no key)
      fireEvent.click(screen.getByText('Continue →'));
      expect(screen.getByText("You're all set!")).toBeDefined();
    });

    it('navigates back from Provider to Welcome step', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('← Back'));
      expect(screen.getByText('Welcome to ORACLE')).toBeDefined();
    });

    it('navigates back from Ready to Provider step', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('← Back'));
      expect(screen.getByText('Connect an AI Provider')).toBeDefined();
    });
  });

  // ── Provider Selection ──

  describe('provider selection', () => {
    it('shows all 4 recommended providers', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      expect(screen.getByText('Groq')).toBeDefined();
      expect(screen.getByText('Google')).toBeDefined();
      expect(screen.getByText('OpenRouter')).toBeDefined();
      expect(screen.getByText('Cerebras')).toBeDefined();
    });

    it('shows FREE badge for providers with free models', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      const freeBadges = screen.getAllByText('FREE');
      expect(freeBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('selects and deselects a provider on click', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));

      // Click Groq to select
      const groqButton = screen.getByText('Groq').closest('button')!;
      fireEvent.click(groqButton);

      // API key input should appear
      expect(screen.getByPlaceholderText('Groq API Key')).toBeDefined();

      // Click Groq again to deselect
      fireEvent.click(groqButton);

      // API key input should disappear
      expect(screen.queryByPlaceholderText('Groq API Key')).toBeNull();
    });

    it('shows API key input when provider is selected', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));

      fireEvent.click(screen.getByText('Groq').closest('button')!);
      expect(screen.getByPlaceholderText('Groq API Key')).toBeDefined();
      // Test & Save only appears when API key is entered
      expect(screen.queryByText('Test & Save')).toBeNull();
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_test' } });
      expect(screen.getByText('Test & Save')).toBeDefined();
    });

    it('shows Get Free Key link for selected provider', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));

      fireEvent.click(screen.getByText('Groq').closest('button')!);
      const link = screen.getByText('Get Free Key →');
      expect(link).toBeDefined();
      expect(link.getAttribute('href')).toBe('https://console.groq.com');
    });

    it('shows Test & Save button only when API key is entered', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));

      fireEvent.click(screen.getByText('Groq').closest('button')!);
      expect(screen.queryByText('Test & Save')).toBeNull();

      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_test123' } });
      expect(screen.getByText('Test & Save')).toBeDefined();
    });
  });

  // ── handleTestAndSave (API Key Test Flow) ──

  describe('handleTestAndSave', () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({ ok: true });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    function navigateToProviderStep() {
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
    }

    it('calls setByokKey and fetch on Test & Save click', async () => {
      renderWizard();
      navigateToProviderStep();
      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_valid_key_123' } });

      fireEvent.click(screen.getByText('Test & Save'));
      await screen.findByText(/Key verified/);

      expect(mockSetByokKey).toHaveBeenCalledWith('groq', 'gsk_valid_key_123');
      expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    it('shows success message on successful test', async () => {
      renderWizard();
      navigateToProviderStep();
      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_valid_key' } });

      fireEvent.click(screen.getByText('Test & Save'));

      expect(await screen.findByText(/Key verified and saved securely/)).toBeDefined();
      expect(mockSetSelectedModel).toHaveBeenCalledWith('groq', 'llama-3.3-70b-versatile');
    });

    it('shows error message when fetch fails (non-ok response)', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      renderWizard();
      navigateToProviderStep();
      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_bad_key' } });

      fireEvent.click(screen.getByText('Test & Save'));

      expect(await screen.findByText(/Invalid key or connection failed/)).toBeDefined();
      expect(mockSetSelectedModel).not.toHaveBeenCalledWith('groq', expect.anything());
    });

    it('shows error message when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      renderWizard();
      navigateToProviderStep();
      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_net_err' } });

      fireEvent.click(screen.getByText('Test & Save'));

      expect(await screen.findByText(/Invalid key or connection failed/)).toBeDefined();
    });

    it('shows error message when setByokKey throws', async () => {
      mockSetByokKey.mockRejectedValueOnce(new Error('Auth failed'));
      renderWizard();
      navigateToProviderStep();
      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_auth_err' } });

      fireEvent.click(screen.getByText('Test & Save'));

      expect(await screen.findByText(/Invalid key or connection failed/)).toBeDefined();
    });

    it('shows loading state while testing', async () => {
      renderWizard();
      navigateToProviderStep();
      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_slow' } });

      fireEvent.click(screen.getByText('Test & Save'));

      // While loading, should show testing text and button should be disabled
      const loadingBtn = screen.getByRole('button', { name: /Testing/ });
      expect(loadingBtn).toBeDefined();
      expect(loadingBtn).toHaveProperty('disabled', true);

      // Wait for the async test to complete
      await screen.findByText(/Key verified/);
    });

    it('displays correct request body in fetch call', async () => {
      renderWizard();
      navigateToProviderStep();
      fireEvent.click(screen.getByText('Google').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Google AI Key'), { target: { value: 'AIza_test' } });

      fireEvent.click(screen.getByText('Test & Save'));

      await screen.findByText(/Key verified/);

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.messages).toEqual([{ role: 'user', content: expect.stringContaining('ok') }]);
      expect(fetchBody.stream).toBe(false);
      expect(fetchBody.maxTokens).toBe(10);
    });

    it('after successful test, Continue replaces Skip button', async () => {
      renderWizard();
      navigateToProviderStep();
      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_good' } });

      // Before test: Skip button shown (key entered, no success yet)
      expect(screen.getByText('Skip — use free models')).toBeDefined();
      expect(screen.queryByText('Continue →')).toBeNull();

      // Click Test & Save to trigger the actual test flow
      fireEvent.click(screen.getByText('Test & Save'));
      await screen.findByText(/Key verified/);

      // After successful test: Continue button should appear, Skip should be gone
      expect(screen.getByText('Continue →')).toBeDefined();
      expect(screen.queryByText('Skip — use free models')).toBeNull();
    });
  });

  // ── Skip Flow ──

  describe('skip flow', () => {
    it('shows "Skip — use free models" when API key is entered but test not passed', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));

      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_test123' } });

      expect(screen.getByText('Skip — use free models')).toBeDefined();
      // Continue button should NOT be shown (Skip replaces it)
      expect(screen.queryByText('Continue →')).toBeNull();
    });

    it('skip button advances to Ready step and sets Groq as default model', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));

      fireEvent.click(screen.getByText('Groq').closest('button')!);
      fireEvent.change(screen.getByPlaceholderText('Groq API Key'), { target: { value: 'gsk_test123' } });

      fireEvent.click(screen.getByText('Skip — use free models'));

      // Should advance to Ready step
      expect(screen.getByText("You're all set!")).toBeDefined();
      // Should have set Groq model
      expect(mockSetSelectedModel).toHaveBeenCalledWith('groq', 'llama-3.3-70b-versatile');
    });

    it('"Skip for now" link calls onComplete to dismiss wizard', () => {
      const onComplete = vi.fn();
      renderWizard(onComplete);
      fireEvent.click(screen.getByText('Skip for now — explore the app first'));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('"Skip for now" link works from any step', () => {
      const onComplete = vi.fn();
      renderWizard(onComplete);

      // Navigate to provider step
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));

      // Skip from provider step
      fireEvent.click(screen.getByText('Skip for now — explore the app first'));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  // ── Service Selection ──

  describe('service selection', () => {
    it('toggles services on and off', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });

      // Select SEO via the service button (use the span with the label)
      const seoButtons = screen.getAllByText('SEO');
      const seoButton = seoButtons[seoButtons.length - 1].closest('button')!;
      fireEvent.click(seoButton);
      // Deselect SEO
      fireEvent.click(seoButton);
    });

    it('shows selected services count in preview', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });

      const seoButtons = screen.getAllByText('SEO');
      fireEvent.click(seoButtons[seoButtons.length - 1]);
      fireEvent.click(screen.getByText('Google Ads'));

      // Preview should show services — text spans multiple elements due to <strong>
      expect(screen.getByText(/specialising in/)).toBeDefined();
    });
  });

  // ── Ready Step ──

  describe('ready step', () => {
    it('shows agency name in summary', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Acme Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('Continue →'));

      expect(screen.getByText('Acme Agency')).toBeDefined();
    });

    it('shows "Free models (Groq)" when no provider selected', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('Continue →'));

      expect(screen.getByText('Free models (Groq)')).toBeDefined();
      expect(screen.getByText('Free tier — no API key needed')).toBeDefined();
    });

    it('shows provider name when provider is selected', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));

      // Select Google provider and continue
      fireEvent.click(screen.getByText('Google').closest('button')!);
      fireEvent.click(screen.getByText('Continue →'));

      expect(screen.getByText('Google')).toBeDefined();
      expect(screen.getByText('Connected and verified')).toBeDefined();
    });

    it('"Start Using ORACLE →" button calls onComplete', () => {
      const onComplete = vi.fn();
      renderWizard(onComplete);
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('Continue →'));

      fireEvent.click(screen.getByText('Start Using ORACLE →'));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('saves profile to localStorage on complete', () => {
      const onComplete = vi.fn();
      renderWizard(onComplete);
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Acme Agency' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Rajesh Kumar'), { target: { value: 'Raj' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Mumbai'), { target: { value: 'Pune' } });
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('Continue →'));

      fireEvent.click(screen.getByText('Start Using ORACLE →'));

      expect(mockSetItem).toHaveBeenCalledWith(
        'oracle-agency-profile',
        expect.stringContaining('Acme Agency')
      );
    });

    it('shows what-you-can-do list', () => {
      renderWizard();
      fireEvent.change(screen.getByPlaceholderText('e.g. DigitalKraft Agency'), { target: { value: 'Test Agency' } });
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('Continue →'));

      expect(screen.getByText('Chat with ORACLE about any client task')).toBeDefined();
      expect(screen.getByText('Use 55+ expert prompts for instant output')).toBeDefined();
      expect(screen.getByText('Get quality scores on every response')).toBeDefined();
      expect(screen.getByText('Generate proposals & GST invoices')).toBeDefined();
    });
  });

  // ── Progress Bar ──

  describe('progress bar', () => {
    it('shows all 3 step labels', () => {
      renderWizard();
      expect(screen.getByText('Welcome')).toBeDefined();
      expect(screen.getByText('Connect AI')).toBeDefined();
      expect(screen.getByText('Ready!')).toBeDefined();
    });

    it('shows step numbers 1, 2, 3', () => {
      renderWizard();
      expect(screen.getByText('1')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
      expect(screen.getByText('3')).toBeDefined();
    });
  });
});
