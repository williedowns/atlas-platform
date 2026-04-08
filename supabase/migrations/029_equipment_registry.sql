-- Customer equipment registry
create table if not exists public.equipment (
  id               uuid primary key default uuid_generate_v4(),
  customer_id      uuid references public.customers(id) on delete cascade,
  contract_id      uuid references public.contracts(id) on delete set null,
  product_name     text not null,
  serial_number    text,
  purchase_date    date,
  warranty_expires date,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table public.equipment enable row level security;
create policy "admin_all_equipment" on public.equipment for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager','sales_rep')));
-- Customers can see their own equipment via portal
create policy "customer_read_own_equipment" on public.equipment for select
  using (
    exists (
      select 1 from public.customers c
      join auth.users u on u.email = c.email
      where u.id = auth.uid() and c.id = equipment.customer_id
    )
  );
