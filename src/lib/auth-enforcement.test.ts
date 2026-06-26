// ═══════════════════════════════════════
// ORACLE — Authentication Enforcement Tests
// P1 Critical: Auth redirect, session handling, protected routes
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ──────────────────────────────

// Mock Supabase middleware
const mockUpdateSession = vi.fn();
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  API_RATE_LIMIT: { maxRequests: 100, windowMs: 60000 },
  API_WRITE_RATE_LIMIT: { maxRequests: 30, windowMs: 60000 },
}));

// Mock CSRF
vi.mock('@/lib/csrf', () => ({
  requiresCsrf: vi.fn((method: string) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)),
  validateCsrfToken: vi.fn().mockReturnValue(true),
  generateCsrfToken: vi.fn().mockReturnValue('mock-csrf-token'),
  setCsrfCookie: vi.fn(),
}));

// Mock subscription
vi.mock('@/lib/subscription', () => ({
  checkSubscription: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Import after mocks ─────────────────

import { proxy } from '@/middleware';

// ─── Helper: create mock NextRequest ────

function createMockRequest(path: string, method = 'GET', headers: Record<string, string> = {}) {
  const url = new URL(`http://localhost:3000${path}`);
  return {
    nextUrl: url,
    method,
    headers: new Headers(headers),
    cookies: {
      get: vi.fn().mockReturnValue(undefined),
    },
  } as unknown as import('next/server').NextRequest;
}

function createMockResponse(status = 200, headers: Record<string, string> = {}) {
  const response = new Response(null, { status });
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

// ─── Tests ──────────────────────────────

describe('Authentication Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: updateSession returns a successful response (authenticated)
    mockUpdateSession.mockResolvedValue(createMockResponse(200));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Protected Route Redirect ────────────

  it('redirects unauthenticated user to /login for protected routes', async () => {
    // updateSession returns a redirect to /login (302)
    const redirectResponse = createMockResponse(302, { Location: '/login' });
    mockUpdateSession.mockResolvedValue(redirectResponse);

    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/login');
    expect(mockUpdateSession).toHaveBeenCalledWith(request);
  });

  it('allows authenticated user through to protected routes', async () => {
    // updateSession returns 200 (session valid)
    mockUpdateSession.mockResolvedValue(createMockResponse(200));

    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it('allows access to /login without authentication', async () => {
    mockUpdateSession.mockResolvedValue(createMockResponse(200));

    const request = createMockRequest('/login');
    const response = await proxy(request);

    // Should pass through — /login is a public route
    expect(response.status).toBe(200);
  });

  it('allows access to /auth routes without authentication', async () => {
    mockUpdateSession.mockResolvedValue(createMockResponse(200));

    const request = createMockRequest('/auth/callback');
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  // ── API Route Protection ────────────────

  it('applies rate limiting to API routes', async () => {
    const request = createMockRequest('/api/projects', 'GET');
    const response = await proxy(request);

    // Should succeed (rate limit allows)
    expect(response.status).toBe(200);
  });

  it('applies CSRF protection to mutating API routes', async () => {
    const { validateCsrfToken } = await import('@/lib/csrf');
    (validateCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const request = createMockRequest('/api/projects', 'POST');
    const response = await proxy(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('CSRF');
  });

  it('exempts /api/auth from CSRF protection', async () => {
    const { validateCsrfToken } = await import('@/lib/csrf');
    (validateCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const request = createMockRequest('/api/auth/signin', 'POST');
    const response = await proxy(request);

    // Should NOT be blocked by CSRF (exempt path)
    expect(response.status).not.toBe(403);
  });

  // ── Security Headers ────────────────────

  it('sets X-Content-Type-Options: nosniff', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('sets X-XSS-Protection header', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
  });

  it('sets Content-Security-Policy header', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
  });

  it('sets Strict-Transport-Security header', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    const hsts = response.headers.get('Strict-Transport-Security');
    expect(hsts).toContain('max-age=');
    expect(hsts).toContain('includeSubDomains');
  });

  it('sets Permissions-Policy with camera denied, microphone self', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    const pp = response.headers.get('Permissions-Policy');
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=(self)');
    expect(pp).toContain('geolocation=()');
  });

  it('sets Referrer-Policy header', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    expect(response.headers.get('Referrer-Policy')).toBe('origin-when-cross-origin');
  });

  // ── CSP Blocks Unauthorized Resources ──

  it('CSP connect-src only allows self and Supabase', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain("connect-src");
    expect(csp).toContain("'self'");
    expect(csp).toContain('*.supabase.co');
    // Should NOT allow arbitrary external connections
    expect(csp).not.toContain('https://evil.com');
  });

  it('CSP blocks frame embedding from external sites', async () => {
    const request = createMockRequest('/dashboard');
    const response = await proxy(request);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain("frame-src 'none'");
  });

  // ── Session Refresh ─────────────────────

  it('calls updateSession for every request', async () => {
    const request1 = createMockRequest('/page1');
    const request2 = createMockRequest('/page2');

    await proxy(request1);
    await proxy(request2);

    expect(mockUpdateSession).toHaveBeenCalledTimes(2);
  });

  it('passes the original request to updateSession', async () => {
    const request = createMockRequest('/dashboard', 'GET', { 'X-Custom': 'value' });
    await proxy(request);

    expect(mockUpdateSession).toHaveBeenCalledWith(request);
  });

  // ── CSRF Cookie on GET ──────────────────

  it('sets CSRF cookie on GET API responses when no existing token', async () => {
    const request = createMockRequest('/api/projects', 'GET');
    // Simulate no existing CSRF cookie
    request.cookies.get = vi.fn().mockReturnValue(undefined);

    const { setCsrfCookie } = await import('@/lib/csrf');
    await proxy(request);

    expect(setCsrfCookie).toHaveBeenCalled();
  });

  it('does NOT set CSRF cookie when token already exists', async () => {
    const request = createMockRequest('/api/projects', 'GET');
    // Simulate existing CSRF cookie
    request.cookies.get = vi.fn().mockReturnValue({ value: 'existing-token' });

    const { setCsrfCookie } = await import('@/lib/csrf');
    (setCsrfCookie as ReturnType<typeof vi.fn>).mockClear();
    await proxy(request);

    expect(setCsrfCookie).not.toHaveBeenCalled();
  });

  // ── Static Assets ───────────────────────

  it('allows access to static assets', async () => {
    mockUpdateSession.mockResolvedValue(createMockResponse(200));

    const request = createMockRequest('/image.png');
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  // ── Rate Limit Headers on API ───────────

  it('includes rate limit headers on successful API responses', async () => {
    const request = createMockRequest('/api/projects', 'GET');
    const response = await proxy(request);

    expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
  });

  // ── Edge Cases ──────────────────────────

  it('handles request to root path', async () => {
    mockUpdateSession.mockResolvedValue(createMockResponse(200));

    const request = createMockRequest('/');
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it('handles deeply nested API paths', async () => {
    const request = createMockRequest('/api/projects/123/tasks/456', 'GET');
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it('handles PUT method as mutating (CSRF enforced)', async () => {
    const { validateCsrfToken } = await import('@/lib/csrf');
    (validateCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const request = createMockRequest('/api/projects/123', 'PUT');
    const response = await proxy(request);

    expect(response.status).toBe(403);
  });

  it('handles PATCH method as mutating (CSRF enforced)', async () => {
    const { validateCsrfToken } = await import('@/lib/csrf');
    (validateCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const request = createMockRequest('/api/projects/123', 'PATCH');
    const response = await proxy(request);

    expect(response.status).toBe(403);
  });

  it('handles DELETE method as mutating (CSRF enforced)', async () => {
    const { validateCsrfToken } = await import('@/lib/csrf');
    (validateCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const request = createMockRequest('/api/projects/123', 'DELETE');
    const response = await proxy(request);

    expect(response.status).toBe(403);
  });

  it('GET requests bypass CSRF check', async () => {
    const { validateCsrfToken } = await import('@/lib/csrf');
    (validateCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const request = createMockRequest('/api/projects', 'GET');
    const response = await proxy(request);

    // GET should not be blocked by CSRF even if token invalid
    expect(response.status).not.toBe(403);
  });
});
