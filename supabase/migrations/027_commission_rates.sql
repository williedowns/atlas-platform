-- Commission rates per rep
create table if not exists public.commission_rates (
  id              uuid primary key default uuid_generate_v4(),
  rep_id          uuid references public.profiles(id) on delete cascade,
  rate_pct        numeric(5,2) not null default 0, -- e.g. 5.00 = 5%
  effective_date  date not null default current_date,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz default now(),
  unique(rep_id)
);
alter table public.commission_rates enable row level security;
create policy "admin_all_commission" on public.commission_rates for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));
create policy "rep_read_own_commission" on public.commission_rates for select
  using (rep_id = auth.uid());
