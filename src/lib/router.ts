// ═══════════════════════════════════════
// ORACLE — NeverStopRouter Engine
// BYOK Key Management · Server-Side AI Calls · Cost Calculator
// ═══════════════════════════════════════

import { PROVIDERS } from '@/data/providers';
import { fetchWithTimeout, TIMEOUT_STANDARD_MS } from '@/lib/fetch-utils';
import { FAILOVER_ORDER, calculateCost as calculateCostShared } from '@/lib/ai-constants';
import { isAvailable, recordSuccess, recordFailure } from '@/lib/circuit-breaker';

// ─── Interfaces ────────────────────────

export interface RouteResult {
  text: string;
  provider: string;
  model: string;
  toolsUsed: string[];
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  latencyMs: number;
}

// ─── Key Format Patterns ───────────────

const KEY_PATTERNS: Record<string, RegExp> = {
  openai: /^sk-[A-Za-z0-9]{20,}$/,
  anthropic: /^sk-ant-[A-Za-z0-9\-]{20,}$/,
  groq: /^gsk_[A-Za-z0-9]{20,}$/,
  google: /^AIza[A-Za-z0-9_\-]{20,}$/,
  openrouter: /^sk-or-[A-Za-z0-9\-]{20,}$/,
  cerebras: /^csk_[A-Za-z0-9]{20,}$/,
  perplexity: /^pplx-[A-Za-z0-9]{20,}$/,
  together: /^[A-Za-z0-9\-]{20,}$/,
  mistral: /^[A-Za-z0-9\-]{20,}$/,
  cohere: /^[A-Za-z0-9\-]{20,}$/,
};

// ─── NeverStopRouter Class ─────────────

/**
 * SECURITY NOTICE: Client-side BYOK (Bring Your Own Key) localStorage methods
 * are retained ONLY for the settings UI and migration tooling.
 * All AI calls MUST go through:
 *   - Client-side: fetch('/api/ai/chat', ...) server proxy
 *   - Server-side: NeverStopRouter.callAISyncServer()
 */
export class NeverStopRouter {
  private static readonly STORAGE_KEY = 'oracle_byok_keys';

  // ── DEPRECATED: BYOK Key Management ──
  // These methods read/write raw API keys to localStorage.
  // They are ONLY safe for the settings UI (display/validation).
  // NEVER use getKey() to make direct provider API calls.

