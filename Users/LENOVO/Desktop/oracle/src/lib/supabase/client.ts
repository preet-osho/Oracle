// ═══════════════════════════════════════
// ORACLE — Client-Side Supabase Browser Client (SSR)
// Cookie-based session management for client components
// ═══════════════════════════════════════

import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Create a Supabase client for use in client components.
 * Uses browser cookies for session management (not localStorage).
 * Singleton pattern — returns the same client instance across re-renders.
 */
export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}
