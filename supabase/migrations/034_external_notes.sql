-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 034: External (customer-facing) notes on contracts and quotes
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Splits notes into two fields:
--   - notes (existing)        → INTERNAL — staff-only, used for audit trail
--                               (refund processed, cancellation reason, etc.)
--   - external_notes (new)    → EXTERNAL — printed on the customer PDF and
--                               included in customer email
--
-- Per 2026-04-28 meeting: salesperson needs to capture both kinds of notes.
-- External must render on the contract PDF; internal must NOT.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS external_notes text;

COMMENT ON COLUMN public.contracts.notes          IS 'Internal-only notes — never rendered on customer PDF or email.';
COMMENT ON COLUMN public.contracts.external_notes IS 'Customer-facing notes — printed on contract PDF and included in customer email.';
