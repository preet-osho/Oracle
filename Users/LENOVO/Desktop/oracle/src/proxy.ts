import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import {
  checkRateLimit,
  getClientIp,
  API_RATE_LIMIT,
  API_WRITE_RATE_LIMIT,
} from '@/lib/rate-limit';
import { requiresCsrf, validateCsrfToken, generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

// Routes that are exempt from CSRF (public/read-only or handled elsewhere)
const CSRF_EXEMPT_PATHS = ['/api/auth', '/auth', '/login'];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');

  // ── CSRF Protection for mutating API routes ──
  if (isApiRoute && requiresCsrf(request.method) && !isCsrfExempt(pathname)) {
    if (!validateCsrfToken(request)) {
      return new Response(
        JSON.stringify({ error: 'CSRF token validation failed' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ── Proxy-level rate limiting for API routes ──
  let apiRateLimitResult: { allowed: boolean; remaining: number; resetAt: number; limit: number } | null = null;

  if (isApiRoute) {
    const ip = getClientIp(request.headers);
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    const limit = isWrite ? API_WRITE_RATE_LIMIT.maxRequests : API_RATE_LIMIT.maxRequests;

    try {
      const rateLimit = await checkRateLimit(
        isWrite ? `api:write:${ip}` : `api:${ip}`,
        isWrite ? API_WRITE_RATE_LIMIT : API_RATE_LIMIT
      );

      apiRateLimitResult = { ...rateLimit, limit };

      if (!rateLimit.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(rateLimit.remaining),
              'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
            },
          }
        );
      }
    } catch (e) {
      // Redis unavailable — allow request through without rate limiting
      console.warn('[Proxy] Rate limit check failed, allowing request:', e);
    }
  }

  // ── Refresh auth session + protect routes ──
  const authResponse = await updateSession(request);

  // ── Rate limit headers for successful API responses ──
  if (isApiRoute && apiRateLimitResult) {
    authResponse.headers.set('X-RateLimit-Limit', String(apiRateLimitResult.limit));
    authResponse.headers.set('X-RateLimit-Remaining', String(apiRateLimitResult.remaining));
    authResponse.headers.set('X-RateLimit-Reset', String(Math.ceil(apiRateLimitResult.resetAt / 1000)));
  }

  // ── Set CSRF token on GET responses (for cookie-based token flow) ──
  if (isApiRoute && request.method === 'GET' && !isCsrfExempt(pathname)) {
    const existingToken = request.cookies.get('oracle_csrf_token')?.value;
    if (!existingToken) {
      const token = generateCsrfToken();
      setCsrfCookie(authResponse, token);
    }
  }

  // ── Security headers ──
  authResponse.headers.set('X-Content-Type-Options', 'nosniff');
  authResponse.headers.set('X-Frame-Options', 'DENY');
  authResponse.headers.set('X-XSS-Protection', '1; mode=block');
  authResponse.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  authResponse.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=()'
  );
  authResponse.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${[
      "'self'",
      // AI providers + web search — all routed through server-side proxies
      // /api/ai/chat and /api/web-search handle provider connections
      // Supabase (REST, Auth, Realtime)
      'https://*.supabase.co', 'wss://*.supabase.co',
      'https://*.supabase.in', 'wss://*.supabase.in',
    ].join(' ')}`,
    "frame-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  authResponse.headers.set('Content-Security-Policy', csp);

  return authResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
