-- Add per-location and per-show QBO deposit item mappings for income/liability modes
--
-- Context: Atlas's current bookkeeping workflow books deposits to INCOME accounts.
-- The target accrual workflow books deposits to LIABILITY accounts (Customer Deposits).
-- A config flag (env var QBO_DEPOSIT_MODE=income|liability) chooses which item to use
-- at runtime. Both item IDs can be pre-configured so flipping the flag is a one-line change.
--
-- Income mode:    uses qbo_deposit_income_item_id     (maps to an Income account in QBO)
-- Liability mode: uses qbo_deposit_liability_item_id  (maps to Customer Deposits liability)

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS qbo_deposit_income_item_id      text,
  ADD COLUMN IF NOT EXISTS qbo_deposit_income_item_name    text,
  ADD COLUMN IF NOT EXISTS qbo_deposit_liability_item_id   text,
  ADD COLUMN IF NOT EXISTS qbo_deposit_liability_item_name text;

ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS qbo_deposit_income_item_id      text,
  ADD COLUMN IF NOT EXISTS qbo_deposit_income_item_name    text,
  ADD COLUMN IF NOT EXISTS qbo_deposit_liability_item_id   text,
  ADD COLUMN IF NOT EXISTS qbo_deposit_liability_item_name text;

COMMENT ON COLUMN public.locations.qbo_deposit_income_item_id
  IS 'QBO Item ID mapped to an income account — used when QBO_DEPOSIT_MODE=income (Lori''s current workflow)';
COMMENT ON COLUMN public.locations.qbo_deposit_liability_item_id
  IS 'QBO Item ID mapped to Customer Deposits liability account — used when QBO_DEPOSIT_MODE=liability (target accrual workflow)';
COMMENT ON COLUMN public.shows.qbo_deposit_income_item_id
  IS 'QBO Item ID mapped to an income account — used when QBO_DEPOSIT_MODE=income (Lori''s current workflow)';
COMMENT ON COLUMN public.shows.qbo_deposit_liability_item_id
  IS 'QBO Item ID mapped to Customer Deposits liability account — used when QBO_DEPOSIT_MODE=liability (target accrual workflow)';
