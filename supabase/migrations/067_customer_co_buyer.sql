-- Co-buyer + secondary phone on customers.
--
-- Atlas's existing inventory data is full of married-couple buyers
-- ("Last, His/Hers" pairs in the master spreadsheet) — Carter / Christy,
-- Tucker / Alexis, Hinojosa / Meredith, etc. The original schema only
-- captured a single first/last name and single phone, so a couple buying
-- together had to pick whose name went on the contract. Reps in the field
-- (Alex Broyles, May 2026 show) flagged this as a real-world gap.
--
-- All four columns nullable — single-buyer contracts continue to work
-- exactly as before. PDF rendering and the Step 2 form add optional UI
-- for these fields; if blank, the contract prints with one buyer like
-- it always has.

alter table public.customers
  add column if not exists co_buyer_first_name text,
  add column if not exists co_buyer_last_name text,
  add column if not exists secondary_phone text;
