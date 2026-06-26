// ═══════════════════════════════════════
// ORACLE — Rate Limiter Tests
// In-memory fallback, enforceRateLimit, resetUserRateLimits, edge cases
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ──────────────────────────────

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: { slidingWindow: vi.fn() },
}));

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}));

// Mock env vars to force in-memory fallback
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ─── Import after mocks ─────────────────

import {
  checkRateLimit,
  enforceRateLimit,
  resetUserRateLimits,
  getClientIp,
  __resetRateLimitStoreForTests,
  LOGIN_RATE_LIMIT,
  SIGNUP_RATE_LIMIT,
  MAGIC_LINK_RATE_LIMIT,
  API_RATE_LIMIT,
  API_WRITE_RATE_LIMIT,
  PASSWORD_UPDATE_RATE_LIMIT,
  EMAIL_VERIFY_RATE_LIMIT,
  AI_CHAT_RATE_LIMIT,
  WEB_SEARCH_RATE_LIMIT,
} from './rate-limit';

// ─── getClientIp Tests ──────────────────

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIp(headers)).toBe('1.2.3.4');
  });

  it('extracts IP from x-real-ip header', () => {
    const headers = new Headers({ 'x-real-ip': '1.2.3.4' });
    expect(getClientIp(headers)).toBe('1.2.3.4');
  });

  it('extracts IP from cf-connecting-ip header', () => {
    const headers = new Headers({ 'cf-connecting-ip': '1.2.3.4' });
    expect(getClientIp(headers)).toBe('1.2.3.4');
  });

  it('returns unknown when no headers present', () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe('unknown');
  });

  it('prefers x-forwarded-for over other headers', () => {
    const headers = new Headers({
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '5.6.7.8',
    });
    expect(getClientIp(headers)).toBe('1.2.3.4');
  });

  it('trims whitespace from x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' });
    expect(getClientIp(headers)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip when x-forwarded-for missing', () => {
    const headers = new Headers({ 'x-real-ip': '9.8.7.6' });
    expect(getClientIp(headers)).toBe('9.8.7.6');
  });

  it('falls back to cf-connecting-ip when others missing', () => {
    const headers = new Headers({ 'cf-connecting-ip': '5.5.5.5' });
    expect(getClientIp(headers)).toBe('5.5.5.5');
  });
});

// ─── Preset Config Tests ────────────────

describe('preset configs', () => {
  it('LOGIN_RATE_LIMIT allows 5 requests per 15 minutes', () => {
    expect(LOGIN_RATE_LIMIT.maxRequests).toBe(5);
    expect(LOGIN_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000);
  });

  it('SIGNUP_RATE_LIMIT allows 3 requests per hour', () => {
    expect(SIGNUP_RATE_LIMIT.maxRequests).toBe(3);
    expect(SIGNUP_RATE_LIMIT.windowMs).toBe(60 * 60 * 1000);
  });

  it('MAGIC_LINK_RATE_LIMIT allows 3 requests per 10 minutes', () => {
    expect(MAGIC_LINK_RATE_LIMIT.maxRequests).toBe(3);
    expect(MAGIC_LINK_RATE_LIMIT.windowMs).toBe(10 * 60 * 1000);
  });

  it('API_RATE_LIMIT allows 100 requests per minute', () => {
    expect(API_RATE_LIMIT.maxRequests).toBe(100);
    expect(API_RATE_LIMIT.windowMs).toBe(60 * 1000);
  });

  it('API_WRITE_RATE_LIMIT allows 30 requests per minute', () => {
    expect(API_WRITE_RATE_LIMIT.maxRequests).toBe(30);
    expect(API_WRITE_RATE_LIMIT.windowMs).toBe(60 * 1000);
  });

  it('PASSWORD_UPDATE_RATE_LIMIT allows 5 requests per 15 minutes', () => {
    expect(PASSWORD_UPDATE_RATE_LIMIT.maxRequests).toBe(5);
    expect(PASSWORD_UPDATE_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000);
  });

  it('EMAIL_VERIFY_RATE_LIMIT allows 10 requests per 15 minutes', () => {
    expect(EMAIL_VERIFY_RATE_LIMIT.maxRequests).toBe(10);
    expect(EMAIL_VERIFY_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000);
  });

  it('AI_CHAT_RATE_LIMIT allows 10 requests per minute', () => {
    expect(AI_CHAT_RATE_LIMIT.maxRequests).toBe(10);
    expect(AI_CHAT_RATE_LIMIT.windowMs).toBe(60 * 1000);
  });

  it('WEB_SEARCH_RATE_LIMIT allows 15 requests per minute', () => {
    expect(WEB_SEARCH_RATE_LIMIT.maxRequests).toBe(15);
    expect(WEB_SEARCH_RATE_LIMIT.windowMs).toBe(60 * 1000);
  });
});

