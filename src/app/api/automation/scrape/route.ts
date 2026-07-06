// ═══════════════════════════════════════
// ORACLE — Web Scraping API
// POST /api/automation/scrape
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { checkRateLimit, WEB_SEARCH_RATE_LIMIT } from '@/lib/rate-limit';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { scrapeUrl, crawlSite, extractStructuredData, mapSite } from '@/lib/scraping';
import { decrypt as decryptKey } from '@/lib/encryption';

// ─── Request Body ──────────────────────

interface ScrapeRequest {
  action: 'scrape' | 'crawl' | 'extract' | 'map';
  url?: string;
  urls?: string[];
  options?: Record<string, unknown>;
  schema?: Record<string, string>;
  prompt?: string;
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found.' }, { status: 400 });

  // 2. Rate limit
  const rateLimitKey = `scrape:${auth.user.id}`;
  const rateLimit = await checkRateLimit(rateLimitKey, WEB_SEARCH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  // 3. Parse body
  let body: ScrapeRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, url, urls, options, schema, prompt } = body;

  if (!action) {
    return Response.json({ error: 'action is required (scrape | crawl | extract | map)' }, { status: 400 });
  }

  // 4. Look up Firecrawl API key
  let apiKey: string | null = null;
  const { data: keyRow } = await auth.supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('org_id', auth.org.orgId)
    .eq('provider_id', 'firecrawl')
    .eq('is_active', true)
    .single();

  if (keyRow) {
    apiKey = decryptKey(keyRow.encrypted_key);
  }

  // Fall back to env var
  if (!apiKey) {
    apiKey = process.env.FIRECRAWL_API_KEY || null;
  }

  if (!apiKey) {
    return Response.json(
      { error: 'No Firecrawl API key configured. Add one in Settings → API Keys, or set FIRECRAWL_API_KEY.' },
      { status: 400 }
    );
  }

  // 5. Execute action
  try {
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.AI_CHAT,
      entityType: 'scraping',
      metadata: { action, url: url || urls?.[0] },
    });

    switch (action) {
      case 'scrape': {
        if (!url) return Response.json({ error: 'url is required for scrape' }, { status: 400 });
        const result = await scrapeUrl(url, options || {}, apiKey);
        return Response.json({ result });
      }

      case 'crawl': {
        if (!url) return Response.json({ error: 'url is required for crawl' }, { status: 400 });
        const result = await crawlSite(url, options || {}, apiKey);
        return Response.json({ result });
      }

      case 'extract': {
        if (!url) return Response.json({ error: 'url is required for extract' }, { status: 400 });
        if (!schema) return Response.json({ error: 'schema is required for extract' }, { status: 400 });
        const result = await extractStructuredData(url, { schema, prompt }, apiKey);
        return Response.json({ result });
      }

      case 'map': {
        if (!url) return Response.json({ error: 'url is required for map' }, { status: 400 });
        const result = await mapSite(url, apiKey);
        return Response.json({ result });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Scraping request failed' },
      { status: 502 }
    );
  }
}
