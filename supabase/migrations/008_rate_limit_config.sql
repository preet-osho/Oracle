-- ═══════════════════════════════════════
-- ORACLE — Rate Limit Configuration
-- Runtime-adjustable rate limits per endpoint
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_limit_config (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  endpoint TEXT NOT NULL UNIQUE,
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Seed with current defaults
INSERT INTO rate_limit_config (endpoint, max_requests, window_seconds) VALUES
  ('ai_chat', 10, 60),
  ('web_search', 15, 60),
  ('api_write', 30, 60),
  ('api_read', 100, 60)
ON CONFLICT (endpoint) DO NOTHING;

-- RLS: service role full access, authenticated read
ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_config_service_role_full"
  ON rate_limit_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "rate_config_authenticated_read"
  ON rate_limit_config FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "rate_config_authenticated_update"
  ON rate_limit_config FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
