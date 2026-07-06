-- ═══════════════════════════════════════
-- ORACLE — Research Findings Memory
-- Persists competitor analysis, market research,
-- website audits, and lead intel across sessions
-- ═══════════════════════════════════════

-- ─── Research Findings Table ──────────

CREATE TABLE IF NOT EXISTS research_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES client_projects(id) ON DELETE SET NULL,
  research_type TEXT NOT NULL CHECK (research_type IN ('competitor', 'market', 'website-audit', 'lead-intel', 'content-extract')),
  target_url TEXT,
  target_query TEXT,
  findings JSONB NOT NULL DEFAULT '{}',
  report_markdown TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  expires_at BIGINT
);

-- ─── Indexes ───────────────────────────

CREATE INDEX IF NOT EXISTS idx_research_findings_user_id ON research_findings(user_id);
CREATE INDEX IF NOT EXISTS idx_research_findings_client_id ON research_findings(client_id);
CREATE INDEX IF NOT EXISTS idx_research_findings_research_type ON research_findings(research_type);
CREATE INDEX IF NOT EXISTS idx_research_findings_target_url ON research_findings(target_url);
CREATE INDEX IF NOT EXISTS idx_research_findings_created_at ON research_findings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_findings_expires_at ON research_findings(expires_at) WHERE expires_at IS NOT NULL;

-- Composite index for common query: user's findings by type, newest first
CREATE INDEX IF NOT EXISTS idx_research_findings_user_type
  ON research_findings(user_id, research_type, created_at DESC);

-- ─── RLS Policies ──────────────────────

ALTER TABLE research_findings ENABLE ROW LEVEL SECURITY;

-- Users can read their own findings
CREATE POLICY "Users can read own findings"
  ON research_findings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own findings
CREATE POLICY "Users can insert own findings"
  ON research_findings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own findings
CREATE POLICY "Users can update own findings"
  ON research_findings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own findings
CREATE POLICY "Users can delete own findings"
  ON research_findings FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for background jobs, cleanup)
CREATE POLICY "Service role full access"
  ON research_findings FOR ALL
  USING (auth.role() = 'service_role');
