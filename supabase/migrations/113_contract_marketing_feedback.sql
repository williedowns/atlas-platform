-- ── 113_contract_marketing_feedback.sql ─────────────────────────────────────
-- Issue 6 (Blake, May 2026 show floor): replace the free-text marketing_feedback
-- that lived on the show workbook (show_deal_overrides) with a STRUCTURED,
-- internal lead-attribution checklist captured in Step 5 of the contract builder
-- — how the customer heard about the show, what drew them to the Atlas booth, and
-- whether it was their first Atlas show.
--
-- Stored as jsonb on contracts so it travels with the deal. Shape is owned by
-- src/lib/marketing-feedback.ts (MarketingFeedback) and validated at the API
-- boundary by normalizeMarketingFeedback() before insert. INTERNAL ONLY — the
-- customer PDF route emits external_notes, never this column.
--
-- Additive + idempotent. A brand-new nullable column:
--   * touches no existing row (every current contract reads back NULL),
--   * cannot break already-signed contracts,
--   * needs no RLS change — column-add does not alter row visibility, and the
--     existing contracts policies already scope who can read/write a row.
-- ---------------------------------------------------------------------------

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS marketing_feedback jsonb;

COMMENT ON COLUMN public.contracts.marketing_feedback IS
  'Additive (113): internal lead-attribution checklist captured in Step 5 of the contract builder. Shape = src/lib/marketing-feedback.ts MarketingFeedback {heard_about[], heard_about_other?, first_time_visitor?, booth_draw?}. NULL when untouched. INTERNAL ONLY — never rendered on the customer PDF.';

-- ─── ROLLBACK (run to revert) ────────────────────────────────────────────────
/*
ALTER TABLE public.contracts DROP COLUMN IF EXISTS marketing_feedback;
*/
