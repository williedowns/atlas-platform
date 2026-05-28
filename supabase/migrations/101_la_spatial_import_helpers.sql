-- ── 101_la_spatial_import_helpers.sql ────────────────────────────────────
-- Helper functions for importing LA spatial data from Census TIGER + LULSTB.
-- Called by scripts/import_la_tiger.ts (Phase LA.3) and
-- scripts/import_la_rates.ts (Phase LA.4).
--
-- Why helpers: PostgREST / supabase-js can't pass `ST_GeomFromGeoJSON(...)`
-- as a raw expression through .insert(). Storing the conversion in a
-- function lets the import scripts just RPC with plain text.
-- -------------------------------------------------------------------------

-- ── Upsert one parish row from GeoJSON ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_la_parish(
  in_fips char(5),
  in_name text,
  in_geom_geojson text,
  in_source text DEFAULT 'tiger_2024'
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.la_parishes (fips_code, name, geometry, rate_source)
  VALUES (
    in_fips,
    in_name,
    ST_Multi(ST_GeomFromGeoJSON(in_geom_geojson))::geometry(MultiPolygon, 4326),
    in_source
  )
  ON CONFLICT (fips_code) DO UPDATE SET
    name = EXCLUDED.name,
    geometry = EXCLUDED.geometry,
    rate_source = EXCLUDED.rate_source,
    imported_at = now();
END $$;

-- ── Upsert one city/place row from GeoJSON ────────────────────────────────
-- parish_fips is set later via backfill (a place's parish requires a spatial
-- intersection that's cheap to do once after both imports complete).
CREATE OR REPLACE FUNCTION public.upsert_la_city(
  in_fips char(7),
  in_name text,
  in_geom_geojson text,
  in_source text DEFAULT 'tiger_2024'
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.la_cities (fips_code, name, geometry, rate_source)
  VALUES (
    in_fips,
    in_name,
    ST_Multi(ST_GeomFromGeoJSON(in_geom_geojson))::geometry(MultiPolygon, 4326),
    in_source
  )
  ON CONFLICT (fips_code) DO UPDATE SET
    name = EXCLUDED.name,
    geometry = EXCLUDED.geometry,
    rate_source = EXCLUDED.rate_source,
    imported_at = now();
END $$;

-- ── Backfill parish_fips on cities ────────────────────────────────────────
-- Census places can span multiple parishes in rare cases. We pick the parish
-- containing the city's "point on surface" (a guaranteed-interior point).
-- Returns the number of city rows updated.
CREATE OR REPLACE FUNCTION public.backfill_la_city_parish_fips()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH city_parish AS (
    SELECT c.fips_code AS city_fips,
           p.fips_code AS parish_fips
    FROM public.la_cities c
    JOIN public.la_parishes p
      ON ST_Contains(p.geometry, ST_PointOnSurface(c.geometry))
  )
  UPDATE public.la_cities lc
  SET parish_fips = cp.parish_fips
  FROM city_parish cp
  WHERE lc.fips_code = cp.city_fips
    AND (lc.parish_fips IS NULL OR lc.parish_fips <> cp.parish_fips);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END $$;

-- ── Upsert one special-district row from GeoJSON ──────────────────────────
-- Hand-mapped districts (Phase LA.5). Caller passes the hand_traced metadata.
CREATE OR REPLACE FUNCTION public.upsert_la_special_district(
  in_name text,
  in_district_type text,
  in_parish_fips char(5),
  in_geom_geojson text,
  in_rate numeric,
  in_rate_effective_date date,
  in_rate_source text,
  in_notes text,
  in_traced_by text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.la_special_districts (
    name, district_type, parish_fips, geometry,
    district_rate, rate_effective_date, rate_source, notes,
    hand_traced_by, hand_traced_at
  )
  VALUES (
    in_name, in_district_type, in_parish_fips,
    ST_Multi(ST_GeomFromGeoJSON(in_geom_geojson))::geometry(MultiPolygon, 4326),
    in_rate, in_rate_effective_date, in_rate_source, in_notes,
    in_traced_by, now()
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
