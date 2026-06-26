-- ═══════════════════════════════════════
-- ORACLE — pgvector Semantic Search
-- Replaces TF-IDF with OpenAI embeddings + cosine similarity
-- ═══════════════════════════════════════

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Document Chunks with Embeddings ──
-- Each chunk of a document gets its own row with a vector embedding
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  document_id TEXT NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Indexes
CREATE INDEX idx_document_chunks_doc ON document_chunks(document_id);

-- HNSW index for fast approximate nearest neighbor search
-- Using cosine distance operator (vector_cosine_ops)
CREATE INDEX idx_document_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- ─── Match Documents Function ──
-- Finds the most semantically similar chunks to a query embedding
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_document_ids text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  document_id text,
  content text,
  similarity float,
  chunk_index integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.chunk_index
  FROM document_chunks dc
  WHERE
    -- Apply document filter if provided
    (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
    -- Apply similarity threshold
    AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─── RLS Policies ──
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_chunks_service_role_full"
  ON document_chunks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "document_chunks_authenticated_select"
  ON document_chunks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "document_chunks_anon_no_access"
  ON document_chunks FOR ALL
  USING (false)
  WITH CHECK (false);
