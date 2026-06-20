// ═══════════════════════════════════════
// ORACLE — Single Knowledge Doc Re-index API
// POST /api/knowledge-docs/[id]/reindex — re-embeds a single document with pgvector
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { enforceRateLimit } from '@/lib/rate-limit';
import { chunkText } from '@/lib/rag';
import { storeEmbeddings, isSemanticSearchAvailable } from '@/lib/embeddings';
import { createLogger } from '@/lib/logger';

const log = createLogger('KnowledgeDocReindex');

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });

  // 2. Rate limit
  const rl = await enforceRateLimit('knowledge-docs', auth.user.id);
  if (rl) return rl;

  // 3. Check if semantic search is available
  if (!isSemanticSearchAvailable()) {
    return NextResponse.json(
      { error: 'Semantic search not configured. Set OPENAI_API_KEY and Supabase credentials.' },
      { status: 400 }
    );
  }

  // 4. Fetch the specific document
  const { supabase } = auth;
  const { data: doc, error: fetchError } = await supabase
    .from('knowledge_docs')
    .select('id, name, content')
    .eq('id', id)
    .eq('org_id', auth.org.orgId)
    .single();

  if (fetchError || !doc) {
    log.warn('Document not found', { documentId: id, error: fetchError?.message });
    return NextResponse.json(
      { error: 'Document not found' },
      { status: 404 }
    );
  }

  // 5. Generate embeddings + store in pgvector
  try {
    const chunks = chunkText(doc.content);
    if (chunks.length === 0) {
      return NextResponse.json({ indexed: false, chunks: 0, message: 'Document has no content to index' });
    }

    const stored = await storeEmbeddings({
      documentId: doc.id,
      chunks,
    });

    log.info('Document re-indexed', { documentId: doc.id, name: doc.name, chunks: stored });

    return NextResponse.json({
      indexed: stored > 0,
      chunks: stored,
      message: stored > 0
        ? `Re-indexed "${doc.name}" (${stored} chunks)`
        : `No embeddings generated for "${doc.name}"`,
    });
  } catch (err) {
    log.error('Failed to re-index document', {
      documentId: doc.id,
      name: doc.name,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return NextResponse.json(
      { error: `Failed to re-index "${doc.name}"` },
      { status: 500 }
    );
  }
}
