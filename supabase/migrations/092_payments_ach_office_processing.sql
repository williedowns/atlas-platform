-- 092_payments_ach_office_processing.sql
-- Adds ACH bank-account columns to the payments table so the salesperson can
-- save routing+account+type+holder when the Intuit eCheck submission fails
-- (or the rep proactively chooses to defer). The office runs the ACH manually
-- and reconciles it later. Mirrors how check_number / bank_name already live
-- on payments for manual check entries.
--
-- The column shape is identical to the existing DepositSplit fields on the
-- contract row (ach_routing_number, ach_account_number, ach_account_holder_name,
-- ach_bank_name on deposit_splits JSONB) — but stored on the payment so the
-- bookkeeper sees them next to the deposit_collected payment.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS ach_routing_number text,
  ADD COLUMN IF NOT EXISTS ach_account_number text,
  ADD COLUMN IF NOT EXISTS ach_account_type text,
  ADD COLUMN IF NOT EXISTS ach_account_holder_name text;

COMMENT ON COLUMN public.payments.ach_routing_number IS
  'ABA routing number captured for office-processed ACH deposits. Used when the salesperson defers ACH submission (e.g. Intuit eCheck rejected the bank info) so the office can run the ACH manually.';

COMMENT ON COLUMN public.payments.ach_account_number IS
  'Bank account number captured for office-processed ACH deposits. Plaintext is acceptable here — payments table is RLS-protected and only admin/manager/bookkeeper roles read these rows.';

COMMENT ON COLUMN public.payments.ach_account_type IS
  'PERSONAL_CHECKING | PERSONAL_SAVINGS | BUSINESS_CHECKING — same enum the Intuit eCheck API uses.';

COMMENT ON COLUMN public.payments.ach_account_holder_name IS
  'Account holder name as entered by the salesperson, used by the office when running the ACH.';
