-- ═══════════════════════════════════════
-- ORACLE — Task Executions Table
-- Stores background job results from Inngest swarm execution
-- ═══════════════════════════════════════

create table if not exists public.task_executions (
  id            uuid default gen_random_uuid() primary key,
  task_id       text not null,
  client_name   text not null default '',
  synthesis     text not null default '',
  agent_results jsonb not null default '[]'::jsonb,
  total_cost_usd  double precision not null default 0,
  total_tokens    bigint not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_message text,
  created_at    bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- RLS: only service-role can access (background jobs run server-side)
alter table public.task_executions enable row level security;

create policy "Service role full access on task_executions"
  on public.task_executions
  for all
  using (true)
  with check (true);

-- Index for querying by task_id
create index if not exists idx_task_executions_task_id on public.task_executions (task_id);
create index if not exists idx_task_executions_created_at on public.task_executions (created_at desc);
create index if not exists idx_task_executions_status on public.task_executions (status);