  /** @deprecated Use server-side /api/ai/chat proxy instead. Keys in localStorage are vulnerable to XSS. */
  static getKey(providerId: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const keys: Record<string, string> = JSON.parse(raw);
      return keys[providerId] || null;
    } catch (e) {
      console.warn('[Router] Failed to read key from localStorage:', e);
      return null;
    }
  }

  /** @deprecated Keys should only be stored server-side via /api/user-api-keys. */
  static setKey(providerId: string, key: string): void {
    console.warn(
      '[Router] SECURITY: setKey() is deprecated. Store keys via /api/user-api-keys (server-side encrypted).',
    );
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const keys: Record<string, string> = raw ? JSON.parse(raw) : {};
      keys[providerId] = key;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keys));
    } catch (e) {
      console.warn('[Router] Failed to save key to localStorage:', e);
    }
  }

  /** @deprecated Keys should only be deleted server-side via /api/user-api-keys. */
  static removeKey(providerId: string): void {
    console.warn(
      '[Router] SECURITY: removeKey() is deprecated. Delete keys via /api/user-api-keys (server-side).',
    );
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const keys: Record<string, string> = JSON.parse(raw);
      delete keys[providerId];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keys));
    } catch (e) {
      console.warn('[Router] Failed to remove key from localStorage:', e);
    }
  }

  /** @deprecated Use the server-side /api/user-api-keys endpoint to check configured providers. */
  static getAllKeys(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('[Router] Failed to read keys from localStorage:', e);
      return {};
    }
  }

  /** @deprecated Use the server-side /api/user-api-keys endpoint to check configured providers. */
  static hasKey(providerId: string): boolean {
    return this.getKey(providerId) !== null;
  }

  static validateKeyFormat(providerId: string, key: string): boolean {
    const pattern = KEY_PATTERNS[providerId];
    if (!pattern) return key.length > 0;
    return pattern.test(key);
  }

  // ── Server-Side AI Call (reads keys from env vars, not localStorage) ──
  // Use this in server-side code (Inngest, API routes, background jobs).
  // Client-side code should use fetch('/api/ai/chat', ...) instead.
  // Retries across FAILOVER_ORDER providers on failure.

  static async callAISyncServer(
    prompt: string,
    options: { maxTokens?: number; providerId?: string; modelId?: string } = {}
  ): Promise<RouteResult> {
    const startTime = Date.now();

    // Read API keys from server-side environment variables
    const ENV_KEY_MAP: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      groq: 'GROQ_API_KEY',
      google: 'GOOGLE_API_KEY',
      cerebras: 'CEREBRAS_API_KEY',
      perplexity: 'PERPLEXITY_API_KEY',
      together: 'TOGETHER_API_KEY',
      mistral: 'MISTRAL_API_KEY',
      cohere: 'COHERE_API_KEY',
    };

    // Build ordered list of providers to try.
    // If caller specified a provider, put it first; then follow FAILOVER_ORDER.
    const providersToTry: Array<{ providerId: string; apiKey: string }> = [];
    const seen = new Set<string>();

    if (options.providerId) {
      const envKey = ENV_KEY_MAP[options.providerId];
      const key = envKey ? process.env[envKey] : undefined;
      if (key) {
        providersToTry.push({ providerId: options.providerId, apiKey: key });
        seen.add(options.providerId);
      }
    }

    for (const pid of FAILOVER_ORDER) {
      if (seen.has(pid)) continue;
      const envKey = ENV_KEY_MAP[pid];
      const key = envKey ? process.env[envKey] : undefined;
      if (key) {
        providersToTry.push({ providerId: pid, apiKey: key });
        seen.add(pid);
      }
    }

    if (providersToTry.length === 0) {
      return {
        text: 'No server-side AI API keys configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in environment.',
        provider: 'none',
        model: 'none',
        toolsUsed: [],
        inputTokens: 0,
        outputTokens: 0,
        costUSD: 0,
        latencyMs: Date.now() - startTime,
      };
    }

    const messages = [{ role: 'user', content: prompt }];
    const errors: string[] = [];

    for (const { providerId, apiKey } of providersToTry) {
      // Skip providers whose circuit is open (known-failing)
      if (!isAvailable(providerId)) {
        errors.push(`${providerId}: circuit breaker open (skipped)`);
        continue;
      }

      const provider = PROVIDERS.find((p) => p.id === providerId);
      if (!provider) {
        errors.push(`${providerId}: unknown provider`);
        continue;
      }

      const modelId = options.modelId || provider.models[0]?.id || 'unknown';

      try {
        let result: { text: string; inputTokens: number; outputTokens: number; toolsUsed: string[] };

        if (providerId === 'anthropic') {
          result = await callAnthropicSync(apiKey, modelId, messages, '', options.maxTokens);
        } else {
          result = await callOpenAISync(provider.baseUrl, apiKey, modelId, messages, '', options.maxTokens);
        }

        // Detect API error responses returned as text (not thrown)
        // so they trigger failover to the next provider
        if (result.text.startsWith('API error: ') || result.text.startsWith('Anthropic API error: ')) {
          throw new Error(result.text);
        }

        recordSuccess(providerId);
        const cost = calculateCostShared(providerId, modelId, result.inputTokens, result.outputTokens);

        return {
          text: result.text,
          provider: providerId,
          model: modelId,
          toolsUsed: result.toolsUsed,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUSD: cost.usd,
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        recordFailure(providerId);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${providerId}: ${errorMessage}`);
        // Continue to next provider
      }
    }

    // All providers exhausted
    return {
      text: `All providers failed. Tried: ${errors.join('; ')}`,
      provider: providersToTry[providersToTry.length - 1]?.providerId || 'none',
      model: options.modelId || 'unknown',
      toolsUsed: [],
      inputTokens: 0,
      outputTokens: 0,
      costUSD: 0,
      latencyMs: Date.now() - startTime,
    };
  }

  // ── Cost Calculator (delegates to shared implementation) ──

  static calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): { usd: number; inr: number } {
    return calculateCostShared(provider, model, inputTokens, outputTokens);
  }
}

// ─── Private: Anthropic Sync ────────────

async function callAnthropicSync(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  maxTokens?: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number; toolsUsed: string[] }> {
  const provider = PROVIDERS.find((p) => p.id === 'anthropic');
  if (!provider) return { text: '', inputTokens: 0, outputTokens: 0, toolsUsed: [] };

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens || 4096,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetchWithTimeout(`${provider.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    timeoutMs: TIMEOUT_STANDARD_MS,
  });

  if (!response.ok) {
    const error = await response.text();
    return { text: `Anthropic API error: ${error}`, inputTokens: 0, outputTokens: 0, toolsUsed: [] };
  }

  const data = await response.json();
  const textParts: string[] = [];
  const toolsUsed: string[] = [];

  if (Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'mcp_tool_use') {
        toolsUsed.push(block.name);
      }
    }
  }

  return {
    text: textParts.join('\n'),
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    toolsUsed,
  };
}

// ─── Private: OpenAI-Compatible Sync ────

async function callOpenAISync(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  maxTokens?: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number; toolsUsed: string[] }> {
  const allMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt });
  }
  allMessages.push(...messages);

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      max_tokens: maxTokens || 4096,
    }),
    timeoutMs: TIMEOUT_STANDARD_MS,
  });

  if (!response.ok) {
    const error = await response.text();
    return { text: `API error: ${error}`, inputTokens: 0, outputTokens: 0, toolsUsed: [] };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return {
    text,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    toolsUsed: [],
  };
}
