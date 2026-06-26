-- ═══════════════════════════════════════
-- ORACLE — Leads & Revenue Streams Schema
-- ═══════════════════════════════════════

-- ─── Leads ───────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  google_maps_url TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  trigger_criterion TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Responded', 'Hot', 'Warm', 'Cold', 'Converted', 'Lost')),
  channel TEXT CHECK (channel IN ('WhatsApp', 'Email', 'LinkedIn', 'Phone')),
  personalised_message TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Manual' CHECK (source IN ('Google Maps', 'Website Audit', 'Funded Startup', 'Social Listening', 'Job Listing', 'Manual')),
  assigned_to TEXT NOT NULL DEFAULT '',
  follow_up_date TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX idx_leads_user ON leads(user_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);

-- ─── Revenue Streams ─────────────────
CREATE TABLE IF NOT EXISTS revenue_streams (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Service' CHECK (type IN ('Service', 'Product', 'Retainer', 'Affiliate', 'SaaS')),
  description TEXT NOT NULL DEFAULT '',
  monthly_projection REAL NOT NULL DEFAULT 0,
  annual_projection REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'Building', 'Active', 'Paused')),
  margin INTEGER NOT NULL DEFAULT 80,
  effort TEXT NOT NULL DEFAULT 'Medium' CHECK (effort IN ('Low', 'Medium', 'High')),
  timeline TEXT NOT NULL DEFAULT '',
  tools JSONB NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX idx_revenue_streams_user ON revenue_streams(user_id);
CREATE INDEX idx_revenue_streams_status ON revenue_streams(status);

-- ─── RLS Policies ────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_streams ENABLE ROW LEVEL SECURITY;

-- Leads: users can only see/modify their own leads
CREATE POLICY "leads_select_own" ON leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "leads_insert_own" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leads_update_own" ON leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "leads_delete_own" ON leads FOR DELETE USING (auth.uid() = user_id);

-- Revenue Streams: users can only see/modify their own streams
CREATE POLICY "revenue_streams_select_own" ON revenue_streams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "revenue_streams_insert_own" ON revenue_streams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "revenue_streams_update_own" ON revenue_streams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "revenue_streams_delete_own" ON revenue_streams FOR DELETE USING (auth.uid() = user_id);
