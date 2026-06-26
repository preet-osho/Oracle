-- ═══════════════════════════════════════
-- ORACLE — Cost Tracking & Provider Health
-- Server-side storage replacing localStorage-only modules
-- ═══════════════════════════════════════

-- ─── AI Usage Records (per-request cost tracking) ──
CREATE TABLE IF NOT EXISTS ai_usage_records (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  agent_type TEXT DEFAULT 'general',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  cost_inr REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Indexes for cost tracking queries
CREATE INDEX idx_ai_usage_user ON ai_usage_records(user_id);
CREATE INDEX idx_ai_usage_provider ON ai_usage_records(provider_id);
CREATE INDEX idx_ai_usage_created ON ai_usage_records(created_at DESC);
CREATE INDEX idx_ai_usage_user_created ON ai_usage_records(user_id, created_at DESC);

-- ─── Provider Health Records ──
CREATE TABLE IF NOT EXISTS provider_health_records (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL DEFAULT '',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Indexes for health dashboard queries
CREATE INDEX idx_provider_health_provider ON provider_health_records(provider_id);
CREATE INDEX idx_provider_health_created ON provider_health_records(created_at DESC);
CREATE INDEX idx_provider_health_provider_created ON provider_health_records(provider_id, created_at DESC);

-- ─── RLS Policies ──

-- ai_usage_records
ALTER TABLE ai_usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_service_role_full"
  ON ai_usage_records FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "ai_usage_authenticated_select_own"
  ON ai_usage_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ai_usage_anon_no_access"
  ON ai_usage_records FOR ALL
  USING (false)
  WITH CHECK (false);

-- provider_health_records
ALTER TABLE provider_health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_health_service_role_full"
  ON provider_health_records FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "provider_health_anon_no_access"
  ON provider_health_records FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Useful Views ──

-- Daily cost summary per provider
CREATE OR REPLACE VIEW v_daily_cost_summary AS
SELECT
  user_id,
  provider_id,
  model_id,
  to_timestamp(created_at / 1000) AT TIME ZONE 'UTC'::date AS day,
  COUNT(*) AS request_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_usd) AS total_cost_usd,
  SUM(cost_inr) AS total_cost_inr,
  ROUND(AVG(latency_ms)) AS avg_latency_ms,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 1) AS success_rate
FROM ai_usage_records
GROUP BY user_id, provider_id, model_id, to_timestamp(created_at / 1000) AT TIME ZONE 'UTC'::date;

-- Provider health summary (last 24h)
CREATE OR REPLACE VIEW v_provider_health_24h AS
SELECT
  provider_id,
  COUNT(*) AS total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful_requests,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS failed_requests,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 1) AS uptime_pct,
  ROUND(AVG(latency_ms)) AS avg_latency_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
  ROUND(AVG(CASE WHEN NOT success THEN NULL ELSE latency_ms END)) AS avg_success_latency_ms,
  ROUND(AVG(tokens_used)) AS avg_tokens
FROM provider_health_records
WHERE created_at > (extract(epoch from now()) * 1000)::bigint - (24 * 60 * 60 * 1000)
GROUP BY provider_id
ORDER BY total_requests DESC;

-- ─── Cleanup function (keep 90 days) ──
CREATE OR REPLACE FUNCTION cleanup_old_usage_records()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_usage_records
  WHERE created_at < (extract(epoch from now()) * 1000)::bigint - (90 * 24 * 60 * 60 * 1000);

  DELETE FROM provider_health_records
  WHERE created_at < (extract(epoch from now()) * 1000)::bigint - (90 * 24 * 60 * 60 * 1000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
