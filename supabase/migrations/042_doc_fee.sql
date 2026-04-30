-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 042: Document Fee — auto-add to every contract, always-taxed
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ROOT CAUSE: Sales reps were manually adding a $99 "Documentation Fee" line
-- item from the products catalog. When the contract was Tax Exempt (TX Rx
-- on file), the existing tax math zeroed out tax on the entire subtotal —
-- including the doc fee. State law requires the doc-fee tax to ALWAYS be
-- collected even with a Rx, and that portion is never refunded when the
-- prescription certificate arrives. Robert Kennedy caught both during 04-30
-- iPad QA ("dollar amount for In-House isn't correct, it's removing the
-- taxes from the $99 doc fee. The state makes us collect and pay that even
-- with a Rx").
--
-- FIX: Promote the doc fee to a first-class field on the contract row with
-- its own waivable flag and its own persisted tax amount. Doc-fee tax is
-- computed and stored separately from items tax so reconciliation /
-- bookkeeping flows can see exactly which portion survives a Rx refund.
--
-- All defaults preserve existing-row behavior:
--   - doc_fee_amount defaults to 99 (every legacy contract reads as $99
--     even though it was previously a line item — the legacy line item
--     stays in line_items[] untouched, so the totals don't double-count
--     because the saved subtotal/total are already canonical)
--   - doc_fee_waived defaults to false
--   - doc_fee_tax_amount defaults to 0
-- ═══════════════════════════════════════════════════════════════════════════

-- Column-level default is 0/true so EXISTING contracts (which already had
-- a $99 Documentation Fee as a manual line item) don't double-count or
-- render a phantom Document Fee line in their PDFs. The application
-- (contractStore initialDraft) sets doc_fee_amount=99 / doc_fee_waived=false
-- for NEW drafts, which then flow through to /api/contracts on insert.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS doc_fee_amount     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doc_fee_waived     boolean       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS doc_fee_tax_amount numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.contracts.doc_fee_amount IS
  'Documentation fee in dollars, auto-added to every contract at sale time. Default $99 per Atlas paper Sales Agreement.';
COMMENT ON COLUMN public.contracts.doc_fee_waived IS
  'True when the sales rep waived the doc fee. When true, doc_fee_amount and doc_fee_tax_amount are excluded from totals.';
COMMENT ON COLUMN public.contracts.doc_fee_tax_amount IS
  'Tax dollars collected on the doc fee. ALWAYS charged at the contract''s tax_rate even when tax_exempt is true — this is the portion that is never refunded when an Rx arrives.';

-- ─── Catalog cleanup: deactivate any legacy "Documentation Fee" product ────
-- Sales reps used to pick this from the products dropdown. Now that it's
-- a first-class field, hide it from the picker so they can't accidentally
-- double-add it. We do NOT delete the row — old contracts may still have
-- line_items[] referencing this product_id by name; deactivating just
-- removes it from the active=true filter the picker uses.

UPDATE public.products
   SET active = false
 WHERE active = true
   AND (
        lower(name) LIKE '%documentation fee%'
     OR lower(name) LIKE '%doc fee%'
     OR lower(name) = 'documentation'
   );
