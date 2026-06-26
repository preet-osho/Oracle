-- ═══════════════════════════════════════
-- ORACLE — Automation Schedules Migration
-- Stores configurable scheduled automations per organization
-- ═══════════════════════════════════════

-- ─── Automation Schedules ──────────────
-- Each row represents one configurable scheduled job for an org.

create table if not exists automation_schedules (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  type          text not null,          -- 'web-scan', 'lead-followup', 'report-weekly', etc.
  frequency     text not null default 'weekly',  -- 'hourly', 'daily', 'weekly', 'monthly'
  cron_expression text not null,        -- 5-field cron expression
  enabled       boolean not null default true,
  last_run_at   bigint,                -- epoch ms of last execution
  next_run_at   bigint,                -- epoch ms of next scheduled execution
  config        jsonb default '{}'::jsonb,  -- schedule-specific config
  created_at    bigint not null default (extract(epoch from now()) * 1000),
  updated_at    bigint not null default (extract(epoch from now()) * 1000)
);

-- Index for fast lookup of active schedules
create index if not exists idx_automation_schedules_org_id
  on automation_schedules(org_id);

create index if not exists idx_automation_schedules_enabled
  on automation_schedules(enabled)
  where enabled = true;

create index if not exists idx_automation_schedules_type
  on automation_schedules(type);

-- Prevent duplicate schedules of the same type per org
create unique index if not exists idx_automation_schedules_org_type
  on automation_schedules(org_id, type);

-- ─── Automation Execution Logs ────────
-- Records each schedule execution for audit and monitoring.

create table if not exists automation_execution_logs (
  id            uuid primary key default gen_random_uuid(),
  schedule_id   uuid not null references automation_schedules(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  schedule_type text not null,
  status        text not null default 'success',  -- 'success', 'failed', 'skipped'
  duration_ms   bigint,
  result        jsonb,
  error         text,
  executed_at   bigint not null default (extract(epoch from now()) * 1000)
);

create index if not exists idx_automation_logs_schedule_id
  on automation_execution_logs(schedule_id);

create index if not exists idx_automation_logs_org_id
  on automation_execution_logs(org_id);

create index if not exists idx_automation_logs_executed_at
  on automation_execution_logs(executed_at desc);

-- ─── RLS Policies ─────────────────────

alter table automation_schedules enable row level security;
alter table automation_execution_logs enable row level security;

-- Org members can read schedules
create policy "org_members_read_schedules"
  on automation_schedules for select
  using (org_id = public.get_user_org_id());

-- Org admins+ can manage schedules
create policy "org_admins_manage_schedules"
  on automation_schedules for all
  using (
    org_id = public.get_user_org_id()
    and public.user_has_role('admin')
  );

-- Service role can manage all schedules (for Inngest functions)
create policy "service_role_all_schedules"
  on automation_schedules for all
  using (true)
  with check (true);

-- Org members can read execution logs
create policy "org_members_read_logs"
  on automation_execution_logs for select
  using (org_id = public.get_user_org_id());

-- Service role can write execution logs
create policy "service_role_all_logs"
  on automation_execution_logs for all
  using (true)
  with check (true);

-- ─── Seed Default Schedules ────────────
-- Insert default schedules for existing orgs

insert into automation_schedules (org_id, type, frequency, cron_expression, enabled, config)
select
  o.id,
  s.type,
  s.frequency,
  s.cron_expression,
  s.enabled,
  '{}'::jsonb
from organizations o
cross join (values
  ('web-scan',        'weekly', '0 6 * * 1', true),
  ('lead-followup',   'weekly', '0 9 * * 2', true),
  ('report-weekly',   'weekly', '0 7 * * 1', true),
  ('report-monthly',  'monthly','0 8 1 * *', true)
) as s(type, frequency, cron_expression, enabled)
on conflict do nothing;
