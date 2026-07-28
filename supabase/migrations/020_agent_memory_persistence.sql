-- ═══════════════════════════════════════
-- ORACLE — Agent Memory Persistence
-- Replaces in-memory Map with Supabase tables + pgvector
-- Supports semantic search, category filtering, and importance scoring
-- ═══════════════════════════════════════

-- ─── Agent Memories Table ─────────────
-- Long-term persistent memory for agents across sessions

CREATE TABLE IF NOT EXISTS agent_memories (
  id TEXT PRIMARY KEY DEFAULT 'mem_' || replace(gen_random_uuid()::text, '-', ''),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('preference', 'fact', 'feedback', 'decision', 'contact', 'sop', 'lesson', 'workflow')),
  importance SMALLINT NOT NULL DEFAULT 2 CHECK (importance IN (1, 2, 3)),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  embedding vector(1536),
  access_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
  last_accessed_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
);

-- ─── Indexes ──────────────────────────

-- Primary query patterns: user's memories for a specific agent
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_agent
  ON agent_memories(user_id, agent_id);

-- Category filtering within agent
CREATE INDEX IF NOT EXISTS idx_agent_memories_category
  ON agent_memories(user_id, agent_id, category);

-- Importance filtering
CREATE INDEX IF NOT EXISTS idx_agent_memories_importance
  ON agent_memories(user_id, agent_id, importance);

-- Recency queries (most recently accessed)
CREATE INDEX IF NOT EXISTS idx_agent_memories_last_accessed
  ON agent_memories(user_id, agent_id, last_accessed_at DESC);

-- Creation time queries
CREATE INDEX IF NOT EXISTS idx_agent_memories_created
  ON agent_memories(user_id, created_at DESC);

-- Tag search (GIN index for JSONB array contains)
CREATE INDEX IF NOT EXISTS idx_agent_memories_tags
  ON agent_memories USING gin(tags);

-- HNSW index for fast approximate nearest neighbor search (semantic search)
-- Using cosine distance operator for embedding similarity
CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding
  ON agent_memories USING hnsw (embedding vector_cosine_ops);

-- ─── Semantic Search Function ──────────
-- Finds memories most similar to a query embedding.
-- If query_embedding is NULL, falls back to recent memories (no semantic ranking).

