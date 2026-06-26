-- ═══════════════════════════════════════
-- ORACLE — User Subscriptions
-- Track subscription status for access enforcement
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('starter', 'pro', 'agency')),
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('active', 'trialing', 'expired', 'cancelled', 'none')),
  trial_ends_at BIGINT,
  current_period_end BIGINT,
  razorpay_order_id TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);

-- Only allow one active/trialing subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_active 
  ON user_subscriptions(user_id) 
  WHERE status IN ('active', 'trialing');

-- RLS policies
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_user_subscriptions" ON user_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Anon has no access
CREATE POLICY "anon_no_access_user_subscriptions" ON user_subscriptions
  FOR ALL USING (false);
