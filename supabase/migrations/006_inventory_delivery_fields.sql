-- ============================================================
-- Migration 006: Add delivery tracking fields to inventory_units
-- These fields capture data from the Google Sheets color coding
-- and notes columns that existed before the app was built.
-- ============================================================

-- delivery_team: which team delivers this unit
-- Values: atlas | fierce | houston_aaron | null
ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS delivery_team text;

-- customer_name: for pre-system sold units not yet in contracts
-- Once a proper contract is created, this is superseded by the contract FK
ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS customer_name text;

-- fin_balance: remaining finance balance (raw text from spreadsheet)
ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS fin_balance text;

-- model_code: raw model abbreviation from spreadsheet (e.g. "LSX 800", "X T15D")
-- Used to match/display before a product_id is resolved
ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS model_code text;

-- Add CHECK constraint for delivery_team
ALTER TABLE public.inventory_units
  DROP CONSTRAINT IF EXISTS inventory_units_delivery_team_check;

ALTER TABLE public.inventory_units
  ADD CONSTRAINT inventory_units_delivery_team_check
  CHECK (delivery_team IN ('atlas', 'fierce', 'houston_aaron') OR delivery_team IS NULL);
