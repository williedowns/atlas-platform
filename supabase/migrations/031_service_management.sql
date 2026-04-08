-- ── Phase 2: Service Management ───────────────────────────────────────────────

-- Service jobs (core ticket)
create table if not exists public.service_jobs (
  id                  uuid primary key default uuid_generate_v4(),
  customer_id         uuid references public.customers(id) on delete cascade,
  equipment_id        uuid references public.equipment(id) on delete set null,
  job_type            text not null default 'maintenance'
                        check (job_type in ('maintenance','repair','warranty','install','follow_up','other')),
  title               text not null,
  description         text,
  status              text not null default 'scheduled'
                        check (status in ('draft','scheduled','in_progress','completed','cancelled')),
  assigned_tech_id    uuid references public.profiles(id) on delete set null,
  scheduled_date      date,
  scheduled_time_start time,
  scheduled_time_end   time,
  completed_at        timestamptz,
  notes               text,
  admin_notes         text,
  invoice_id          uuid, -- FK added below after service_invoices
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.service_jobs enable row level security;
create policy "admin_all_service_jobs" on public.service_jobs for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));
create policy "tech_own_service_jobs" on public.service_jobs for select
  using (assigned_tech_id = auth.uid());
create policy "tech_update_own_service_jobs" on public.service_jobs for update
  using (assigned_tech_id = auth.uid());

-- Water test logs per job visit
create table if not exists public.service_job_water_tests (
  id            uuid primary key default uuid_generate_v4(),
  job_id        uuid references public.service_jobs(id) on delete cascade,
  ph            numeric(4,2),
  alkalinity    int,          -- ppm
  sanitizer_ppm numeric(6,2),
  temp_f        numeric(5,1),
  hardness      int,          -- ppm calcium hardness
  notes         text,
  tested_by     uuid references public.profiles(id),
  tested_at     timestamptz default now()
);
alter table public.service_job_water_tests enable row level security;
create policy "admin_all_water_tests" on public.service_job_water_tests for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));
create policy "tech_own_water_tests" on public.service_job_water_tests for all
  using (
    exists (
      select 1 from public.service_jobs j
      where j.id = service_job_water_tests.job_id and j.assigned_tech_id = auth.uid()
    )
  );

-- Photo metadata per job
create table if not exists public.service_job_photos (
  id           uuid primary key default uuid_generate_v4(),
  job_id       uuid references public.service_jobs(id) on delete cascade,
  storage_url  text not null,
  caption      text,
  uploaded_by  uuid references public.profiles(id),
  created_at   timestamptz default now()
);
alter table public.service_job_photos enable row level security;
create policy "admin_all_photos" on public.service_job_photos for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));
create policy "tech_own_photos" on public.service_job_photos for all
  using (
    exists (
      select 1 from public.service_jobs j
      where j.id = service_job_photos.job_id and j.assigned_tech_id = auth.uid()
    )
  );

-- Recurring service templates
create table if not exists public.recurring_service_templates (
  id                  uuid primary key default uuid_generate_v4(),
  customer_id         uuid references public.customers(id) on delete cascade,
  equipment_id        uuid references public.equipment(id) on delete set null,
  job_type            text not null default 'maintenance'
                        check (job_type in ('maintenance','repair','warranty','install','follow_up','other')),
  title               text not null,
  description         text,
  frequency           text not null default 'monthly'
                        check (frequency in ('weekly','biweekly','monthly','seasonal')),
  assigned_tech_id    uuid references public.profiles(id) on delete set null,
  active              boolean not null default true,
  next_generate_date  date,
  last_generated_at   timestamptz,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.recurring_service_templates enable row level security;
create policy "admin_all_recurring" on public.recurring_service_templates for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager')));

-- Service invoices
create table if not exists public.service_invoices (
  id             uuid primary key default uuid_generate_v4(),
  service_job_id uuid references public.service_jobs(id) on delete set null,
  customer_id    uuid references public.customers(id) on delete cascade,
  line_items     jsonb not null default '[]'::jsonb,
  subtotal       numeric(10,2) not null default 0,
  tax_amount     numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  status         text not null default 'draft'
                   check (status in ('draft','sent','paid','void')),
  qbo_invoice_id text,
  sent_at        timestamptz,
  paid_at        timestamptz,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
alter table public.service_invoices enable row level security;
create policy "admin_all_service_invoices" on public.service_invoices for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager','bookkeeper')));

-- Back-fill FK on service_jobs → service_invoices
alter table public.service_jobs
  add constraint fk_service_jobs_invoice
  foreign key (invoice_id) references public.service_invoices(id) on delete set null;
