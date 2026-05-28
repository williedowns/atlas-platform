-- ── 102_la_lata_rate_seed.sql ────────────────────────────────────────────
-- Phase LA.4 — LATA-authoritative LA jurisdiction rate table.
--
-- Data source: LATA (Louisiana Association of Tax Administrators)
-- per-parish city-to-parish index pages. Compiled into the workbook
-- /Users/williedowns/Documents/Sales_Tax_Compliance_TX_OK_LA_KS_AR.xlsx
-- (sheet "LA Parish Rates (Detailed)", 444 rows, last verified 2026-05-28).
--
-- Coverage: 62 of 64 parishes. Missing:
--   - Jefferson Parish (no per-component LATA breakdown; needs manual entry)
--   - Cameron Parish (LATA page unavailable at extraction time)
-- These two fall back to state-only 5% with low_confidence warning until
-- they're populated via the admin UI.
--
-- The LATA "Combined Local Rate" already sums school board + police jury +
-- law enforcement + city/town + special districts at the jurisdiction level.
-- Atlas sums state 5% + this value = total combined rate.
--
-- Sub-jurisdictions:
--   - Simple cities (298 rows) — match to Census place name
--   - "Balance of Parish" rows (34) — fallback when no city polygon matches
--   - "X within/outside Y" (16) — sub-parish areas; handled via "Balance" fallback for v1
--   - "city limits in X parish" (3) — cities that straddle parishes; LATA disambiguates
--   - Special districts (93) — handled in Phase LA.5 with hand-traced polygons
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.la_lata_jurisdictions (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_name             text          NOT NULL,           -- e.g. "Acadia" (no " Parish" suffix)
  jurisdiction_name       text          NOT NULL,           -- e.g. "Crowley", "Balance of Parish", "Hwy 30 EDD"
  lata_column             text,                             -- LATA reference letter (A, B, C, ...)
  components_breakdown    text,                             -- "School Board: 1.500% | Police Jury: ..."
  combined_local_rate     numeric(7,5)  NOT NULL CHECK (combined_local_rate >= 0 AND combined_local_rate <= 0.10),
  state_rate              numeric(7,5)  NOT NULL DEFAULT 0.05,
  total_rate              numeric(7,5)  NOT NULL CHECK (total_rate >= 0.05 AND total_rate <= 0.15),
  jurisdiction_kind       text          NOT NULL CHECK (jurisdiction_kind IN (
    'city',           -- Simple city/town that matches a Census place
    'balance',        -- "Balance of Parish" catchall for unincorporated areas
    'within_outside', -- "X within Y" / "X outside Y" sub-parish areas
    'cross_parish',   -- "City X limits in Parish Y" (city straddles parishes)
    'special'         -- EDD/TIF/Annexation/Mall/etc — needs polygon (Phase LA.5)
  )),
  effective_date          date,
  source_url              text,
  source_verified_at      date,                             -- when the LATA page was scraped
  notes                   text,
  imported_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (parish_name, jurisdiction_name)
);

CREATE INDEX IF NOT EXISTS idx_la_lata_parish_kind
  ON public.la_lata_jurisdictions (parish_name, jurisdiction_kind);

-- ── Updated-at trigger ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_touch_la_lata_jurisdictions ON public.la_lata_jurisdictions;
CREATE TRIGGER trg_touch_la_lata_jurisdictions
  BEFORE UPDATE ON public.la_lata_jurisdictions
  FOR EACH ROW EXECUTE FUNCTION public.touch_tax_lookup_row();

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.la_lata_jurisdictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "la_lata_read" ON public.la_lata_jurisdictions;
CREATE POLICY "la_lata_read" ON public.la_lata_jurisdictions
  FOR SELECT TO authenticated USING (true);

