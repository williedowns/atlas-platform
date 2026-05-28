/**
 * Phase LA.3 — Import Louisiana parish + city boundaries from Census TIGER.
 *
 * Source: Census TIGERweb ArcGIS REST service (free, no auth).
 *   Parishes: https://tigerweb.geo.census.gov/.../State_County/MapServer/1
 *   Places:   https://tigerweb.geo.census.gov/.../Places_CouSub_ConCity_SubMCD/MapServer/4
 *
 * What this does:
 *   1. Fetch all 64 LA parishes as GeoJSON
 *   2. Upsert each into public.la_parishes via the upsert_la_parish RPC
 *   3. Fetch all ~305 LA incorporated places as GeoJSON
 *   4. Upsert each into public.la_cities via the upsert_la_city RPC
 *   5. Run backfill_la_city_parish_fips to associate each city with its parish
 *   6. Print summary counts
 *
 * Run with:
 *   cd ~/Documents/Salta/atlas-platform
 *   bun scripts/import_la_tiger.ts
 *
 * Bun auto-loads `.env.local` which already has NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY for the Atlas project. Do NOT prefix env vars on
 * the command line — that overrides .env.local with whatever you pass and
 * is a footgun (see Phase LA.3 false start 2026-05-28).
 *
 * Idempotent: helper functions use ON CONFLICT DO UPDATE. Safe to re-run
 * after Census TIGER updates (~every 10 years, plus annual ACS revisions).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Census TIGERweb endpoints ────────────────────────────────────────────
const TIGERWEB_PARISHES =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query";
const TIGERWEB_PLACES =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4/query";
const LA_STATE_FIPS = "22";

interface TigerFeature {
  type: "Feature";
  properties: {
    GEOID?: string;
    NAME?: string;
    BASENAME?: string;
    STATE?: string;
  };
  geometry: unknown; // GeoJSON Polygon or MultiPolygon
}

async function fetchTigerLayer(
  baseUrl: string,
  whereClause: string,
  outFields: string,
): Promise<TigerFeature[]> {
  const body = new URLSearchParams({
    where: whereClause,
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TIGERweb ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { features?: TigerFeature[]; error?: unknown };
  if (json.error) {
    throw new Error(`TIGERweb returned error: ${JSON.stringify(json.error)}`);
  }
  return Array.isArray(json.features) ? json.features : [];
}

async function importParishes(): Promise<{ inserted: number; failed: number }> {
  console.log("── Fetching LA parishes from Census TIGER ──");
  const features = await fetchTigerLayer(
    TIGERWEB_PARISHES,
    `STATE='${LA_STATE_FIPS}'`,
    "GEOID,NAME,BASENAME",
  );
  console.log(`  fetched ${features.length} parishes`);

  let inserted = 0;
  let failed = 0;
  for (const f of features) {
    const fips = f.properties.GEOID;
    const name = f.properties.NAME ?? f.properties.BASENAME ?? "";
    if (!fips || fips.length !== 5) {
      console.warn(`  ✗ skipping malformed GEOID: ${fips}`);
      failed++;
      continue;
    }
    const geomText = JSON.stringify(f.geometry);
    const { error } = await supabase.rpc("upsert_la_parish", {
      in_fips: fips,
      in_name: name,
      in_geom_geojson: geomText,
      in_source: "tiger_2024",
    });
    if (error) {
      console.warn(`  ✗ ${fips} ${name}: ${error.message}`);
      failed++;
    } else {
      inserted++;
    }
  }
  return { inserted, failed };
}

async function importPlaces(): Promise<{ inserted: number; failed: number }> {
  console.log("── Fetching LA incorporated places from Census TIGER ──");
  const features = await fetchTigerLayer(
    TIGERWEB_PLACES,
    `STATE='${LA_STATE_FIPS}'`,
    "GEOID,NAME,BASENAME,STATE",
  );
  console.log(`  fetched ${features.length} places`);

  let inserted = 0;
  let failed = 0;
  for (const f of features) {
    const fips = f.properties.GEOID;
    const name = f.properties.NAME ?? f.properties.BASENAME ?? "";
    if (!fips || fips.length !== 7) {
      console.warn(`  ✗ skipping malformed GEOID: ${fips}`);
      failed++;
      continue;
    }
    const geomText = JSON.stringify(f.geometry);
    const { error } = await supabase.rpc("upsert_la_city", {
      in_fips: fips,
      in_name: name,
      in_geom_geojson: geomText,
      in_source: "tiger_2024",
    });
    if (error) {
      console.warn(`  ✗ ${fips} ${name}: ${error.message}`);
      failed++;
    } else {
      inserted++;
    }
  }
  return { inserted, failed };
}

async function backfillParishFips(): Promise<number> {
  console.log("── Backfilling city.parish_fips via spatial join ──");
  const { data, error } = await supabase.rpc("backfill_la_city_parish_fips");
  if (error) {
    throw new Error(`backfill failed: ${error.message}`);
  }
  return Number(data ?? 0);
}

async function verifySpotCheck(): Promise<void> {
  console.log("── Spot-check: query for known parishes + cities ──");
  for (const fips of ["22071", "22033", "22051", "22017", "22055"]) {
    // Orleans, East Baton Rouge, Jefferson, Caddo, Lafayette
    const { data } = await supabase
      .from("la_parishes")
      .select("fips_code, name")
      .eq("fips_code", fips)
      .maybeSingle();
    console.log(`  parish ${fips}: ${data ? `✓ ${data.name}` : "✗ not found"}`);
  }
  for (const fips of ["2255000", "2205000", "2236255", "2270000", "2240735"]) {
    // New Orleans, Baton Rouge, Lafayette, Shreveport, Lake Charles
    const { data } = await supabase
      .from("la_cities")
      .select("fips_code, name, parish_fips")
      .eq("fips_code", fips)
      .maybeSingle();
    console.log(`  city ${fips}: ${data ? `✓ ${data.name} (parish ${data.parish_fips})` : "✗ not found"}`);
  }
}

async function main() {
  const start = Date.now();
  console.log("Phase LA.3 — TIGER import starting\n");

  const p = await importParishes();
  console.log(`  parishes: ${p.inserted} inserted, ${p.failed} failed`);

  const c = await importPlaces();
  console.log(`  cities: ${c.inserted} inserted, ${c.failed} failed`);

  const updated = await backfillParishFips();
  console.log(`  parish_fips backfilled on ${updated} city rows`);

  await verifySpotCheck();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDONE in ${elapsed}s`);
  if (p.failed > 0 || c.failed > 0) {
    process.exit(1);
  }
}

await main();
