import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NeverStopRouter, type StreamChunk } from './router';

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

// ─── ReadableStream mock for SSE ───────

function createMockSSEBody(sseLines: string[]) {
  const encoder = new TextEncoder();
  const fullText = sseLines.join('');
  const bytes = encoder.encode(fullText);
  let offset = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunkSize = 32;
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.byteLength);
      controller.enqueue(bytes.slice(offset, end));
      offset = end;
    },
  });
}

function createAnthropicSSEChunks(textParts: string[]) {
  const lines: string[] = [];
  lines.push(`event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { model: 'claude-sonnet-4-6' } })}\n\n`);
  lines.push(`event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`);
  for (const text of textParts) {
    lines.push(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })}\n\n`);
  }
  lines.push(`event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { input_tokens: 50, output_tokens: 100 } })}\n\n`);
  lines.push(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
  return lines;
}

function createOpenAISSEChunks(textParts: string[], model = 'gpt-4o') {
  const lines: string[] = [];
  for (const text of textParts) {
    lines.push(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }], model })}\n\n`);
  }
  lines.push(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], model, usage: { prompt_tokens: 30, completion_tokens: 80, total_tokens: 110 } })}\n\n`);
  lines.push('data: [DONE]\n\n');
  return lines;
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
      // Due to rounding at 4 decimal places, use a looser tolerance
      expect(cost2.usd).toBeCloseTo(cost1.usd * 2, 4);
      expect(cost2.inr).toBeCloseTo(cost1.inr * 2, 2);
    });

    it('returns zero for free providers (groq)', () => {
      const cost = NeverStopRouter.calculateCost('groq', 'llama-3.3-70b-versatile', 10000, 10000);
      expect(cost.usd).toBe(0);
      expect(cost.inr).toBe(0);
    });
  });

  // ── Provider Selection ──

  describe('selectProvider', () => {
    it('returns a provider when keys are available', () => {
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(route).not.toBeNull();
      expect(route!.providerId).toBeTruthy();
      expect(route!.modelId).toBeTruthy();
    });

    it('returns null when no keys are configured', () => {
      localStorageStore['oracle_byok_keys'] = '{}';
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(route).toBeNull();
    });

    it('respects preferredProvider and preferredModel', () => {
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      });
      expect(route).not.toBeNull();
      expect(route!.providerId).toBe('openai');
      expect(route!.modelId).toBe('gpt-4o');
    });

    it('prefers free models when available', () => {
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(route).not.toBeNull();
      // Should pick groq (first in failover order with free models)
      expect(route!.providerId).toBe('groq');
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

  // ── Anthropic Streaming (forced via preferredProvider) ──

  describe('streamAnthropic (via callStreaming)', () => {
    it('yields text content chunks with providerId=anthropic and modelId', async () => {
      const sseLines = createAnthropicSSEChunks(['Hello', ' world']);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEBody(sseLines),
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const collected: string[] = [];
      const providerIds: string[] = [];
      const modelIds: string[] = [];

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'anthropic',
        preferredModel: 'claude-sonnet-4-6',
      })) {
        if (chunk.done) break;
        if (chunk.chunk) {
          collected.push(chunk.chunk);
          if (chunk.providerId) providerIds.push(chunk.providerId);
          if (chunk.modelId) modelIds.push(chunk.modelId);
        }
      }

      expect(collected.join('')).toBe('Hello world');
      expect(providerIds.length).toBeGreaterThan(0);
      expect(providerIds.every(id => id === 'anthropic')).toBe(true);
      expect(modelIds.length).toBeGreaterThan(0);
      expect(modelIds.every(id => id === 'claude-sonnet-4-6')).toBe(true);

      // Verify fetch call arguments
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'x-api-key': 'sk-ant-test-anthropic-key-1234567890abcdef',
        'anthropic-version': '2023-06-01',
      }));
      const body = JSON.parse(init.body);
      expect(body.model).toBe('claude-sonnet-4-6');
      expect(body.max_tokens).toBe(4096);
      expect(body.stream).toBe(true);
      expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
      expect(body.system).toContain('ORACLE');
    });

    it('yields done=true on stream end', async () => {
      const sseLines = createAnthropicSSEChunks([]);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEBody(sseLines),
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'anthropic',
        preferredModel: 'claude-sonnet-4-6',
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
    });

    it('yields error chunk on non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'anthropic',
        preferredModel: 'claude-sonnet-4-6',
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('Anthropic API error');
      expect(lastChunk!.chunk).toContain('401');
    });
  });

  // ── OpenAI-Compatible Streaming (forced via preferredProvider) ──

  describe('streamOpenAICompatible (via callStreaming)', () => {
    it('yields text content chunks with providerId and modelId', async () => {
      const sseLines = createOpenAISSEChunks(['Hello', ' from OpenAI'], 'gpt-4o');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEBody(sseLines),
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const collected: string[] = [];
      const providerIds: string[] = [];
      const modelIds: string[] = [];

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        if (chunk.done) break;
        if (chunk.chunk) {
          collected.push(chunk.chunk);
          if (chunk.providerId) providerIds.push(chunk.providerId);
          if (chunk.modelId) modelIds.push(chunk.modelId);
        }
      }

      expect(collected.join('')).toBe('Hello from OpenAI');
      expect(providerIds.length).toBeGreaterThan(0);
      expect(providerIds.every(id => id === 'openai')).toBe(true);
      expect(modelIds.length).toBeGreaterThan(0);
      expect(modelIds.every(id => id === 'gpt-4o')).toBe(true);

      // Verify fetch call arguments
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test-openai-key-1234567890abcdef',
      }));
      const body = JSON.parse(init.body);
      expect(body.model).toBe('gpt-4o');
      expect(body.max_tokens).toBe(4096);
      expect(body.stream).toBe(true);
      // System prompt prepended as first message
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('ORACLE');
      expect(body.messages[1]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('handles [DONE] signal correctly', async () => {
      const sseLines = createOpenAISSEChunks(['Hi'], 'gpt-4o');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEBody(sseLines),
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const chunks: StreamChunk[] = [];

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        chunks.push(chunk);
        if (chunk.done) break;
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('streams content incrementally', async () => {
      const sseLines = createOpenAISSEChunks(['one', 'two', 'three'], 'gpt-4o');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEBody(sseLines),
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const textChunks: string[] = [];

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        if (chunk.done) break;
        if (chunk.chunk) textChunks.push(chunk.chunk);
      }

      expect(textChunks).toEqual(['one', 'two', 'three']);
    });

    it('yields error chunk on non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('API error');
      expect(lastChunk!.chunk).toContain('429');
    });
  });

  // ── Failover (network errors trigger catch) ──

  describe('callStreaming failover', () => {
    it('yields a switching chunk on network error and falls back', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Network error — this triggers the catch block in callStreaming
          throw new TypeError('Failed to fetch');
        }
        // Second call succeeds
        const sseLines = createOpenAISSEChunks(['recovered'], 'gpt-4o');
        return { ok: true, body: createMockSSEBody(sseLines) };
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const allTexts: string[] = [];
      const sawSwitching = { current: false };

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })) {
        if (chunk.chunk?.includes('Switching to')) {
          sawSwitching.current = true;
        }
        if (chunk.chunk) allTexts.push(chunk.chunk);
        if (chunk.done) break;
      }

      expect(sawSwitching.current).toBe(true);
      expect(allTexts.join('')).toContain('recovered');
    });

    it('yields error when all providers fail with network errors', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        throw new TypeError('Failed to fetch');
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('Error');
    });

    it('no failover when response is not OK (handled internally)', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return { ok: false, status: 500, text: async () => 'server error' };
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        lastChunk = chunk;
      }

      // HTTP errors are handled inside the generator, not by the failover catch
      expect(callCount).toBe(1);
      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('API error');
    });
  });



  // ── getFailoverProvider ──

  describe('getFailoverProvider', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getFailover = (id: string) => (NeverStopRouter as any).getFailoverProvider(id) as { providerId: string; modelId: string } | null;

    it('returns the next available provider after the current one', () => {
      const result = getFailover('openai');
      expect(result).not.toBeNull();
      expect(result!.providerId).not.toBe('openai');
    });

    it('wraps around when no other providers are available', () => {
      localStorageStore['oracle_byok_keys'] = JSON.stringify({ openai: 'sk-test-1234567890abcdef1234' });
      const result = getFailover('groq');
      expect(result).not.toBeNull();
      expect(result!.providerId).toBe('openai');
    });

    it('returns null when no keys exist at all', () => {
      localStorageStore['oracle_byok_keys'] = '{}';
      const result = getFailover('openai');
      expect(result).toBeNull();
    });
  });

  // ── streamCallback ──

  describe('streamCallback option', () => {
    it('calls streamCallback for each content chunk', async () => {
      const sseLines = createOpenAISSEChunks(['Hello', ' world'], 'gpt-4o');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEBody(sseLines),
      });

      const callback = vi.fn();
      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
        streamCallback: callback,
      })) {
        if (chunk.done) break;
      }

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith('Hello');
      expect(callback).toHaveBeenCalledWith(' world');
    });
  });

  // ── callSync (Non-Streaming) ──

  describe('callSync', () => {
    // ─ Anthropic Sync ─

    describe('callAnthropicSync (forced via preferredProvider)', () => {
      it('returns text and token counts from Anthropic response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: 'Hello from Claude' }],
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          preferredProvider: 'anthropic',
          preferredModel: 'claude-sonnet-4-6',
        });

        expect(result.text).toBe('Hello from Claude');
        expect(result.provider).toBe('anthropic');
        expect(result.model).toBe('claude-sonnet-4-6');
        expect(result.inputTokens).toBe(50);
        expect(result.outputTokens).toBe(100);
        expect(result.costUSD).toBeGreaterThan(0);
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Verify fetch call arguments
        const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toBe('https://api.anthropic.com/v1/messages');
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual(expect.objectContaining({
          'Content-Type': 'application/json',
          'x-api-key': 'sk-ant-test-anthropic-key-1234567890abcdef',
          'anthropic-version': '2023-06-01',
        }));
        const body = JSON.parse(init.body);
        expect(body.model).toBe('claude-sonnet-4-6');
        expect(body.max_tokens).toBe(4096);
        expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
        // System prompt is always injected (ORACLE default)
        expect(body.system).toContain('ORACLE');
      });

      it('estimates tokens when response lacks usage data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: 'Short' }],
          }),
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'Hi there', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          preferredProvider: 'anthropic',
          preferredModel: 'claude-sonnet-4-6',
        });

        expect(result.text).toBe('Short');
        expect(result.inputTokens).toBeGreaterThan(0);
        expect(result.outputTokens).toBeGreaterThan(0);
      });

      it('detects MCP tool use blocks', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            content: [
              { type: 'text', text: 'I sent the email.' },
              { type: 'mcp_tool_use', name: 'gmail_send' },
              { type: 'mcp_tool_use', name: 'gmail_search' },
            ],
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'Send an email', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          preferredProvider: 'anthropic',
          preferredModel: 'claude-sonnet-4-6',
          mcpEnabled: true,
        });

        expect(result.text).toBe('I sent the email.');
        expect(result.toolsUsed).toEqual(['gmail_send', 'gmail_search']);
      });

      it('handles non-OK response gracefully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: async () => 'rate limited',
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          preferredProvider: 'anthropic',
          preferredModel: 'claude-sonnet-4-6',
        });

        // Sync error format: 'Anthropic API error: <text>' (no status code, unlike streaming)
        expect(result.text).toContain('Anthropic API error');
        expect(result.text).toContain('rate limited');
        expect(result.inputTokens).toBe(0);
        expect(result.outputTokens).toBe(0);
        expect(result.costUSD).toBe(0);
      });
    });

    // ─ OpenAI-Compatible Sync ─

    describe('callOpenAISync (forced via preferredProvider)', () => {
      it('returns text and token counts from OpenAI response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Hello from GPT' } }],
            usage: { prompt_tokens: 30, completion_tokens: 80 },
          }),
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          preferredProvider: 'openai',
          preferredModel: 'gpt-4o',
        });

        expect(result.text).toBe('Hello from GPT');
        expect(result.provider).toBe('openai');
        expect(result.model).toBe('gpt-4o');
        expect(result.inputTokens).toBe(30);
        expect(result.outputTokens).toBe(80);
        expect(result.costUSD).toBeGreaterThan(0);
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Verify fetch call arguments
        const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toBe('https://api.openai.com/v1/chat/completions');
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual(expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-test-openai-key-1234567890abcdef',
        }));
        const body = JSON.parse(init.body);
        expect(body.model).toBe('gpt-4o');
        expect(body.max_tokens).toBe(4096);
        // OpenAI sync prepends system prompt as a system message
        expect(body.messages[0].role).toBe('system');
        expect(body.messages[0].content).toContain('ORACLE');
        expect(body.messages[1]).toEqual({ role: 'user', content: 'Hi' });
      });

      it('estimates tokens when response lacks usage data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Short reply' } }],
          }),
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'A fairly long user message for token estimation', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          preferredProvider: 'openai',
          preferredModel: 'gpt-4o',
        });

        expect(result.text).toBe('Short reply');
        expect(result.inputTokens).toBeGreaterThan(0);
        expect(result.outputTokens).toBeGreaterThan(0);

        // Verify no stream field in body (sync mode)
        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        expect(body.stream).toBeUndefined();
      });

      it('handles non-OK response gracefully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'internal error',
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          preferredProvider: 'openai',
          preferredModel: 'gpt-4o',
        });

        // Sync error format: 'API error: <text>' (no status code, unlike streaming)
        expect(result.text).toContain('API error');
        expect(result.text).toContain('internal error');
        expect(result.costUSD).toBe(0);
      });
    });

    // ─ Sync Failover ─

    describe('callSync failover', () => {
      it('falls back to another provider on network error', async () => {
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            throw new TypeError('Failed to fetch');
          }
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Recovered from failover' } }],
              usage: { prompt_tokens: 10, completion_tokens: 20 },
            }),
          };
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        expect(result.text).toBe('Recovered from failover');
        expect(callCount).toBe(2);
      });

      it('returns error when all providers fail', async () => {
        global.fetch = vi.fn().mockImplementation(async () => {
          throw new TypeError('Failed to fetch');
        });

        const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        expect(result.text).toContain('Error');
        expect(result.costUSD).toBe(0);
      });
    });

    // ─ No Keys ─

    describe('callSync with no keys', () => {
      it('returns error without making a network call', async () => {
        localStorageStore['oracle_byok_keys'] = '{}';

        const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
        const result = await NeverStopRouter.callSync(messages, {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        expect(result.text).toContain('No API keys');
        expect(result.costUSD).toBe(0);
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  // ── Message Building (buildMessages + buildSystemPrompt) ──

  describe('message building options', () => {
    const successSyncResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    };

    const successStreamResponse = {
      ok: true,
      body: createMockSSEBody(createOpenAISSEChunks(['OK'], 'gpt-4o')),
    };

    // ─ Documents ─

    describe('documents injection', () => {
      it('injects document context into user messages via callSync', async () => {
        global.fetch = vi.fn().mockResolvedValue(successSyncResponse);

        await NeverStopRouter.callSync(
          [{ id: '1', role: 'user' as const, content: 'Summarize this', timestamp: Date.now() }],
          {
            messages: [{ role: 'user', content: 'Summarize this' }],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
            documents: ['Doc A content', 'Doc B content'],
          }
        );

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
        expect(userMsg.content).toContain('[Document Context]');
        expect(userMsg.content).toContain('Doc A content');
        expect(userMsg.content).toContain('Doc B content');
        expect(userMsg.content).toContain('---');
        expect(userMsg.content).toContain('Summarize this');
      });

      it('injects document context into user messages via callStreaming', async () => {
        global.fetch = vi.fn().mockResolvedValue(successStreamResponse);

        for await (const chunk of NeverStopRouter.callStreaming(
          [{ id: '1', role: 'user' as const, content: 'Summarize this', timestamp: Date.now() }],
          {
            messages: [{ role: 'user', content: 'Summarize this' }],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
            documents: ['Doc A content'],
          }
        )) {
          if (chunk.done) break;
        }

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
        expect(userMsg.content).toContain('[Document Context]');
        expect(userMsg.content).toContain('Doc A content');
        expect(userMsg.content).toContain('Summarize this');
      });

      it('does not inject documents into assistant messages', async () => {
        global.fetch = vi.fn().mockResolvedValue(successSyncResponse);

        await NeverStopRouter.callSync(
          [
            { id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() },
            { id: '2', role: 'assistant' as const, content: 'Hello', timestamp: Date.now() },
            { id: '3', role: 'user' as const, content: 'Follow up', timestamp: Date.now() },
          ],
          {
            messages: [
              { role: 'user', content: 'Hi' },
              { role: 'assistant', content: 'Hello' },
              { role: 'user', content: 'Follow up' },
            ],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
            documents: ['Secret doc'],
          }
        );

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        const assistantMsg = body.messages.find((m: { role: string }) => m.role === 'assistant');
        expect(assistantMsg.content).toBe('Hello');
        expect(assistantMsg.content).not.toContain('[Document Context]');
      });
    });

    // ─ Agent Memory ─

    describe('agentMemory injection', () => {
      it('injects agent memory into user messages via callSync', async () => {
        global.fetch = vi.fn().mockResolvedValue(successSyncResponse);

        await NeverStopRouter.callSync(
          [{ id: '1', role: 'user' as const, content: 'What about my client?', timestamp: Date.now() }],
          {
            messages: [{ role: 'user', content: 'What about my client?' }],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
            agentMemory: 'Client: Acme Corp, prefers formal tone',
          }
        );

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
        expect(userMsg.content).toContain('[Client Memory]');
        expect(userMsg.content).toContain('Client: Acme Corp');
        expect(userMsg.content).toContain('What about my client?');
      });

      it('injects agent memory via callStreaming', async () => {
        global.fetch = vi.fn().mockResolvedValue(successStreamResponse);

        for await (const chunk of NeverStopRouter.callStreaming(
          [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }],
          {
            messages: [{ role: 'user', content: 'Hi' }],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
            agentMemory: 'Remember: user likes concise answers',
          }
        )) {
          if (chunk.done) break;
        }

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
        expect(userMsg.content).toContain('[Client Memory]');
        expect(userMsg.content).toContain('Remember: user likes concise answers');
      });
    });

    // ─ Attachments ─

    describe('attachments injection', () => {
      it('prepends attachment content to messages with attachments via callSync', async () => {
        global.fetch = vi.fn().mockResolvedValue(successSyncResponse);

        await NeverStopRouter.callSync(
          [{
            id: '1',
            role: 'user' as const,
            content: 'Analyze this file',
            timestamp: Date.now(),
            attachments: [{ id: 'a1', name: 'report.csv', type: 'text' as const, content: 'col1,col2\n1,2', size: 100 }],
          }],
          {
            messages: [{ role: 'user', content: 'Analyze this file' }],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
          }
        );

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
        expect(userMsg.content).toContain('[Attachment: report.csv]');
        expect(userMsg.content).toContain('col1,col2');
        expect(userMsg.content).toContain('---');
        expect(userMsg.content).toContain('Analyze this file');
      });

      it('handles multiple attachments', async () => {
        global.fetch = vi.fn().mockResolvedValue(successSyncResponse);

        await NeverStopRouter.callSync(
          [{
            id: '1',
            role: 'user' as const,
            content: 'Compare these',
            timestamp: Date.now(),
            attachments: [
              { id: 'a1', name: 'file1.txt', type: 'text' as const, content: 'Content A', size: 10 },
              { id: 'a2', name: 'file2.txt', type: 'text' as const, content: 'Content B', size: 10 },
            ],
          }],
          {
            messages: [{ role: 'user', content: 'Compare these' }],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
          }
        );

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
        expect(userMsg.content).toContain('[Attachment: file1.txt]');
        expect(userMsg.content).toContain('[Attachment: file2.txt]');
        expect(userMsg.content).toContain('Content A');
        expect(userMsg.content).toContain('Content B');
      });
    });

    // ─ Custom System Prompt ─

    describe('custom systemPrompt', () => {
      it('prepends custom systemPrompt before ORACLE default via callSync (Anthropic)', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: 'OK' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        });

        await NeverStopRouter.callSync(
          [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }],
          {
            messages: [{ role: 'user', content: 'Hi' }],
            preferredProvider: 'anthropic',
            preferredModel: 'claude-sonnet-4-6',
            systemPrompt: 'You are a legal assistant.',
          }
        );

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        // Anthropic: system is a top-level field
        // buildSystemPrompt uses custom prompt instead of ORACLE default (mutually exclusive)
        expect(body.system).toBe('You are a legal assistant.');
      });

      it('prepends custom systemPrompt before ORACLE default via callStreaming (OpenAI)', async () => {
        global.fetch = vi.fn().mockResolvedValue(successStreamResponse);

        for await (const chunk of NeverStopRouter.callStreaming(
          [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }],
          {
            messages: [{ role: 'user', content: 'Hi' }],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
            systemPrompt: 'You are a legal assistant.',
          }
        )) {
          if (chunk.done) break;
        }

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        // OpenAI: system is the first message
        const sysMsg = body.messages[0];
        expect(sysMsg.role).toBe('system');
        // buildSystemPrompt uses custom prompt instead of ORACLE default (mutually exclusive)
        expect(sysMsg.content).toBe('You are a legal assistant.');
      });
    });

    // ─ Combined Options ─

    describe('combined options', () => {
      it('injects documents + agentMemory + custom systemPrompt together', async () => {
        global.fetch = vi.fn().mockResolvedValue(successSyncResponse);

        await NeverStopRouter.callSync(
          [{ id: '1', role: 'user' as const, content: 'Help me', timestamp: Date.now() }],
          {
            messages: [{ role: 'user', content: 'Help me' }],
            preferredProvider: 'openai',
            preferredModel: 'gpt-4o',
            documents: ['Contract draft v2'],
            agentMemory: 'Client budget: ₹5L',
            systemPrompt: 'You are a contract lawyer.',
          }
        );

        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(init.body);
        const sysMsg = body.messages[0];
        // buildSystemPrompt uses custom prompt instead of ORACLE default (mutually exclusive)
        expect(sysMsg.content).toBe('You are a contract lawyer.');
        const userMsg = body.messages[1];
        expect(userMsg.content).toContain('[Document Context]');
        expect(userMsg.content).toContain('Contract draft v2');
        expect(userMsg.content).toContain('[Client Memory]');
        expect(userMsg.content).toContain('Client budget: ₹5L');
        expect(userMsg.content).toContain('Help me');
      });
    });
  });

  // ── API Key Expiry Detection (Scenario 2.2) ──

  describe('API key expiry detection', () => {
    it('streaming: returns actionable error on 401 with provider name', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('401');
      expect(lastChunk!.chunk).toContain('API error');
    });

    it('sync: returns error text with status code on 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const result = await NeverStopRouter.callSync(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      });

      expect(result.text).toContain('API error');
      expect(result.text).toContain('Invalid API key');
      expect(result.costUSD).toBe(0);
      expect(result.provider).toBe('openai');
    });

    it('streaming: does NOT failover on 401 (HTTP errors handled inline)', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return { ok: false, status: 401, text: async () => 'Invalid API key' };
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        lastChunk = chunk;
      }

      // HTTP 401 is handled inside the streaming generator, NOT by failover catch
      // So only 1 fetch call should be made
      expect(callCount).toBe(1);
      expect(lastChunk!.done).toBe(true);
    });

    it('sync: does NOT failover on 401 (HTTP errors handled inline)', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return { ok: false, status: 401, text: async () => 'Invalid API key' };
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const result = await NeverStopRouter.callSync(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      });

      expect(callCount).toBe(1);
      expect(result.text).toContain('API error');
    });

    it('streaming: failover on network error (simulates expired key + connection reset)', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new TypeError('Failed to fetch');
        }
        const sseLines = createOpenAISSEChunks(['recovered'], 'gpt-4o');
        return { ok: true, body: createMockSSEBody(sseLines) };
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const allTexts: string[] = [];

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })) {
        if (chunk.chunk) allTexts.push(chunk.chunk);
        if (chunk.done) break;
      }

      expect(callCount).toBe(2);
      expect(allTexts.join('')).toContain('recovered');
    });

    it('sync: failover on network error with graceful degradation', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new TypeError('Network request failed');
        }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Recovered via failover' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          }),
        };
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const result = await NeverStopRouter.callSync(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      });

      expect(result.text).toBe('Recovered via failover');
      expect(result.costUSD).toBe(0);
      expect(callCount).toBe(2);
    });

    it('sync: returns actionable error when all providers fail', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        throw new TypeError('Failed to fetch');
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const result = await NeverStopRouter.callSync(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      });

      expect(result.text).toContain('Error');
      expect(result.text).toContain('No more providers');
      expect(result.costUSD).toBe(0);
    });

    it('streaming: yields error when all providers fail', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        throw new TypeError('Failed to fetch');
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('Error');
      expect(lastChunk!.chunk).toContain('No more providers');
    });
  });

  // ── selectProvider additional branches ──

  describe('selectProvider edge cases', () => {
    it('uses taskType routing when no preferredProvider', () => {
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Hi' }],
        taskType: 'code',
      });
      expect(route).not.toBeNull();
      // SMART_ROUTING_RULES['code'] maps to a provider with keys
      expect(route!.providerId).toBeTruthy();
      expect(route!.modelId).toBeTruthy();
    });

    it('uses web search routing to perplexity when enabled and key exists', () => {
      NeverStopRouter.setKey('perplexity', 'pplx_test_1234567890abcdef');
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Search for X' }],
        enableWebSearch: true,
      });
      expect(route).not.toBeNull();
      expect(route!.providerId).toBe('perplexity');
    });

    it('skips web search when perplexity key not configured', () => {
      localStorageStore['oracle_byok_keys'] = JSON.stringify({ openai: 'sk-test-1234567890abcdef1234' });
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Search for X' }],
        enableWebSearch: true,
      });
      expect(route).not.toBeNull();
      // Falls through to failover, not perplexity
      expect(route!.providerId).not.toBe('perplexity');
    });

    it('returns preferred provider even without matching key when preferredProvider is set', () => {
      localStorageStore['oracle_byok_keys'] = '{}';
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      });
      // hasKey returns false, so it falls through
      expect(route).toBeNull();
    });

    it('falls through to first available when no free models in failover', () => {
      // Only has a provider without free models
      localStorageStore['oracle_byok_keys'] = JSON.stringify({ openai: 'sk-test-1234567890abcdef1234' });
      const route = NeverStopRouter.selectProvider({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(route).not.toBeNull();
      expect(route!.providerId).toBe('openai');
    });
  });

  // ── getFailoverProvider edge cases ──

  describe('getFailoverProvider edge cases', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getFailover = (id: string) => (NeverStopRouter as any).getFailoverProvider(id) as { providerId: string; modelId: string } | null;

    it('wraps around when current provider is not in FAILOVER_ORDER', () => {
      const result = getFailover('unknown-provider');
      expect(result).not.toBeNull();
    });

    it('returns same provider when only current provider has keys (wraps around)', () => {
      localStorageStore['oracle_byok_keys'] = JSON.stringify({ groq: 'gsk_test_1234567890abcdef' });
      const result = getFailover('groq');
      // Wraps around and returns groq as the only available provider
      expect(result).not.toBeNull();
      expect(result!.providerId).toBe('groq');
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
      // Should not throw
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
      // Should not throw
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

  // ── callSync prompt versioning ──

  describe('callSync prompt versioning', () => {
    it('logs request when testId is provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OK' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const result = await NeverStopRouter.callSync(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
        testId: 'test-123',
      });

      expect(result.text).toBe('OK');
    });
  });

  // ── callSync max attempts exhausted ──

  describe('callSync max attempts', () => {
    it('returns failed after all attempts when provider keeps throwing', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        throw new TypeError('Connection reset');
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const result = await NeverStopRouter.callSync(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      });

      expect(result.text).toContain('Error');
      expect(result.costUSD).toBe(0);
    });
  });

  // ── callStreaming max attempts exhausted ──

  describe('callStreaming max attempts', () => {
    it('yields error after all attempts when provider keeps throwing', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        throw new TypeError('Connection reset');
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('Error');
    });
  });

  // ── Unknown provider paths ──

  describe('unknown provider handling', () => {
    it('callStreaming yields error for unknown provider', async () => {
      localStorageStore['oracle_byok_keys'] = JSON.stringify({ 'fake-provider': 'fake-key-1234567890abcdef' });
      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'fake-provider',
        preferredModel: 'fake-model',
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('Unknown provider');
    });

    it('callSync returns error for unknown provider', async () => {
      localStorageStore['oracle_byok_keys'] = JSON.stringify({ 'fake-provider': 'fake-key-1234567890abcdef' });
      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const result = await NeverStopRouter.callSync(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'fake-provider',
        preferredModel: 'fake-model',
      });

      expect(result.text).toContain('Unknown provider');
      expect(result.costUSD).toBe(0);
    });
  });

  // ── Malformed SSE chunks ──

  describe('malformed SSE handling', () => {
    it('callStreaming skips malformed JSON in OpenAI SSE', async () => {
      const sseLines = [
        `data: ${JSON.stringify({choices:[{delta:{content:'valid'},finish_reason:null}]})}\n\n`,
        'data: {invalid json}\n\n',
        'data: [DONE]\n\n',
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEBody(sseLines),
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const collected: string[] = [];

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        if (chunk.done) break;
        if (chunk.chunk) collected.push(chunk.chunk);
      }

      expect(collected).toContain('valid');
    });

    it('callStreaming skips malformed JSON in Anthropic SSE', async () => {
      const sseLines = [
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"valid"}}\n\n',
        'event: content_block_delta\ndata: bad-json\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEBody(sseLines),
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      const collected: string[] = [];

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'anthropic',
        preferredModel: 'claude-sonnet-4-6',
      })) {
        if (chunk.done) break;
        if (chunk.chunk) collected.push(chunk.chunk);
      }

      expect(collected).toContain('valid');
    });
  });

  describe('null response body handling', () => {
    it('callStreaming yields error when response body is null (OpenAI)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: null,
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'openai',
        preferredModel: 'gpt-4o',
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('Failed to read response stream');
    });

    it('callStreaming yields error when response body is null (Anthropic)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: null,
      });

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: [{ role: 'user', content: 'Hi' }],
        preferredProvider: 'anthropic',
        preferredModel: 'claude-sonnet-4-6',
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('Failed to read Anthropic response stream');
    });
  });

  // ── No API Keys ──

  describe('callStreaming with no keys', () => {
    it('yields error when no keys configured', async () => {
      localStorageStore['oracle_byok_keys'] = '{}';

      const messages = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }];
      let lastChunk;

      for await (const chunk of NeverStopRouter.callStreaming(messages, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk!.done).toBe(true);
      expect(lastChunk!.chunk).toContain('No API keys');
      // Verify no network call was attempted
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
