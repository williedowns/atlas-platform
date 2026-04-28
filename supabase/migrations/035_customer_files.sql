-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 035: Customer Files Vault
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Per 2026-04-28 meeting (Robert Kennedy + Lindy + Ryan):
-- We need ONE general-purpose document vault per customer that holds
-- driver's licenses, proof-of-homeownership, permit receipts, surveys,
-- HOA approvals, ACH voided checks, wet-sig contracts, photos, etc.
--
-- A category dropdown lets us filter and surface required-but-missing
-- documents (e.g., "Foundation customer is missing proof-of-homeownership").

CREATE TABLE IF NOT EXISTS public.customer_files (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contract_id     uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  category        text NOT NULL CHECK (category IN (
    'drivers_license',
    'proof_of_homeownership',
    'permit_receipt',
    'survey',
    'hoa_approval',
    'income_verification',
    'ach_voided_check',
    'wet_signature_contract',
    'photo',
    'other'
  )),
  filename        text NOT NULL,
  storage_path    text NOT NULL,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid REFERENCES auth.users(id),
  internal_notes  text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_files_customer_idx ON public.customer_files(customer_id);
CREATE INDEX IF NOT EXISTS customer_files_contract_idx ON public.customer_files(contract_id);
CREATE INDEX IF NOT EXISTS customer_files_category_idx ON public.customer_files(category);

ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all customer files (org scoping comes via the
-- customer/contract joins; refine in 033-style audit later).
CREATE POLICY "customer_files_read" ON public.customer_files
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "customer_files_insert" ON public.customer_files
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "customer_files_delete" ON public.customer_files
  FOR DELETE USING (auth.role() = 'authenticated');

COMMENT ON TABLE  public.customer_files IS 'Per-customer document vault — DL, proof of ownership, ACH, permits, photos, etc.';
COMMENT ON COLUMN public.customer_files.category IS 'Document type for filtering and required-doc gating.';
