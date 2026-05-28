-- ── 103_la_lookup_function_fix.sql ───────────────────────────────────────
-- Phase LA.4 fix-up: la_lookup_by_latlng was ambiguous on `jurisdiction_name`
-- because that's both the RETURN TABLE column AND a column on
-- la_lata_jurisdictions. PL/pgSQL refused to resolve the reference.
--
-- Surgical fix: alias the table + qualify every column reference inside
-- the function body. Logic is identical to migration 102's version; only
-- column qualification changes.
--
-- Also normalizes "DeSoto" / "De Soto" parish name handling — LATA uses
-- "DeSoto" (no space), Census uses "De Soto" (with space).
-- -------------------------------------------------------------------------

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

  -- Containing parish (always 0 or 1).
  SELECT p.name INTO v_parish_full
  FROM public.la_parishes p
  WHERE ST_Contains(p.geometry, pt)
  LIMIT 1;

  -- Strip " Parish" suffix AND normalize "De Soto" → "DeSoto" so the join
  -- to LATA's spelling works.
  v_parish_name := REGEXP_REPLACE(COALESCE(v_parish_full, ''), '\s+Parish$', '', 'i');
  IF v_parish_name = 'De Soto' THEN v_parish_name := 'DeSoto'; END IF;

  -- Containing city / Census place (0 or 1).
  SELECT c.name INTO v_city_full
  FROM public.la_cities c
  WHERE ST_Contains(c.geometry, pt)
  LIMIT 1;

  v_city_name := REGEXP_REPLACE(COALESCE(v_city_full, ''), '\s+(city|town|village|CDP)$', '', 'i');

  -- Match LATA: try parish + city, then parish + "Balance of Parish".
  -- ALIAS THE TABLE (`j`) and qualify EVERY column so `jurisdiction_name` is
  -- unambiguous against the RETURN TABLE column of the same name.
  IF v_parish_name <> '' THEN
    IF v_city_name <> '' THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_name ILIKE v_city_name
      LIMIT 1;
    END IF;

    IF v_combined IS NULL THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_kind = 'balance'
      LIMIT 1;
    END IF;

    IF v_combined IS NOT NULL THEN
      RETURN QUERY SELECT
        (v_parish_name || ' Parish — ' || v_matched_juris)::text,
        'parish_combined'::text,
        v_combined;
    END IF;
  END IF;

  -- Special districts (hand-mapped, Phase LA.5). Already aliased — fine.
  RETURN QUERY
    SELECT d.name, d.district_type, d.district_rate
    FROM public.la_special_districts d
    WHERE d.active = true
      AND d.district_rate > 0
      AND ST_Contains(d.geometry, pt);
END $$;
