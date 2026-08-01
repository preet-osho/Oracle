-- ═══════════════════════════════════════
-- ORACLE — Workflow Templates
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#3b82f6',
  estimated_time TEXT DEFAULT '1-2 hours',
  domains TEXT[] DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  is_builtin BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- Index for fast lookups by org
CREATE INDEX IF NOT EXISTS idx_workflow_templates_org ON workflow_templates(org_id);

-- RLS policies
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see templates from their organization
CREATE POLICY "Users can view own org workflow templates"
  ON workflow_templates FOR SELECT
  USING (org_id = (SELECT org_id FROM user_organizations WHERE user_id = auth.uid() LIMIT 1));

-- Users can insert templates for their organization
CREATE POLICY "Users can insert own org workflow templates"
  ON workflow_templates FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM user_organizations WHERE user_id = auth.uid() LIMIT 1));

-- Users can update templates in their organization
CREATE POLICY "Users can update own org workflow templates"
  ON workflow_templates FOR UPDATE
  USING (org_id = (SELECT org_id FROM user_organizations WHERE user_id = auth.uid() LIMIT 1));

-- Users can delete non-builtin templates from their organization
CREATE POLICY "Users can delete own org workflow templates"
  ON workflow_templates FOR DELETE
  USING (org_id = (SELECT org_id FROM user_organizations WHERE user_id = auth.uid() LIMIT 1) AND is_builtin = FALSE);
