-- Sales goals / quota tracking per rep per month
-- rep_id = null means org-wide goal (fallback for all reps)
create table if not exists public.sales_goals (
  id              uuid primary key default uuid_generate_v4(),
  rep_id          uuid references public.profiles(id) on delete cascade,
  period_start    date not null,                    -- first day of the month
  target_revenue  numeric(12,2) not null default 0,
  target_contracts int not null default 0,
  created_by      uuid references public.profiles(id),
  updated_at      timestamptz default now(),
  created_at      timestamptz default now(),
  unique(rep_id, period_start)
);

alter table public.sales_goals enable row level security;

-- Admins/managers can read/write all goals
create policy "admin_all_goals" on public.sales_goals
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','manager')
    )
  );

-- Reps can read their own goal
create policy "rep_read_own_goal" on public.sales_goals
  for select using (rep_id = auth.uid());
