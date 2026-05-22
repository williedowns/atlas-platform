-- Migration 089 — Per-contract COGS (Cost of Goods Sold)
--
-- Atlas tracks per-deal cost in Lori's XLSX workbooks (column AN: "Total Cost"
-- = spa cost + color cost + cabinet cost + masterpur cost + floor system cost
-- + options + freight + delivery + crane + removal + lifter + chem kit).
-- Until now that data was extracted by backfill_historical_shows.py but had
-- nowhere to land — contracts had no cost column.
--
-- With contracts.cost populated, every Net Profit / Margin / ROI number
-- across the analytics page + PDF report becomes accurate. The show-cost
-- allocation workaround can be retired.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS cost numeric(12, 2);

COMMENT ON COLUMN public.contracts.cost IS
  'Atlas''s total COGS for this contract — spa wholesale + options + freight + delivery + all line costs. From Lori XLSX column AN (Total Cost). NULL = not yet imported. Drives true gross margin throughout analytics.';
