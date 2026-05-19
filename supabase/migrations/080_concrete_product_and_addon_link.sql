-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 080: Seed Concrete Pad product + addon link column
-- ═══════════════════════════════════════════════════════════════════════════
-- (1) Seeds the "Concrete Pad" site-prep product that is added to an addon
--     contract created after a site visit when the customer opted for concrete
--     instead of crushed granite at the show. Default sell_price is 0.00 —
--     the salesperson enters the on-site bid at the customer's house.
--
-- (2) Adds parent_contract_id to contracts so an addon (concrete) contract
--     can link back to its parent (spa) contract. Nullable / optional —
--     existing contracts have NULL and behave unchanged.
--
-- Both rows / column have been run inline in production already. This
-- migration is the source-of-truth idempotent version so a fresh environment
-- lands in the same state.
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
  'b8e14da1-5084-43cd-9383-0d14ca92a33e',
  '270',
  'Concrete Pad',
  'CPB',
  'Site Preparation',
  0.00,
  0.00,
  'Concrete pad for spa, swim spa, or cold tub installation. Bid on-site after the show; price is entered by the salesperson at the customer''s house.',
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

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS parent_contract_id UUID REFERENCES public.contracts(id);