CREATE OR REPLACE FUNCTION match_agent_memories(
  query_embedding vector(1536) DEFAULT NULL::vector(1536),
  match_user_id uuid DEFAULT NULL,
  match_agent_id text DEFAULT NULL,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_category text DEFAULT NULL,
  filter_min_importance smallint DEFAULT NULL
)
RETURNS TABLE (
  id text,
  agent_id text,
  content text,
  category text,
  importance smallint,
  tags jsonb,
  metadata jsonb,
  similarity float,
  access_count integer,
  created_at bigint,
  updated_at bigint,
  last_accessed_at bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- If no embedding provided, return recent memories (no semantic ranking)
  IF query_embedding IS NULL THEN
    RETURN QUERY
    SELECT
      am.id,
      am.agent_id,
      am.content,
      am.category,
      am.importance,
      am.tags,
      am.metadata,
      0.0::float AS similarity,
      am.access_count,
      am.created_at,
      am.updated_at,
      am.last_accessed_at
    FROM agent_memories am
    WHERE
      am.user_id = match_user_id
      AND (match_agent_id IS NULL OR am.agent_id = match_agent_id)
      AND (filter_category IS NULL OR am.category = filter_category)
      AND (filter_min_importance IS NULL OR am.importance >= filter_min_importance)
    ORDER BY am.last_accessed_at DESC
    LIMIT match_count;
    RETURN;
  END IF;

  -- Semantic search with embedding similarity
  RETURN QUERY
  SELECT
    am.id,
    am.agent_id,
    am.content,
    am.category,
    am.importance,
    am.tags,
    am.metadata,
    1 - (am.embedding <=> query_embedding) AS similarity,
    am.access_count,
    am.created_at,
    am.updated_at,
    am.last_accessed_at
  FROM agent_memories am
  WHERE
    am.user_id = match_user_id
    AND (match_agent_id IS NULL OR am.agent_id = match_agent_id)
    AND (filter_category IS NULL OR am.category = filter_category)
    AND (filter_min_importance IS NULL OR am.importance >= filter_min_importance)
    AND am.embedding IS NOT NULL
    AND (1 - (am.embedding <=> query_embedding)) > match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─── Access Count Increment Function ──

CREATE OR REPLACE FUNCTION increment_agent_memory_access(
  memory_ids text[]
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE agent_memories
  SET access_count = access_count + 1
  WHERE id = ANY(memory_ids);
$$;

-- ─── Memory Stats Function ─────────────
-- Returns aggregate statistics for an agent's memories

CREATE OR REPLACE FUNCTION get_agent_memory_stats(
  stats_user_id uuid,
  stats_agent_id text
)
RETURNS TABLE (
  total_memories bigint,
  by_category jsonb,
  by_importance jsonb,
  avg_access_count numeric,
  oldest_memory bigint,
  newest_memory bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_memories,
    COALESCE(
      (SELECT jsonb_object_agg(category, cnt)
       FROM (SELECT category, COUNT(*) AS cnt
             FROM agent_memories
             WHERE user_id = stats_user_id AND agent_id = stats_agent_id
             GROUP BY category) sub),
      '{}'::jsonb
    ) AS by_category,
    COALESCE(
      (SELECT jsonb_object_agg(importance::text, cnt)
       FROM (SELECT importance, COUNT(*) AS cnt
             FROM agent_memories
             WHERE user_id = stats_user_id AND agent_id = stats_agent_id
             GROUP BY importance) sub),
      '{}'::jsonb
    ) AS by_importance,
    COALESCE(
      (SELECT AVG(access_count)::numeric FROM agent_memories
       WHERE user_id = stats_user_id AND agent_id = stats_agent_id),
      0::numeric
    ) AS avg_access_count,
    COALESCE(
      (SELECT MIN(created_at) FROM agent_memories
       WHERE user_id = stats_user_id AND agent_id = stats_agent_id),
      0
    )::bigint AS oldest_memory,
    COALESCE(
      (SELECT MAX(created_at) FROM agent_memories
       WHERE user_id = stats_user_id AND agent_id = stats_agent_id),
      0
    )::bigint AS newest_memory;
END;
$$;

-- ─── Memory Pruning Function ───────────
-- Removes old/low-importance memories, keeping the most accessed.
-- Uses a CTE for efficient single-query delete.

CREATE OR REPLACE FUNCTION prune_agent_memories(
  prune_user_id uuid,
  prune_agent_id text,
  max_age_days integer DEFAULT 90,
  min_importance smallint DEFAULT NULL,
  keep_recent integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff_timestamp bigint;
  removed_count integer := 0;
BEGIN
  -- Calculate cutoff timestamp in milliseconds
  cutoff_timestamp := (EXTRACT(EPOCH FROM NOW()) - (max_age_days * 86400)) * 1000;

  -- Single CTE: identify excess memories, then delete
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY last_accessed_at DESC) AS rn
    FROM agent_memories
    WHERE user_id = prune_user_id AND agent_id = prune_agent_id
  )
  DELETE FROM agent_memories
  WHERE id IN (
    SELECT id FROM ranked
    WHERE rn > keep_recent
  )
  AND (
    created_at < cutoff_timestamp
    OR (min_importance IS NOT NULL AND importance < min_importance)
  );

  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count;
END;
$$;

-- ─── Update Timestamps Trigger ─────────

CREATE OR REPLACE FUNCTION update_agent_memory_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_agent_memory_updated ON agent_memories;

CREATE TRIGGER trigger_agent_memory_updated
  BEFORE UPDATE ON agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_memory_timestamp();

-- ─── RLS Policies ──────────────────────

ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- Users can read their own memories
CREATE POLICY "Users can read own agent memories"
  ON agent_memories FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own memories
CREATE POLICY "Users can insert own agent memories"
  ON agent_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own memories
CREATE POLICY "Users can update own agent memories"
  ON agent_memories FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own memories
CREATE POLICY "Users can delete own agent memories"
  ON agent_memories FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for background jobs, admin operations)
CREATE POLICY "Service role full access on agent memories"
  ON agent_memories FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Grants ────────────────────────────

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION match_agent_memories TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_memory_stats TO authenticated;
GRANT EXECUTE ON FUNCTION prune_agent_memories TO authenticated;
GRANT EXECUTE ON FUNCTION increment_agent_memory_access TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_memories TO authenticated;
