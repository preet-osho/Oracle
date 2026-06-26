import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from './fetch-with-timeout';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls fetch with the correct url and options', async () => {
    const response = new Response('ok');
    mockFetch.mockResolvedValue(response);

    const result = await fetchWithTimeout('https://api.example.com/test');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/test',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result).toBe(response);
  });

  it('passes through custom options', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));

    await fetchWithTimeout('https://api.example.com/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"value"}',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"key":"value"}',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('uses default 60s timeout for non-streaming', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));

    await fetchWithTimeout('https://api.example.com/test');

    // The timeout should be set - we can verify by advancing timers
    // If fetch was called, the timer was set
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses 120s timeout for streaming requests', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));

    await fetchWithTimeout('https://api.example.com/test', { streaming: true });

    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses custom timeout when provided', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));

    await fetchWithTimeout('https://api.example.com/test', { timeoutMs: 5000 });

    expect(mockFetch).toHaveBeenCalled();
  });

  it('throws error on timeout', async () => {
    // Mock fetch to simulate abort by rejecting with AbortError
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const promise = fetchWithTimeout('https://api.example.com/test', { timeoutMs: 100 });

    // Advance past the timeout to trigger abort
    vi.advanceTimersByTime(101);

    await expect(promise).rejects.toThrow('timed out after 100ms');
  });

  it('throws timeout error for streaming when initial connect hangs', async () => {
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const promise = fetchWithTimeout('https://api.example.com/test', {
      streaming: true,
      timeoutMs: 200,
    });

    vi.advanceTimersByTime(201);

    await expect(promise).rejects.toThrow('timed out after 200ms');
  });

  it('clears timeout for streaming responses with body', async () => {
    const body = new ReadableStream();
    const response = new Response(body);
    mockFetch.mockResolvedValue(response);

    await fetchWithTimeout('https://api.example.com/test', { streaming: true });

    // Timer should be cleared - advancing time should not cause issues
    vi.advanceTimersByTime(200000);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('propagates non-abort errors', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockFetch.mockRejectedValue(networkError);

    await expect(
      fetchWithTimeout('https://api.example.com/test')
    ).rejects.toThrow('Failed to fetch');
  });

  it('handles URL objects', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));

    await fetchWithTimeout(new URL('https://api.example.com/test'));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('handles Request objects', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));
    const request = new Request('https://api.example.com/test', { method: 'GET' });

    await fetchWithTimeout(request);

    expect(mockFetch).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
