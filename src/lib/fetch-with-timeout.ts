// ═══════════════════════════════════════
// ORACLE — Fetch with Timeout
// Wraps fetch() with AbortController to prevent hung requests
// Used by all AI provider calls (server-side and client-side)
// ═══════════════════════════════════════

/** Default timeout for non-streaming requests (60 seconds) */
const DEFAULT_TIMEOUT_MS = 60_000;

/** Extended timeout for streaming connections (120 seconds) */
const STREAMING_TIMEOUT_MS = 120_000;

/**
 * Fetch with an automatic timeout via AbortController.
 *
 * For streaming requests, use `streaming: true` to get a longer timeout
 * that only applies to the initial connection — the stream reader keeps
 * the connection alive after that.
 *
 * On timeout, throws an Error with `name === 'AbortError'`.
 */
export async function fetchWithTimeout(
  url: string | URL | Request,
  init?: RequestInit & {
    timeoutMs?: number;
    streaming?: boolean;
  },
): Promise<Response> {
  const { timeoutMs, streaming, ...fetchInit } = init ?? {};

  // For streaming, only the initial connect has a timeout;
  // once the reader starts, the timeout is cleared.
  const effectiveTimeout = timeoutMs
    ?? (streaming ? STREAMING_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });

    // For streaming responses, clear the timeout once we get the headers
    // (the stream will keep the connection alive via reader.read())
    if (streaming && response.body) {
      clearTimeout(timer);
    }

    return response;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Request to ${typeof url === 'string' ? url : url.toString()} timed out after ${effectiveTimeout}ms`,
      );
    }
    throw err;
  }
}
