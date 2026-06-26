-- ═══════════════════════════════════════
-- ORACLE — Server-Side API Key Storage
-- P0 Security: Keys never leave the server
-- ═══════════════════════════════════════

-- ─── 1. Create user_api_keys table ───────

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,  -- AES-256-GCM encrypted API key
  key_hint TEXT NOT NULL,       -- Last 4 chars + pattern for display (e.g., "sk-12...abcd")
  is_active BOOLEAN DEFAULT TRUE,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  
  -- One key per provider per user
  UNIQUE(user_id, provider_id)
);

-- ─── 2. Indexes ────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(user_id, provider_id);

-- ─── 3. RLS Policies ──────────────────

-- Drop old policies if they exist
DROP POLICY IF EXISTS "user_api_keys_select_own" ON user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_insert_own" ON user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_update_own" ON user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_delete_own" ON user_api_keys;

-- User-scoped RLS
CREATE POLICY "user_api_keys_select_own" ON user_api_keys 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_api_keys_insert_own" ON user_api_keys 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_api_keys_update_own" ON user_api_keys 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_api_keys_delete_own" ON user_api_keys 
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 4. Enable RLS ────────────────────

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
