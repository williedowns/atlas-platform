-- ── 085_per_nat_entries.sql ──────────────────────────────────────────────
-- Atlas Spas Per Nat list as a first-class table.
--
-- The original 083 migration relied on contracts.is_per_nat as a derived
-- signal: contracts get flagged when status='low_deposit' or when
-- delivery_timeframe is set. That captures Salta-native deals but misses
-- ~220 historical Per Nat rows from Natalie's XLSX whose customers were
-- never imported into the customers table (non-expo channels Lori's
-- backfill never touched).
--
-- This migration adds per_nat_entries as the source of truth for the Per
-- Nat list. Each entry optionally links to a contract via contract_id.
-- The Per Nat page now reads from per_nat_entries (with the linked
-- contract joined when present), giving us the full 454-row list Natalie
-- has been keeping in the XLSX.
--
-- contracts.is_per_nat stays — toggling it via the Modify Contract card
-- continues to work, with an INSERT trigger that mirrors the flag into
-- per_nat_entries so the two stay coherent.

CREATE TABLE IF NOT EXISTS public.per_nat_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Optional link to a Salta contract (NULL when the deal lives only in
  -- the XLSX / Natalie's tracker and we never created a contract).
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL UNIQUE,

  -- Source: where this entry came from
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'xlsx_import', 'contract_flag')),

  -- Customer / deal identification (denormalized for XLSX-only rows)
  sale_date date,
  customer_name text NOT NULL,
  model text,
  color text,
  skirt text,
  serial_number text,
  salesperson_name text,

  -- Per Nat metadata
  timeframe_text text,            -- "Feb-April", "End of June?", "2026-03-01"
  notes text,                     -- the rich Per Nat history (Natalie's notes)
  fierce_notes text,              -- delivery routing — "Amarillo - OKC", "Atlas Delivery - LA"
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),

  -- Reason for being on the list — mirrors contracts.per_nat_reason
  reason text
    CHECK (reason IS NULL OR reason IN ('low_deposit', 'future_delivery', 'special_order', 'manual')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.per_nat_entries IS
  'Per Nat list source of truth. Each entry optionally links to a Salta contract via contract_id. XLSX-imported entries have contract_id IS NULL when the underlying customer/contract was never captured in the contracts table.';

COMMENT ON COLUMN public.per_nat_entries.source IS
  'manual = added through UI; xlsx_import = imported from Natalie''s Per Nat XLSX; contract_flag = auto-created when contract.is_per_nat was toggled.';

CREATE INDEX IF NOT EXISTS idx_pne_status_active
  ON public.per_nat_entries(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_pne_contract
  ON public.per_nat_entries(contract_id)
  WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pne_sale_date
  ON public.per_nat_entries(sale_date DESC NULLS LAST);

-- Auto-touch updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.fn_per_nat_entries_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_per_nat_entries_touch ON public.per_nat_entries;
CREATE TRIGGER trg_per_nat_entries_touch
  BEFORE UPDATE ON public.per_nat_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_per_nat_entries_touch();

-- Backfill from existing flagged contracts so we don't lose the 95 entries
-- the original 083 backfill produced.
INSERT INTO public.per_nat_entries (
  contract_id, source, sale_date, customer_name, status, reason, timeframe_text, notes
)
SELECT
  c.id,
  'contract_flag',
  c.created_at::date,
  TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')),
  CASE
    WHEN c.status = 'delivered' THEN 'completed'
    WHEN c.status = 'cancelled' THEN 'cancelled'
    ELSE 'active'
  END,
  c.per_nat_reason,
  c.delivery_timeframe,
  NULLIF(REGEXP_REPLACE(COALESCE(c.notes, ''), '\[backfill[^\]]*\][^\n]*', '', 'gi'), '')
FROM public.contracts c
LEFT JOIN public.customers cu ON cu.id = c.customer_id
WHERE c.is_per_nat = true
ON CONFLICT (contract_id) DO NOTHING;

-- RLS — admin + manager only, matching the rest of the Per Nat surface.
ALTER TABLE public.per_nat_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pne_read" ON public.per_nat_entries;
CREATE POLICY "pne_read" ON public.per_nat_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "pne_write" ON public.per_nat_entries;
CREATE POLICY "pne_write" ON public.per_nat_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
