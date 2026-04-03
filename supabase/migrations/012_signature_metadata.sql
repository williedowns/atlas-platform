-- Migration 012: Legal Signature Metadata
-- Stores IP address, user agent, consent timestamp for legal defensibility

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signature_metadata jsonb;

COMMENT ON COLUMN public.contracts.signature_metadata IS
  'Legal metadata captured at signing: ip_address, user_agent, consented_at, signed_name, electronic_consent (true/false). Makes canvas e-signature legally defensible.';
