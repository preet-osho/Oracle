// ═══════════════════════════════════════
// ORACLE — API Key Validation
// Live validation: tests the key with a minimal API call
// ═══════════════════════════════════════

import { getCsrfToken } from '@/lib/csrf';

export interface ValidationResult {
  valid: boolean;
  provider: string;
  latencyMs: number;
  error?: string;
  model?: string;
}

/**
 * Validates an API key by sending a minimal request through the server proxy.
 * Returns success/failure with latency and error details.
 */
export async function validateApiKey(
  providerId: string,
  _apiKey: string
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-oracle-provider-id': providerId,
    };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say ok' }],
        stream: false,
        maxTokens: 5,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return {
        valid: false,
        provider: providerId,
        latencyMs,
        error: body.error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      valid: true,
      provider: providerId,
      latencyMs,
      model: data.model,
    };
  } catch (err) {
    return {
      valid: false,
      provider: providerId,
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
