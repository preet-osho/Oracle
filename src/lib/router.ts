// ═══════════════════════════════════════
// ORACLE — NeverStopRouter Engine
// BYOK Key Management · Streaming · Smart Routing · Cost Calculator · MCP
// ═══════════════════════════════════════

import type { Message, Attachment } from '@/types';
import { PROVIDERS, SMART_ROUTING_RULES } from '@/data/providers';
import { estimateTokens } from '@/lib/utils';
import { PromptRegistry } from '@/lib/prompt-versioning';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { sanitizeDocumentContent, sanitizeExternalContext } from '@/lib/prompt-sanitizer';

// ─── Interfaces ────────────────────────

export interface RouteOptions {
  messages: Array<{ role: string; content: string; attachments?: Attachment[] }>;
  systemPrompt?: string;
  maxTokens?: number;
  streamCallback?: (chunk: string) => void;
  mcpEnabled?: boolean;
  taskType?: 'code' | 'reasoning' | 'speed' | 'document' | 'search' | 'general';
  preferredProvider?: string;
  preferredModel?: string;
  enableWebSearch?: boolean;
  documents?: string[];
  agentMemory?: string;
  promptVersionId?: string;
  testId?: string;
}

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

export interface StreamChunk {
  chunk: string;
  done: boolean;
  provider: string;
  providerId?: string;
  modelId?: string;
}

