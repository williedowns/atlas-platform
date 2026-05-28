-- ── 100_la_spatial_schema.sql ────────────────────────────────────────────
-- Louisiana automated tax-rate lookup — spatial schema.
--
-- Replaces the existing "manual phone-per-parish" LA path with a proper
-- lat/lon → polygon lookup against Census TIGER parish + city boundaries
-- and hand-mapped special districts.
--
-- Build plan: Plans/2026-05-28_louisiana-automation-build-plan.md
-- Decision: Willie approved full build 2026-05-28 (heavy LA volume,
-- monthly shows + LA showroom planned).
--
-- This migration is PHASE LA.2 — schema only, no data yet. Subsequent
-- phases populate:
--   LA.3 — TIGER parish + city polygons (Census 2024)
--   LA.4 — LULSTB rates per parish/city
--   LA.5 — Hand-traced special district polygons (Orleans, Jefferson,
--          East Baton Rouge, Caddo)
--
-- Tables are NOT consulted by lookupRate.ts until Phase LA.7. Safe to run
-- early — additive only.
-- -------------------------------------------------------------------------

-- Enable PostGIS for spatial queries. Idempotent.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 1. LA parish boundaries (64 rows total once seeded) ───────────────────
CREATE TABLE IF NOT EXISTS public.la_parishes (
  fips_code        char(5)       PRIMARY KEY,                      -- e.g. "22071" (Orleans)
  name             text          NOT NULL,
  geometry         geometry(MultiPolygon, 4326) NOT NULL,           -- WGS84 lat/lon polygons
  parish_rate      numeric(7,5)  NOT NULL DEFAULT 0,                -- e.g. 0.04500 for 4.5%
  rate_effective_date date,
  rate_source      text,                                            -- e.g. 'LULSTB_2026Q2'
  imported_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_la_parishes_geometry
  ON public.la_parishes USING GIST (geometry);

-- ── 2. LA city / Census place boundaries ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.la_cities (
  fips_code        char(7)       PRIMARY KEY,                      -- e.g. "2255000" (New Orleans)
  parish_fips      char(5)       REFERENCES public.la_parishes(fips_code) ON DELETE RESTRICT,
  name             text          NOT NULL,
  geometry         geometry(MultiPolygon, 4326) NOT NULL,
  city_rate        numeric(7,5)  NOT NULL DEFAULT 0,
  rate_effective_date date,
  rate_source      text,
  imported_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_la_cities_geometry
  ON public.la_cities USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_la_cities_parish
  ON public.la_cities (parish_fips);

-- ── 3. Special districts (hand-mapped) ────────────────────────────────────
-- Convention center districts, tourism districts, EDDs, hotel/motel, etc.
-- These are hand-traced from public LDR Revenue Information Bulletins
-- because LA does not publish machine-readable polygons for special districts.
--
-- Phase LA.5 starting set (per Willie 2026-05-28):
--   - Orleans: NOLA + Ernest N. Morial Convention Center District
--   - Jefferson: Metairie/Kenner + Domed Stadium District
--   - East Baton Rouge: Baton Rouge + downtown EDDs
--   - Caddo: Shreveport + convention/downtown districts
CREATE TABLE IF NOT EXISTS public.la_special_districts (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text          NOT NULL,
  district_type    text          NOT NULL CHECK (
    district_type IN (
      'convention_center',
      'tourism',
      'edd',
      'hotel_motel',
      'stadium',
      'school_board',
      'other'
    )
  ),
  parish_fips      char(5)       REFERENCES public.la_parishes(fips_code) ON DELETE RESTRICT,
  geometry         geometry(MultiPolygon, 4326) NOT NULL,
  district_rate    numeric(7,5)  NOT NULL CHECK (district_rate >= 0 AND district_rate <= 0.05),
  rate_effective_date date,
  rate_source      text,                                            -- LDR RIB number, e.g. 'LDR_RIB_25-001'
  notes            text,
  active           boolean       NOT NULL DEFAULT true,
  hand_traced_by   text,                                            -- "Willie 2026-06-15" — audit trail
  hand_traced_at   timestamptz,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_la_special_districts_geometry
  ON public.la_special_districts USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_la_special_districts_active
  ON public.la_special_districts (active, parish_fips);

-- ── 4. Geocode cache (separate from spatial — caches Mapbox responses) ────
-- Same address geocoded only once; subsequent lookups skip Mapbox.
-- Keyed by the normalized address string. Atlas-volume-friendly:
-- 100K free Mapbox geocodes per month is way more than needed once cached.
CREATE TABLE IF NOT EXISTS public.la_geocode_cache (
  address_normalized text         PRIMARY KEY,                     -- "200 N WALKER AVE 73102"
  latitude         numeric(9,6)  NOT NULL,
  longitude        numeric(9,6)  NOT NULL,
  provider         text          NOT NULL,                         -- 'mapbox' | 'google' | 'usps'
  accuracy         text,                                           -- 'rooftop' | 'street' | 'zip'
  fetched_at       timestamptz   NOT NULL DEFAULT now()
);

-- No spatial index needed on cache; lookup is by exact normalized string.

-- ── Updated-at triggers (reuse the helper from migration 095) ─────────────
DROP TRIGGER IF EXISTS trg_touch_la_parishes ON public.la_parishes;
CREATE TRIGGER trg_touch_la_parishes
  BEFORE UPDATE ON public.la_parishes
  FOR EACH ROW EXECUTE FUNCTION public.touch_tax_lookup_row();

DROP TRIGGER IF EXISTS trg_touch_la_cities ON public.la_cities;
CREATE TRIGGER trg_touch_la_cities
  BEFORE UPDATE ON public.la_cities
  FOR EACH ROW EXECUTE FUNCTION public.touch_tax_lookup_row();

DROP TRIGGER IF EXISTS trg_touch_la_special_districts ON public.la_special_districts;
CREATE TRIGGER trg_touch_la_special_districts
  BEFORE UPDATE ON public.la_special_districts
  FOR EACH ROW EXECUTE FUNCTION public.touch_tax_lookup_row();

-- ── RLS — read for authenticated, write service-role only ────────────────
ALTER TABLE public.la_parishes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.la_cities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.la_special_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.la_geocode_cache     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "la_parishes_read"          ON public.la_parishes;
DROP POLICY IF EXISTS "la_cities_read"            ON public.la_cities;
DROP POLICY IF EXISTS "la_special_districts_read" ON public.la_special_districts;
DROP POLICY IF EXISTS "la_geocode_cache_read"     ON public.la_geocode_cache;

CREATE POLICY "la_parishes_read"          ON public.la_parishes          FOR SELECT TO authenticated USING (true);
CREATE POLICY "la_cities_read"            ON public.la_cities            FOR SELECT TO authenticated USING (true);
CREATE POLICY "la_special_districts_read" ON public.la_special_districts FOR SELECT TO authenticated USING (true);
CREATE POLICY "la_geocode_cache_read"     ON public.la_geocode_cache     FOR SELECT TO authenticated USING (true);

-- ── Convenience function: resolve LA address rates given a lat/lon ──────
-- Returns the LA combined rate breakdown for the point.
-- Caller: laParishClient.ts (built in Phase LA.6).
-- Returns: state 5% + parish + city + matching special districts.
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
BEGIN
  -- State rate (always 5% LA state — hardcoded for now; could be driven
  -- from tax_rates_raw if LA state rate ever changes; effective 2025-01-01).
  RETURN QUERY SELECT 'LOUISIANA'::text, 'state'::text, 0.05000::numeric(7,5);

  -- Parish rate
  RETURN QUERY
    SELECT p.name, 'parish'::text, p.parish_rate
    FROM public.la_parishes p
    WHERE p.parish_rate > 0
      AND ST_Contains(p.geometry, pt);

  -- City rate (0 or 1 row — point is in at most one Census place)
  RETURN QUERY
    SELECT c.name, 'city'::text, c.city_rate
    FROM public.la_cities c
    WHERE c.city_rate > 0
      AND ST_Contains(c.geometry, pt);

  -- Special districts (0 or more — point may be in multiple e.g. tourism + convention)
  RETURN QUERY
    SELECT d.name, d.district_type, d.district_rate
    FROM public.la_special_districts d
    WHERE d.active = true
      AND d.district_rate > 0
      AND ST_Contains(d.geometry, pt);
END $$;

COMMENT ON FUNCTION public.la_lookup_by_latlng IS
  'Returns all LA tax-rate layers (state + parish + city + special districts) containing the given lat/lng point. Use ST_SetSRID(ST_MakePoint(lng, lat), 4326) for the input.';