-- ── Upsert helper for import script ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_la_lata_jurisdiction(
  in_parish text,
  in_jurisdiction text,
  in_lata_column text,
  in_components text,
  in_combined_local numeric,
  in_state numeric,
  in_total numeric,
  in_kind text,
  in_effective_date date,
  in_source_url text,
  in_verified_at date,
  in_notes text
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE result_id uuid;
BEGIN
  INSERT INTO public.la_lata_jurisdictions (
    parish_name, jurisdiction_name, lata_column, components_breakdown,
    combined_local_rate, state_rate, total_rate, jurisdiction_kind,
    effective_date, source_url, source_verified_at, notes
  ) VALUES (
    in_parish, in_jurisdiction, in_lata_column, in_components,
    in_combined_local, in_state, in_total, in_kind,
    in_effective_date, in_source_url, in_verified_at, in_notes
  )
  ON CONFLICT (parish_name, jurisdiction_name) DO UPDATE SET
    lata_column = EXCLUDED.lata_column,
    components_breakdown = EXCLUDED.components_breakdown,
    combined_local_rate = EXCLUDED.combined_local_rate,
    state_rate = EXCLUDED.state_rate,
    total_rate = EXCLUDED.total_rate,
    jurisdiction_kind = EXCLUDED.jurisdiction_kind,
    effective_date = EXCLUDED.effective_date,
    source_url = EXCLUDED.source_url,
    source_verified_at = EXCLUDED.source_verified_at,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO result_id;
  RETURN result_id;
END $$;

-- ── Updated la_lookup_by_latlng — uses LATA data ──────────────────────────
-- Returns the rate stack for any LA point:
--   1. State 5% baseline (always returned)
--   2. Best-matching LATA combined local rate (parish + city, or parish + balance)
--   3. Special districts containing the point (from la_special_districts; Phase LA.5)
--
-- If the parish isn't in LATA data (Jefferson, Cameron), only state is returned —
-- caller sees low_confidence and admin pin is required.
CREATE OR REPLACE FUNCTION public.la_lookup_by_latlng(
  in_lat numeric,
  in_lng numeric
)
RETURNS TABLE (
  jurisdiction_name text,
  jurisdiction_type text,
  jurisdiction_rate numeric(7,5)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  pt geometry := ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326);
  v_parish_full text;
  v_parish_name text;
  v_city_full text;
  v_city_name text;
  v_combined numeric(7,5);
  v_matched_juris text;
BEGIN
  -- ALWAYS return state 5%.
  RETURN QUERY SELECT 'LOUISIANA'::text, 'state'::text, 0.05000::numeric(7,5);

  -- Identify containing parish (always 0 or 1 row).
  SELECT name INTO v_parish_full FROM public.la_parishes
    WHERE ST_Contains(geometry, pt) LIMIT 1;
  v_parish_name := REGEXP_REPLACE(COALESCE(v_parish_full, ''), '\s+Parish$', '', 'i');

  -- Identify containing city / Census place (0 or 1).
  SELECT name INTO v_city_full FROM public.la_cities
    WHERE ST_Contains(geometry, pt) LIMIT 1;
  v_city_name := REGEXP_REPLACE(COALESCE(v_city_full, ''), '\s+(city|town|village|CDP)$', '', 'i');

  -- Match LATA: try parish + city, then parish + "Balance of Parish".
  IF v_parish_name <> '' THEN
    -- 1. Exact city match
    IF v_city_name <> '' THEN
      SELECT combined_local_rate, jurisdiction_name INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions
      WHERE parish_name = v_parish_name
        AND jurisdiction_name ILIKE v_city_name
      LIMIT 1;
    END IF;

    -- 2. Fall back to Balance of Parish
    IF v_combined IS NULL THEN
      SELECT combined_local_rate, jurisdiction_name INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions
      WHERE parish_name = v_parish_name
        AND jurisdiction_kind = 'balance'
      LIMIT 1;
    END IF;

    IF v_combined IS NOT NULL THEN
      RETURN QUERY SELECT
        (v_parish_name || ' Parish — ' || v_matched_juris)::text,
        'parish_combined'::text,
        v_combined;
    END IF;
  END IF;

  -- Special districts containing the point (hand-mapped, Phase LA.5).
  RETURN QUERY
    SELECT d.name, d.district_type, d.district_rate
    FROM public.la_special_districts d
    WHERE d.active = true
      AND d.district_rate > 0
      AND ST_Contains(d.geometry, pt);
END $$;

COMMENT ON FUNCTION public.la_lookup_by_latlng IS
  'Returns LA tax rate stack for a lat/lng point: state 5% + LATA-sourced parish/city combined rate + hand-mapped special districts. If parish is unmatched (Jefferson, Cameron), only state row is returned — caller treats as low_confidence.';
