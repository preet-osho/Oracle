import { vi, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Shared test helpers for Oracle component tests.
 *
 * NOTE: Due to Vitest's vi.mock() hoisting model, vi.mock() calls and vi.hoisted()
 * variables CANNOT be shared across test files. Each test file must define its own
 * vi.mock() and vi.hoisted() calls locally. This file exports pure utility
 * functions (vi.mock/hoisting-free) and render helpers that dynamically import
 * ChatPanel so the caller's vi.mock() factories are used at resolution time.
 *
 * ## CJS stubFn vs vi.fn() limitation
 *
 * test-utils.mocks.cjs uses a plain `stubFn` helper (not `vi.fn()`) because it
 * must be `require()`-able at vi.mock() hoist time, before TypeScript module
 * resolution is available. `stubFn` instances have mock-like setters
 * (mockReturnValue, mockImplementation, mockClear, etc.) but do NOT have Vitest's
 * spy internals — in particular `.mock.calls` is a plain array and
 * `expect(stubFn).toHaveBeenCalledTimes()` throws "not a spy".
 *
 * This means:
 *   - Functions returned by CJS mock factories (e.g. createAgencyOperationsMock)
 *     can be used to SET UP behavior but CANNOT be asserted on with Vitest matchers.
 *   - Shared render helpers like `renderAndStartLoop` and `renderAndStartLoopWithFetch`
 *     call `expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1)`, so they
 *     require a real `vi.fn()` — not a CJS `stubFn`.
 *
 * To use the render helpers, test files must define mocks via `vi.hoisted()`:
 *
 *   const { mockRunOperatingLoop, analyzeTask } = vi.hoisted(() => ({
 *     mockRunOperatingLoop: vi.fn().mockResolvedValue([]),
 *     analyzeTask: vi.fn().mockReturnValue({ complexity: 0.3, ... }),
 *   }));
 *
 *   vi.mock('@/lib/agency-operations', () => ({
 *     runOperatingLoop: mockRunOperatingLoop,
 *     // ...other exports
 *   }));
 *
 *   vi.mock('@/lib/task-analyzer', () => ({ analyzeTask }));
 *
 * Now `mockRunOperatingLoop` is a real `vi.fn()` with full assertion support,
 * and `renderAndStartLoopWithFetch(mockRunOperatingLoop, ...)` works correctly.
 *
 * Usage:
 *   import { createSSEFetchMock, defaultFetchMock, renderAndStartLoop } from './test-utils';
 */

// ─── SSE Fetch Mock ─────────────────────────────────────

/** A single SSE chunk sent by the /api/ai/chat streaming endpoint. */
export interface SSEChunk {
  chunk: string;
  done: boolean;
  model?: string;
  provider?: string;
}

/**
 * Creates a mock `global.fetch` that intercepts `/api/ai/chat` requests.
 *
 * - For **streaming** requests (`stream: true`): returns a ReadableStream of SSE-encoded chunks.
 * - For **sync** requests (`stream: false`): returns a JSON response with the concatenated text.
 * - For **other** URLs (e.g. `/api/web-search`): returns `{ ok: true, json: () => ({ results: [] }) }`.
 */
export function createSSEFetchMock(chunks: SSEChunk[]) {
   
  return vi.fn(async (url: URL | Request | string, init?: RequestInit): Promise<any> => {
    if (typeof url === 'string' && url.includes('/api/ai/chat')) {
      const body = JSON.parse((init?.body as string) || '{}');
      if (body.stream === false) {
        const fullText = chunks
          .filter((c) => c.chunk)
          .map((c) => c.chunk)
          .join('');
        const provider = chunks[0]?.provider || 'openai';
        const model = chunks[0]?.model || 'gpt-4o';
        return {
          ok: true,
          json: async () => ({
            text: fullText,
            provider,
            model,
            inputTokens: 10,
            outputTokens: 20,
            costUSD: 0.001,
            _health: { latencyMs: 150, success: true },
          }),
        };
      }
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const c of chunks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(c)}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ _health: { latencyMs: 200, success: true, model: chunks[0]?.model || 'gpt-4o' } })}\n\n`));
          controller.close();
        },
      });
      return { ok: true, body: stream, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({ results: [] }) };
  });
}

/**
 * Default fetch mock returning "Hello from AI" as streaming SSE chunks.
 * Each chunk includes `model: 'gpt-4o'` to match production SSE behavior.
 */
export function defaultFetchMock() {
  return createSSEFetchMock([
    { chunk: 'H', done: false, model: 'gpt-4o' },
    { chunk: 'ello', done: false, model: 'gpt-4o' },
    { chunk: ' from AI', done: false, model: 'gpt-4o' },
  ]);
}

// ─── Abort Signal / CallAI Mocks ──

/**
 * Creates a mock `global.fetch` that:
 * 1. Captures `AbortSignal` instances from `/api/ai/chat` requests into `capturedSignals`
 * 2. Returns a JSON response for `stream: false` (callAI path)
 * 3. Returns an SSE stream for `stream: true` (main response path)
 */
export function createSignalCapturingFetch(capturedSignals: AbortSignal[]) {
   
  return vi.fn(async (url: URL | Request | string, init?: RequestInit): Promise<any> => {
    if (typeof url === 'string' && url.includes('/api/ai/chat')) {
      if (init?.signal) capturedSignals.push(init.signal);
      const body = JSON.parse((init?.body as string) || '{}');
      if (body.stream === false) {
        return {
          ok: true,
          json: async () => ({
            text: 'step result',
            provider: 'groq',
            model: 'llama-3',
            inputTokens: 10,
            outputTokens: 10,
            costUSD: 0,
          }),
        };
      }
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode('data: {"chunk":"OK"}\n\n'));
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return { ok: true, body: stream, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({ results: [] }) };
  });
}

/**
 * Configures a `mockRunOperatingLoop` to actually call its `callAI` argument once,
 * exercising the real fetch+signal path inside ChatPanel.
 *
 * @param mock - The `vi.fn()` wrapping the controllable loop mock
 * @param onStepComplete - Optional callback forwarded to `runOperatingLoop`
 */
export function setupCallAIMock(mock: ReturnType<typeof vi.fn>) {
  mock.mockImplementation(
    async (
      task: string,
      callAI: (prompt: string, sysPrompt?: string) => Promise<{ text: string; tokens: number }>,
      onStepComplete?: (...args: unknown[]) => void,
    ) => {
      const result = await callAI('step: ' + task);
      const r = { step: 'understand' as const, output: result.text, agentUsed: 'agency-brain', duration: 50 };
      onStepComplete?.(r, 1, 6);
      return [r];
    },
  );
}

// ─── Render + Start Loop Helper ──

/**
 * Shared render helper: renders ChatPanel, types a message into the chat input,
 * and waits for `mockRunOperatingLoop` to be called once.
 *
 * Designed for use in tests that exercise the operating-loop path. The caller
 * must already have the necessary `vi.mock()` setup in place (ChatPanel mocks,
 * controllable loop mock, etc.).
 *
 * @returns The React Testing Library `unmount` fn, the `onStepComplete` callback
 *          captured by the controllable loop mock, the `userEvent` instance, and
 *          the prompt string that was typed.
 */
export async function renderAndStartLoop(
  /** The mocked runOperatingLoop (vi.fn()) to assert call count */
  mockRunOperatingLoop: ReturnType<typeof vi.fn>,
  /** Callback that returns the onStepComplete captured by the controllable loop */
  getLoopCallback: () => ((...args: unknown[]) => void) | null,
  /** Optional custom message to type (defaults to a marketing strategy prompt) */
  message?: string,
): Promise<{
  unmount: () => void;
  callback: ((...args: unknown[]) => void) | null;
   
  user: any;
  prompt: string;
}> {
  // Dynamic import of ChatPanel to ensure the caller's vi.mock() factories
  // are resolved at call-time rather than at module-evaluation time.
  const { ChatPanel } = await import('./ChatPanel');
  const user = userEvent.setup();
  const { unmount } = render(<ChatPanel />);
  const prompt = message || 'Build a complete end-to-end marketing strategy';
  await user.type(screen.getByLabelText('Chat input'), prompt + '{Enter}');
  await waitFor(() => {
    expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1);
  });
  return { unmount, callback: getLoopCallback(), user, prompt };
}

export async function renderAndStartLoopWithFetch(
  /** The mocked runOperatingLoop (vi.fn()) to assert call count */
  mockRunOperatingLoop: ReturnType<typeof vi.fn>,
  /** Custom fetch mock to install as global.fetch before rendering */
  fetchMock: typeof global.fetch,
  /** Optional custom message to type (defaults to a marketing strategy prompt) */
  message?: string,
): Promise<{
  unmount: () => void;
   
  user: any;
  prompt: string;
}> {
  // Dynamic import of ChatPanel to ensure the caller's vi.mock() factories
  // are resolved at call-time rather than at module-evaluation time.
  const { ChatPanel } = await import('./ChatPanel');
  global.fetch = fetchMock as typeof fetch;
  const user = userEvent.setup();
  const { unmount } = render(<ChatPanel />);
  const prompt = message || 'Build a complete end-to-end marketing strategy';
  await user.type(screen.getByLabelText('Chat input'), prompt + '{Enter}');
  await waitFor(() => {
    expect(mockRunOperatingLoop).toHaveBeenCalledTimes(1);
  });
  return { unmount, user, prompt };
}

// ─── Render + Type Helper ──

/**
 * Lightweight render helper: renders ChatPanel, optionally runs a `beforeType`
 * callback (e.g. to select a project), types a message, and waits for the
 * expected response text to appear.
 *
 * Unlike `renderAndStartLoop`, this does NOT depend on the operating loop mock
 * — it simply waits for the response text to appear in the DOM.
 *
 * @param message - The message to type into the chat input
 * @param options.waitForResponse - Text to wait for in the assistant response
 * @param options.fetchMock - Optional custom fetch mock to install as global.fetch
 * @param options.beforeType - Optional async callback run after render but before
 *                             typing (e.g. to select a project from the dropdown)
 */
export async function renderAndType(
  message: string,
  options?: {
    /** Text to wait for in the DOM after sending */
    waitForResponse?: string;
    /** Custom fetch mock to install as global.fetch before rendering */
    fetchMock?: typeof global.fetch;
    /** Async callback run after render but before typing */
     
    beforeType?: (user: any) => Promise<void>;
  },
): Promise<{
  unmount: () => void;
   
  user: any;
  prompt: string;
}> {
  const { ChatPanel } = await import('./ChatPanel');
  if (options?.fetchMock) {
    global.fetch = options.fetchMock as typeof fetch;
  }
  const user = userEvent.setup();
  const { unmount } = render(<ChatPanel />);
  if (options?.beforeType) {
    await options.beforeType(user);
  }
  await user.type(screen.getByLabelText('Chat input'), message + '{Enter}');
  if (options?.waitForResponse) {
    const responseText = options.waitForResponse;
    await waitFor(() => {
      expect(screen.getByText(responseText)).toBeDefined();
    });
  }
  return { unmount, user, prompt: message };
}

// ─── Streaming Mocks (for NeverStopRouter.callStreaming) ──

/** A single streaming chunk matching the shape returned by NeverStopRouter.callStreaming. */
export interface StreamingChunk {
  chunk: string;
  done: boolean;
  provider: string;
  providerId?: string;
  modelId?: string;
}

/**
 * Create an array of streaming chunks from a text string.
 * Each character becomes a separate chunk, plus a final done chunk.
 */
export function createStreamingChunks(
  text: string,
  provider = 'openai',
  model = 'gpt-4o',
): StreamingChunk[] {
  const baseUrl = provider.startsWith('http') ? provider : `https://api.${provider}.com/v1`;
  const chunks: StreamingChunk[] = text.split('').map((char) => ({
    chunk: char,
    done: false,
    provider: baseUrl,
    providerId: provider,
    modelId: model,
  }));
  chunks.push({ chunk: '', done: true, provider: baseUrl, providerId: provider, modelId: model });
  return chunks;
}

/** Async generator that yields streaming chunks one at a time. */
export async function* streamFromChunks(chunks: StreamingChunk[]): AsyncGenerator<StreamingChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}
