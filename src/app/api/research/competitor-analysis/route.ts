// ═══════════════════════════════════════
// ORACLE — Competitor Analysis API
// POST /api/research/competitor-analysis
// Website auditing · SWOT · Comparison
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { checkRateLimit, WEB_SEARCH_RATE_LIMIT } from '@/lib/rate-limit';
import { validateBody, CompetitorAnalysisSchema } from '@/lib/validations';
import {
  analyzeCompetitor,
  compareCompetitors,
  generateSwot,
  generateReport,
} from '@/lib/research/competitor-analyzer';
import { storeFinding } from '@/lib/research/memory';
import { createLogger } from '@/lib/logger';

const log = createLogger('CompetitorAnalysisAPI');

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

  // 2. Rate limit (reuse web-search rate limit)
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

  const parsed = validateBody(body, CompetitorAnalysisSchema);
  if (parsed.error) return parsed.error;

  const { url, urls, includeSubpages, generateReport: shouldGenerateReport } = parsed.data;

  try {
    // Single URL: analyze + SWOT + report
    if (url) {
      const analysis = await analyzeCompetitor(url, { includeSubpages });
      const swot = generateSwot(analysis);
      const report = shouldGenerateReport ? generateReport(analysis, swot) : undefined;

      // Persist findings to research memory (best-effort, don't block response)
      let findingId: string | undefined;
      try {
        const finding = await storeFinding({
          userId: auth.user.id,
          clientId: parsed.data.clientId,
          researchType: 'competitor',
          targetUrl: url,
          findings: { analysis, swot },
          reportMarkdown: report,
          ttlMs: 90 * 24 * 60 * 60 * 1000, // 90 days
        });
        findingId = finding.id;
      } catch (persistError) {
        log.warn('Failed to persist competitor analysis', {
          error: persistError instanceof Error ? persistError.message : 'Unknown',
        });
      }

      log.info(`Single analysis complete for ${analysis.domain}`, {
        userId: auth.user.id,
        strengths: swot.strengths.length,
        weaknesses: swot.weaknesses.length,
        findingId,
      });

      return Response.json({
        analysis,
        swot,
        report,
        findingId,
      });
    }

    // Multiple URLs: compare
    if (urls && urls.length > 0) {
      const comparison = await compareCompetitors(urls, { includeSubpages });

      // Persist comparison to research memory (best-effort)
      let findingId: string | undefined;
      try {
        const finding = await storeFinding({
          userId: auth.user.id,
          clientId: parsed.data.clientId,
          researchType: 'competitor',
          targetQuery: urls.join(', '),
          findings: { competitors: comparison.competitors, swotAnalyses: comparison.swotAnalyses, comparisonTable: comparison.comparisonTable },
          ttlMs: 90 * 24 * 60 * 60 * 1000, // 90 days
        });
        findingId = finding.id;
      } catch (persistError) {
        log.warn('Failed to persist competitor comparison', {
          error: persistError instanceof Error ? persistError.message : 'Unknown',
        });
      }

      log.info(`Comparison complete for ${comparison.competitors.length} competitors`, {
        userId: auth.user.id,
        domains: comparison.competitors.map((c) => c.domain),
        findingId,
      });

      return Response.json({ ...comparison, findingId });
    }

    return Response.json(
      { error: 'Provide either url or urls array' },
      { status: 400 },
    );
  } catch (error) {
    log.error('Competitor analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return Response.json(
      { error: error instanceof Error ? error.message : 'Analysis request failed' },
      { status: 502 },
    );
  }
}
