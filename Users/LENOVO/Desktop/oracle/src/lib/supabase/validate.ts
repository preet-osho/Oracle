// ═══════════════════════════════════════
// ORACLE — API Route Auth Validation
// Reusable helper for protecting API endpoints
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { User, SupabaseClient } from '@supabase/supabase-js';

export interface AuthResult {
  user: User;
  /** Cookie-based Supabase client authenticated as the current user.
   *  With the new RLS policies, this client can query tables directly
   *  — no need for the service-role key. */
  supabase: SupabaseClient;
}

/**
 * Validate the current user session in an API route.
 *
 * Usage in any route handler:
 * ```ts
 * const auth = await validateAuth();
 * if ('error' in auth) return auth.error;
 * const { user, supabase } = auth;
 * // Use `supabase` for all database queries — it respects RLS.
 * ```
 */
export async function validateAuth(): Promise<
  AuthResult | { error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized — please sign in' },
        { status: 401 }
      ),
    };
  }

  return { user, supabase };
}
