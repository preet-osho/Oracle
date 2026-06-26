-- ═══════════════════════════════════════
-- ORACLE — Add user_id to all tables + User-scoped RLS
-- P0 Security Fix: Every table must be scoped to its owning user
-- ═══════════════════════════════════════

-- ─── 1. Add user_id columns ───────────

-- Projects: add user_id (nullable first for data migration)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- Conversations: add user_id
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

-- Time Entries: add user_id (linked via projects, but also direct ownership)
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);

-- Invoices: add user_id
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);

-- Memories: add user_id
ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);

-- Knowledge Docs: add user_id
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_user ON knowledge_docs(user_id);

-- Proposals: add user_id
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_proposals_user ON proposals(user_id);

-- Custom Prompts: add user_id
ALTER TABLE custom_prompts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_custom_prompts_user ON custom_prompts(user_id);

-- Prompt Favourites: add user_id
ALTER TABLE prompt_favourites ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_prompt_favourites_user ON prompt_favourites(user_id);

-- ─── 2. Drop old service_role/anon policies ───────────

-- Projects
DROP POLICY IF EXISTS "service_role_full_access_projects" ON projects;
DROP POLICY IF EXISTS "anon_no_access_projects" ON projects;

-- Time Entries
DROP POLICY IF EXISTS "service_role_full_access_time_entries" ON time_entries;
DROP POLICY IF EXISTS "anon_no_access_time_entries" ON time_entries;

-- Invoices
DROP POLICY IF EXISTS "service_role_full_access_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_no_access_invoices" ON invoices;

-- Memories
DROP POLICY IF EXISTS "service_role_full_access_memories" ON memories;
DROP POLICY IF EXISTS "anon_no_access_memories" ON memories;

-- Knowledge Docs
DROP POLICY IF EXISTS "service_role_full_access_knowledge_docs" ON knowledge_docs;
DROP POLICY IF EXISTS "anon_no_access_knowledge_docs" ON knowledge_docs;

-- Proposals
DROP POLICY IF EXISTS "service_role_full_access_proposals" ON proposals;
DROP POLICY IF EXISTS "anon_no_access_proposals" ON proposals;

-- Custom Prompts
DROP POLICY IF EXISTS "service_role_full_access_custom_prompts" ON custom_prompts;
DROP POLICY IF EXISTS "anon_no_access_custom_prompts" ON custom_prompts;

-- Prompt Favourites
DROP POLICY IF EXISTS "service_role_full_access_prompt_favourites" ON prompt_favourites;
DROP POLICY IF EXISTS "anon_no_access_prompt_favourites" ON prompt_favourites;

-- ─── 3. Create user-scoped RLS policies ───────────
-- Strategy: authenticated users can only access rows where user_id = auth.uid()
-- Service role bypasses RLS (used by server-side API routes that validate auth)

-- Projects
CREATE POLICY "projects_select_own" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Time Entries
CREATE POLICY "time_entries_select_own" ON time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "time_entries_insert_own" ON time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "time_entries_update_own" ON time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "time_entries_delete_own" ON time_entries FOR DELETE USING (auth.uid() = user_id);

-- Invoices
CREATE POLICY "invoices_select_own" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own" ON invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own" ON invoices FOR DELETE USING (auth.uid() = user_id);

-- Memories
CREATE POLICY "memories_select_own" ON memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "memories_insert_own" ON memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memories_update_own" ON memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "memories_delete_own" ON memories FOR DELETE USING (auth.uid() = user_id);

-- Knowledge Docs
CREATE POLICY "knowledge_docs_select_own" ON knowledge_docs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "knowledge_docs_insert_own" ON knowledge_docs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "knowledge_docs_update_own" ON knowledge_docs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "knowledge_docs_delete_own" ON knowledge_docs FOR DELETE USING (auth.uid() = user_id);

-- Proposals
CREATE POLICY "proposals_select_own" ON proposals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "proposals_insert_own" ON proposals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "proposals_update_own" ON proposals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "proposals_delete_own" ON proposals FOR DELETE USING (auth.uid() = user_id);

-- Custom Prompts
CREATE POLICY "custom_prompts_select_own" ON custom_prompts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "custom_prompts_insert_own" ON custom_prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custom_prompts_update_own" ON custom_prompts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "custom_prompts_delete_own" ON custom_prompts FOR DELETE USING (auth.uid() = user_id);

-- Prompt Favourites
CREATE POLICY "prompt_favourites_select_own" ON prompt_favourites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prompt_favourites_insert_own" ON prompt_favourites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prompt_favourites_delete_own" ON prompt_favourites FOR DELETE USING (auth.uid() = user_id);

-- Conversations (already has service_role policies from 003_conversations.sql — drop and replace)
DROP POLICY IF EXISTS "service_role_full_access_conversations" ON conversations;
DROP POLICY IF EXISTS "anon_no_access_conversations" ON conversations;

CREATE POLICY "conversations_select_own" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert_own" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update_own" ON conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "conversations_delete_own" ON conversations FOR DELETE USING (auth.uid() = user_id);

-- ─── 4. Backfill helper comment ───────────
-- NOTE: Existing rows will have NULL user_id. They will NOT be visible under RLS
-- until a backfill migration assigns them to a user. For new installations this
-- is a non-issue. For existing data, run:
--   UPDATE projects SET user_id = '<admin-uuid>' WHERE user_id IS NULL;
-- (repeat for each table)
