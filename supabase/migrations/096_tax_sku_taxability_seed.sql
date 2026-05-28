-- ── 096_tax_sku_taxability_seed.sql ──────────────────────────────────────
-- Initial per-state taxability for Atlas's SKU categories.
--
-- THIS IS A DRAFT — every row must be reviewed and signed off by Ian Allena
-- (Atlas's CPA) before it can be relied upon. Until ian_approved_at is set,
-- the OTD calculator should fall back to a conservative "taxable" default
-- and surface a warning.
--
-- Sources cited per row:
--   TX: Texas Comptroller Pub 96-211, Rule 3.291, Rule 3.303, Rule 3.357, Pub 94-157
--   LA: LDR LAC 61:I.4372, Revenue Ruling 01-007
--   OK: OAC 710:65-1-9, OAC 710:65-19-365
--   KS: K.S.A. 79-3603, Pub. KS-1525, Notice 23-02
-- -------------------------------------------------------------------------

INSERT INTO public.tax_sku_taxability
  (sku_category, state, is_taxable, notes, citation)
VALUES
  -- ── Hot tub / spa unit itself (TPP everywhere) ──────────────────────────
  ('spa_unit', 'TX', true, 'Generic TPP; taxable at combined rate.', 'TX Tax Code §151.010'),
  ('spa_unit', 'LA', true, 'Generic TPP.', 'LA R.S. 47:301 et seq.'),
  ('spa_unit', 'OK', true, 'Generic TPP.', 'OAC 710:65'),
  ('spa_unit', 'KS', true, 'Generic TPP.', 'K.S.A. 79-3603'),

  -- ── Delivery charges (varies by state) ──────────────────────────────────
  ('delivery', 'TX', true,
    'Delivery charges are taxable even when separately stated (part of sales price).',
    'TX Rule 3.303'),
  ('delivery', 'LA', false,
    'Not taxable IF separately stated AND buyer had option to pick up. Otherwise taxable. Some parishes tax anyway — confirm at parish.',
    'LDR Revenue Ruling 01-007'),
  ('delivery', 'OK', false,
    'Not taxable when separately stated on invoice. Bundled = fully taxable.',
    'OAC 710:65-1-9'),
  ('delivery', 'KS', false,
    'Not taxable when separately stated and clearly denominated. Reversed July 1, 2023.',
    'KDOR Notice 23-02'),

  -- ── Installation labor on portable / above-ground spa (TPP) ─────────────
  ('install_labor_portable', 'TX', true,
    'Portable spa = TPP. Install labor taxable as part of TPP sale.',
    'TX Rule 3.357'),
  ('install_labor_portable', 'LA', true,
    'Portable spa = movable property. Labor on movable property taxable.',
    'LAC 61:I.4372'),
  ('install_labor_portable', 'OK', false,
    'Install labor not taxable IF separately stated on invoice.',
    'OAC 710:65'),
  ('install_labor_portable', 'KS', false,
    'Residential original install = exempt. Commercial install on TPP = taxable.',
    'Pub. KS-1525'),

  -- ── Installation labor on built-in / in-deck spa (real property) ────────
  ('install_labor_builtin', 'TX', false,
    'In-deck install = real property improvement. Residential install labor NOT taxable; contractor pays use tax on materials.',
    'TX Rule 3.291; Pub 94-157'),
  ('install_labor_builtin', 'LA', false,
    'Immovable property labor not taxable; contractor pays tax on materials.',
    'LAC 61:I.4372'),
  ('install_labor_builtin', 'OK', false,
    'Residential real property improvement labor not taxable when separately stated.',
    'OAC 710:65'),
  ('install_labor_builtin', 'KS', false,
    'Residential original construction labor exempt.',
    'Pub. KS-1525'),

  -- ── Crushed granite pad (residential real property service) ─────────────
  ('granite_pad_residential', 'TX', false,
    'Residential real property service. Labor NOT taxable. Contractor (Atlas) pays use tax on granite material at purchase. CURRENT 8.25% APPLIED IS OVER-COLLECTION — confirm with Ian.',
    'TX Rule 3.291; Pub 94-157'),
  ('granite_pad_residential', 'LA', false,
    'Immovable property labor not taxable.',
    'LAC 61:I.4372'),
  ('granite_pad_residential', 'OK', false,
    'Residential improvement labor not taxable when separately stated.',
    'OAC 710:65'),
  ('granite_pad_residential', 'KS', false,
    'Residential original installation exempt.',
    'Pub. KS-1525'),

  -- ── Crushed granite pad (commercial) ────────────────────────────────────
  ('granite_pad_commercial', 'TX', true,
    'Commercial = taxable real property service.',
    'TX Rule 3.291'),
  ('granite_pad_commercial', 'LA', true,
    'Confirm with parish — varies.',
    'parish-specific'),
  ('granite_pad_commercial', 'OK', true,
    'Generally taxable.',
    'OAC 710:65'),
  ('granite_pad_commercial', 'KS', true,
    'Commercial install on TPP taxable.',
    'K.S.A. 79-3603(p)'),

  -- ── Accessories (covers, lifters, steps, chemicals) ─────────────────────
  ('cover',     'TX', true, 'TPP.', 'TX Tax Code §151.010'),
  ('cover',     'LA', true, 'TPP.', 'LA R.S. 47:301'),
  ('cover',     'OK', true, 'TPP.', 'OAC 710:65'),
  ('cover',     'KS', true, 'TPP.', 'K.S.A. 79-3603'),

  ('lifter',    'TX', true, 'TPP.', 'TX Tax Code §151.010'),
  ('lifter',    'LA', true, 'TPP.', 'LA R.S. 47:301'),
  ('lifter',    'OK', true, 'TPP.', 'OAC 710:65'),
  ('lifter',    'KS', true, 'TPP.', 'K.S.A. 79-3603'),

  ('steps',     'TX', true, 'TPP.', 'TX Tax Code §151.010'),
  ('steps',     'LA', true, 'TPP.', 'LA R.S. 47:301'),
  ('steps',     'OK', true, 'TPP.', 'OAC 710:65'),
  ('steps',     'KS', true, 'TPP.', 'K.S.A. 79-3603'),

  ('chemicals', 'TX', true, 'Retail TPP — not exempt as ingredient/component.', 'TX Tax Code §151.010'),
  ('chemicals', 'LA', true, 'Retail TPP.', 'LA R.S. 47:301'),
  ('chemicals', 'OK', true, 'Retail TPP.', 'OAC 710:65'),
  ('chemicals', 'KS', true, 'Retail TPP; not exempt as ingredient.', 'K.S.A. 79-3603'),

  -- ── Extended warranty / service contract ────────────────────────────────
  ('warranty_extended', 'TX', false,
    'Separately stated extended warranty on TPP generally NOT taxable at sale. Parts used to fulfill are taxable to provider on withdrawal. Some recent rulings shifting — fact-specific.',
    'TX Comptroller STAR rulings'),
  ('warranty_extended', 'LA', true,
    'Taxable as a service when warranty covers TPP located in LA. Parts used are exempt to provider.',
    'LDR guidance'),
  ('warranty_extended', 'OK', false,
    'Optional warranties NOT taxable; mandatory bundled warranties taxable as part of sales price. Atlas warranties are optional → not taxable.',
    'OAC 710:65-19-365'),
  ('warranty_extended', 'KS', true,
    'KS treats extended warranties on TPP as taxable services.',
    'K.S.A. 79-3603')
ON CONFLICT (sku_category, state) DO NOTHING;

COMMENT ON TABLE public.tax_sku_taxability IS
  'Per-state taxability of Atlas SKU categories. Rows are DRAFT until ian_approved_at is set. Until then the OTD calculator should fall back to default-taxable and warn.';
