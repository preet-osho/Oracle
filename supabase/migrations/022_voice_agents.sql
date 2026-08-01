-- ═══════════════════════════════════════
-- ORACLE — Voice Agents & Call Logs
-- ═══════════════════════════════════════

-- Voice agents table
CREATE TABLE IF NOT EXISTS voice_agents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('vapi', 'sarvam', 'elevenlabs', 'bland')),
  voice TEXT NOT NULL DEFAULT 'Aria (Female, Professional)',
  language TEXT NOT NULL DEFAULT 'English',
  greeting TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  tools TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Call logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES voice_agents(id) ON DELETE CASCADE,
  caller_number TEXT NOT NULL DEFAULT '',
  duration INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'missed', 'failed', 'in-progress')),
  transcript TEXT DEFAULT '',
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  summary TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_agents_org ON voice_agents(org_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_org ON call_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent ON call_logs(agent_id);

-- RLS policies
ALTER TABLE voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- voice_agents: users can manage their org's agents
CREATE POLICY "voice_agents_org_select" ON voice_agents
  FOR SELECT USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "voice_agents_org_insert" ON voice_agents
  FOR INSERT WITH CHECK (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "voice_agents_org_update" ON voice_agents
  FOR UPDATE USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "voice_agents_org_delete" ON voice_agents
  FOR DELETE USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

-- call_logs: users can manage their org's logs
CREATE POLICY "call_logs_org_select" ON call_logs
  FOR SELECT USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "call_logs_org_insert" ON call_logs
  FOR INSERT WITH CHECK (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');

CREATE POLICY "call_logs_org_update" ON call_logs
  FOR UPDATE USING (org_id = current_setting('request.jwt.claims', true)::json->>'org_id');
