// ═══════════════════════════════════════
// ORACLE — Knowledge Docs Re-index API
// POST /api/knowledge-docs/reindex — re-embeds all documents with pgvector
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { getSupabaseServer } from '@/lib/supabase';
import { chunkText } from '@/lib/rag';
import { storeEmbeddings, isSemanticSearchAvailable } from '@/lib/embeddings';
import { createLogger } from '@/lib/logger';

const log = createLogger('KnowledgeDocsReindex');

export async function POST() {
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });

  // 2. Check if semantic search is available
  if (!isSemanticSearchAvailable()) {
    return NextResponse.json(
      { error: 'Semantic search not configured. Set OPENAI_API_KEY and Supabase credentials.' },
      { status: 400 }
    );
  }

  // 3. Fetch all knowledge docs for this user
  const supabase = getSupabaseServer();
  const { data: docs, error: fetchError } = await supabase
    .from('knowledge_docs')
    .select('id, name, content')
    .order('created_at', { ascending: false });

  if (fetchError) {
    log.error('Failed to fetch knowledge docs', { error: fetchError.message });
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }

  if (!docs || docs.length === 0) {
    return NextResponse.json({ indexed: 0, total: 0, message: 'No documents to index' });
  }

  // 4. Index each document (generate embeddings + store in pgvector)
  let indexed = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      const chunks = chunkText(doc.content);
      if (chunks.length === 0) continue;

      const stored = await storeEmbeddings({
        documentId: doc.id,
        chunks,
      });

      if (stored > 0) {
        indexed++;
        log.info('Document re-indexed', { documentId: doc.id, name: doc.name, chunks: stored });
      } else {
        failed++;
        log.warn('Document re-indexing produced no embeddings', { documentId: doc.id, name: doc.name });
      }
    } catch (err) {
      failed++;
      log.error('Failed to re-index document', {
        documentId: doc.id,
        name: doc.name,
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }
  }

  log.info('Re-indexing complete', { indexed, failed, total: docs.length });

  return NextResponse.json({
    indexed,
    failed,
    total: docs.length,
    message: `Re-indexed ${indexed}/${docs.length} documents` + (failed > 0 ? ` (${failed} failed)` : ''),
  });
}
