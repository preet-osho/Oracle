// ═══════════════════════════════════════
// ORACLE — Shared Supabase Client for Inngest
// Service-role client for background functions
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

/**
 * Get a Supabase service-role client for Inngest background functions.
 * Uses service-role key to bypass RLS (background jobs run as system).
 * Returns null if env vars are not configured.
 */
export async function getInngestServiceClient(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  cachedClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}
