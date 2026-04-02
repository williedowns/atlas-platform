-- ============================================================
-- Migration 008: Add delivery tracking columns to inventory_units
-- Captures spreadsheet fields not previously stored:
--   - delivery_info: raw "Completed" column (truck dates, add-on notes, delivery dates)
--   - foundation_financing: customer financed through Foundation Financial (color-coded in spreadsheet)
--   - scheduled_owes: customer is scheduled for delivery but has an outstanding balance
-- ============================================================

ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS delivery_info text,
  ADD COLUMN IF NOT EXISTS foundation_financing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_owes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.inventory_units.delivery_info IS
  'Raw value from spreadsheet Completed column: delivery dates, truck dates, add-on work (SALT, WiFi, lights), storage notes, USED/SWAP info';

COMMENT ON COLUMN public.inventory_units.foundation_financing IS
  'True if customer financed through Foundation Financial (previously stored as cell background color in spreadsheet)';

COMMENT ON COLUMN public.inventory_units.scheduled_owes IS
  'True if customer has a scheduled delivery date but still has a balance owed (previously stored as cell background color)';
