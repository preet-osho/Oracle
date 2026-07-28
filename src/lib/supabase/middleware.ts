// ═══════════════════════════════════════
// ORACLE — Supabase Middleware Helper
// Session refresh + route protection
// ═══════════════════════════════════════

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Refresh the Supabase auth session on every request.
 * This ensures Server Components and API routes always have a fresh session.
 *
 * Also protects routes that require authentication.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is set, update the request cookies too
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Refresh the session — this is critical for keeping the user logged in
  const { data: { user } } = await supabase.auth.getUser();

  // ── Route Protection ──
  const pathname = request.nextUrl.pathname;

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/auth/callback', '/auth/confirm', '/'];
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'));

  // Static assets and Next.js internals are always public
  const isStaticAsset = pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.');

  // API routes handle their own auth via validateAuth() — skip redirect for them
  const isApiRoute = pathname.startsWith('/api/');

  // Redirect unauthenticated users to login (page routes only)
  if (!user && !isPublicRoute && !isStaticAsset && !isApiRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (user && pathname === '/login') {
    const redirectParam = request.nextUrl.searchParams.get('redirect');
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = redirectParam || '/';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
