-- Migration 010: Tax Exemption Certificate Tracking
-- Adds per-contract tracking for Texas Sales & Use Tax Exemption Certification
-- Customers have 30 days from purchase to submit Form 01-339 to Atlas Spas

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tax_exempt_cert_received boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exempt_cert_received_at timestamptz;

COMMENT ON COLUMN public.contracts.tax_exempt_cert_received IS
  'Whether the customer has submitted a Texas Sales & Use Tax Exemption Certificate (Form 01-339). Customers have 30 days from purchase date.';

COMMENT ON COLUMN public.contracts.tax_exempt_cert_received_at IS
  'Timestamp when the tax exemption certificate was marked as received by the bookkeeper.';
