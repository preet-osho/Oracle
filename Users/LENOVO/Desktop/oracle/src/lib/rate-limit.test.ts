import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Redis to use in-memory fallback ───

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: {
    slidingWindow: vi.fn(),
  },
}));

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}));

// Mock env vars to force in-memory fallback
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';

// ─── Import after mocks ───

import {
  checkRateLimit,
  getClientIp,
  __resetRateLimitStoreForTests,
  LOGIN_RATE_LIMIT,
  SIGNUP_RATE_LIMIT,
  MAGIC_LINK_RATE_LIMIT,
  API_RATE_LIMIT,
  API_WRITE_RATE_LIMIT,
  PASSWORD_UPDATE_RATE_LIMIT,
  EMAIL_VERIFY_RATE_LIMIT,
} from './rate-limit';

// ─── Tests ─────────────────────────────

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
});

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
});

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

    // Window expired
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
});
