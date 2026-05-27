-- 093_payments_processed_by_notes.sql
-- Phase 1 of the ACH Queue feature. The office (Lindy) needs to mark each
-- pending office-processed ACH as ran, with a signature trail. Adds:
--   processed_by uuid — who flipped pending→completed (Lindy / a manager)
--   notes text       — re-run notes ("ACH re ran on 9-11-25 (account info
--                       was incorrect)") and any other annotations the
--                       bookkeeper adds while working the queue
-- These mirror the Sign-Your-Name and Notes columns Lindy currently uses
-- in her Google Sheet ACH Atlas Log.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.payments.processed_by IS
  'The user (typically the office bookkeeper, Lindy) who flipped a pending ACH to completed. NULL for payments that were captured automatically (Intuit card charges, successful eChecks) — only set for office-processed ACHs marked ran from the ACH Queue.';

COMMENT ON COLUMN public.payments.notes IS
  'Free-text notes added by the bookkeeper while working a payment in the ACH Queue. Use for re-run history, bank rejection reasons, customer-confirmed account corrections, etc.';
