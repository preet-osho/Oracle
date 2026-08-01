-- ═══════════════════════════════════════
-- ORACLE — Custom Agents
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS custom_agents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  task_focus TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  default_tier TEXT NOT NULL DEFAULT 'standard',
  default_provider_id TEXT,
  default_model_id TEXT,
  tools TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_custom_agents_org ON custom_agents(org_id);

ALTER TABLE custom_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_agents_org_select" ON custom_agents
  FOR SELECT USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "custom_agents_org_insert" ON custom_agents
  FOR INSERT WITH CHECK (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "custom_agents_org_update" ON custom_agents
  FOR UPDATE USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "custom_agents_org_delete" ON custom_agents
  FOR DELETE USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');
