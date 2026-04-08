-- Minimum stock threshold per product for reorder alerts
alter table public.products
  add column if not exists min_stock_qty int not null default 0;
