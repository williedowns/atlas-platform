-- ── 084_contract_pdf_archive.sql ─────────────────────────────────────────
-- Companion migration to 083 (Per Nat list). Adds an archive column so the
-- balance-to-financing conversion flow can preserve the original signed PDF
-- before regenerating with new financing terms.
--
-- Scenario (Willie + Natalie, 2026-05-20): customer signed a contract paying
-- balance by check, later called to convert that balance to financing. The
-- rep records the conversion → PDF regenerates with new terms. Original
-- signed PDF must remain available for legal defensibility.
--
-- Implementation: append-only text[] of prior URLs. Most recent first.
-- App code pushes the current contract_pdf_url onto the array, then sets
-- contract_pdf_url to null (forces regen on next view).

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contract_pdf_archive_urls text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.contracts.contract_pdf_archive_urls IS
  'Append-only history of prior contract_pdf_url values. New entries pushed at index 0 (most recent first) when the contract is materially modified post-signing — financing added, line items changed, etc. Original signed PDF preserved here for legal defensibility.';
