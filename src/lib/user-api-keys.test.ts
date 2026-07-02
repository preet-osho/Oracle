import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userApiKeysApi } from './user-api-keys';

// Mock csrf module
vi.mock('@/lib/csrf', () => ({
  getCsrfToken: () => 'test-csrf-token',
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('userApiKeysApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('list passes an AbortSignal to fetch (via fetchWithTimeout)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await userApiKeysApi.list();

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('save passes an AbortSignal to fetch (via fetchWithTimeout)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'k1', provider_id: 'openai' }),
    });

    await userApiKeysApi.save('openai', 'sk-test');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('remove passes an AbortSignal to fetch (via fetchWithTimeout)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await userApiKeysApi.remove('openai');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('list sends correct URL and headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'k1' }]),
    });

    const result = await userApiKeysApi.list();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user-api-keys',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-csrf-token': 'test-csrf-token',
        }),
      }),
    );
    expect(result).toEqual([{ id: 'k1' }]);
  });

  it('save sends POST with correct body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'k1' }),
    });

    await userApiKeysApi.save('openai', 'sk-test');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/user-api-keys');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      provider_id: 'openai',
      api_key: 'sk-test',
    });
  });

  it('remove sends DELETE with correct query param', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(undefined),
    });

    await userApiKeysApi.remove('groq');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/user-api-keys?provider_id=groq');
    expect(opts.method).toBe('DELETE');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'Invalid key' }),
    });

    await expect(userApiKeysApi.save('openai', 'bad')).rejects.toThrow('Invalid key');
  });

  it('throws on non-ok response with status text fallback', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
    });

    await expect(userApiKeysApi.list()).rejects.toThrow('Failed to list API keys: 500');
  });
});
