-- Customer service requests (submitted via portal)
create table if not exists public.service_requests (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid references public.customers(id) on delete cascade,
  equipment_id    uuid references public.equipment(id) on delete set null,
  description     text not null,
  urgency         text not null default 'routine' check (urgency in ('routine','urgent','emergency')),
  contact_method  text not null default 'phone' check (contact_method in ('phone','email','text')),
  status          text not null default 'new' check (status in ('new','acknowledged','scheduled','completed','cancelled')),
  admin_notes     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.service_requests enable row level security;
create policy "admin_all_service_requests" on public.service_requests for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));
create policy "customer_own_service_requests" on public.service_requests for all
  using (
    exists (
      select 1 from public.customers c
      join auth.users u on u.email = c.email
      where u.id = auth.uid() and c.id = service_requests.customer_id
    )
  );
