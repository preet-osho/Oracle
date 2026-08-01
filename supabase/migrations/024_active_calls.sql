-- ═══════════════════════════════════════
-- ORACLE — Active Calls (Live Status Tracking)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS active_calls (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
  vapi_call_id TEXT NOT NULL,
  caller_number TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'in-progress', 'forwarding', 'ended')),
  started_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_active_calls_org ON active_calls(org_id);
CREATE INDEX IF NOT EXISTS idx_active_calls_agent ON active_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_active_calls_status ON active_calls(status);

ALTER TABLE active_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_calls_org_select" ON active_calls
  FOR SELECT USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "active_calls_org_insert" ON active_calls
  FOR INSERT WITH CHECK (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "active_calls_org_update" ON active_calls
  FOR UPDATE USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "active_calls_org_delete" ON active_calls
  FOR DELETE USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');
