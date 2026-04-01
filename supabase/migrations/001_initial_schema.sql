-- Atlas Spas Platform — Initial Schema
-- Run in Supabase SQL editor or via supabase db push

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users ──────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin','manager','sales_rep','bookkeeper','field_crew','customer')),
  assigned_location_id uuid,
  created_at timestamptz default now()
);

-- ─── Locations ───────────────────────────────────────────────────────────────
create table public.locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('store','show')),
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  phone text,
  cc_surcharge_enabled boolean default false,
  cc_surcharge_rate numeric(5,4) default 0.035,
  floor_price_enabled boolean default true,
  active boolean default true,
  created_at timestamptz default now()
);

-- ─── Shows ───────────────────────────────────────────────────────────────────
create table public.shows (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location_id uuid references public.locations(id),
  venue_name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  start_date date not null,
  end_date date not null,
  assigned_rep_ids uuid[] default '{}',
  active boolean default true,
  created_at timestamptz default now()
);

-- ─── Products ─────────────────────────────────────────────────────────────────
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  qbo_item_id text unique,
  name text not null,
  sku text,
  category text,
  msrp numeric(10,2) not null,
  floor_price numeric(10,2),
  description text,
  photo_url text,
  active boolean default true,
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ─── Inventory ────────────────────────────────────────────────────────────────
create table public.inventory_units (
  id uuid primary key default uuid_generate_v4(),
  serial_number text not null unique,
  product_id uuid references public.products(id),
  location_id uuid references public.locations(id),
  status text not null default 'on_order' check (status in (
    'on_order','in_factory','at_location','allocated','sold','delivered'
  )),
  contract_id uuid, -- FK added after contracts table
  delivery_work_order_id uuid, -- FK added after work orders table
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Customers ────────────────────────────────────────────────────────────────
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  cascade_crm_id text,
  qbo_customer_id text,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  address text,
  city text,
  state text,
  zip text,
  has_prescription boolean default false,
  prescription_url text,
  created_at timestamptz default now()
);

-- ─── Contracts ────────────────────────────────────────────────────────────────
create table public.contracts (
  id uuid primary key default uuid_generate_v4(),
  contract_number text not null unique,
  status text not null default 'draft' check (status in (
    'draft','pending_signature','signed','deposit_collected',
    'in_production','ready_for_delivery','delivered','cancelled'
  )),

  customer_id uuid references public.customers(id) not null,
  sales_rep_id uuid references public.profiles(id) not null,
  show_id uuid references public.shows(id),
  location_id uuid references public.locations(id) not null,

  -- Line items stored as JSONB for flexibility
  line_items jsonb not null default '[]',
  discounts jsonb not null default '[]',
  financing jsonb not null default '{"type":"none","financed_amount":0}',

  -- Financials
  subtotal numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  tax_rate numeric(6,5) not null default 0,
  surcharge_amount numeric(10,2) not null default 0,
  surcharge_rate numeric(5,4) not null default 0,
  total numeric(10,2) not null default 0,
  deposit_amount numeric(10,2) not null default 0,
  deposit_paid numeric(10,2) not null default 0,
  balance_due numeric(10,2) not null default 0,

  payment_method text check (payment_method in (
    'credit_card','debit_card','ach','cash','financing'
  )),

  -- QBO IDs
  qbo_estimate_id text,
  qbo_deposit_invoice_id text,
  qbo_final_invoice_id text,

  -- Intuit Payments
  intuit_payment_id text,

  -- Signatures
  customer_signature_url text,
  signed_at timestamptz,
  contract_pdf_url text,

  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Payments ─────────────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid references public.contracts(id) not null,
  amount numeric(10,2) not null,
  surcharge_amount numeric(10,2) not null default 0,
  method text not null,
  status text not null default 'pending' check (status in (
    'pending','processing','completed','failed','refunded'
  )),
  intuit_charge_id text,
  receipt_url text,
  processed_at timestamptz,
  created_at timestamptz default now()
);

-- ─── Delivery Work Orders ─────────────────────────────────────────────────────
create table public.delivery_work_orders (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid references public.contracts(id) not null,
  assigned_crew_ids uuid[] default '{}',
  scheduled_date date,
  status text not null default 'scheduled' check (status in (
    'scheduled','in_progress','completed','cancelled'
  )),
  checklist_items jsonb not null default '[]',
  customer_signature_url text,
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- ─── Add deferred FKs ────────────────────────────────────────────────────────
alter table public.inventory_units
  add constraint fk_inventory_contract
    foreign key (contract_id) references public.contracts(id),
  add constraint fk_inventory_work_order
    foreign key (delivery_work_order_id) references public.delivery_work_orders(id);

-- ─── Offline Queue ────────────────────────────────────────────────────────────
-- Tracks operations queued when offline, replayed on reconnect
create table public.offline_queue (
  id uuid primary key default uuid_generate_v4(),
  device_id text not null,
  operation text not null, -- 'create_contract', 'collect_payment', etc.
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  error text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.shows enable row level security;
alter table public.products enable row level security;
alter table public.inventory_units enable row level security;
alter table public.customers enable row level security;
alter table public.contracts enable row level security;
alter table public.payments enable row level security;
alter table public.delivery_work_orders enable row level security;

-- Profiles: users can read all, update own
create policy "profiles_read" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Locations: all authenticated users can read
create policy "locations_read" on public.locations for select using (auth.role() = 'authenticated');

-- Shows: all authenticated users can read
create policy "shows_read" on public.shows for select using (auth.role() = 'authenticated');
create policy "shows_write" on public.shows for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);

-- Products: all authenticated users can read
create policy "products_read" on public.products for select using (auth.role() = 'authenticated');
create policy "products_write" on public.products for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin'))
);

-- Inventory: all authenticated users can read; admin/manager can write
create policy "inventory_read" on public.inventory_units for select using (auth.role() = 'authenticated');
create policy "inventory_write" on public.inventory_units for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);

-- Customers: all authenticated users can read/create
create policy "customers_read" on public.customers for select using (auth.role() = 'authenticated');
create policy "customers_write" on public.customers for insert using (auth.role() = 'authenticated');
create policy "customers_update" on public.customers for update using (auth.role() = 'authenticated');

-- Contracts: reps see own, managers see location, admin sees all
create policy "contracts_read_admin" on public.contracts for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager','bookkeeper'))
);
create policy "contracts_read_rep" on public.contracts for select using (
  sales_rep_id = auth.uid()
);
create policy "contracts_write" on public.contracts for insert using (auth.role() = 'authenticated');
create policy "contracts_update" on public.contracts for update using (
  sales_rep_id = auth.uid() or
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);

-- Payments: reps see own contracts' payments
create policy "payments_read" on public.payments for select using (
  exists (
    select 1 from public.contracts c
    where c.id = contract_id and (
      c.sales_rep_id = auth.uid() or
      exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager','bookkeeper'))
    )
  )
);
create policy "payments_write" on public.payments for insert using (auth.role() = 'authenticated');

-- ─── Updated_at triggers ─────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contracts_updated_at before update on public.contracts
  for each row execute function update_updated_at();

create trigger inventory_updated_at before update on public.inventory_units
  for each row execute function update_updated_at();
