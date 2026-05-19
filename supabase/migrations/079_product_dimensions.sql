-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 079: Product Dimensions for Crushed Granite Base auto-calc
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds length_ft and width_ft to public.products and populates 63 spa /
-- hot tub / cold tub SKUs with their physical dimensions.
--
-- Sourced 2026-05-19 from manufacturer sites (masterspas.com,
-- h2xswimspa.com, michaelphelpsswimspa.com, chillygoattubs.com). See
-- session notes for confidence flags.
--
-- Saunas (3 SKUs) and accessories intentionally left NULL so the
-- granite-add UI skips them via `length_ft IS NULL` check.
--
-- Keyed on `sku` because `model_code` is NULL on ~half the rows in
-- production. Idempotent: ALTER guarded by IF NOT EXISTS, UPDATEs are
-- same-value re-runs.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS length_ft NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS width_ft  NUMERIC(5,2);

BEGIN;

-- Clarity Series (7)
UPDATE public.products SET length_ft = 6.50, width_ft = 6.50 WHERE sku = 'CLS BALANCE 6';
UPDATE public.products SET length_ft = 6.50, width_ft = 6.50 WHERE sku = 'CLS BALANCE 6 CS';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'CLS BALANCE 7';
UPDATE public.products SET length_ft = 7.83, width_ft = 7.83 WHERE sku = 'CLS BALANCE 8';
UPDATE public.products SET length_ft = 9.00, width_ft = 7.83 WHERE sku = 'CLS BALANCE 9';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'CLS PRECISION 7';
UPDATE public.products SET length_ft = 7.83, width_ft = 7.83 WHERE sku = 'CLS PRECISION 8';

-- Twilight Series (8)
UPDATE public.products SET length_ft = 6.50, width_ft = 6.50 WHERE sku = 'TS 240';
UPDATE public.products SET length_ft = 6.50, width_ft = 6.50 WHERE sku = 'TS 240X';
UPDATE public.products SET length_ft = 6.50, width_ft = 6.50 WHERE sku = 'TS 6.2';
UPDATE public.products SET length_ft = 7.00, width_ft = 5.83 WHERE sku = 'TS 67.25';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'TS 7.2';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'TS 7.25';
UPDATE public.products SET length_ft = 7.83, width_ft = 7.83 WHERE sku = 'TS 8.2';
UPDATE public.products SET length_ft = 7.83, width_ft = 7.83 WHERE sku = 'TS 8.25';

-- Getaway Series (5)
UPDATE public.products SET length_ft = 7.25, width_ft = 7.25 WHERE sku = 'GS BARHARBOR LE';
UPDATE public.products SET length_ft = 7.17, width_ft = 7.17 WHERE sku = 'GS BARHARBOR SE';
UPDATE public.products SET length_ft = 7.17, width_ft = 6.00 WHERE sku = 'GS OCHO RIOS CS';
UPDATE public.products SET length_ft = 7.17, width_ft = 6.00 WHERE sku = 'GS OCHO RIOS SE';
UPDATE public.products SET length_ft = 5.75, width_ft = 6.58 WHERE sku = 'GS SANMIGUEL';

-- LH Series — Healthy Living (8)
-- LH 5 yellow: matched to LH L5 spec (no standalone LH 5 on current Master Spas site)
UPDATE public.products SET length_ft = 6.50, width_ft = 5.00 WHERE sku = 'LH 5';
UPDATE public.products SET length_ft = 6.50, width_ft = 6.50 WHERE sku = 'LH 6';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'LH 7';
UPDATE public.products SET length_ft = 6.50, width_ft = 5.00 WHERE sku = 'LH L5';
UPDATE public.products SET length_ft = 6.50, width_ft = 6.50 WHERE sku = 'LH L6';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'LH L7';
UPDATE public.products SET length_ft = 6.50, width_ft = 6.50 WHERE sku = 'LH S6';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'LH S7';

-- MP Legend Series — LSX hot tubs (5)
UPDATE public.products SET length_ft = 7.83, width_ft = 7.83 WHERE sku = 'MPL 30';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'MPL 700';
UPDATE public.products SET length_ft = 7.83, width_ft = 7.83 WHERE sku = 'MPL 800';
UPDATE public.products SET length_ft = 7.83, width_ft = 7.83 WHERE sku = 'MPL 850';
UPDATE public.products SET length_ft = 9.00, width_ft = 7.83 WHERE sku = 'MPL 900';

