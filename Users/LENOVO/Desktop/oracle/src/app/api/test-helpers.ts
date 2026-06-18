/**
 * Shared test utilities for API route handlers.
 *
 * Each test file must:
 * 1. Import this file first
 * 2. Call vi.mock('@/lib/supabase/validate', ...) at top level with vi.hoisted
 * 3. Then import route handlers
 */

import { vi } from 'vitest';

// ─── Mock next/server ───

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    init: { status?: number };
    constructor(body?: unknown, init?: { status?: number }) {
      this.body = body;
      this.init = init ?? {};
    }
    static json(body: unknown, init?: { status?: number }) {
      return { body, init, _type: 'NextResponse' };
    }
  }
  return { NextResponse: MockNextResponse };
});

// ─── MockResponse type ───

export interface MockResponse {
  body: unknown;
  init?: { status?: number };
  status?: number;
}

export function castMockResponse(res: unknown): MockResponse {
  return res as MockResponse;
}

// ─── NextRequest factories ───

export function createGetRequest(url = 'http://localhost/api/test') {
  return { url } as unknown as import('next/server').NextRequest;
}

export function createPostRequest(body: unknown, url = 'http://localhost/api/test') {
  return {
    url,
    json: async () => body,
  } as unknown as import('next/server').NextRequest;
}

export function createPutRequest(body: unknown, url = 'http://localhost/api/test') {
  return {
    url,
    json: async () => body,
  } as unknown as import('next/server').NextRequest;
}

// ─── Mock Supabase Client ───

/**
 * Factory that creates a `setupChain` function bound to the given hoisted mocks.
 *
 * Usage in test file:
 * ```ts
 * const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
 * vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));
 * import { GET } from './route';
 * const setupChain = makeSetupChain(from, authMock);
 * ```
 */
export function makeSetupChain(from: any, authMock: any) {
  return function setupChain(res?: { data?: unknown; error?: unknown }) {
    const result = { data: res?.data ?? [], error: res?.error ?? null };
    const spy = () => c;
    const c: any = {
      select: vi.fn(spy), insert: vi.fn(spy), update: vi.fn(spy), delete: vi.fn(spy),
      order: vi.fn(spy), eq: vi.fn(spy), limit: vi.fn(spy),
      single: vi.fn().mockResolvedValue(result),
      then: (ok: any, fail?: any) => { if (result.error) fail?.(result.error); else ok(result); },
    };
    from.mockReturnValue(c);
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from, auth: { getUser: vi.fn() }, _chain: c } });
    return c;
  };
}
