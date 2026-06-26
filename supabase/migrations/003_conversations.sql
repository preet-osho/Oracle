-- ═══════════════════════════════════════
-- ORACLE — Conversations Table
-- Chat persistence · Message history
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title TEXT NOT NULL DEFAULT 'New Chat',
  messages JSONB NOT NULL DEFAULT '[]',
  agent_type TEXT NOT NULL DEFAULT 'orchestrator',
  project_id TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- ─── RLS Policies ──────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_conversations"
  ON conversations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_conversations"
  ON conversations FOR ALL
  USING (false)
  WITH CHECK (false);
