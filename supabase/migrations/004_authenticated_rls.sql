-- ═══════════════════════════════════════
-- ORACLE — Authenticated User RLS Policies
-- Allow authenticated users direct database access
-- ═══════════════════════════════════════
--
-- STRATEGY:
--   • Service role (server-side) → full access (unchanged)
--   • Authenticated users (logged in via Supabase Auth) → full read/write access
--   • Anon users (not logged in) → NO access (unchanged)
--
-- This eliminates the need for the service_role key in most API routes.
-- The cookie-based client (with user session) can now query the database directly.
--
-- SETUP:
--   1. Run this migration in your Supabase SQL Editor
--   2. API routes will use the cookie-based client from validateAuth()
--   3. Service role key is still available for admin operations if needed

-- ─── Drop the old restrictive anon policies ──
-- We keep the service_role policies and add authenticated ones

DROP POLICY IF EXISTS "anon_no_access_projects" ON projects;
DROP POLICY IF EXISTS "anon_no_access_time_entries" ON time_entries;
DROP POLICY IF EXISTS "anon_no_access_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_no_access_memories" ON memories;
DROP POLICY IF EXISTS "anon_no_access_knowledge_docs" ON knowledge_docs;
DROP POLICY IF EXISTS "anon_no_access_proposals" ON proposals;
DROP POLICY IF EXISTS "anon_no_access_custom_prompts" ON custom_prompts;
DROP POLICY IF EXISTS "anon_no_access_prompt_favourites" ON prompt_favourites;
DROP POLICY IF EXISTS "anon_no_access_conversations" ON conversations;

-- ─── Projects ─────────────────────────

CREATE POLICY "authenticated_full_access_projects"
  ON projects FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_projects"
  ON projects FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Time Entries ─────────────────────

CREATE POLICY "authenticated_full_access_time_entries"
  ON time_entries FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_time_entries"
  ON time_entries FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Invoices ─────────────────────────

CREATE POLICY "authenticated_full_access_invoices"
  ON invoices FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_invoices"
  ON invoices FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Memories ─────────────────────────

CREATE POLICY "authenticated_full_access_memories"
  ON memories FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_memories"
  ON memories FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Knowledge Documents ──────────────

CREATE POLICY "authenticated_full_access_knowledge_docs"
  ON knowledge_docs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_knowledge_docs"
  ON knowledge_docs FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Proposals ────────────────────────

CREATE POLICY "authenticated_full_access_proposals"
  ON proposals FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_proposals"
  ON proposals FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Custom Prompts ───────────────────

CREATE POLICY "authenticated_full_access_custom_prompts"
  ON custom_prompts FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_custom_prompts"
  ON custom_prompts FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Prompt Favourites ────────────────

CREATE POLICY "authenticated_full_access_prompt_favourites"
  ON prompt_favourites FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_prompt_favourites"
  ON prompt_favourites FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Conversations ────────────────────

CREATE POLICY "authenticated_full_access_conversations"
  ON conversations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "anon_no_access_conversations"
  ON conversations FOR ALL
  USING (false)
  WITH CHECK (false);
