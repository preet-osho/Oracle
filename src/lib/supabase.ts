// ═══════════════════════════════════════
// ORACLE — Supabase Client Singleton
// Server-side and client-side helpers
// ═══════════════════════════════════════

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Client-side Supabase Client ──────
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

// ─── Server-side Supabase Client ──────
// Uses service_role key to bypass RLS policies.
// This key must NEVER be exposed to the client (no NEXT_PUBLIC_ prefix).
export function getSupabaseServer(): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseServiceKey) {
    // Development fallback: use anon key with a warning
    if (process.env.NODE_ENV === 'development') {
      console.warn('[ORACLE] SUPABASE_SERVICE_ROLE_KEY not set. Falling back to anon key. Set the key for production.');
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — required for server-side operations. Get it from Supabase Dashboard → Settings → API → service_role secret.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
