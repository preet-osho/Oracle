-- ═══════════════════════════════════════
-- ORACLE — Organizations & RBAC
-- Multi-user permission system with org-scoped data access
-- Roles: owner > admin > employee > client
-- ═══════════════════════════════════════

-- ─── Organizations Table ────────────────

create table if not exists public.organizations (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  settings    jsonb not null default '{}'::jsonb,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists idx_organizations_slug on public.organizations (slug);
create index if not exists idx_organizations_created_by on public.organizations (created_by);

-- ─── Organization Memberships Table ─────

create table if not exists public.organization_memberships (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  role        text not null default 'employee' check (role in ('owner', 'admin', 'employee', 'client')),
  invited_by  uuid references auth.users(id),
  joined_at   bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique(user_id, org_id)
);

create index if not exists idx_memberships_user_id on public.organization_memberships (user_id);
create index if not exists idx_memberships_org_id on public.organization_memberships (org_id);
create index if not exists idx_memberships_role on public.organization_memberships (role);

-- ─── Helper: Get user's org_id and role ──

-- Returns the user's organization ID and role for API routes
create or replace function public.get_user_org_context(target_user_id uuid default auth.uid())
returns table(org_id uuid, role text)
language sql
security definer
stable
as $$
  select m.org_id, m.role
  from public.organization_memberships m
  where m.user_id = target_user_id
  limit 1;
$$;

-- Returns true if user has at least the specified role in their org
create or replace function public.user_has_role(min_role text, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.user_id = target_user_id
      and (
        (m.role = 'owner')
        or (m.role = 'admin' and min_role in ('admin', 'employee', 'client'))
        or (m.role = 'employee' and min_role in ('employee', 'client'))
        or (m.role = 'client' and min_role = 'client')
      )
  );
$$;

-- ─── Helper: Get org_id from user ───────

create or replace function public.get_user_org_id(target_user_id uuid default auth.uid())
returns uuid
language sql
security definer
stable
as $$
  select m.org_id from public.organization_memberships m
  where m.user_id = target_user_id
  limit 1;
$$;

-- ─── Add org_id to all existing tables ──

-- Projects
DO $$ BEGIN
  ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Time entries
DO $$ BEGIN
  ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Invoices
DO $$ BEGIN
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Memories
DO $$ BEGIN
  ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Knowledge docs
DO $$ BEGIN
  ALTER TABLE public.knowledge_docs ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Conversations
DO $$ BEGIN
  ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Leads
DO $$ BEGIN
  ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Revenue streams
DO $$ BEGIN
  ALTER TABLE public.revenue_streams ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Proposals
DO $$ BEGIN
  ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Custom prompts
DO $$ BEGIN
  ALTER TABLE public.custom_prompts ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Favourites
DO $$ BEGIN
  ALTER TABLE public.favourites ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- User API keys
DO $$ BEGIN
  ALTER TABLE public.user_api_keys ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- ─── Add org_id indexes ────────────────

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects (org_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_org_id ON public.time_entries (org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices (org_id);
CREATE INDEX IF NOT EXISTS idx_memories_org_id ON public.memories (org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org_id ON public.knowledge_docs (org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON public.conversations (org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON public.leads (org_id);
CREATE INDEX IF NOT EXISTS idx_revenue_streams_org_id ON public.revenue_streams (org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org_id ON public.proposals (org_id);
CREATE INDEX IF NOT EXISTS idx_custom_prompts_org_id ON public.custom_prompts (org_id);
CREATE INDEX IF NOT EXISTS idx_favourites_org_id ON public.favourites (org_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_org_id ON public.user_api_keys (org_id);

-- ─── Update RLS Policies ───────────────
-- Strategy: Users access data through their org membership.
-- A user can access any row where org_id matches their org.

-- Drop old user_id-based policies and replace with org-scoped ones

-- Helper: create org-scoped policy
-- Pattern: FOR {action} USING (org_id = public.get_user_org_id())

-- Projects
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_org_select" ON public.projects FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "projects_org_insert" ON public.projects FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "projects_org_update" ON public.projects FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "projects_org_delete" ON public.projects FOR DELETE USING (org_id = public.get_user_org_id() AND public.user_has_role('employee'));

-- Time entries
DROP POLICY IF EXISTS "time_entries_select_own" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert_own" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update_own" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_delete_own" ON public.time_entries;
CREATE POLICY "time_entries_org_select" ON public.time_entries FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "time_entries_org_insert" ON public.time_entries FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "time_entries_org_update" ON public.time_entries FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "time_entries_org_delete" ON public.time_entries FOR DELETE USING (org_id = public.get_user_org_id() AND public.user_has_role('employee'));

-- Invoices
DROP POLICY IF EXISTS "invoices_select_own" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_own" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_own" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_own" ON public.invoices;
CREATE POLICY "invoices_org_select" ON public.invoices FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "invoices_org_insert" ON public.invoices FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "invoices_org_update" ON public.invoices FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "invoices_org_delete" ON public.invoices FOR DELETE USING (org_id = public.get_user_org_id() AND public.user_has_role('employee'));

-- Memories
DROP POLICY IF EXISTS "memories_select_own" ON public.memories;
DROP POLICY IF EXISTS "memories_insert_own" ON public.memories;
DROP POLICY IF EXISTS "memories_update_own" ON public.memories;
DROP POLICY IF EXISTS "memories_delete_own" ON public.memories;
CREATE POLICY "memories_org_select" ON public.memories FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "memories_org_insert" ON public.memories FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "memories_org_update" ON public.memories FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "memories_org_delete" ON public.memories FOR DELETE USING (org_id = public.get_user_org_id());

-- Knowledge docs
DROP POLICY IF EXISTS "knowledge_docs_select_own" ON public.knowledge_docs;
DROP POLICY IF EXISTS "knowledge_docs_insert_own" ON public.knowledge_docs;
DROP POLICY IF EXISTS "knowledge_docs_delete_own" ON public.knowledge_docs;
CREATE POLICY "knowledge_docs_org_select" ON public.knowledge_docs FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "knowledge_docs_org_insert" ON public.knowledge_docs FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "knowledge_docs_org_delete" ON public.knowledge_docs FOR DELETE USING (org_id = public.get_user_org_id());

-- Conversations
DROP POLICY IF EXISTS "conversations_select_own" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_own" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_own" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_own" ON public.conversations;
CREATE POLICY "conversations_org_select" ON public.conversations FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "conversations_org_insert" ON public.conversations FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "conversations_org_update" ON public.conversations FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "conversations_org_delete" ON public.conversations FOR DELETE USING (org_id = public.get_user_org_id());

-- Leads
DROP POLICY IF EXISTS "leads_select_own" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_own" ON public.leads;
DROP POLICY IF EXISTS "leads_update_own" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_own" ON public.leads;
CREATE POLICY "leads_org_select" ON public.leads FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "leads_org_insert" ON public.leads FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "leads_org_update" ON public.leads FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "leads_org_delete" ON public.leads FOR DELETE USING (org_id = public.get_user_org_id() AND public.user_has_role('employee'));

-- Revenue streams
DROP POLICY IF EXISTS "revenue_streams_select_own" ON public.revenue_streams;
DROP POLICY IF EXISTS "revenue_streams_insert_own" ON public.revenue_streams;
DROP POLICY IF EXISTS "revenue_streams_update_own" ON public.revenue_streams;
DROP POLICY IF EXISTS "revenue_streams_delete_own" ON public.revenue_streams;
CREATE POLICY "revenue_streams_org_select" ON public.revenue_streams FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "revenue_streams_org_insert" ON public.revenue_streams FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "revenue_streams_org_update" ON public.revenue_streams FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "revenue_streams_org_delete" ON public.revenue_streams FOR DELETE USING (org_id = public.get_user_org_id() AND public.user_has_role('employee'));

-- User API keys
DROP POLICY IF EXISTS "user_api_keys_select_own" ON public.user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_insert_own" ON public.user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_update_own" ON public.user_api_keys;
DROP POLICY IF EXISTS "user_api_keys_delete_own" ON public.user_api_keys;
CREATE POLICY "user_api_keys_org_select" ON public.user_api_keys FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "user_api_keys_org_insert" ON public.user_api_keys FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "user_api_keys_org_update" ON public.user_api_keys FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "user_api_keys_org_delete" ON public.user_api_keys FOR DELETE USING (org_id = public.get_user_org_id());

-- ─── Organizations RLS ─────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizations_member_select" ON public.organizations
  FOR SELECT USING (
    id in (select org_id from public.organization_memberships where user_id = auth.uid())
  );
CREATE POLICY "organizations_owner_update" ON public.organizations
  FOR UPDATE USING (
    public.user_has_role('admin')
    AND id = public.get_user_org_id()
  );

-- Memberships RLS
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_org_select" ON public.organization_memberships
  FOR SELECT USING (
    org_id = public.get_user_org_id()
  );
CREATE POLICY "memberships_admin_insert" ON public.organization_memberships
  FOR INSERT WITH CHECK (
    public.user_has_role('admin')
    AND org_id = public.get_user_org_id()
  );
CREATE POLICY "memberships_admin_delete" ON public.organization_memberships
  FOR DELETE USING (
    public.user_has_role('admin')
    AND org_id = public.get_user_org_id()
    AND role != 'owner'
  );
