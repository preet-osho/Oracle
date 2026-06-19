-- ═══════════════════════════════════════
-- ORACLE — Circuit Breaker State Persistence
-- Survives serverless cold starts by storing state in Supabase
-- ═══════════════════════════════════════

-- One row per provider with current circuit state
CREATE TABLE IF NOT EXISTS circuit_breakers (
  provider_id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half-open')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_failure_at BIGINT,
  last_success_at BIGINT,
  opened_at BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Index for quick lookups by state
CREATE INDEX idx_circuit_breakers_state ON circuit_breakers(state);

-- RLS: only service role can access (this is internal infrastructure, not user data)
ALTER TABLE circuit_breakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circuit_breakers_service_role_full"
  ON circuit_breakers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "circuit_breakers_anon_no_access"
  ON circuit_breakers FOR ALL
  USING (false)
  WITH CHECK (false);

-- Cleanup function: remove circuits that have been closed for > 1 hour
-- (stale entries from providers that recovered long ago)
CREATE OR REPLACE FUNCTION cleanup_closed_circuits()
RETURNS void AS $$
BEGIN
  DELETE FROM circuit_breakers
  WHERE state = 'closed'
    AND updated_at < (extract(epoch from now()) * 1000)::bigint - (60 * 60 * 1000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
