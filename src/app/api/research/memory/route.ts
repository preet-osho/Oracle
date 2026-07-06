// ═══════════════════════════════════════
// ORACLE — Research Memory API
// POST/GET/DELETE /api/research/memory
// Persist analysis findings across sessions
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { checkRateLimit, API_RATE_LIMIT } from '@/lib/rate-limit';
import { validateBody, StoreResearchFindingSchema, ListResearchFindingsSchema, DeleteResearchFindingSchema } from '@/lib/validations';
import {
  storeFinding,
  listFindings,
  getFinding,
  deleteFinding,
  countFindings,
} from '@/lib/research/memory';
import { createLogger } from '@/lib/logger';

const log = createLogger('ResearchMemoryAPI');

// ─── POST: Store a Finding ────────────

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return Response.json({ error: 'No organization found.' }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(`api:write:research-memory:${auth.user.id}`, API_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateBody(body, StoreResearchFindingSchema);
  if (parsed.error) return parsed.error;

  try {
    const finding = await storeFinding({
      userId: auth.user.id,
      clientId: parsed.data.clientId,
      researchType: parsed.data.researchType,
      targetUrl: parsed.data.targetUrl,
      targetQuery: parsed.data.targetQuery,
      findings: parsed.data.findings,
      reportMarkdown: parsed.data.reportMarkdown,
      ttlMs: parsed.data.ttlMs,
    });

    log.info('Stored research finding', { userId: auth.user.id, researchType: parsed.data.researchType });
    return Response.json(finding, { status: 201 });
  } catch (error) {
    log.error('Failed to store finding', { error: error instanceof Error ? error.message : 'Unknown' });
    return Response.json({ error: error instanceof Error ? error.message : 'Storage failed' }, { status: 500 });
  }
}

// ─── GET: List or Get Findings ────────

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return Response.json({ error: 'No organization found.' }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(`api:read:research-memory:${auth.user.id}`, API_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const findingId = searchParams.get('id');

  // Single finding by ID
  if (findingId) {
    const finding = await getFinding(findingId, auth.user.id);
    if (!finding) {
      return Response.json({ error: 'Finding not found or expired' }, { status: 404 });
    }
    return Response.json(finding);
  }

  // List findings with filters
  const listParams = {
    userId: auth.user.id,
    clientId: searchParams.get('clientId') || undefined,
    researchType: searchParams.get('researchType') as 'competitor' | 'market' | 'website-audit' | 'lead-intel' | 'content-extract' | undefined,
    targetUrl: searchParams.get('targetUrl') || undefined,
    limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    offset: parseInt(searchParams.get('offset') || '0'),
    includeExpired: searchParams.get('includeExpired') === 'true',
  };

  const parsed = validateBody(listParams, ListResearchFindingsSchema);
  if (parsed.error) return parsed.error;

  try {
    const findings = await listFindings(parsed.data);
    // Get total count for pagination
    const totalCount = await countFindings({
      userId: auth.user.id,
      researchType: parsed.data.researchType,
      clientId: parsed.data.clientId,
      includeExpired: parsed.data.includeExpired,
    });
    return Response.json({
      findings,
      count: findings.length,
      totalCount,
      hasMore: (parsed.data.offset || 0) + findings.length < totalCount,
    });
  } catch (error) {
    log.error('Failed to list findings', { error: error instanceof Error ? error.message : 'Unknown' });
    return Response.json({ error: error instanceof Error ? error.message : 'List failed' }, { status: 500 });
  }
}

// ─── DELETE: Remove a Finding ─────────

export async function DELETE(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return Response.json({ error: 'No organization found.' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateBody(body, DeleteResearchFindingSchema);
  if (parsed.error) return parsed.error;

  try {
    await deleteFinding(parsed.data.id, auth.user.id);
    log.info('Deleted research finding', { userId: auth.user.id, id: parsed.data.id });
    return Response.json({ success: true });
  } catch (error) {
    log.error('Failed to delete finding', { error: error instanceof Error ? error.message : 'Unknown' });
    return Response.json({ error: error instanceof Error ? error.message : 'Delete failed' }, { status: 500 });
  }
}
