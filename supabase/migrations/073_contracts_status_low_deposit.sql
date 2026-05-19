-- ── 073_contracts_status_low_deposit.sql ────────────────────────────────
-- Extends the contracts.status enum to capture XLSX-only statuses that
-- the historical backfill (Lori Donahue's 137 expo workbooks) needs to
-- preserve. The XLSX uses 'Low Deposit' and 'Financing Pending' as
-- first-class deal statuses alongside OK / Cancelled / Contingent.
-- 'Contingent' continues to use the existing is_contingent boolean flag
-- since that already exists and is referenced by other features.
-- ---------------------------------------------------------------------------

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check CHECK (status IN (
    'draft','quote','pending_signature','signed','deposit_collected',
    'low_deposit','financing_pending',
    'in_production','ready_for_delivery','delivered','cancelled'
  ));
