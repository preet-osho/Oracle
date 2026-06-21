// ═══════════════════════════════════════
// ORACLE — CSRF Protection Tests
// Token generation, validation, cookie management, constant-time comparison
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCsrfToken,
  setCsrfCookie,
  validateCsrfToken,
  requiresCsrf,
  getCsrfToken,
  csrfHeaders,
} from './csrf';

// ─── Mock NextRequest ──────────────────

function createMockRequest(headers: Record<string, string> = {}, cookieValue?: string) {
  const cookieStore = new Map<string, string>();
  if (cookieValue !== undefined) {
    cookieStore.set('oracle_csrf_token', cookieValue);
  }

  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    cookies: {
      get: (name: string) => {
        const value = cookieStore.get(name);
        return value !== undefined ? { value } : undefined;
      },
    },
  } as unknown as import('next/server').NextRequest;
}

function createMockResponse() {
  return new Response(null, {
    status: 200,
    headers: new Headers(),
  });
}

// ─── generateCsrfToken Tests ───────────

describe('generateCsrfToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens on each call', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 50; i++) {
      tokens.add(generateCsrfToken());
    }
    // 50 unique tokens out of 50 attempts
    expect(tokens.size).toBe(50);
  });

  it('uses crypto.getRandomValues', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    generateCsrfToken();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('produces deterministic output with mocked randomness', () => {
    const mockBytes = new Uint8Array(32).fill(0xab);
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((arr) => {
      arr.set(mockBytes);
      return arr;
    });

    const token = generateCsrfToken();
    expect(token).toBe('ab'.repeat(32));

    spy.mockRestore();
  });
});

// ─── setCsrfCookie Tests ───────────────

describe('setCsrfCookie', () => {
  it('sets the CSRF cookie on the response', () => {
    const response = createMockResponse();
    setCsrfCookie(response, 'test-token-123');

    const cookies = response.headers.getSetCookie();
    expect(cookies.length).toBe(1);
    expect(cookies[0]).toContain('oracle_csrf_token=test-token-123');
  });

  it('sets Path=/ and HttpOnly', () => {
    const response = createMockResponse();
    setCsrfCookie(response, 'token');

    const cookie = response.headers.getSetCookie()[0];
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
  });

  it('sets SameSite=Strict', () => {
    const response = createMockResponse();
    setCsrfCookie(response, 'token');

    const cookie = response.headers.getSetCookie()[0];
    expect(cookie).toContain('SameSite=Strict');
  });

  it('sets Max-Age to 24 hours (86400 seconds)', () => {
    const response = createMockResponse();
    setCsrfCookie(response, 'token');

    const cookie = response.headers.getSetCookie()[0];
    expect(cookie).toContain('Max-Age=86400');
  });

  it('preserves existing response headers', () => {
    const response = createMockResponse();
    response.headers.set('X-Custom', 'value');
    setCsrfCookie(response, 'token');

    expect(response.headers.get('X-Custom')).toBe('value');
  });
});

// ─── validateCsrfToken Tests ────────────

describe('validateCsrfToken', () => {
  it('allows request through when no cookie exists (first visit)', () => {
    const request = createMockRequest({});
    expect(validateCsrfToken(request)).toBe(true);
  });

  it('rejects when cookie exists but header is missing', () => {
    const request = createMockRequest({}, 'some-token');
    expect(validateCsrfToken(request)).toBe(false);
  });

  it('accepts when header matches cookie', () => {
    const request = createMockRequest(
      { 'x-csrf-token': 'abc123' },
      'abc123'
    );
    expect(validateCsrfToken(request)).toBe(true);
  });

  it('rejects when header differs from cookie', () => {
    const request = createMockRequest(
      { 'x-csrf-token': 'wrong-token' },
      'abc123'
    );
    expect(validateCsrfToken(request)).toBe(false);
  });

  it('rejects when tokens have different lengths', () => {
    const request = createMockRequest(
      { 'x-csrf-token': 'short' },
      'a-much-longer-token'
    );
    expect(validateCsrfToken(request)).toBe(false);
  });

  it('rejects when header is empty string but cookie exists', () => {
    const request = createMockRequest(
      { 'x-csrf-token': '' },
      'some-token'
    );
    expect(validateCsrfToken(request)).toBe(false);
  });

  it('accepts identical long tokens', () => {
    const longToken = 'a'.repeat(64);
    const request = createMockRequest(
      { 'x-csrf-token': longToken },
      longToken
    );
    expect(validateCsrfToken(request)).toBe(true);
  });

  it('rejects tokens that differ by one character', () => {
    const token1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const token2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab';
    const request = createMockRequest(
      { 'x-csrf-token': token1 },
      token2
    );
    expect(validateCsrfToken(request)).toBe(false);
  });

  it('accepts when both header and cookie are empty (empty cookie is falsy, passes early)', () => {
    const request = createMockRequest(
      { 'x-csrf-token': '' },
      ''
    );
    // Empty string is falsy, so !cookieToken short-circuits to true
    expect(validateCsrfToken(request)).toBe(true);
  });

  it('is case-sensitive for token values', () => {
    const request = createMockRequest(
      { 'x-csrf-token': 'ABC123' },
      'abc123'
    );
    expect(validateCsrfToken(request)).toBe(false);
  });
});

