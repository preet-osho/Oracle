import { vi } from 'vitest';

/**
 * Shared test helpers for Oracle component tests.
 *
 * NOTE: Due to Vitest's vi.mock() hoisting model, vi.mock() calls and vi.hoisted()
 * variables CANNOT be shared across test files. Each test file must define its own
 * vi.mock() and vi.hoisted() calls locally. This file only exports pure utility
 * functions that don't involve vi.mock or vi.hoisted.
 *
 * Usage:
 *   import { createSSEFetchMock, defaultFetchMock } from './test-utils';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
