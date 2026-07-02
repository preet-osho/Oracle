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
