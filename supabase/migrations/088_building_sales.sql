-- Migration 088 — Atlas Building Systems sales
--
-- Atlas Building Systems is a separate division from Atlas Spas (sheds,
-- carports, decks, granite bases, in-ground pools). Sales are point-of-sale
-- transactions — no deposits, no signature workflow, no rich line_items.
--
-- This table is intentionally separate from `contracts` so neither model
-- gets diluted. Analytics aggregates across both for company-wide views.
--
-- Idempotent imports: (source_file, source_row_hash) is unique. Re-running
-- the import script over the same XLSXs produces zero duplicate rows.

-- ── 1. building_sales table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS building_sales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- When the sale happened
  sold_at           DATE NOT NULL,

  -- Where it was sold. location_name is the free-form string from the XLSX
  -- (e.g. "Plano Spa", "Canton", "WH / Athens"). location_id is reserved for
  -- future linkage to the locations table once string→FK mapping is curated.
  location_name     TEXT NOT NULL,
  location_id       UUID NULL REFERENCES locations(id) ON DELETE SET NULL,

  -- What was sold
  product_category  TEXT NOT NULL,        -- "Bargain Barn", "Deluxe", "Carport", "Granite Base", etc.
  product_size      TEXT NULL,            -- "8 x 12", "10' x 16'", etc.

  -- Money. amount is signed — negatives are refunds/returns. cost is NULL
  -- until William Downs Sr. provides cost data; profit KPIs light up the
  -- moment cost is populated.
  amount            NUMERIC(12, 2) NOT NULL,
  cost              NUMERIC(12, 2) NULL,

  -- Inventory provenance. STOCK = on-lot, AGED STOCK = stale inventory,
  -- REPO = repossessed, BOL = bill of lading / shipped to customer.
  stock_status      TEXT NULL,

  -- Retail (lot walk-in) vs wholesale (sold to other dealers like Rampy)
  channel           TEXT NOT NULL DEFAULT 'retail' CHECK (channel IN ('retail', 'wholesale')),

  -- Free-form salesman name. Not FK because XLSX has names only, no IDs.
  -- A later migration can resolve these to profiles.id via a name map.
  salesman_name     TEXT NULL,

  notes             TEXT NULL,

  -- Idempotency: row_hash = MD5 of file/sheet/row/date/amount/product so
  -- re-imports of the same workbook produce zero duplicate inserts.
  source_file       TEXT NOT NULL,
  source_row_hash   TEXT NOT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── 2. Indexes ──────────────────────────────────────────────────────────
-- sold_at for period-window queries (today / month / year)
CREATE INDEX IF NOT EXISTS building_sales_sold_at_idx ON building_sales (sold_at);

-- location_name for per-store breakdown analytics
CREATE INDEX IF NOT EXISTS building_sales_location_idx ON building_sales (location_name);

-- product_category for taxonomy rollups
CREATE INDEX IF NOT EXISTS building_sales_category_idx ON building_sales (product_category);

-- channel for retail-vs-wholesale segmentation
CREATE INDEX IF NOT EXISTS building_sales_channel_idx ON building_sales (channel);

-- Idempotency: unique by source row identity
CREATE UNIQUE INDEX IF NOT EXISTS building_sales_source_uniq_idx
  ON building_sales (source_file, source_row_hash);

-- ── 3. RLS ──────────────────────────────────────────────────────────────
-- Mirrors inventory_blem_photos pattern: authenticated read, admin/manager
-- write. Sales data is internal — no public access.
ALTER TABLE building_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS building_sales_read ON building_sales;
CREATE POLICY building_sales_read
  ON building_sales
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS building_sales_write ON building_sales;
CREATE POLICY building_sales_write
  ON building_sales
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'bookkeeper')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'bookkeeper')
    )
  );

-- ── 4. Comments ─────────────────────────────────────────────────────────
COMMENT ON TABLE building_sales IS 'Atlas Building Systems point-of-sale transactions (sheds, carports, decks, granite bases). Separate from contracts table because building sales have no deposits/signatures/line_items.';
COMMENT ON COLUMN building_sales.amount IS 'Signed sale price. Negative values represent refunds/returns.';
COMMENT ON COLUMN building_sales.cost IS 'COGS for this unit. NULL until William Downs Sr. provides cost data. Profit KPIs derive from amount - cost.';
COMMENT ON COLUMN building_sales.stock_status IS 'Inventory provenance: STOCK (on-lot), AGED STOCK (stale), REPO (repossessed), BOL (bill of lading / shipped). Free-form to match XLSX values.';
COMMENT ON COLUMN building_sales.channel IS 'retail = lot walk-in customer. wholesale = sold to another dealer (e.g. Rampy Sheds).';