import { USD_TO_INR, FAILOVER_ORDER, calculateCost as calculateCostShared } from '@/lib/ai-constants';

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
 * are DEPRECATED. All AI calls MUST go through the server-side proxy at
 * /api/ai/chat which handles key decryption and provider routing securely.
 *
 * The localStorage methods below are retained for backward compatibility
 * with the settings UI and migration tooling only. Direct provider calls
 * from the browser are UNSAFE because:
 *   1. API keys in localStorage are accessible to any XSS attack
 *   2. Browser→provider connections bypass rate limiting, audit logging,
 *      cost tracking, and prompt sanitization
 *
 * Use the server proxy instead:
 *   await fetch('/api/ai/chat', { method: 'POST', body: JSON.stringify({...}) })
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

  // ── Smart Provider Selection with Failover ──

  static selectProvider(options: RouteOptions): { providerId: string; modelId: string } | null {
    // 1. User forced a specific provider/model
    if (options.preferredProvider && options.preferredModel) {
      if (this.hasKey(options.preferredProvider)) {
        return { providerId: options.preferredProvider, modelId: options.preferredModel };
      }
    }

    // 2. Task-based smart routing
    if (options.taskType && !options.preferredProvider) {
      const routedId = SMART_ROUTING_RULES[options.taskType];
      if (routedId && this.hasKey(routedId)) {
        const provider = PROVIDERS.find((p) => p.id === routedId);
        if (provider) {
          const freeModel = provider.models.find((m) => m.isFree) || provider.models[0];
          return { providerId: routedId, modelId: freeModel.id };
        }
      }
    }

    // 3. Web search → Perplexity
    if (options.enableWebSearch && this.hasKey('perplexity')) {
      return {
        providerId: 'perplexity',
        modelId: 'llama-3.1-sonar-large-128k-online',
      };
    }

    // 4. Fall through with failover order
    const allKeys = this.getAllKeys();
    const availableProviders = Object.keys(allKeys);
    if (availableProviders.length === 0) return null;

    // Prefer free models first, then follow failover order
    for (const pid of FAILOVER_ORDER) {
      if (!availableProviders.includes(pid)) continue;
      const provider = PROVIDERS.find((p) => p.id === pid);
      if (provider) {
        const freeModel = provider.models.find((m) => m.isFree);
        if (freeModel) return { providerId: pid, modelId: freeModel.id };
      }
    }

    // Otherwise use first available
    const firstPid = availableProviders[0];
    const firstProvider = PROVIDERS.find((p) => p.id === firstPid);
    if (firstProvider && firstProvider.models.length > 0) {
      return { providerId: firstPid, modelId: firstProvider.models[0].id };
    }

    return null;
  }

  // ── Get Failover Provider ──

  static getFailoverProvider(currentProviderId: string): { providerId: string; modelId: string } | null {
    const currentIndex = FAILOVER_ORDER.indexOf(currentProviderId);
    const startSearch = currentIndex >= 0 ? currentIndex + 1 : 0;
    
    for (let i = startSearch; i < FAILOVER_ORDER.length; i++) {
      const pid = FAILOVER_ORDER[i];
      if (this.hasKey(pid)) {
        const provider = PROVIDERS.find((p) => p.id === pid);
        if (provider) {
          const freeModel = provider.models.find((m) => m.isFree) || provider.models[0];
          return { providerId: pid, modelId: freeModel.id };
        }
      }
    }
    
    // Wrap around if we didn't find one
    for (let i = 0; i < startSearch; i++) {
      const pid = FAILOVER_ORDER[i];
      if (this.hasKey(pid)) {
        const provider = PROVIDERS.find((p) => p.id === pid);
        if (provider) {
          const freeModel = provider.models.find((m) => m.isFree) || provider.models[0];
          return { providerId: pid, modelId: freeModel.id };
        }
      }
    }
    
    return null;
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

  // ── DEPRECATED: Client-Side Streaming ──
  // SECURITY: This method reads API keys from localStorage and calls providers
  // directly from the browser. Use the server proxy /api/ai/chat instead.

  /** @deprecated SECURITY: Use fetch('/api/ai/chat', ...) server proxy instead. Direct provider calls bypass security controls. */
  static async *callStreaming(
    messages: Message[],
    options: RouteOptions
  ): AsyncGenerator<StreamChunk> {
    console.warn(
      '[Router] SECURITY: callStreaming() is deprecated. Use /api/ai/chat server proxy to prevent XSS key theft.',
    );
    const route = this.selectProvider(options);
    if (!route) {
      yield { chunk: 'No API keys configured. Please add a provider key in Settings.', done: true, provider: 'none' };
      return;
    }

    const { providerId, modelId } = route;
    const key = this.getKey(providerId);
    if (!key) {
      yield { chunk: `Missing API key for ${providerId}. Please add it in Settings.`, done: true, provider: providerId };
      return;
    }

    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) {
      yield { chunk: `Unknown provider: ${providerId}`, done: true, provider: providerId };
      return;
    }

    // Build message payload
    const apiMessages = this.buildMessages(messages, options);
    const systemPrompt = this.buildSystemPrompt(options);

    // Try with failover
    let currentProviderId = providerId;
    let currentModelId = modelId;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        // Anthropic uses a different API format
        if (currentProviderId === 'anthropic') {
          yield* this.streamAnthropic(key, currentModelId, apiMessages, systemPrompt, options);
          return;
        }

        // All other providers use OpenAI-compatible format
        const currentProvider = PROVIDERS.find((p) => p.id === currentProviderId);
        if (!currentProvider) break;
        
        yield* this.streamOpenAICompatible(currentProvider.baseUrl, key, currentModelId, currentProviderId, apiMessages, systemPrompt, options);
        return;
      } catch (error) {
        attempts++;
        console.error(`Provider ${currentProviderId} failed (attempt ${attempts}/${maxAttempts}):`, error);
        
        // Try failover
        const failover = this.getFailoverProvider(currentProviderId);
        if (failover && attempts < maxAttempts) {
          const failoverKey = this.getKey(failover.providerId);
          if (failoverKey) {
            currentProviderId = failover.providerId;
            currentModelId = failover.modelId;
            yield { chunk: `Switching to ${currentProviderId} due to error...`, done: false, provider: currentProviderId };
            continue;
          }
        }
        
        yield { chunk: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. No more providers available for failover.`, done: true, provider: currentProviderId };
        return;
      }
    }
  }

  // ── DEPRECATED: Client-Side Sync Call ──
  // SECURITY: This method reads API keys from localStorage and calls providers
  // directly from the browser. Use the server proxy /api/ai/chat instead.

  /** @deprecated SECURITY: Use fetch('/api/ai/chat', ...) server proxy instead. Direct provider calls bypass security controls. */
  static async callSync(
    messages: Message[],
    options: RouteOptions
  ): Promise<RouteResult> {
    console.warn(
      '[Router] SECURITY: callSync() is deprecated. Use /api/ai/chat server proxy to prevent XSS key theft.',
    );
    const startTime = Date.now();
    const route = this.selectProvider(options);

    if (!route) {
      return {
        text: 'No API keys configured. Please add a provider key in Settings.',
        provider: 'none',
        model: 'none',
        toolsUsed: [],
        inputTokens: 0,
        outputTokens: 0,
        costUSD: 0,
        latencyMs: 0,
      };
    }

    const { providerId, modelId } = route;
    const key = this.getKey(providerId);
    if (!key) {
      return {
        text: `Missing API key for ${providerId}.`,
        provider: providerId,
        model: modelId,
        toolsUsed: [],
        inputTokens: 0,
        outputTokens: 0,
        costUSD: 0,
        latencyMs: 0,
      };
    }

    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) {
      return {
        text: `Unknown provider: ${providerId}`,
        provider: providerId,
        model: modelId,
        toolsUsed: [],
        inputTokens: 0,
        outputTokens: 0,
        costUSD: 0,
        latencyMs: 0,
      };
    }

    const apiMessages = this.buildMessages(messages, options);
    const systemPrompt = this.buildSystemPrompt(options);

    // Try with failover
    let currentProviderId = providerId;
    let currentModelId = modelId;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        let result: { text: string; inputTokens: number; outputTokens: number; toolsUsed: string[] };

        if (currentProviderId === 'anthropic') {
          result = await this.callAnthropicSync(key, currentModelId, apiMessages, systemPrompt, options);
        } else {
          const currentProvider = PROVIDERS.find((p) => p.id === currentProviderId);
          if (!currentProvider) break;
          result = await this.callOpenAISync(currentProvider.baseUrl, key, currentModelId, apiMessages, systemPrompt);
        }

        const cost = this.calculateCost(currentProviderId, currentModelId, result.inputTokens, result.outputTokens);

        // Log request for prompt versioning analytics (single selection, no duplicate)
        if (options.testId || options.promptVersionId) {
          const version = options.promptVersionId
            ? PromptRegistry.getVersion(options.promptVersionId)
            : PromptRegistry.selectVersion(options.testId);
          if (version) {
            PromptRegistry.logRequest({
              versionId: version.id,
              testId: options.testId,
              timestamp: Date.now(),
              provider: currentProviderId,
              model: currentModelId,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              costUSD: cost.usd,
            });
          }
        }

        return {
          text: result.text,
          provider: currentProviderId,
          model: currentModelId,
          toolsUsed: result.toolsUsed,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUSD: cost.usd,
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        attempts++;
        console.error(`Provider ${currentProviderId} failed (attempt ${attempts}/${maxAttempts}):`, error);
        
        // Try failover
        const failover = this.getFailoverProvider(currentProviderId);
        if (failover && attempts < maxAttempts) {
          const failoverKey = this.getKey(failover.providerId);
          if (failoverKey) {
            currentProviderId = failover.providerId;
            currentModelId = failover.modelId;
            continue;
          }
        }
        
        return {
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. No more providers available for failover.`,
          provider: currentProviderId,
          model: currentModelId,
          toolsUsed: [],
          inputTokens: 0,
          outputTokens: 0,
          costUSD: 0,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    return {
      text: 'Failed after all attempts.',
      provider: currentProviderId,
      model: currentModelId,
      toolsUsed: [],
      inputTokens: 0,
      outputTokens: 0,
      costUSD: 0,
      latencyMs: Date.now() - startTime,
    };
  }

  // ── Private: Build Messages ──

  private static buildMessages(
    messages: Message[],
    options: RouteOptions
  ): Array<{ role: string; content: string }> {
    const result: Array<{ role: string; content: string }> = [];

    for (const msg of messages) {
      let content = msg.content;

      // Inject document context if available (sanitize each document)
      if (options.documents && options.documents.length > 0 && msg.role === 'user') {
        const sanitizedDocs = options.documents.map((doc, i) => {
          const result = sanitizeDocumentContent(doc, `document_${i}`);
          return result.sanitized;
        });
        const docContext = sanitizedDocs.join('\n\n---\n\n');
        content = `[Document Context]\n${docContext}\n\n---\n\n${content}`;
      }

      // Inject agent memory if available (sanitize)
      if (options.agentMemory && msg.role === 'user') {
        const memResult = sanitizeExternalContext(options.agentMemory, 'agent_memory');
        content = `[Client Memory]\n${memResult.sanitized}\n\n---\n\n${content}`;
      }

      // Handle attachments (sanitize each)
      if (msg.attachments && msg.attachments.length > 0) {
        const attachContent = msg.attachments
          .map((a) => {
            const result = sanitizeExternalContext(a.content, 'attachment');
            return `[Attachment: ${a.name}]\n${result.sanitized}`;
          })
          .join('\n\n');
        content = `${attachContent}\n\n---\n\n${content}`;
      }

      result.push({ role: msg.role, content });
    }

    return result;
  }

  // ── Private: Build System Prompt ──

  private static buildSystemPrompt(options: RouteOptions): string {
    const parts: string[] = [];

    // 1. Explicit prompt versioning (A/B test or specific version)
    if (options.testId || options.promptVersionId) {
      const version = options.promptVersionId
        ? PromptRegistry.getVersion(options.promptVersionId)
        : PromptRegistry.selectVersion(options.testId);
      if (version) {
        parts.push(version.content);
      }
    }

    // 2. Caller-provided system prompt
    if (parts.length === 0 && options.systemPrompt) {
      parts.push(options.systemPrompt);
    }

    // 3. Fallback: static identity prompt
    if (parts.length === 0) {
      parts.push(
        'You are ORACLE, the ultimate agency AI agent. You help digital agencies deliver exceptional results for their clients across 40 service domains. Be specific, actionable, and contextually relevant to Indian business scenarios when appropriate.'
      );
    }

    return parts.join('\n\n');
  }

  // ── Private: Anthropic Streaming ──

  private static async *streamAnthropic(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    options: RouteOptions
  ): AsyncGenerator<StreamChunk> {
    const provider = PROVIDERS.find((p) => p.id === 'anthropic');
    if (!provider) return;

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens || 4096,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    // MCP support — only Claude supports this
    if (options.mcpEnabled && provider.supportsMCP) {
      body.mcp_servers = [
        { type: 'url' as const, url: 'https://gmailmcp.googleapis.com/mcp/v1', name: 'Gmail' },
        { type: 'url' as const, url: 'https://calendarmcp.googleapis.com/mcp/v1', name: 'Calendar' },
        { type: 'url' as const, url: 'https://drivemcp.googleapis.com/mcp/v1', name: 'Drive' },
      ];
    }

    const response = await fetchWithTimeout(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      streaming: true,
    });

    if (!response.ok) {
      const error = await response.text();
      yield { chunk: `Anthropic API error (${response.status}): ${error}`, done: true, provider: 'anthropic' };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { chunk: 'Failed to read Anthropic response stream.', done: true, provider: 'anthropic' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield { chunk: parsed.delta.text, done: false, provider: 'anthropic', providerId: 'anthropic', modelId: model };
              options.streamCallback?.(parsed.delta.text);
            }

            if (parsed.type === 'message_stop') {
              yield { chunk: '', done: true, provider: 'anthropic', providerId: 'anthropic', modelId: model };
            }
          } catch (e) {
            console.warn('[Router] Skipping malformed SSE chunk:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── Private: OpenAI-Compatible Streaming ──

  private static async *streamOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    providerId: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    options: RouteOptions
  ): AsyncGenerator<StreamChunk> {
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
        max_tokens: options.maxTokens || 4096,
        stream: true,
      }),
      streaming: true,
    });

    if (!response.ok) {
      const error = await response.text();
      yield { chunk: `API error (${response.status}): ${error}`, done: true, provider: baseUrl };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { chunk: 'Failed to read response stream.', done: true, provider: baseUrl };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            yield { chunk: '', done: true, provider: baseUrl };
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { chunk: content, done: false, provider: baseUrl, providerId: providerId, modelId: model };
              options.streamCallback?.(content);
            }

            if (parsed.choices?.[0]?.finish_reason) {
              yield { chunk: '', done: true, provider: baseUrl, providerId: providerId, modelId: model };
            }
          } catch (e) {
            console.warn('[Router] Skipping malformed SSE chunk:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── Private: Anthropic Sync ──

  private static async callAnthropicSync(
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    options: RouteOptions
  ): Promise<{ text: string; inputTokens: number; outputTokens: number; toolsUsed: string[] }> {
    const provider = PROVIDERS.find((p) => p.id === 'anthropic');
    if (!provider) return { text: '', inputTokens: 0, outputTokens: 0, toolsUsed: [] };

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens || 4096,
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
      inputTokens: data.usage?.input_tokens || estimateTokens(messages.map((m) => m.content).join('')),
      outputTokens: data.usage?.output_tokens || estimateTokens(textParts.join('')),
      toolsUsed,
    };
  }

  // ── Private: OpenAI-Compatible Sync ──

  private static async callOpenAISync(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string
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
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { text: `API error: ${error}`, inputTokens: 0, outputTokens: 0, toolsUsed: [] };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return {
      text,
      inputTokens: data.usage?.prompt_tokens || estimateTokens(allMessages.map((m) => m.content).join('')),
      outputTokens: data.usage?.completion_tokens || estimateTokens(text),
      toolsUsed: [],
    };
  }
}
