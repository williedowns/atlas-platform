-- Delivery timeframe estimate on contracts.
--
-- Reps already track this informally in inventory_units.notes
-- ("Delivery Timeframe: 2-4 weeks from 3-14-26"). This formalizes it
-- onto the contract itself so it can be shown to the customer in the
-- portal AND printed on the contract PDF.
--
-- Two-stage display: while delivery isn't firm-scheduled, the customer
-- portal shows this estimated timeframe. Once a delivery_work_orders
-- row has a scheduled_date set, the portal shows the firm date instead.
--
-- Edit policy (enforced in the API, not at the DB level): sales_rep can
-- set at contract creation. Only admin/manager can change after that.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS delivery_timeframe            text,
  ADD COLUMN IF NOT EXISTS delivery_timeframe_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_timeframe_updated_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.contracts.delivery_timeframe IS
  'Sales-rep estimated delivery window — freeform text like "2-4 weeks", "Mid-June", "Late July". Editable by admin/manager after contract creation. Customer-visible in the portal and printed on the contract PDF until the firm delivery date (delivery_work_orders.scheduled_date) is set.';
