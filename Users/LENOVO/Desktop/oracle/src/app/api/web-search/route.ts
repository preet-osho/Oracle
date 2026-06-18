// ═══════════════════════════════════════
// ORACLE — Server-Side Web Search Proxy
// Routes Tavily/Serper calls through the server
// Prevents browser→provider direct connections
// Keys are looked up from user_api_keys table
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { checkRateLimit, WEB_SEARCH_RATE_LIMIT } from '@/lib/rate-limit';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { decrypt as decryptKey } from '@/lib/encryption';

// ─── Request Body ──────────────────────

interface WebSearchRequest {
  query: string;
  provider?: 'tavily' | 'serper';
  maxResults?: number;
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  // 2. Rate limit (per-user, 15 req/min)
  const rateLimitKey = `web-search:${auth.user.id}`;
  const rateLimit = await checkRateLimit(rateLimitKey, WEB_SEARCH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
      entityType: 'web_search',
      metadata: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    });
    return Response.json(
      { error: 'Rate limit exceeded. Please wait before searching again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(WEB_SEARCH_RATE_LIMIT.maxRequests),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
        },
      }
    );
  }

  // Log near-limit usage for abuse pattern detection (≤2 remaining)
  if (rateLimit.remaining <= 2) {
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.RATE_LIMIT_WARNING,
      entityType: 'web_search',
      metadata: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    });
  }

  // 3. Parse body
  let body: WebSearchRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { query, provider = 'tavily', maxResults = 5 } = body;

  if (!query || !query.trim()) {
    return Response.json({ error: 'query is required' }, { status: 400 });
  }

  // 3. Look up web search key from server-side storage
  const { data: keyRow, error: keyError } = await auth.supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('user_id', auth.user.id)
    .eq('provider_id', provider)
    .eq('is_active', true)
    .single();

  if (keyError || !keyRow) {
    return Response.json(
      { error: `No ${provider} API key configured. Add one in Settings → API Keys.` },
      { status: 400 }
    );
  }

  const apiKey = decryptKey(keyRow.encrypted_key);
  if (!apiKey) {
    return Response.json({ error: 'Failed to decrypt API key' }, { status: 500 });
  }

  // 4. Route to provider
  try {
    if (provider === 'tavily') {
      return await searchTavilyServer(query, apiKey, maxResults);
    } else {
      return await searchSerperServer(query, apiKey, maxResults);
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Search request failed' },
      { status: 502 }
    );
  }
}

// ─── Tavily (Server-Side) ─────────────

async function searchTavilyServer(query: string, apiKey: string, maxResults: number) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const results = (data.results || []).map((r: Record<string, string>) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    publishedDate: r.published_date || undefined,
  }));

  return Response.json({ results });
}

// ─── Serper (Server-Side) ─────────────

async function searchSerperServer(query: string, apiKey: string, maxResults: number) {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      q: query,
      num: maxResults,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Serper API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const results = (data.organic || []).map((r: Record<string, string>) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
    publishedDate: r.date || undefined,
  }));

  return Response.json({ results });
}
