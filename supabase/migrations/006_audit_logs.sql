-- ═══════════════════════════════════════
-- ORACLE — Audit Logs Schema
-- Track API and user actions for compliance
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ─── RLS Policies ────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role: full access (for server-side logging)
CREATE POLICY "audit_logs_service_role_full"
  ON audit_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users: can insert (log their own actions) and read their own
CREATE POLICY "audit_logs_insert_authenticated"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "audit_logs_select_own"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Anon: no access
CREATE POLICY "audit_logs_anon_no_access"
  ON audit_logs FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Auto-cleanup: keep logs for 90 days ──
-- This can be run as a pg_cron job or Supabase Edge Function
-- SELECT cleanup_old_audit_logs();

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < (extract(epoch from now()) * 1000)::bigint - (90 * 24 * 60 * 60 * 1000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
