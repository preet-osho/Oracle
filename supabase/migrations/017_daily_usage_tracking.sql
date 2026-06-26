-- ═══════════════════════════════════════
-- ORACLE — Daily Usage Tracking
-- Tracks per-user, per-day AI request counts for plan enforcement
-- ═══════════════════════════════════════

-- Daily usage tracking table
CREATE TABLE IF NOT EXISTS daily_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  ai_requests INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (user_id, date)
);

-- Index for efficient lookups by user and date
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);

-- RLS policies
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "Users can read own daily usage"
  ON daily_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update (for the increment function)
CREATE POLICY "Service role can manage daily usage"
  ON daily_usage FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_daily_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_daily_usage_updated_at
  BEFORE UPDATE ON daily_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_usage_updated_at();
