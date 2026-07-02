// ─── Timeout Tiers ────────────────────────────
/** Quick: validation pings, key checks, lightweight internal APIs. */
export const TIMEOUT_QUICK_MS = 15_000;
/** Moderate: editor gate reviews, embeddings, external search APIs. */
export const TIMEOUT_MODERATE_MS = 30_000;
/** Standard: AI provider sync (non-streaming) generation calls. */
export const TIMEOUT_STANDARD_MS = 60_000;
/** Streaming: AI provider streaming generation calls. */
export const TIMEOUT_STREAMING_MS = 120_000;

/** Default timeout for fetch requests (ms). */
export const FETCH_TIMEOUT_MS = TIMEOUT_QUICK_MS;

/**
 * Wrapper around `fetch` that attaches an `AbortController` signal and
 * auto-aborts after `timeoutMs`. Throws an `Error` with `name === 'AbortError'`
 * on timeout so callers can handle it uniformly via their existing catch blocks.
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const { timeoutMs: _, signal: callerSignal, ...fetchInit } = init ?? {};
  const controller = new AbortController();

  // Chain caller's signal: if caller aborts, forward to our controller so
  // either the caller's cancel OR the timeout can trigger the abort.
  let onCallerAbort: (() => void) | null = null;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      onCallerAbort = () => controller.abort();
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...fetchInit, signal: controller.signal }).finally(() => {
    clearTimeout(id);
    // Clean up caller signal listener to avoid holding a reference to our controller
    if (onCallerAbort && callerSignal) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  });
}
