import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NeverStopRouter } from './router';
import { isAvailable, recordSuccess, recordFailure } from '@/lib/circuit-breaker';

vi.mock('@/lib/circuit-breaker', () => ({
  isAvailable: vi.fn().mockReturnValue(true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  initCircuitBreaker: vi.fn(),
  getCircuitStatus: vi.fn().mockReturnValue([]),
  resetCircuit: vi.fn(),
  getUnavailableProviders: vi.fn().mockReturnValue([]),
}));

// ─── localStorage Mock ─────────────────

const localStorageStore: Record<string, string> = {};

function setupLocalStorage(keys?: Record<string, string>) {
  const defaultKeys = {
    openai: 'sk-test-openai-key-1234567890abcdef',
    anthropic: 'sk-ant-test-anthropic-key-1234567890abcdef',
    groq: 'gsk_test_groq_key_1234567890abcdef',
    google: 'AIza_test_google_key_1234567890abcdef',
  };

  localStorageStore['oracle_byok_keys'] = JSON.stringify(keys ?? defaultKeys);

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
      removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
      clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
    },
    writable: true,
  });
}

// ─── Tests ─────────────────────────────

describe('NeverStopRouter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setupLocalStorage();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  });

  // ── Cost Calculator ──

  describe('calculateCost', () => {
    it('returns zero for unknown provider/model', () => {
      const cost = NeverStopRouter.calculateCost('unknown', 'unknown', 1000, 1000);
      expect(cost.usd).toBe(0);
      expect(cost.inr).toBe(0);
    });

    it('returns non-zero for known openai/gpt-4o pricing', () => {
      const cost = NeverStopRouter.calculateCost('openai', 'gpt-4o', 1000, 1000);
      expect(cost.usd).toBeGreaterThan(0);
      expect(cost.inr).toBeGreaterThan(0);
    });

    it('scales cost proportionally with token count', () => {
      const cost1 = NeverStopRouter.calculateCost('openai', 'gpt-4o', 1000, 1000);
      const cost2 = NeverStopRouter.calculateCost('openai', 'gpt-4o', 2000, 2000);
      expect(cost2.usd).toBeCloseTo(cost1.usd * 2, 4);
      expect(cost2.inr).toBeCloseTo(cost1.inr * 2, 2);
    });

    it('returns zero for free providers (groq)', () => {
      const cost = NeverStopRouter.calculateCost('groq', 'llama-3.3-70b-versatile', 10000, 10000);
      expect(cost.usd).toBe(0);
      expect(cost.inr).toBe(0);
    });
  });

  // ── BYOK Key Management ──

  describe('BYOK key management', () => {
    it('hasKey returns true for configured providers', () => {
      expect(NeverStopRouter.hasKey('openai')).toBe(true);
      expect(NeverStopRouter.hasKey('anthropic')).toBe(true);
      expect(NeverStopRouter.hasKey('groq')).toBe(true);
    });

    it('hasKey returns false for unconfigured providers', () => {
      expect(NeverStopRouter.hasKey('cerebras')).toBe(false);
    });

    it('setKey and getKey round-trip', () => {
      NeverStopRouter.setKey('cerebras', 'csk_test_1234567890abcdef');
      expect(NeverStopRouter.getKey('cerebras')).toBe('csk_test_1234567890abcdef');
    });

    it('removeKey deletes the key', () => {
      NeverStopRouter.setKey('cerebras', 'csk_test_1234567890abcdef');
      NeverStopRouter.removeKey('cerebras');
      expect(NeverStopRouter.getKey('cerebras')).toBeNull();
    });

    it('validateKeyFormat validates openai key format', () => {
      expect(NeverStopRouter.validateKeyFormat('openai', 'sk-1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('openai', 'invalid')).toBe(false);
    });

    it('getAllKeys returns all configured keys', () => {
      const keys = NeverStopRouter.getAllKeys();
      expect(Object.keys(keys)).toContain('openai');
      expect(Object.keys(keys)).toContain('anthropic');
      expect(Object.keys(keys)).toContain('groq');
    });
  });

  // ── validateKeyFormat edge cases ──

  describe('validateKeyFormat edge cases', () => {
    it('returns true for non-empty key with unknown provider', () => {
      expect(NeverStopRouter.validateKeyFormat('unknown', 'any-key')).toBe(true);
    });

    it('returns false for empty key with unknown provider', () => {
      expect(NeverStopRouter.validateKeyFormat('unknown', '')).toBe(false);
    });

    it('validates groq key format', () => {
      expect(NeverStopRouter.validateKeyFormat('groq', 'gsk_1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('groq', 'invalid')).toBe(false);
    });

    it('validates google key format', () => {
      expect(NeverStopRouter.validateKeyFormat('google', 'AIza_1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('google', 'invalid')).toBe(false);
    });

    it('validates openrouter key format', () => {
      expect(NeverStopRouter.validateKeyFormat('openrouter', 'sk-or-1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('openrouter', 'invalid')).toBe(false);
    });

    it('validates cerebras key format', () => {
      expect(NeverStopRouter.validateKeyFormat('cerebras', 'csk_1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('cerebras', 'invalid')).toBe(false);
    });

    it('validates perplexity key format', () => {
      expect(NeverStopRouter.validateKeyFormat('perplexity', 'pplx-1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('perplexity', 'invalid')).toBe(false);
    });

    it('validates together key format', () => {
      expect(NeverStopRouter.validateKeyFormat('together', '1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('together', 'short')).toBe(false);
    });

    it('validates mistral key format', () => {
      expect(NeverStopRouter.validateKeyFormat('mistral', '1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('mistral', 'short')).toBe(false);
    });

    it('validates cohere key format', () => {
      expect(NeverStopRouter.validateKeyFormat('cohere', '1234567890abcdef1234')).toBe(true);
      expect(NeverStopRouter.validateKeyFormat('cohere', 'short')).toBe(false);
    });
  });

  // ── localStorage error handling ──

  describe('localStorage error handling', () => {
    it('getKey handles JSON parse errors', () => {
      localStorageStore['oracle_byok_keys'] = 'not-json';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = NeverStopRouter.getKey('openai');
      expect(result).toBeNull();
      warnSpy.mockRestore();
    });

    it('setKey handles JSON parse errors on existing data', () => {
      localStorageStore['oracle_byok_keys'] = 'not-json';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      NeverStopRouter.setKey('test', 'key');
      warnSpy.mockRestore();
    });

    it('removeKey handles JSON parse errors', () => {
      localStorageStore['oracle_byok_keys'] = 'not-json';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      NeverStopRouter.removeKey('test');
      warnSpy.mockRestore();
    });

    it('getAllKeys handles JSON parse errors', () => {
      localStorageStore['oracle_byok_keys'] = 'not-json';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const keys = NeverStopRouter.getAllKeys();
      expect(keys).toEqual({});
      warnSpy.mockRestore();
    });

    it('removeKey handles missing raw data', () => {
      delete localStorageStore['oracle_byok_keys'];
      NeverStopRouter.removeKey('test');
    });

    it('getKey returns null when raw is null', () => {
      delete localStorageStore['oracle_byok_keys'];
      const result = NeverStopRouter.getKey('openai');
      expect(result).toBeNull();
    });

    it('getKey returns null when provider key not found', () => {
      localStorageStore['oracle_byok_keys'] = JSON.stringify({ openai: 'sk-test' });
      const result = NeverStopRouter.getKey('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── callAISyncServer ──

  describe('callAISyncServer', () => {
    const savedEnv: Record<string, string | undefined> = {};
    const ENV_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'GOOGLE_API_KEY', 'CEREBRAS_API_KEY', 'PERPLEXITY_API_KEY', 'TOGETHER_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY'];

    beforeEach(() => {
      for (const key of ENV_KEYS) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    });

    afterEach(() => {
      for (const key of ENV_KEYS) {
        if (savedEnv[key] !== undefined) {
          process.env[key] = savedEnv[key];
        } else {
          delete process.env[key];
        }
      }
    });

    it('uses provider selected by FAILOVER_ORDER from env vars', async () => {
      process.env.GROQ_API_KEY = 'gsk_test_server_groq_key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello from Groq' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const result = await NeverStopRouter.callAISyncServer('Test prompt', { maxTokens: 1000 });

      expect(result.text).toBe('Hello from Groq');
      expect(result.provider).toBe('groq');
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(20);
      expect(result.costUSD).toBe(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('groq');
      const body = JSON.parse(init.body);
      expect(body.max_tokens).toBe(1000);
    });

    it('passes maxTokens to OpenAI-compatible providers', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-server-openai-key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OK' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
        }),
      });

      await NeverStopRouter.callAISyncServer('Hi', { maxTokens: 500 });

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.max_tokens).toBe(500);
    });

    it('passes maxTokens to Anthropic provider', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-server-key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Claude says hi' }],
          usage: { input_tokens: 15, output_tokens: 25 },
        }),
      });

      const result = await NeverStopRouter.callAISyncServer('Hi', { maxTokens: 2000 });

      expect(result.text).toBe('Claude says hi');
      expect(result.provider).toBe('anthropic');

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.max_tokens).toBe(2000);
    });

    it('returns error when no env vars are set', async () => {
      const result = await NeverStopRouter.callAISyncServer('Test');

      expect(result.text).toContain('No server-side AI API keys configured');
      expect(result.provider).toBe('none');
      expect(result.costUSD).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('respects providerId option to force a specific provider', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-server-key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Forced Anthropic' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      const result = await NeverStopRouter.callAISyncServer('Hi', {
        providerId: 'anthropic',
        maxTokens: 1500,
      });

      expect(result.text).toBe('Forced Anthropic');
      expect(result.provider).toBe('anthropic');

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.max_tokens).toBe(1500);
    });

    it('falls back to next provider on network error', async () => {
      let callCount = 0;
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.OPENAI_API_KEY = 'sk-test_openai_key';
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Recovered via failover' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          }),
        };
      });

      const result = await NeverStopRouter.callAISyncServer('Test');

      expect(result.text).toBe('Recovered via failover');
      expect(result.provider).toBe('openai');
      expect(callCount).toBe(2);
    });

    it('returns combined error when all providers fail', async () => {
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.OPENAI_API_KEY = 'sk-test_openai_key';
      global.fetch = vi.fn().mockImplementation(async () => {
        throw new TypeError('Network error');
      });

      const result = await NeverStopRouter.callAISyncServer('Test');

      expect(result.text).toContain('All providers failed');
      expect(result.text).toContain('groq');
      expect(result.text).toContain('openai');
      expect(result.costUSD).toBe(0);
    });

    it('skips providers that fail with HTTP errors and tries next', async () => {
      let callCount = 0;
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.GOOGLE_API_KEY = 'AIza_test_google_key';
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 429, text: async () => 'rate limited' };
        }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Google OK' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          }),
        };
      });

      const result = await NeverStopRouter.callAISyncServer('Test');

      expect(result.text).toBe('Google OK');
      expect(result.provider).toBe('google');
      expect(callCount).toBe(2);
    });
  });

  // ── Circuit Breaker Integration ──

  describe('callAISyncServer circuit breaker integration', () => {
    const savedEnv: Record<string, string | undefined> = {};
    const ENV_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'GOOGLE_API_KEY'];

    beforeEach(() => {
      for (const key of ENV_KEYS) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
      vi.mocked(isAvailable).mockReset();
      vi.mocked(recordSuccess).mockReset();
      vi.mocked(recordFailure).mockReset();
      // Default: all providers available
      vi.mocked(isAvailable).mockReturnValue(true);
    });

    afterEach(() => {
      for (const key of ENV_KEYS) {
        if (savedEnv[key] !== undefined) {
          process.env[key] = savedEnv[key];
        } else {
          delete process.env[key];
        }
      }
    });

    it('skips providers whose circuit is open', async () => {
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.OPENAI_API_KEY = 'sk-test_openai_key';
      // groq circuit is open, openai is available
      vi.mocked(isAvailable).mockImplementation((pid: string) => pid !== 'groq');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OpenAI OK' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const result = await NeverStopRouter.callAISyncServer('Test');

      // Should succeed via openai, not groq
      expect(result.text).toBe('OpenAI OK');
      expect(result.provider).toBe('openai');
      // groq was skipped, so only openai was called
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('openai');
    });

    it('returns combined error when all providers have open circuits', async () => {
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.OPENAI_API_KEY = 'sk-test_openai_key';
      // Both circuits are open
      vi.mocked(isAvailable).mockReturnValue(false);

      const result = await NeverStopRouter.callAISyncServer('Test');

      expect(result.text).toContain('All providers failed');
      expect(result.text).toContain('circuit breaker open (skipped)');
      expect(result.costUSD).toBe(0);
      // No fetch calls should have been made
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('records success when API call succeeds', async () => {
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
        }),
      });

      await NeverStopRouter.callAISyncServer('Test');

      expect(recordSuccess).toHaveBeenCalledWith('groq');
      expect(recordFailure).not.toHaveBeenCalled();
    });

    it('records failure when API call throws', async () => {
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.OPENAI_API_KEY = 'sk-test_openai_key';
      global.fetch = vi.fn().mockImplementation(async () => {
        throw new TypeError('Network error');
      });

      await NeverStopRouter.callAISyncServer('Test');

      // Both providers failed, both should be recorded as failures
      expect(recordFailure).toHaveBeenCalledWith('groq');
      expect(recordFailure).toHaveBeenCalledWith('openai');
      expect(recordSuccess).not.toHaveBeenCalled();
    });

    it('records failure when API returns error response', async () => {
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.OPENAI_API_KEY = 'sk-test_openai_key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      });

      await NeverStopRouter.callAISyncServer('Test');

      // groq failed with HTTP error → failover to openai, which also failed
      expect(recordFailure).toHaveBeenCalledWith('groq');
      expect(recordFailure).toHaveBeenCalledWith('openai');
    });

    it('records success only on the provider that succeeds during failover', async () => {
      let callCount = 0;
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.GOOGLE_API_KEY = 'AIza_test_google_key';
      // FAILOVER_ORDER: groq → google → ...
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new TypeError('Network error');
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Recovered' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          }),
        };
      });

      await NeverStopRouter.callAISyncServer('Test');

      expect(recordFailure).toHaveBeenCalledWith('groq');
      expect(recordSuccess).toHaveBeenCalledWith('google');
    });

    it('skips circuit-broken provider but tries and succeeds with next', async () => {
      process.env.GROQ_API_KEY = 'gsk_test_groq_key';
      process.env.GOOGLE_API_KEY = 'AIza_test_google_key';
      // groq is circuit-broken, google is available
      vi.mocked(isAvailable).mockImplementation((pid: string) => pid !== 'groq');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Google recovered' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const result = await NeverStopRouter.callAISyncServer('Test');

      expect(result.text).toBe('Google recovered');
      expect(result.provider).toBe('google');
      expect(recordFailure).not.toHaveBeenCalled();
      expect(recordSuccess).toHaveBeenCalledWith('google');
      // Only 1 fetch call (google), groq was skipped
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
