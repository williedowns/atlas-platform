-- ── 097_tax_add_arkansas.sql ─────────────────────────────────────────────
-- Add Arkansas (AR) to the multi-state tax tables.
--
-- Context: discovered 2026-05-28 during Avalara sales call that Atlas is
-- registered in AR ("brand new... I didn't even know we were set up").
-- AR Comptroller exposes a free public lookup at gis.arkansas.gov; client
-- already shipped at src/lib/tax/arGisClient.ts.
--
-- This migration:
--   1. Drops the existing 4-state CHECK constraints and replaces them with
--      5-state versions (TX/LA/OK/KS/AR)
--   2. Seeds the 11 AR rows into tax_sku_taxability
--
-- Idempotent: CHECK constraints re-created; INSERT uses ON CONFLICT DO NOTHING.
-- -------------------------------------------------------------------------

-- ── 1. Drop & recreate CHECK constraints to include 'AR' ──────────────────
ALTER TABLE public.tax_rates_raw
  DROP CONSTRAINT IF EXISTS tax_rates_raw_state_check;
ALTER TABLE public.tax_rates_raw
  ADD CONSTRAINT tax_rates_raw_state_check
  CHECK (state IN ('TX','LA','OK','KS','AR'));

-- tax_rates_by_zip previously excluded LA — keep that, just add AR
ALTER TABLE public.tax_rates_by_zip
  DROP CONSTRAINT IF EXISTS tax_rates_by_zip_state_check;
ALTER TABLE public.tax_rates_by_zip
  ADD CONSTRAINT tax_rates_by_zip_state_check
  CHECK (state IN ('TX','OK','KS','AR'));

ALTER TABLE public.tax_show_locations
  DROP CONSTRAINT IF EXISTS tax_show_locations_state_check;
ALTER TABLE public.tax_show_locations
  ADD CONSTRAINT tax_show_locations_state_check
  CHECK (state IN ('TX','LA','OK','KS','AR'));

ALTER TABLE public.tax_sku_taxability
  DROP CONSTRAINT IF EXISTS tax_sku_taxability_state_check;
ALTER TABLE public.tax_sku_taxability
  ADD CONSTRAINT tax_sku_taxability_state_check
  CHECK (state IN ('TX','LA','OK','KS','AR'));

-- ── 2. Seed Arkansas taxability rows (11 categories × AR) ─────────────────
-- Same SKU categories as the 4-state seed; AR is a Streamlined Sales Tax
-- (SST) member, so taxability is largely uniform with TPP rules. Atlas
-- doesn't sell food, so the AR food-rate special case isn't relevant here.
--
-- All rows ian_approved_at = NULL until Ian signs off.

INSERT INTO public.tax_sku_taxability
  (sku_category, state, is_taxable, notes, citation)
VALUES
  ('spa_unit', 'AR', true,
    'Generic TPP; taxable at AR combined rate.',
    'A.C.A. §26-52-301; SST taxability matrix'),

  ('delivery', 'AR', false,
    'Delivery charges separately stated and elected by buyer are NOT taxable in AR. If bundled into sales price, taxable.',
    'A.C.A. §26-52-103; AR Rule GR-18'),

  ('install_labor_portable', 'AR', true,
    'Portable spa = TPP. Install labor taxable as part of TPP sale.',
    'A.C.A. §26-52-301; AR Rule GR-9'),

  ('install_labor_builtin', 'AR', false,
    'In-deck install = real property improvement. Residential install labor NOT taxable; contractor pays use tax on materials.',
    'A.C.A. §26-52-301; AR Rule GR-21 (construction contractors)'),

  ('granite_pad_residential', 'AR', false,
    'Residential real property service. Labor NOT taxable. Contractor (Atlas) pays use tax on granite material at purchase.',
    'AR Rule GR-21 (construction contractors)'),

  ('granite_pad_commercial', 'AR', true,
    'Commercial = taxable. Confirm with Ian for specific commercial scenarios.',
    'A.C.A. §26-52-301'),

  ('cover',     'AR', true, 'TPP.', 'A.C.A. §26-52-301'),
  ('lifter',    'AR', true, 'TPP.', 'A.C.A. §26-52-301'),
  ('steps',     'AR', true, 'TPP.', 'A.C.A. §26-52-301'),
  ('chemicals', 'AR', true, 'Retail TPP — not exempt as ingredient/component.', 'A.C.A. §26-52-301'),

  ('warranty_extended', 'AR', true,
    'AR treats extended warranties on TPP as taxable services. Confirm with Ian — fact-specific.',
    'A.C.A. §26-52-316; AR Rule GR-26')
ON CONFLICT (sku_category, state) DO NOTHING;

-- ── 3. Sanity verification ────────────────────────────────────────────────
-- Expected: 11 new AR rows (one per SKU category).
-- Run separately after migration: SELECT count(*) FROM public.tax_sku_taxability WHERE state = 'AR';
