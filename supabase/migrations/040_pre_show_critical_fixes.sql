-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 040: Pre-Show CRITICAL Audit Fixes
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two ship-blockers identified during the 2026-04-29 deep audit:
--
-- 1. contracts.tax_exempt boolean column missing — Step 5 toggle was cosmetic;
--    /api/contracts and /api/quotes never persisted the value. Customers
--    flagged exempt at the show would have the flag silently lost. Adding the
--    column and the API routes are updated to persist it.
--
-- 2. customer_files RLS policy "customer_files_read" allowed ANY authenticated
--    user to read every customer's driver's licenses, ACH voided checks, and
--    proof-of-homeownership files. PII leak across orgs / sales reps. Tighten
--    so admin/manager/bookkeeper see all, sales reps see files for customers
--    on their own contracts, and uploaders always see their own uploads.

-- ─── Fix 1: contracts.tax_exempt column ────────────────────────────────────

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contracts.tax_exempt IS
  'True when this contract is flagged tax-exempt (Texas Form 01-339). When true, tax_amount is set to 0 at the POS and the customer must upload the certificate via the portal.';

-- ─── Fix 2: tighten customer_files SELECT policy ───────────────────────────

DROP POLICY IF EXISTS "customer_files_read" ON public.customer_files;

CREATE POLICY "customer_files_read" ON public.customer_files
  FOR SELECT USING (
    -- Admins/managers/bookkeepers can read all customer files
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'bookkeeper')
    )
    -- Sales reps can read files for customers on their own contracts
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.customer_id = customer_files.customer_id
        AND c.sales_rep_id = auth.uid()
    )
    -- The user who uploaded a file can always read it back
    OR uploaded_by = auth.uid()
  );

COMMENT ON POLICY "customer_files_read" ON public.customer_files IS
  'Tightened 2026-04-29: prior policy allowed any authenticated user to read every customer file (PII leak). Now scoped to admin/manager/bookkeeper, the assigned sales rep, or the uploader.';