// ─── requiresCsrf Tests ─────────────────

describe('requiresCsrf', () => {
  it('returns true for POST', () => {
    expect(requiresCsrf('POST')).toBe(true);
  });

  it('returns true for PUT', () => {
    expect(requiresCsrf('PUT')).toBe(true);
  });

  it('returns true for PATCH', () => {
    expect(requiresCsrf('PATCH')).toBe(true);
  });

  it('returns true for DELETE', () => {
    expect(requiresCsrf('DELETE')).toBe(true);
  });

  it('returns false for GET', () => {
    expect(requiresCsrf('GET')).toBe(false);
  });

  it('returns false for HEAD', () => {
    expect(requiresCsrf('HEAD')).toBe(false);
  });

  it('returns false for OPTIONS', () => {
    expect(requiresCsrf('OPTIONS')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(requiresCsrf('post')).toBe(true);
    expect(requiresCsrf('Post')).toBe(true);
    expect(requiresCsrf('PUT')).toBe(true);
    expect(requiresCsrf('get')).toBe(false);
  });

  it('returns false for unknown methods', () => {
    expect(requiresCsrf('TRACE')).toBe(false);
    expect(requiresCsrf('CONNECT')).toBe(false);
    expect(requiresCsrf('CUSTOM')).toBe(false);
  });
});

// ─── getCsrfToken Tests ─────────────────

describe('getCsrfToken', () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('returns undefined on server (no document)', () => {
    // @ts-expect-error testing server-side behavior
    delete globalThis.document;
    expect(getCsrfToken()).toBeUndefined();
  });

  it('reads token from document.cookie', () => {
    globalThis.document = {
      cookie: 'other=value; oracle_csrf_token=my-csrf-token; another=thing',
    } as Document;

    expect(getCsrfToken()).toBe('my-csrf-token');
  });

  it('returns undefined when no CSRF cookie present', () => {
    globalThis.document = {
      cookie: 'other=value; another=thing',
    } as Document;

    expect(getCsrfToken()).toBeUndefined();
  });

  it('returns undefined when cookie is empty', () => {
    globalThis.document = {
      cookie: '',
    } as Document;

    expect(getCsrfToken()).toBeUndefined();
  });

  it('handles token at start of cookie string', () => {
    globalThis.document = {
      cookie: 'oracle_csrf_token=first-token; other=value',
    } as Document;

    expect(getCsrfToken()).toBe('first-token');
  });

  it('handles token at end of cookie string', () => {
    globalThis.document = {
      cookie: 'other=value; oracle_csrf_token=last-token',
    } as Document;

    expect(getCsrfToken()).toBe('last-token');
  });

  it('handles token as only cookie', () => {
    globalThis.document = {
      cookie: 'oracle_csrf_token=only-token',
    } as Document;

    expect(getCsrfToken()).toBe('only-token');
  });
});

// ─── csrfHeaders Tests ──────────────────

describe('csrfHeaders', () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('returns empty object when no token (server-side)', () => {
    // @ts-expect-error testing server-side behavior
    delete globalThis.document;
    expect(csrfHeaders()).toEqual({});
  });

  it('returns header with token when cookie exists', () => {
    globalThis.document = {
      cookie: 'oracle_csrf_token=my-token',
    } as Document;

    expect(csrfHeaders()).toEqual({ 'x-csrf-token': 'my-token' });
  });

  it('returns empty object when no CSRF cookie', () => {
    globalThis.document = {
      cookie: 'other=value',
    } as Document;

    expect(csrfHeaders()).toEqual({});
  });
});
