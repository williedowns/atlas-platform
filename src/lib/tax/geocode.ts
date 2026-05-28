/**
 * Mapbox geocoding wrapper — address → lat/lon for LA spatial queries.
 *
 * Server-side only. Never expose this to the browser even though the token
 * is a public "pk." key — we want the API quota controlled and the cache
 * managed centrally.
 *
 * Used by: src/lib/tax/laParishClient.ts (Phase LA.6) for the LA address
 * lookup chain. Could be reused later for other geocoding needs.
 *
 * Provider: Mapbox Geocoding v6 (latest stable, address-precision focus).
 * Free tier: 100K geocodes/month. Atlas's volume is well under.
 *
 * Caching: each unique address is geocoded only ONCE. Subsequent lookups
 * hit the la_geocode_cache table (migration 100). Cache invalidation: 365
 * days — addresses don't move; but a hard cap protects against bad
 * data persisting indefinitely.
 */
import { createClient } from "@supabase/supabase-js";

const MAPBOX_BASE = "https://api.mapbox.com/search/geocode/v6/forward";
const CACHE_TTL_DAYS = 365;

export interface GeocodeResult {
  ok: true;
  latitude: number;
  longitude: number;
  /**
   * Mapbox accuracy hint. Common values:
   *  - "rooftop"   — best, exact building
   *  - "parcel"    — property boundary
   *  - "point"     — interpolated within a parcel
   *  - "interpolated" — interpolated along a street
   *  - "street"    — street-level only
   * Lower-precision matches should be flagged downstream so admin
   * verifies before relying on the rate.
   */
  accuracy: string;
  /** Normalized canonical form Mapbox returned (e.g. "1500 McKinney St, Houston, TX 77002"). */
  resolvedAddress: string | null;
  provider: "mapbox";
  cached: boolean;
  raw?: unknown;
}

export interface GeocodeFailure {
  ok: false;
  reason: "no_match" | "http_error" | "network_error" | "parse_error" | "missing_token";
  message: string;
  status?: number;
}

export type GeocodeLookup = GeocodeResult | GeocodeFailure;

export interface GeocodeArgs {
  street: string;
  city?: string;
  state?: string; // 2-letter
  zip?: string;
  country?: string; // defaults to "US"
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function normalize(args: GeocodeArgs): string {
  const parts = [
    args.street?.trim(),
    args.city?.trim(),
    args.state?.trim().toUpperCase(),
    args.zip?.trim(),
  ].filter(Boolean);
  return parts.join(", ").toUpperCase().replace(/\s+/g, " ");
}

function getToken(): string | null {
  const t = process.env.MAPBOX_ACCESS_TOKEN;
  return t && t.trim() ? t.trim() : null;
}

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Cache layer ──────────────────────────────────────────────────────────
async function readCache(normalized: string): Promise<GeocodeResult | null> {
  const sb = serviceSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("la_geocode_cache")
    .select("latitude, longitude, provider, accuracy, fetched_at")
    .eq("address_normalized", normalized)
    .maybeSingle();
  if (!data) return null;
  // TTL check — stale rows fall through to a fresh Mapbox call
  const fetched = new Date(data.fetched_at).getTime();
  if (Date.now() - fetched > CACHE_TTL_DAYS * 86_400_000) return null;
  return {
    ok: true,
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    accuracy: data.accuracy ?? "unknown",
    resolvedAddress: null,
    provider: "mapbox",
    cached: true,
  };
}

async function writeCache(
  normalized: string,
  result: GeocodeResult
): Promise<void> {
  const sb = serviceSupabase();
  if (!sb) return;
  await sb.from("la_geocode_cache").upsert(
    {
      address_normalized: normalized,
      latitude: result.latitude,
      longitude: result.longitude,
      provider: result.provider,
      accuracy: result.accuracy,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "address_normalized" }
  );
}

// ─── Mapbox call ──────────────────────────────────────────────────────────
async function callMapbox(args: GeocodeArgs, token: string): Promise<GeocodeLookup> {
  const params = new URLSearchParams({
    access_token: token,
    country: (args.country ?? "us").toLowerCase(),
    limit: "1",
    types: "address",
    autocomplete: "false",
  });
  // v6 uses structured params for higher accuracy than free-text q=
  if (args.street) params.set("address_line1", args.street);
  if (args.city) params.set("place", args.city);
  if (args.state) params.set("region", args.state);
  if (args.zip) params.set("postcode", args.zip);

  const url = `${MAPBOX_BASE}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  } catch (e) {
    return {
      ok: false,
      reason: "network_error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "http_error",
      status: res.status,
      message: `Mapbox ${res.status}: ${text.slice(0, 200)}`,
    };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    return {
      ok: false,
      reason: "parse_error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
  const feats = (body as { features?: unknown[] })?.features ?? [];
  if (!Array.isArray(feats) || feats.length === 0) {
    return { ok: false, reason: "no_match", message: "Mapbox returned no features" };
  }
  const first = feats[0] as Record<string, unknown>;
  const props = (first.properties ?? {}) as Record<string, unknown>;
  const coords =
    (props.coordinates as { latitude?: number; longitude?: number } | undefined) ??
    undefined;
  const geom =
    (first.geometry as { coordinates?: [number, number] } | undefined) ?? undefined;

  let lat: number | undefined;
  let lng: number | undefined;
  if (coords && typeof coords.latitude === "number" && typeof coords.longitude === "number") {
    lat = coords.latitude;
    lng = coords.longitude;
  } else if (geom && Array.isArray(geom.coordinates) && geom.coordinates.length === 2) {
    // GeoJSON order: [lng, lat]
    lng = geom.coordinates[0];
    lat = geom.coordinates[1];
  }
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { ok: false, reason: "parse_error", message: "no coordinates in feature" };
  }

  const accuracy =
    (typeof props.accuracy === "string" ? props.accuracy : null) ??
    (typeof (props.match_code as { accuracy?: string } | undefined)?.accuracy === "string"
      ? (props.match_code as { accuracy: string }).accuracy
      : "unknown");

  return {
    ok: true,
    latitude: lat,
    longitude: lng,
    accuracy,
    resolvedAddress: typeof props.full_address === "string" ? props.full_address : null,
    provider: "mapbox",
    cached: false,
    raw: body,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────
/**
 * Geocode an address. Reads cache first; on miss, calls Mapbox + writes the
 * cache. Returns a discriminated union — caller checks `.ok` before reading
 * coordinates.
 */
export async function geocodeAddress(args: GeocodeArgs): Promise<GeocodeLookup> {
  const token = getToken();
  if (!token) {
    return {
      ok: false,
      reason: "missing_token",
      message:
        "MAPBOX_ACCESS_TOKEN env var not set. Add it in Vercel for production + .env.local for dev.",
    };
  }
  const normalized = normalize(args);
  if (!normalized) {
    return { ok: false, reason: "no_match", message: "empty address" };
  }

  // 1) Cache hit?
  try {
    const cached = await readCache(normalized);
    if (cached) return cached;
  } catch (e) {
    // Cache failures are non-fatal — fall through to Mapbox.
    console.warn("[geocode] cache read failed:", e instanceof Error ? e.message : e);
  }

  // 2) Live Mapbox call
  const live = await callMapbox(args, token);
  if (!live.ok) return live;

  // 3) Persist to cache (best-effort, non-fatal on failure)
  try {
    await writeCache(normalized, live);
  } catch (e) {
    console.warn("[geocode] cache write failed:", e instanceof Error ? e.message : e);
  }

  return live;
}
