// ═══════════════════════════════════════
// ORACLE — OpenAI Embeddings
// text-embedding-3-small · pgvector storage · cosine similarity search
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('Embeddings');

// ─── Constants ────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_CHUNK_LENGTH = 8000; // Safe limit per embedding request (OpenAI allows 8191 tokens)
const BATCH_SIZE = 100; // Max embeddings per API call (OpenAI supports up to 2048)
const DEFAULT_MATCH_THRESHOLD = 0.3;
const DEFAULT_MATCH_COUNT = 5;

// ─── Singleton Clients ────────────────

let embeddingClient: SupabaseClient | null = null;

function getEmbeddingClient(): SupabaseClient | null {
  if (embeddingClient) return embeddingClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  embeddingClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return embeddingClient;
}

// ─── Types ────────────────────────────

export interface EmbeddingResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  chunkIndex: number;
}

export interface StoreEmbeddingOptions {
  documentId: string;
  chunks: string[];
}

// ─── Generate Embeddings ──────────────

/**
 * Generate embeddings for an array of text strings using OpenAI text-embedding-3-small.
 * Processes in batches of BATCH_SIZE to respect API limits.
 * Returns an array of embedding vectors (each is a number[] of length 1536).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.warn('OPENAI_API_KEY not set — cannot generate embeddings');
    return [];
  }

  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const truncatedBatch = batch.map((text) =>
      text.length > MAX_CHUNK_LENGTH ? text.slice(0, MAX_CHUNK_LENGTH) : text
    );

    try {
      const response = await fetchWithTimeout('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: truncatedBatch,
          encoding_format: 'float',
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      });

      if (!response.ok) {
        const error = await response.text();
        log.error(`OpenAI embeddings API error (${response.status})`, { error });
        // Return empty for this batch, continue with others
        allEmbeddings.push(...truncatedBatch.map(() => []));
        continue;
      }

      const data = await response.json();
      // Sort by index to maintain order
      const sorted = data.data.sort((a: { index: number }, b: { index: number }) => a.index - b.index);
      allEmbeddings.push(...sorted.map((item: { embedding: number[] }) => item.embedding));
    } catch (err) {
      log.error('Embedding generation failed', {
        error: err instanceof Error ? err.message : 'Unknown',
        batchSize: batch.length,
      });
      allEmbeddings.push(...truncatedBatch.map(() => []));
    }
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a text string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const results = await generateEmbeddings([text]);
  return results[0] || [];
}

// ─── Store Embeddings in Supabase ─────

/**
 * Store document chunk embeddings in Supabase.
 * Deletes existing chunks for the document first (idempotent re-indexing).
 */
export async function storeEmbeddings(options: StoreEmbeddingOptions): Promise<number> {
  const supabase = getEmbeddingClient();
  if (!supabase) {
    log.warn('Cannot store embeddings — Supabase not configured');
    return 0;
  }

  const { documentId, chunks } = options;

  // Generate embeddings for all chunks
  const embeddings = await generateEmbeddings(chunks);

  if (embeddings.length === 0 || embeddings.every((e) => e.length === 0)) {
    log.warn('No embeddings generated', { documentId, chunkCount: chunks.length });
    return 0;
  }

  // Delete existing chunks for this document (re-index)
  await supabase.from('document_chunks').delete().eq('document_id', documentId);

  // Insert new chunks with embeddings
  const rows = chunks.map((content, index) => ({
    id: `${documentId}_chunk_${index}`,
    document_id: documentId,
    chunk_index: index,
    content,
    embedding: embeddings[index] || [],
    created_at: Date.now(),
  }));

  // Filter out chunks with empty embeddings
  const validRows = rows.filter((r) => r.embedding.length > 0);

  if (validRows.length === 0) {
    log.warn('No valid embeddings to store', { documentId });
    return 0;
  }

  // Insert in batches (Supabase handles this well up to ~1000 rows)
  const { error } = await supabase.from('document_chunks').insert(validRows);

  if (error) {
    log.error('Failed to store embeddings', { error: error.message, documentId });
    return 0;
  }

  log.info('Stored embeddings', { documentId, chunks: validRows.length });
  return validRows.length;
}

// ─── Semantic Search ──────────────────

/**
 * Search for semantically similar document chunks using pgvector cosine similarity.
 * Falls back to empty results if embeddings are not available.
 */
export async function semanticSearch(
  query: string,
  options: {
    matchThreshold?: number;
    matchCount?: number;
    documentIds?: string[];
  } = {}
): Promise<EmbeddingResult[]> {
  const supabase = getEmbeddingClient();
  if (!supabase) {
    log.warn('Cannot perform semantic search — Supabase not configured');
    return [];
  }

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  if (queryEmbedding.length === 0) {
    log.warn('Failed to generate query embedding');
    return [];
  }

  // Call the match_documents RPC function
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: options.matchThreshold ?? DEFAULT_MATCH_THRESHOLD,
    match_count: options.matchCount ?? DEFAULT_MATCH_COUNT,
    filter_document_ids: options.documentIds ?? null,
  });

  if (error) {
    log.error('Semantic search failed', { error: error.message });
    return [];
  }

  if (!data || !Array.isArray(data)) return [];

  return data.map((row: {
    id: string;
    document_id: string;
    content: string;
    similarity: number;
    chunk_index: number;
  }) => ({
    chunkId: row.id,
    documentId: row.document_id,
    content: row.content,
    similarity: row.similarity,
    chunkIndex: row.chunk_index,
  }));
}

// ─── Delete Embeddings ────────────────

/**
 * Delete all chunk embeddings for a document.
 */
export async function deleteEmbeddings(documentId: string): Promise<void> {
  const supabase = getEmbeddingClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId);

  if (error) {
    log.error('Failed to delete embeddings', { error: error.message, documentId });
  }
}

// ─── Availability Check ───────────────

/**
 * Check if semantic search is available (both OpenAI key and Supabase configured).
 */
export function isSemanticSearchAvailable(): boolean {
  return !!(
    process.env.OPENAI_API_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
