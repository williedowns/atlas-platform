-- 091_contract_total_adjustment.sql
-- Adds an admin-only post-tax adjustment to contracts. Used to reconcile
-- penny-precision mismatches between the contract total and what a financing
-- provider (e.g., GreenSky) actually processed — cases where the rep keyed in
-- $14,878.96 but the system calculated $14,878.97, and the books need to
-- match the cash that came in. The adjustment is added to the total without
-- touching the discount or the tax math, so sales tax stays correct.
--
-- The API enforces abs(total_adjustment_amount) <= 5 and requires a reason.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS total_adjustment_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_adjustment_reason text;

COMMENT ON COLUMN public.contracts.total_adjustment_amount IS
  'Admin-only post-tax adjustment to the contract total. Used to reconcile penny-precision mismatches (e.g. GreenSky funded $0.01 under the calculated total). Positive = customer owes more; negative = customer owes less. Tax and discount math are unaffected. API caps abs(value) at 5.';

COMMENT ON COLUMN public.contracts.total_adjustment_reason IS
  'Admin-provided audit trail for total_adjustment_amount. Required when amount is non-zero.';
