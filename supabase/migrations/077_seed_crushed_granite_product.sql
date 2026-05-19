-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 077: Seed Crushed Granite Base product
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds the "Crushed Granite Base" site-prep product that is auto-attached to
-- every spa / swim spa / cold tub line item when a sales rep adds one to a
-- contract in Step 3. Quantity is driven by the spa's longest dimension
-- (length_ft or width_ft), price is one of $135 / $140 / $145 per linear foot
-- with $145 as default.
--
-- Spec note: Willie inserted this row inline in production already. This
-- migration is the source-of-truth idempotent version so a fresh environment
-- (staging, dev reset, new region) lands in the same state. ON CONFLICT on
-- qbo_item_id keeps it re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.products (
  id,
  qbo_item_id,
  name,
  sku,
  category,
  msrp,
  floor_price,
  description,
  active,
  has_serial,
  length_ft,
  width_ft
) VALUES (
  '812df407-4f9a-4596-9f65-0d73426eddb0',
  '265',
  'Crushed Granite Base',
  'CGB',
  'Site Preparation',
  145.00,
  135.00,
  'Crushed granite base for spa, swim spa, or cold tub installation. Priced per linear foot, includes delivery and leveling.',
  true,
  false,
  NULL,
  NULL
)
ON CONFLICT (qbo_item_id) DO UPDATE
  SET name        = EXCLUDED.name,
      sku         = EXCLUDED.sku,
      category    = EXCLUDED.category,
      msrp        = EXCLUDED.msrp,
      floor_price = EXCLUDED.floor_price,
      description = EXCLUDED.description,
      active      = EXCLUDED.active,
      has_serial  = EXCLUDED.has_serial;
