-- ═══════════════════════════════════════
-- ORACLE — Rate Limit Analytics
-- Views and functions for abuse pattern analysis
-- ═══════════════════════════════════════

-- ─── View: Top blocked users (last 24h) ──
CREATE OR REPLACE VIEW rate_limit_top_blocked_users AS
SELECT
  user_id,
  COUNT(*) AS blocked_count,
  COUNT(DISTINCT entity_type) AS endpoints_hit,
  MIN(created_at) AS first_blocked,
  MAX(created_at) AS last_blocked,
  MAX(metadata->>'remaining')::int AS lowest_remaining
FROM audit_logs
WHERE action = 'security.rate_limit_exceeded'
  AND created_at > (extract(epoch from now()) * 1000)::bigint - (24 * 60 * 60 * 1000)
GROUP BY user_id
ORDER BY blocked_count DESC;

-- ─── View: Hourly blocked request distribution (last 7 days) ──
CREATE OR REPLACE VIEW rate_limit_hourly_distribution AS
SELECT
  to_timestamp(created_at / 1000) AT DATE 'UTC' AS hour_bucket,
  action,
  entity_type,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM audit_logs
WHERE action IN ('security.rate_limit_exceeded', 'security.rate_limit_warning')
  AND created_at > (extract(epoch from now()) * 1000)::bigint - (7 * 24 * 60 * 60 * 1000)
GROUP BY hour_bucket, action, entity_type
ORDER BY hour_bucket DESC;

-- ─── View: Per-endpoint abuse summary (last 7 days) ──
CREATE OR REPLACE VIEW rate_limit_endpoint_summary AS
SELECT
  entity_type AS endpoint,
  action,
  COUNT(*) AS total_events,
  COUNT(DISTINCT user_id) AS unique_users,
  ROUND(AVG((metadata->>'remaining')::int), 1) AS avg_remaining_at_event,
  MIN((metadata->>'remaining')::int) AS min_remaining
FROM audit_logs
WHERE action IN ('security.rate_limit_exceeded', 'security.rate_limit_warning')
  AND created_at > (extract(epoch from now()) * 1000)::bigint - (7 * 24 * 60 * 60 * 1000)
GROUP BY entity_type, action
ORDER BY total_events DESC;

-- ─── Function: User abuse score (0-100) ──
-- Higher score = more likely abuse. Combines frequency, recency, and breadth.
CREATE OR REPLACE FUNCTION get_user_abuse_score(target_user_id UUID)
RETURNS TABLE (
  score INT,
  blocked_count_24h INT,
  warning_count_24h INT,
  endpoints_affected INT,
  last_event_at BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    LEAST(100,
      (blocked_24h * 10) +           -- 10 points per block
      (warning_24h * 3) +            -- 3 points per warning
      (endpoints * 5)                -- 5 points per endpoint affected
    )::int AS score,
    blocked_24h,
    warning_24h,
    endpoints,
    last_event
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE action = 'security.rate_limit_exceeded')::int AS blocked_24h,
      COUNT(*) FILTER (WHERE action = 'security.rate_limit_warning')::int AS warning_24h,
      COUNT(DISTINCT entity_type)::int AS endpoints,
      MAX(created_at) AS last_event
    FROM audit_logs
    WHERE user_id = target_user_id
      AND action IN ('security.rate_limit_exceeded', 'security.rate_limit_warning')
      AND created_at > (extract(epoch from now()) * 1000)::bigint - (24 * 60 * 60 * 1000)
  ) sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── View: Users with high abuse scores ──
CREATE OR REPLACE VIEW rate_limit_high_risk_users AS
SELECT
  user_id,
  get_user_abuse_score(user_id) AS abuse_info
FROM (
  SELECT DISTINCT user_id
  FROM audit_logs
  WHERE action IN ('security.rate_limit_exceeded', 'security.rate_limit_warning')
    AND created_at > (extract(epoch from now()) * 1000)::bigint - (24 * 60 * 60 * 1000)
) recent_users
ORDER BY (get_user_abuse_score(user_id)).score DESC
LIMIT 50;
