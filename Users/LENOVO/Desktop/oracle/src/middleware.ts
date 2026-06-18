// ═══════════════════════════════════════
// ORACLE — Root Middleware
// Session refresh + route protection + CSRF enforcement + security headers
// ═══════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { validateCsrfToken, requiresCsrf, generateCsrfToken } from '@/lib/csrf';

/**
 * Ensure a CSRF cookie exists on the response.
 * Called on every page load so the client always has a token.
 */
function ensureCsrfCookie(request: NextRequest, response: NextResponse): void {
  // Only set cookie if one doesn't exist yet
  if (!request.cookies.get('oracle_csrf_token')) {
    const token = generateCsrfToken();
    const isSecure = request.nextUrl.protocol === 'https:';
    response.headers.append(
      'Set-Cookie',
      `oracle_csrf_token=${token}; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24}${isSecure ? '; Secure' : ''}`
    );
  }
}

export async function middleware(request: NextRequest) {
  // ── CSRF enforcement for all mutating API routes ──
  if (request.nextUrl.pathname.startsWith('/api/') && requiresCsrf(request.method)) {
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
  }

  // ── Session refresh + route protection ──
  const response = await updateSession(request);

  // ── Set CSRF cookie on page loads (not API routes) ──
  const isPageLoad = !request.nextUrl.pathname.startsWith('/api/') &&
    request.method === 'GET';
  if (isPageLoad) {
    ensureCsrfCookie(request, response);
  }

  // ── Security headers ──
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP — only on HTML page loads (not API routes which use SSE streaming)
  // Note: Next.js App Router doesn't auto-inject nonces into <script> tags,
  // so we use a restrictive CSP without nonce. Script integrity comes from
  // Next.js bundling. Remove 'unsafe-eval' in production builds.
  if (isPageLoad) {
    const isDev = request.nextUrl.hostname === 'localhost';
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src 'self'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ''} https://browser.sentry-cdn.com https://js.sentry-cdn.com`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://api.qrserver.com https://*.supabase.co",
        "font-src 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.sentry.io",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
      ].join('; ')
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes (exclude static files, images)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
