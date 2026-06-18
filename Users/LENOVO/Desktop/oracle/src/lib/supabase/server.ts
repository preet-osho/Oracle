// ═══════════════════════════════════════
// ORACLE — Server-Side Supabase Client (SSR)
// Cookie-based session management for Next.js App Router
// ═══════════════════════════════════════

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client that uses the user's session cookies.
 * Use this in Server Components, Server Actions, and Route Handlers
 * where you need to access the authenticated user.
 *
 * For operations that need to bypass RLS, use getSupabaseServiceClient()
 * from '@/lib/supabase' instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (err) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
            console.debug('[Supabase] Cookie set ignored (Server Component):', name, err);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (err) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
            console.debug('[Supabase] Cookie remove ignored (Server Component):', name, err);
          }
        },
      },
    }
  );
}

/**
 * Get the authenticated user from the current session.
 * Returns null if not authenticated.
 */
export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Require authentication — throws or redirects if not logged in.
 * Use this in Server Components that must be behind auth.
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}
