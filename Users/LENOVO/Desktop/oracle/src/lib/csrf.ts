// ═══════════════════════════════════════
// ORACLE — CSRF Protection
// Double-submit cookie pattern
// ═══════════════════════════════════════

import { type NextRequest } from 'next/server';

const CSRF_COOKIE_NAME = 'oracle_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Set the CSRF token as a cookie on the response.
 */
export function setCsrfCookie(response: Response, token: string): void {
  response.headers.append(
    'Set-Cookie',
    `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24}`
  );
}

/**
 * Validate that the CSRF token from the header matches the cookie.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  // If no cookie exists, allow the request through (first visit / GET)
  if (!cookieToken) return true;

  // If cookie exists but header is missing, reject
  if (!headerToken) return false;

  // Constant-time comparison
  if (headerToken.length !== cookieToken.length) return false;

  let result = 0;
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if a request method requires CSRF protection.
 * Only mutating methods (POST, PUT, PATCH, DELETE) need CSRF.
 */
export function requiresCsrf(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

// ─── Client-Side Helpers ──────────────

/**
 * Read the CSRF token from the browser cookie.
 * Safe to call on server (returns undefined).
 */
export function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.match(/oracle_csrf_token=([^;]+)/)?.[1];
}

/**
 * Returns an object with the x-csrf-token header, or empty object if no token.
 * Use in fetch headers: { ...csrfHeaders() }
 */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { [CSRF_HEADER_NAME]: token } : {};
}
