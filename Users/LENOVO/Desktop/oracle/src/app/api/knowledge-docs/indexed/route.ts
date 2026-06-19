// ═══════════════════════════════════════
// ORACLE — Knowledge Docs Index Status API
// GET /api/knowledge-docs/indexed — returns which docs have pgvector embeddings
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { enforceRateLimit } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('KnowledgeDocsIndexed');

export async function GET() {
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  // 2. Get user's doc IDs first (RLS-scoped), then check which have chunks
  const { supabase } = auth;
  const { data: docs } = await supabase
    .from('knowledge_docs')
    .select('id')
    .eq('user_id', auth.user.id);

  if (!docs || docs.length === 0) {
    return NextResponse.json({ indexedIds: [] });
  }

  const userDocIds = docs.map((d: { id: string }) => d.id);

  // 3. Query distinct document_ids that have at least one chunk
  const { data, error } = await supabase
    .from('document_chunks')
    .select('document_id')
    .in('document_id', userDocIds)
    .limit(1000);

  if (error) {
    // Table might not exist yet (migration not run) — return empty
    log.warn('Failed to query document_chunks (migration may not be run)', { error: error.message });
    return NextResponse.json({ indexedIds: [] });
  }

  // Deduplicate to get unique document IDs
  const indexedIds = [...new Set((data ?? []).map((row: { document_id: string }) => row.document_id))];

  return NextResponse.json({ indexedIds });
}

// ─── DELETE ───────────────────────────

export async function DELETE() {
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  // 2. Rate limit
  const rl = await enforceRateLimit('knowledge-docs', auth.user.id);
  if (rl) return rl;

  // 3. Get user's doc IDs (RLS-scoped), then delete their chunks
  const { supabase } = auth;
  const { data: docs } = await supabase
    .from('knowledge_docs')
    .select('id')
    .eq('user_id', auth.user.id);

  if (!docs || docs.length === 0) {
    return NextResponse.json({ deleted: 0, message: 'No documents to clear' });
  }

  const userDocIds = docs.map((d: { id: string }) => d.id);

  // 4. Delete all chunks belonging to user's documents
  const { error, count } = await supabase
    .from('document_chunks')
    .delete()
    .in('document_id', userDocIds);

  if (error) {
    // Table might not exist yet (migration not run)
    log.warn('Failed to delete document_chunks (migration may not be run)', { error: error.message });
    return NextResponse.json({ deleted: 0, message: 'No embeddings to clear (migration may not be run)' });
  }

  log.info('Cleared all embeddings', { userId: auth.user.id, docCount: userDocIds.length, chunksDeleted: count ?? 0 });

  return NextResponse.json({
    deleted: count ?? 0,
    message: `Cleared ${count ?? 0} chunks across ${userDocIds.length} documents`,
  });
}
