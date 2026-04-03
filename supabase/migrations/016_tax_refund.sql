-- Migration 016: Tax Refund tracking on contracts
-- Run in Supabase SQL Editor → New Query

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tax_refund_amount     decimal(10,2),
  ADD COLUMN IF NOT EXISTS tax_refund_issued_at  timestamptz,
  ADD COLUMN IF NOT EXISTS tax_refund_notes      text,
  ADD COLUMN IF NOT EXISTS tax_refund_issued_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contracts.tax_refund_amount    IS 'Amount of tax refunded to customer (e.g. after TX exemption cert received)';
COMMENT ON COLUMN public.contracts.tax_refund_issued_at IS 'Timestamp when the tax refund was issued/recorded';
COMMENT ON COLUMN public.contracts.tax_refund_notes     IS 'How the refund was processed (e.g. "Credit memo in QB", "Direct refund via ACH")';
COMMENT ON COLUMN public.contracts.tax_refund_issued_by IS 'Staff member who recorded the refund';
