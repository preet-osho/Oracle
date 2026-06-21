// ═══════════════════════════════════════
// ORACLE — API Route Auth Validation
// Reusable helper for protecting API endpoints
// Returns user + org context for RBAC
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { type OrgRole } from '@/lib/permissions';
import { checkSubscription } from '@/lib/subscription';

export interface AuthResult {
  user: User;
  /** Cookie-based Supabase client authenticated as the current user.
   *  With the new RLS policies, this client can query tables directly
   *  — no need for the service-role key. */
  supabase: SupabaseClient;
  /** Organization context — null if user has no org membership. */
  org: {
    orgId: string;
    role: OrgRole;
  } | null;
}

/**
 * Validate the current user session in an API route.
 *
 * Usage in any route handler:
 * ```ts
 * const auth = await validateAuth();
 * if ('error' in auth) return auth.error;
 * const { user, supabase, org } = auth;
 * // Use `supabase` for all database queries — it respects RLS.
 * // Use `org` for org-scoped queries.
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

  // Get org context via database function
  let org: AuthResult['org'] = null;
  try {
    const { data: orgData } = await supabase.rpc('get_user_org_context', {
      target_user_id: user.id,
    });

    if (orgData && orgData.length > 0) {
      org = {
        orgId: orgData[0].org_id,
        role: orgData[0].role as OrgRole,
      };
    }
  } catch {
    // Org context not available yet (migration not applied) — proceed without it
  }

  // ── Subscription Enforcement for API Routes ──
  // Skip subscription check for public routes and subscription management
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const exemptApiRoutes = ['/api/subscription', '/api/health', '/api/razorpay', '/api/auth'];
  const isExemptApi = exemptApiRoutes.some((route) => pathname.startsWith(route));

  if (!isExemptApi) {
    const subCheck = await checkSubscription(user.id);
    if (!subCheck.allowed) {
      return {
        error: NextResponse.json(
          {
            error: subCheck.reason || 'Subscription required',
            subscriptionRequired: true,
            upgradeUrl: subCheck.upgradeUrl || '/pricing',
          },
          { status: 403 }
        ),
      };
    }
  }

  return { user, supabase, org };
}
