-- ═══════════════════════════════════════
-- ORACLE — Row Level Security Policies
-- Protect data when anon key is exposed client-side
-- ═══════════════════════════════════════
--
-- STRATEGY:
--   • Service role (server-side API routes) → full access to everything
--   • Anon key (client-side browser) → NO direct table access
--   • All data flows through /api/* routes which use service role
--
-- SETUP:
--   1. Create a SUPABASE_SERVICE_ROLE_KEY in your Supabase dashboard
--      (Settings → API → service_role secret)
--   2. Add it to .env.local: SUPABASE_SERVICE_ROLE_KEY=eyJ...
--   3. The server-side client (src/lib/supabase.ts) uses this key
--   4. The anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) stays client-side only

-- ─── Enable RLS on all tables ─────────

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_favourites ENABLE ROW LEVEL SECURITY;

-- ─── Projects ─────────────────────────

CREATE POLICY "service_role_full_access_projects"
  ON projects FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_projects"
  ON projects FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Time Entries ─────────────────────

CREATE POLICY "service_role_full_access_time_entries"
  ON time_entries FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_time_entries"
  ON time_entries FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Invoices ─────────────────────────

CREATE POLICY "service_role_full_access_invoices"
  ON invoices FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_invoices"
  ON invoices FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Memories ─────────────────────────

CREATE POLICY "service_role_full_access_memories"
  ON memories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_memories"
  ON memories FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Knowledge Documents ──────────────

CREATE POLICY "service_role_full_access_knowledge_docs"
  ON knowledge_docs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_knowledge_docs"
  ON knowledge_docs FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Proposals ────────────────────────

CREATE POLICY "service_role_full_access_proposals"
  ON proposals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_proposals"
  ON proposals FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Custom Prompts ───────────────────

CREATE POLICY "service_role_full_access_custom_prompts"
  ON custom_prompts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_custom_prompts"
  ON custom_prompts FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Prompt Favourites ────────────────

CREATE POLICY "service_role_full_access_prompt_favourites"
  ON prompt_favourites FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_no_access_prompt_favourites"
  ON prompt_favourites FOR ALL
  USING (false)
  WITH CHECK (false);