// ─── checkRateLimit (in-memory) Tests ───

describe('checkRateLimit (in-memory fallback)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetRateLimitStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows first request', async () => {
    const result = await checkRateLimit('test:user-1', {
      maxRequests: 3,
      windowMs: 60000,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('tracks remaining requests', async () => {
    const config = { maxRequests: 3, windowMs: 60000 };

    const r1 = await checkRateLimit('track:user-1', config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit('track:user-1', config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit('track:user-1', config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks when limit exceeded', async () => {
    const config = { maxRequests: 2, windowMs: 60000 };

    await checkRateLimit('block:user-1', config);
    await checkRateLimit('block:user-1', config);
    const result = await checkRateLimit('block:user-1', config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window expires', async () => {
    const config = { maxRequests: 2, windowMs: 60000 };

    await checkRateLimit('reset:user-1', config);
    await checkRateLimit('reset:user-1', config);

    vi.advanceTimersByTime(61000);

    const result = await checkRateLimit('reset:user-1', config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('isolates different keys', async () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    await checkRateLimit('iso:user-1', config);
    const result = await checkRateLimit('iso:user-2', config);

    expect(result.allowed).toBe(true);
  });

  it('logs blocked events', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { maxRequests: 1, windowMs: 60000 };

    await checkRateLimit('log:user-1', config);
    await checkRateLimit('log:user-1', config);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not log allowed events', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { maxRequests: 5, windowMs: 60000 };

    await checkRateLimit('nolog:user-1', config);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns correct resetAt timestamp', async () => {
    const before = Date.now();
    const result = await checkRateLimit('ts:user-1', { maxRequests: 5, windowMs: 30000 });
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 30000);
    expect(result.resetAt).toBeLessThanOrEqual(before + 30001);
  });

  it('works with maxRequests of 1', async () => {
    const result = await checkRateLimit('single:user-1', { maxRequests: 1, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);

    const blocked = await checkRateLimit('single:user-1', { maxRequests: 1, windowMs: 60000 });
    expect(blocked.allowed).toBe(false);
  });
});

// ─── enforceRateLimit Tests ──────────────

describe('enforceRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetRateLimitStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when allowed', async () => {
    const result = await enforceRateLimit('projects', 'user-1');
    expect(result).toBeNull();
  });

  it('returns 429 Response when rate limit exceeded', async () => {
    // Use a very low limit
    const config = { maxRequests: 1, windowMs: 60000 };

    await enforceRateLimit('test-endpoint', 'user-1', config);
    const response = await enforceRateLimit('test-endpoint', 'user-1', config);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
  });

  it('includes Retry-After header in 429 response', async () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    await enforceRateLimit('headers', 'user-1', config);
    const response = await enforceRateLimit('headers', 'user-1', config);

    expect(response!.headers.get('Retry-After')).toBeTruthy();
  });

  it('includes rate limit headers in 429 response', async () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    await enforceRateLimit('hdrs', 'user-1', config);
    const response = await enforceRateLimit('hdrs', 'user-1', config);

    expect(response!.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(response!.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response!.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('uses default config when none provided', async () => {
    const result = await enforceRateLimit('default', 'user-1');
    expect(result).toBeNull();
  });

  it('returns JSON error body in 429', async () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    await enforceRateLimit('json', 'user-1', config);
    const response = await enforceRateLimit('json', 'user-1', config);

    const body = await response!.json();
    expect(body.error).toContain('Rate limit exceeded');
  });
});

// ─── resetUserRateLimits Tests ───────────

describe('resetUserRateLimits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetRateLimitStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes matching in-memory keys', async () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    // Use up the rate limit
    await checkRateLimit('ai:chat:user-1', config);
    await checkRateLimit('api:write:user-1', config);

    const deleted = await resetUserRateLimits('user-1');
    expect(deleted).toBe(2);
  });

  it('returns 0 when no keys match', async () => {
    const deleted = await resetUserRateLimits('nonexistent-user');
    expect(deleted).toBe(0);
  });

  it('resets rate limit allowing new requests', async () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    await checkRateLimit('ai:chat:reset-test', config);
    const blocked = await checkRateLimit('ai:chat:reset-test', config);
    expect(blocked.allowed).toBe(false);

    await resetUserRateLimits('reset-test');
    const allowed = await checkRateLimit('ai:chat:reset-test', config);
    expect(allowed.allowed).toBe(true);
  });
});

// ─── __resetRateLimitStoreForTests ───────

describe('__resetRateLimitStoreForTests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears all rate limit entries', async () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    await checkRateLimit('clear:user-1', config);
    __resetRateLimitStoreForTests();

    const result = await checkRateLimit('clear:user-1', config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
