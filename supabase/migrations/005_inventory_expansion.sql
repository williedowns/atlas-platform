-- ── Inventory System Expansion ────────────────────────────────────────────────
-- Adds full physical unit tracking: shell/cabinet colors, unit type, show
-- assignment, transfer history, and factory order numbers.
-- Mirrors data from 21-tab Google Spreadsheet inventory management system.

-- ── 1. Expand products table ──────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS line text,            -- "Clarity", "H2X", "Twilight Series", etc.
  ADD COLUMN IF NOT EXISTS model_code text,       -- "C Bal 7", "X T19D", etc.
  ADD COLUMN IF NOT EXISTS has_serial boolean NOT NULL DEFAULT true; -- false for accessories

-- ── 2. Expand inventory_units ─────────────────────────────────────────────────

-- Make serial_number nullable (on-order units have order# only, no serial yet)
ALTER TABLE public.inventory_units
  ALTER COLUMN serial_number DROP NOT NULL;

-- Drop and re-add status constraint to include new statuses
ALTER TABLE public.inventory_units
  DROP CONSTRAINT IF EXISTS inventory_units_status_check;

ALTER TABLE public.inventory_units
  ADD CONSTRAINT inventory_units_status_check CHECK (status IN (
    'on_order',
    'in_factory',
    'in_transit',
    'at_location',
    'at_show',
    'allocated',
    'delivered'
  ));

-- Add all new tracking columns
ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS order_number text,          -- W-prefix factory order number
  ADD COLUMN IF NOT EXISTS show_id uuid REFERENCES public.shows(id),
  ADD COLUMN IF NOT EXISTS shell_color text,           -- e.g. "Sterling Silver", "Midnight Canyon"
  ADD COLUMN IF NOT EXISTS cabinet_color text,         -- e.g. "GRAPH", "ESP", "MID2"
  ADD COLUMN IF NOT EXISTS wrap_status text DEFAULT 'WR'
    CHECK (wrap_status IN ('WR', 'UN')),               -- WR=wrapped, UN=unwrapped
  ADD COLUMN IF NOT EXISTS sub_location text,          -- "floor", "backroom", "warehouse", "home_office"
  ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'stock'
    CHECK (unit_type IN (
      'stock',           -- New in-stock unit
      'factory_build',   -- New factory build ordered for customer
      'floor_model',     -- Floor / display model
      'blem',            -- Blem or AS IS unit
      'wet_model'        -- Wet / demo model
    )),
  ADD COLUMN IF NOT EXISTS received_date date,         -- Date unit arrived at this location
  ADD COLUMN IF NOT EXISTS msrp_override numeric(10,2); -- Per-unit MSRP override (blems, floor models)

-- ── 3. New: inventory_transfers ──────────────────────────────────────────────
-- Full audit trail of every location/show move for a unit.

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id uuid NOT NULL REFERENCES public.inventory_units(id) ON DELETE CASCADE,
  from_location_id uuid REFERENCES public.locations(id),
  to_location_id   uuid REFERENCES public.locations(id),
  from_show_id     uuid REFERENCES public.shows(id),
  to_show_id       uuid REFERENCES public.shows(id),
  transferred_by   uuid REFERENCES public.profiles(id),
  notes            text,
  created_at       timestamptz DEFAULT now()
);

-- Index for fast unit history lookups
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_unit
  ON public.inventory_transfers(unit_id, created_at DESC);
