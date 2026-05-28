-- ── 095_tax_rate_lookup.sql ──────────────────────────────────────────────
-- Multi-state sales tax rate lookup tables.
--
-- Strategy (per MEMORY/WORK/20260527-114447_custom-sales-tax-system/PRD.md):
--   - In-house rate lookup using free state DOR feeds (TX EDI, KS Pub 1700,
--     OK COPO). Louisiana is intentionally manual per home-rule parish.
--   - This migration adds LOOKUP tables only. It does NOT modify the existing
--     contracts.tax_rate behavior — that column remains the per-contract
--     applied rate. These tables feed the OTD calculator's auto-suggest.
--
-- Layers:
--   1. tax_rates_raw       — verbatim rows from state DOR feeds (audit trail)
--   2. tax_rates_by_zip    — pre-computed combined rate per 5-digit ZIP
--   3. tax_show_locations  — Atlas-verified rates for known venues (overrides)
--   4. tax_sku_taxability  — per-state taxability of Atlas's SKU categories
-- -------------------------------------------------------------------------

-- ── 1. Raw jurisdiction-level rates from state DOR feeds ──────────────────
CREATE TABLE IF NOT EXISTS public.tax_rates_raw (
  id              bigserial PRIMARY KEY,
  state           char(2)        NOT NULL CHECK (state IN ('TX','LA','OK','KS')),
  jurisdiction_code text         NOT NULL,                  -- TX TA code, KS Pub1700 code, OK COPO, LA parish code
  jurisdiction_name text         NOT NULL,
  jurisdiction_type text         NOT NULL CHECK (
    jurisdiction_type IN ('state','county','parish','city','transit','special','combined')
  ),
  rate            numeric(7,5)   NOT NULL CHECK (rate >= 0 AND rate <= 0.20),
  effective_date  date           NOT NULL,
  expires_date    date,
  source          text           NOT NULL CHECK (
    source IN ('TX_EDI','KS_PUB1700','OK_COPO','LA_MANUAL')
  ),
  source_file     text,                                     -- e.g. "TX_2026Q2.txt"
  imported_at     timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (state, jurisdiction_code, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_raw_state_effective
  ON public.tax_rates_raw (state, effective_date DESC);

-- ── 2. Pre-computed combined rate by 5-digit ZIP ──────────────────────────
-- Most show addresses can be resolved by ZIP alone for TX/KS/OK.
-- LA is excluded — home-rule parishes require manual verification.
CREATE TABLE IF NOT EXISTS public.tax_rates_by_zip (
  zip             char(5)        NOT NULL,
  state           char(2)        NOT NULL CHECK (state IN ('TX','OK','KS')),
  combined_rate   numeric(7,5)   NOT NULL CHECK (combined_rate >= 0 AND combined_rate <= 0.20),
  state_rate      numeric(7,5)   NOT NULL,
  local_rate      numeric(7,5)   NOT NULL,
  jurisdictions   jsonb          NOT NULL,                  -- [{name,type,rate}, ...]
  effective_date  date           NOT NULL,
  source          text           NOT NULL,
  computed_at     timestamptz    NOT NULL DEFAULT now(),
  PRIMARY KEY (zip, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_by_zip_state
  ON public.tax_rates_by_zip (state, zip);

-- ── 3. Atlas-verified show venue rates (overrides + LA path) ──────────────
-- For each known venue (state fair grounds, expo center, etc.), Atlas
-- (or Ian) verifies the combined rate and pins it here. LA shows MUST
-- use this table — verified by phone call to the parish tax collector.
CREATE TABLE IF NOT EXISTS public.tax_show_locations (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_name      text           NOT NULL,
  street_address  text,
  city            text           NOT NULL,
  state           char(2)        NOT NULL CHECK (state IN ('TX','LA','OK','KS')),
  zip             char(5)        NOT NULL,
  combined_rate   numeric(7,5)   NOT NULL CHECK (combined_rate >= 0 AND combined_rate <= 0.20),
  jurisdictions   jsonb          NOT NULL,
  verified_by     text           NOT NULL,                  -- "Ian Allena" / "parish_phone" / "Willie 2026-05-27"
  verified_at     timestamptz    NOT NULL,
  verification_notes text,
  active          boolean        NOT NULL DEFAULT true,
  created_at      timestamptz    NOT NULL DEFAULT now(),
  updated_at      timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_show_locations_active
  ON public.tax_show_locations (active, state);

-- ── 4. Per-state taxability of Atlas's SKU categories ─────────────────────
-- Source of truth for "is this line item taxable in this state".
-- Ian signs off via ian_approved_at. Citation field carries the rule/pub.
CREATE TABLE IF NOT EXISTS public.tax_sku_taxability (
  id              bigserial PRIMARY KEY,
  sku_category    text           NOT NULL,
  state           char(2)        NOT NULL CHECK (state IN ('TX','LA','OK','KS')),
  is_taxable      boolean        NOT NULL,
  notes           text,
  citation        text,                                     -- e.g. "TX Rule 3.291; Pub 94-157"
  ian_approved_at timestamptz,
  ian_approved_by text,
  created_at      timestamptz    NOT NULL DEFAULT now(),
  updated_at      timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (sku_category, state)
);

CREATE INDEX IF NOT EXISTS idx_tax_sku_taxability_lookup
  ON public.tax_sku_taxability (sku_category, state);

-- ── Updated-at triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_tax_lookup_row()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_tax_show_locations ON public.tax_show_locations;
CREATE TRIGGER trg_touch_tax_show_locations
  BEFORE UPDATE ON public.tax_show_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_tax_lookup_row();

DROP TRIGGER IF EXISTS trg_touch_tax_sku_taxability ON public.tax_sku_taxability;
CREATE TRIGGER trg_touch_tax_sku_taxability
  BEFORE UPDATE ON public.tax_sku_taxability
  FOR EACH ROW EXECUTE FUNCTION public.touch_tax_lookup_row();

-- ── RLS — read-anyone-authenticated, write-admin-only ─────────────────────
-- Sales reps need to READ rates at show time. Only admins/bookkeepers may
-- WRITE (verifying a new venue, adjusting taxability after Ian sign-off).
ALTER TABLE public.tax_rates_raw       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates_by_zip    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_show_locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_sku_taxability  ENABLE ROW LEVEL SECURITY;

-- Read policies (any authenticated user)
DROP POLICY IF EXISTS "tax_rates_raw_read"      ON public.tax_rates_raw;
DROP POLICY IF EXISTS "tax_rates_by_zip_read"   ON public.tax_rates_by_zip;
DROP POLICY IF EXISTS "tax_show_locations_read" ON public.tax_show_locations;
DROP POLICY IF EXISTS "tax_sku_taxability_read" ON public.tax_sku_taxability;

CREATE POLICY "tax_rates_raw_read"      ON public.tax_rates_raw      FOR SELECT TO authenticated USING (true);
CREATE POLICY "tax_rates_by_zip_read"   ON public.tax_rates_by_zip   FOR SELECT TO authenticated USING (true);
CREATE POLICY "tax_show_locations_read" ON public.tax_show_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "tax_sku_taxability_read" ON public.tax_sku_taxability FOR SELECT TO authenticated USING (true);

-- Write policies — admin/manager/bookkeeper only.
-- (Adjust the role check to match the platform's existing profile-role pattern.)
DROP POLICY IF EXISTS "tax_show_locations_write" ON public.tax_show_locations;
CREATE POLICY "tax_show_locations_write" ON public.tax_show_locations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','manager','bookkeeper')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','manager','bookkeeper')
    )
  );

DROP POLICY IF EXISTS "tax_sku_taxability_write" ON public.tax_sku_taxability;
CREATE POLICY "tax_sku_taxability_write" ON public.tax_sku_taxability
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','bookkeeper')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','bookkeeper')
    )
  );

-- Raw + by_zip are written only by the sync script (service-role key),
-- so no authenticated-user write policy is needed. RLS denies by default.

-- ── Convenience view: latest active rate per ZIP ──────────────────────────
CREATE OR REPLACE VIEW public.v_tax_rates_by_zip_current AS
SELECT DISTINCT ON (zip)
  zip, state, combined_rate, state_rate, local_rate, jurisdictions,
  effective_date, source
FROM public.tax_rates_by_zip
WHERE effective_date <= current_date
ORDER BY zip, effective_date DESC;

COMMENT ON VIEW public.v_tax_rates_by_zip_current IS
  'Latest in-force combined rate per ZIP. Use this from the OTD calculator.';
