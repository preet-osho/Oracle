// ═══════════════════════════════════════
// ORACLE — Server-Side API Key Management Client
// Replaces localStorage-based key storage with server-side storage
// Keys are encrypted at rest and never exposed to the browser
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface ApiKeyInfo {
  id: string;
  provider_id: string;
  key_preview: string; // Masked: "sk-1****abcd"
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

// ─── CSRF Token Helper ─────────────────

import { getCsrfToken } from '@/lib/csrf';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { type SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';
import { createLogger } from '@/lib/logger';
import type { SearchProvider } from '@/lib/research';

const log = createLogger('UserApiKeys');

// ─── API Methods ───────────────────────

export const userApiKeysApi = {
  /**
   * List all configured API keys (masked — never exposes full keys)
   */
  async list(): Promise<ApiKeyInfo[]> {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    const res = await fetchWithTimeout('/api/user-api-keys', { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Failed to list API keys: ${res.status}`);
    }
    return res.json();
  },

  /**
   * Save or update an API key for a provider
   * The key is encrypted server-side before storage
   */
  async save(providerId: string, apiKey: string): Promise<ApiKeyInfo> {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    const res = await fetchWithTimeout('/api/user-api-keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider_id: providerId, api_key: apiKey }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Failed to save API key: ${res.status}`);
    }
    return res.json();
  },

  /**
   * Delete an API key for a provider
   */
  async remove(providerId: string): Promise<void> {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    const res = await fetchWithTimeout(`/api/user-api-keys?provider_id=${encodeURIComponent(providerId)}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Failed to delete API key: ${res.status}`);
    }
  },
};

// ─── Server-Side Search Key Lookup ─────
// Used by MCP servers, chat-with-research route, web-search route

/** Search providers supported for BYOK lookup */
export const SEARCH_PROVIDERS: SearchProvider[] = ['tavily', 'serper', 'brave'];

/**
 * Look up user search API keys (BYOK) from user_api_keys table.
 *
 * @param supabase - Supabase client (from auth or standalone)
 * @param orgId - Organization ID to look up keys for
 * @returns Decrypted keys for tavily/serper/brave, or undefined if none configured
 */
export async function lookupUserSearchKeys(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Partial<Record<SearchProvider, string>> | undefined> {
  try {
    const { data: rows, error } = await supabase
      .from('user_api_keys')
      .select('provider_id, encrypted_key')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .in('provider_id', SEARCH_PROVIDERS as unknown as string[]);

    if (error || !rows || rows.length === 0) {
      return undefined;
    }

    const keys: Partial<Record<SearchProvider, string>> = {};

    for (const row of rows) {
      try {
        const decrypted = decrypt(row.encrypted_key);
        if (decrypted) {
          keys[row.provider_id as SearchProvider] = decrypted;
        }
      } catch (err) {
        log.warn(`Failed to decrypt search key for ${row.provider_id}: ${err}`);
      }
    }

    return Object.keys(keys).length > 0 ? keys : undefined;
  } catch (err) {
    log.error(`Error looking up search keys for org ${orgId}: ${err}`);
    return undefined;
  }
}

