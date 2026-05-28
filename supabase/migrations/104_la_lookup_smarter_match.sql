-- ── 104_la_lookup_smarter_match.sql ──────────────────────────────────────
-- Phase LA.4 fix-up #2: broaden the LATA jurisdiction name matching so
-- parishes that don't follow the standard "city / Balance of Parish"
-- structure still resolve. Spot-checks before this migration showed:
--   - Orleans (2 rows): only "Parishwide - General Sales" + Food
--   - East Baton Rouge (16 rows): "Baton Rouge EBR School District", etc.
--   - Lafayette (21 rows): "Lafayette (excluding EDD)", etc.
--
-- Strategy chain (first match wins):
--   1. Exact city ILIKE match — works for parishes with simple city rows
--   2. City name as prefix of jurisdiction_name + " " — catches "Baton Rouge"
--      matching "Baton Rouge EBR School District"
--   3. City name followed by " (" in jurisdiction_name — catches "Lafayette"
--      matching "Lafayette (excluding EDD)"
--   4. "Balance of Parish" kind — most-common parishwide catchall
--   5. "Parishwide - General Sales" name — Orleans-style fallback
--
-- Logic only — no schema changes.
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
  RETURN QUERY SELECT 'LOUISIANA'::text, 'state'::text, 0.05000::numeric(7,5);

  -- Containing parish.
  SELECT p.name INTO v_parish_full
  FROM public.la_parishes p
  WHERE ST_Contains(p.geometry, pt)
  LIMIT 1;

  v_parish_name := REGEXP_REPLACE(COALESCE(v_parish_full, ''), '\s+Parish$', '', 'i');
  IF v_parish_name = 'De Soto' THEN v_parish_name := 'DeSoto'; END IF;

  -- Containing city / Census place.
  SELECT c.name INTO v_city_full
  FROM public.la_cities c
  WHERE ST_Contains(c.geometry, pt)
  LIMIT 1;

  v_city_name := REGEXP_REPLACE(COALESCE(v_city_full, ''), '\s+(city|town|village|CDP)$', '', 'i');

  IF v_parish_name <> '' THEN
    -- Strategy 1: exact city match (Crowley, Shreveport, Lake Charles)
    IF v_city_name <> '' THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_name ILIKE v_city_name
        AND j.jurisdiction_kind <> 'special'
      LIMIT 1;
    END IF;

    -- Strategy 2: city name as prefix + space (Baton Rouge → "Baton Rouge EBR School District")
    -- Excludes 'special' kind so we don't accidentally pick a special district when
    -- a more general city row exists.
    IF v_combined IS NULL AND v_city_name <> '' THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_name ILIKE (v_city_name || ' %')
        AND j.jurisdiction_kind <> 'special'
      ORDER BY length(j.jurisdiction_name) ASC  -- shortest = most general
      LIMIT 1;
    END IF;

    -- Strategy 3: city name followed by " (" (Lafayette → "Lafayette (excluding EDD)")
    IF v_combined IS NULL AND v_city_name <> '' THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_name ILIKE (v_city_name || ' (%')
        AND j.jurisdiction_kind <> 'special'
      LIMIT 1;
    END IF;

    -- Strategy 4: "Balance of Parish" — most-common parishwide catchall
    IF v_combined IS NULL THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_kind = 'balance'
      LIMIT 1;
    END IF;

    -- Strategy 5: "Parishwide - General Sales" — Orleans-style fallback
    IF v_combined IS NULL THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_name ILIKE 'Parishwide%General%'
      LIMIT 1;
    END IF;

    IF v_combined IS NOT NULL THEN
      RETURN QUERY SELECT
        (v_parish_name || ' Parish — ' || v_matched_juris)::text,
        'parish_combined'::text,
        v_combined;
    END IF;
  END IF;

  -- Hand-mapped special districts (Phase LA.5)
  RETURN QUERY
    SELECT d.name, d.district_type, d.district_rate
    FROM public.la_special_districts d
    WHERE d.active = true
      AND d.district_rate > 0
      AND ST_Contains(d.geometry, pt);
END $$;
