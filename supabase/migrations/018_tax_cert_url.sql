-- Add URL column to store the uploaded tax exemption certificate file.
-- Allows the bookkeeper to click and view/download the actual cert document.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tax_exempt_cert_url TEXT;

COMMENT ON COLUMN public.contracts.tax_exempt_cert_url IS 'Public URL of the uploaded TX Form 01-339 tax exemption certificate';
