// ═══════════════════════════════════════
// ORACLE — Content Extraction API Route
// POST /api/research/extract
// Extracts clean readable content from any URL
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody } from '@/lib/validations';
import { enforceRateLimit, WEB_SEARCH_RATE_LIMIT } from '@/lib/rate-limit';
import { extractContent, extractBatch } from '@/lib/research/extractor';
import { z } from 'zod';

// ─── Validation Schema ─────────────────

const ExtractSingleSchema = z.object({
  url: z.string().url('Must be a valid URL').max(2000),
  provider: z.enum(['jina', 'firecrawl', 'raw']).optional(),
  maxContentLength: z.number().int().min(100).max(200_000).optional(),
  includeHtml: z.boolean().optional(),
});

const ExtractBatchSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
  provider: z.enum(['jina', 'firecrawl', 'raw']).optional(),
  maxContentLength: z.number().int().min(100).max(200_000).optional(),
  concurrency: z.number().int().min(1).max(5).optional(),
});

// ─── POST /api/research/extract ────────

export async function POST(request: NextRequest) {
  // Auth
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  // Rate limit
  const rl = await enforceRateLimit('research:extract', auth.user.id, WEB_SEARCH_RATE_LIMIT);
  if (rl) return rl;

  // Parse body
  const rawBody = await request.json();

  // Detect batch vs single by checking for 'urls' array
  if (rawBody.urls && Array.isArray(rawBody.urls)) {
    // ── Batch extraction ──
    const validation = validateBody(rawBody, ExtractBatchSchema);
    if ('error' in validation) return validation.error;

    const results = await extractBatch(
      validation.data.urls,
      {
        provider: validation.data.provider,
        maxContentLength: validation.data.maxContentLength,
      },
      validation.data.concurrency,
    );

    const succeeded = results.filter((r) => r.result);
    const failed = results.filter((r) => r.error);

    return NextResponse.json({
      success: failed.length === 0,
      total: results.length,
      succeeded: succeeded.length,
      failed: failed.length,
      results: results.map((r) => ({
        url: r.url,
        ...(r.result
          ? {
              title: r.result.title,
              wordCount: r.result.metadata.wordCount,
              provider: r.result.provider,
              content: r.result.content,
              metadata: r.result.metadata,
            }
          : { error: r.error }),
      })),
    });
  }

  // ── Single extraction ──
  const validation = validateBody(rawBody, ExtractSingleSchema);
  if ('error' in validation) return validation.error;

  try {
    const result = await extractContent(validation.data.url, {
      provider: validation.data.provider,
      maxContentLength: validation.data.maxContentLength,
      includeHtml: validation.data.includeHtml,
    });

    return NextResponse.json({
      success: true,
      title: result.title,
      content: result.content,
      html: result.html,
      metadata: result.metadata,
      provider: result.provider,
      url: result.url,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Extraction failed',
        url: validation.data.url,
      },
      { status: 502 },
    );
  }
}

// ─── GET /api/research/extract ─────────

export async function GET() {
  return NextResponse.json({
    usage: 'POST to extract content from URLs. Body: { url } or { urls: [...] }',
    providers: {
      jina: 'Best quality, requires JINA_API_KEY',
      firecrawl: 'Good for JS-heavy pages, requires FIRECRAWL_API_KEY',
      raw: 'Basic fallback, no API key needed',
    },
    rateLimit: `${WEB_SEARCH_RATE_LIMIT.maxRequests} requests per minute`,
  });
}
