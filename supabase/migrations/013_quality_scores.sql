-- ═══════════════════════════════════════
-- ORACLE — Quality Scores Table
-- Stores AI response quality scores from Inngest background scoring
-- ═══════════════════════════════════════

create table if not exists public.quality_scores (
  id              uuid default gen_random_uuid() primary key,
  conversation_id text,
  score_data      jsonb not null default '{}'::jsonb,
  total           double precision not null default 0,
  created_at      bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- RLS: only service-role can access (background jobs run server-side)
alter table public.quality_scores enable row level security;

create policy "Service role full access on quality_scores"
  on public.quality_scores
  for all
  using (true)
  with check (true);

-- Index for querying by conversation_id
create index if not exists idx_quality_scores_conversation_id on public.quality_scores (conversation_id);
create index if not exists idx_quality_scores_created_at on public.quality_scores (created_at desc);