-- H2X Challenger Swim Spas (7)
UPDATE public.products SET length_ft = 15.00, width_ft = 7.83 WHERE sku = 'H2X CHA 15D';
UPDATE public.products SET length_ft = 15.00, width_ft = 7.83 WHERE sku = 'H2X CHA 15D w/ Temp+ Control';
UPDATE public.products SET length_ft = 17.92, width_ft = 7.83 WHERE sku = 'H2X CHA 18D';
UPDATE public.products SET length_ft = 17.92, width_ft = 7.83 WHERE sku = 'H2X CHA 18PRO';
UPDATE public.products SET length_ft = 19.25, width_ft = 7.83 WHERE sku = 'H2X CHA 19D';
UPDATE public.products SET length_ft = 19.25, width_ft = 7.83 WHERE sku = 'H2X CHA 19M';
UPDATE public.products SET length_ft = 21.42, width_ft = 7.83 WHERE sku = 'H2X CHA 21D';

-- H2X Trainer Swim Spas (10)
UPDATE public.products SET length_ft = 12.00, width_ft = 7.83 WHERE sku = 'H2X TRAINER12';
UPDATE public.products SET length_ft = 15.00, width_ft = 7.83 WHERE sku = 'H2X TRAINER15';
UPDATE public.products SET length_ft = 15.00, width_ft = 7.83 WHERE sku = 'H2X TRAINER15D';
UPDATE public.products SET length_ft = 15.00, width_ft = 7.83 WHERE sku = 'H2X TRAINER15D w/ Temp+ Control';
UPDATE public.products SET length_ft = 17.92, width_ft = 7.83 WHERE sku = 'H2X TRAINER18D';
UPDATE public.products SET length_ft = 19.25, width_ft = 7.83 WHERE sku = 'H2X TRAINER19';
UPDATE public.products SET length_ft = 19.25, width_ft = 7.83 WHERE sku = 'H2X TRAINER19D';
UPDATE public.products SET length_ft = 19.25, width_ft = 7.83 WHERE sku = 'H2X TRAINER19M';
UPDATE public.products SET length_ft = 21.42, width_ft = 7.83 WHERE sku = 'H2X TRAINER21';
UPDATE public.products SET length_ft = 21.42, width_ft = 7.83 WHERE sku = 'H2X TRAINER21D';

-- H2X Therapool Swim Spas (4)
-- Therapool D + SE flagged for showroom verification (footprint unusual vs 13/15 pattern)
UPDATE public.products SET length_ft = 13.00, width_ft = 7.50 WHERE sku = 'H2X THERAPOOL13';
UPDATE public.products SET length_ft = 15.00, width_ft = 7.50 WHERE sku = 'H2X THERAPOOL15';
UPDATE public.products SET length_ft = 11.00, width_ft = 7.83 WHERE sku = 'H2X THERAPOOL D';
UPDATE public.products SET length_ft = 11.00, width_ft = 7.83 WHERE sku = 'H2X THERAPOOL SE';

-- Michael Phelps Swim Spas (3)
UPDATE public.products SET length_ft = 19.25, width_ft = 7.83 WHERE sku = 'MP MOMENTUM D';
UPDATE public.products SET length_ft = 17.92, width_ft = 7.83 WHERE sku = 'MP SIGNATURE D';
UPDATE public.products SET length_ft = 17.92, width_ft = 7.83 WHERE sku = 'MP SIGNATURE PRO';

-- MP Chilly Goat Cold Tubs — hard-shell (6)
UPDATE public.products SET length_ft = 7.00, width_ft = 3.50 WHERE sku = 'CG ALPINE GLACI';
UPDATE public.products SET length_ft = 7.00, width_ft = 3.50 WHERE sku = 'CG ALPINE TERRA';
UPDATE public.products SET length_ft = 6.08, width_ft = 3.67 WHERE sku = 'CG MATTERHORN ONYX';
UPDATE public.products SET length_ft = 6.08, width_ft = 3.67 WHERE sku = 'CG MATTERHORN PB';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'CG VALARIS GLAC';
UPDATE public.products SET length_ft = 7.00, width_ft = 7.00 WHERE sku = 'CG VALARIS TERR';

COMMIT;
