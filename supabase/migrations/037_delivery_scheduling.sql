-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 037: Delivery Scheduling Enhancements
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Extends delivery_work_orders with the fields the meeting flagged
-- (window, override address, special instructions) and adds a one-click
-- balance-call audit log per Lori's request.

ALTER TABLE public.delivery_work_orders
  ADD COLUMN IF NOT EXISTS scheduled_window      text,
  ADD COLUMN IF NOT EXISTS delivery_address      text,
  ADD COLUMN IF NOT EXISTS special_instructions  text,
  ADD COLUMN IF NOT EXISTS readiness_overridden  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS readiness_overridden_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS readiness_override_reason text;

CREATE INDEX IF NOT EXISTS dwo_scheduled_date_idx
  ON public.delivery_work_orders (scheduled_date)
  WHERE status IN ('scheduled', 'in_progress');

-- Lightweight log so Lori can record "I called the customer about balance" without
-- digging through the audit log
CREATE TABLE IF NOT EXISTS public.balance_call_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  called_by uuid REFERENCES auth.users(id),
  outcome text CHECK (outcome IN ('paid','will_pay','no_answer','disputed','other')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS balance_call_contract_idx ON public.balance_call_log(contract_id);

ALTER TABLE public.balance_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balance_call_read"   ON public.balance_call_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "balance_call_insert" ON public.balance_call_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

COMMENT ON COLUMN public.delivery_work_orders.scheduled_window IS 'Time window like "2-4 PM" — customer-friendly delivery slot.';
COMMENT ON COLUMN public.delivery_work_orders.readiness_overridden IS 'True if a manager bypassed the readiness gate (DL/balance/permit/HOA missing).';
COMMENT ON TABLE  public.balance_call_log IS 'Audit log of staff calls about outstanding balance — Lori uses this from her dashboard.';
