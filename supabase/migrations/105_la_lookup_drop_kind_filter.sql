-- ── 105_la_lookup_drop_kind_filter.sql ───────────────────────────────────
-- Phase LA.4 fix-up #3: drop the `kind <> 'special'` filter from strategies
-- 2 and 3 (prefix + parens matches).
--
-- Spot-check #2 results showed Lafayette picked the wrong row because
-- "Lafayette (excluding EDD)" was classified as kind='special' (its name
-- contains "EDD"), so strategy 2 skipped it and picked the longer
-- "Lafayette I-10 Coor Dist..." instead. Same problem for Baton Rouge —
-- all 16 EBR rows include "School District" → 'special' → all skipped.
--
-- The classifier itself is too aggressive (substring "edd" / " district"
-- in any phrase matches). Fixing the classifier requires re-running the
-- import; the smaller surgical fix is in the function: prefix-bounded
-- match + shortest-length ordering reliably picks the right row WITHOUT
-- needing kind filtering on strategies 2/3.
--
-- Strategy 1 (exact city) keeps the kind filter as defense-in-depth.
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

  SELECT p.name INTO v_parish_full
  FROM public.la_parishes p
  WHERE ST_Contains(p.geometry, pt)
  LIMIT 1;
  v_parish_name := REGEXP_REPLACE(COALESCE(v_parish_full, ''), '\s+Parish$', '', 'i');
  IF v_parish_name = 'De Soto' THEN v_parish_name := 'DeSoto'; END IF;

  SELECT c.name INTO v_city_full
  FROM public.la_cities c
  WHERE ST_Contains(c.geometry, pt)
  LIMIT 1;
  v_city_name := REGEXP_REPLACE(COALESCE(v_city_full, ''), '\s+(city|town|village|CDP)$', '', 'i');

  IF v_parish_name <> '' THEN
    IF v_city_name <> '' THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_name ILIKE v_city_name
        AND j.jurisdiction_kind <> 'special'
      LIMIT 1;
    END IF;

    IF v_combined IS NULL AND v_city_name <> '' THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_name ILIKE (v_city_name || ' %')
      ORDER BY length(j.jurisdiction_name) ASC
      LIMIT 1;
    END IF;

    IF v_combined IS NULL AND v_city_name <> '' THEN
      SELECT j.combined_local_rate, j.jurisdiction_name
        INTO v_combined, v_matched_juris
      FROM public.la_lata_jurisdictions j
      WHERE j.parish_name = v_parish_name
        AND j.jurisdiction_name ILIKE (v_city_name || ' (%')
      ORDER BY length(j.jurisdiction_name) ASC
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

  RETURN QUERY
    SELECT d.name, d.district_type, d.district_rate
    FROM public.la_special_districts d
    WHERE d.active = true
      AND d.district_rate > 0
      AND ST_Contains(d.geometry, pt);
END $$;
