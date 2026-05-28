-- ── 099_contracts_tax_refund_reason.sql ───────────────────────────────────
-- Add `tax_refund_reason` to contracts so audit defense can answer
-- "WHY did Atlas refund tax on this contract?"
--
-- Context: Avalara consultation 2026-05-28 highlighted that audit defense
-- requires a chain from refund event → reason → original tax decision. Today
-- we capture amount + free-text notes; the categorized reason is missing.
--
-- Common scenarios this captures:
--   - TX hydrotherapy Rx received post-sale → reimburse tax
--   - OK disabled veteran cert received post-sale → reimburse tax
--   - Customer provided resale certificate after the fact
--   - Wrong rate originally applied (admin correction)
--   - Customer dispute resolved in their favor
--
-- The column is NULLABLE so existing refund rows aren't broken. The API
-- requires it on NEW refunds. UI surfaces a dropdown.
-- -------------------------------------------------------------------------

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tax_refund_reason text;

-- Enum-like CHECK constraint. Use 'other' + free-text notes as the escape hatch.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'contracts'
      AND constraint_name = 'contracts_tax_refund_reason_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_tax_refund_reason_check
      CHECK (tax_refund_reason IS NULL OR tax_refund_reason IN (
        'tx_hydrotherapy_rx',
        'ok_disabled_veteran',
        'resale_certificate',
        'corrected_rate',
        'customer_dispute',
        'other'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.contracts.tax_refund_reason IS
  'Categorized reason for a tax refund (audit defense). One of: tx_hydrotherapy_rx, ok_disabled_veteran, resale_certificate, corrected_rate, customer_dispute, other. NULL for refunds issued before this column existed.';

-- Index for audit queries by reason
CREATE INDEX IF NOT EXISTS idx_contracts_tax_refund_reason
  ON public.contracts (tax_refund_reason)
  WHERE tax_refund_reason IS NOT NULL;
