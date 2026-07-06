-- ═══════════════════════════════════════
-- ORACLE — Communication Message Logs
-- Stores all outbound/inbound messages for
-- audit trail and analytics
-- ═══════════════════════════════════════

-- ─── Message Logs Table ────────────────

CREATE TABLE IF NOT EXISTS message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES client_projects(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  to_address TEXT NOT NULL,
  from_address TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  template_id TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_code TEXT,
  metadata JSONB,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ─── Indexes ───────────────────────────

CREATE INDEX IF NOT EXISTS idx_message_logs_user_id ON message_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_client_id ON message_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_lead_id ON message_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_channel ON message_logs(channel);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_provider_message_id ON message_logs(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at DESC);

-- ─── RLS Policies ──────────────────────

ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own messages
CREATE POLICY "Users can read own messages"
  ON message_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert own messages"
  ON message_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own messages (for status updates)
CREATE POLICY "Users can update own messages"
  ON message_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhook handlers)
CREATE POLICY "Service role full access"
  ON message_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Updated At Trigger ────────────────

CREATE OR REPLACE FUNCTION update_message_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_logs_updated_at ON message_logs;
CREATE TRIGGER message_logs_updated_at
  BEFORE UPDATE ON message_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_message_logs_updated_at();
