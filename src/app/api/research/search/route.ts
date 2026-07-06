// ═══════════════════════════════════════
// ORACLE — Research Search API
// POST /api/research/search
// Multi-source search with Tavily/Serper/Brave
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { checkRateLimit, WEB_SEARCH_RATE_LIMIT } from '@/lib/rate-limit';
import { validateBody, ResearchSearchSchema } from '@/lib/validations';
import { multiSourceSearch, getAvailableProviders } from '@/lib/research/search-orchestrator';
import { createLogger } from '@/lib/logger';

const log = createLogger('ResearchSearchAPI');

// ─── POST Handler ─────────────────────

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return Response.json(
      { error: 'No organization found. Create or join an organization first.' },
      { status: 400 },
    );
  }

  // 2. Rate limit (reuse web-search rate limit: 15 req/min)
  const rateLimitKey = `web-search:${auth.user.id}`;
  const rateLimit = await checkRateLimit(rateLimitKey, WEB_SEARCH_RATE_LIMIT);
  if (!rateLimit.allowed) {
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
      },
    );
  }

  // 3. Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateBody(body, ResearchSearchSchema);
  if (parsed.error) return parsed.error;

  // 4. Check available providers
  const availableProviders = getAvailableProviders();
  if (availableProviders.length === 0) {
    return Response.json(
      {
        error: 'No search API keys configured. Add at least one in Settings → API Keys.',
        requiredEnvVars: ['TAVILY_API_KEY', 'SERPER_API_KEY', 'BRAVE_SEARCH_API_KEY'],
      },
      { status: 400 },
    );
  }

  // 5. Execute multi-source search
  try {
    const response = await multiSourceSearch(parsed.data);

    log.info(`Search completed for "${parsed.data.query}"`, {
      userId: auth.user.id,
      resultsCount: response.results.length,
      sourcesQueried: response.sourcesQueried,
      durationMs: response.searchDurationMs,
    });

    return Response.json(response);
  } catch (error) {
    log.error('Search failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return Response.json(
      { error: error instanceof Error ? error.message : 'Search request failed' },
      { status: 502 },
    );
  }
}
