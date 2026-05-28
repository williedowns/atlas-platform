/**
 * Louisiana parish lookup client.
 *
 * Server-side only. Wraps the Mapbox geocoder + the la_lookup_by_latlng
 * PL/pgSQL function (migrations 100, 102, 103, 104, 105) into a single
 * call that matches the signature of the other state clients
 * (txComptrollerApi, ksRevenueClient, okTaxClient, arGisClient).
 *
 * Flow:
 *   1. Geocode the address with Mapbox → lat/lng
 *   2. Sanity check: lat/lng inside LA bounding box
 *   3. RPC la_lookup_by_latlng(lat, lng) → rate stack from LATA data:
 *      - LA state 5%
 *      - Parish-combined rate (school + police jury + city/town + ...)
 *      - Hand-mapped special districts (Phase LA.5)
 *
 * Coverage: 62 of 64 parishes via LATA. Cameron + Jefferson return
 * `low_confidence` (only state row found) — those need manual venue pin.
 *
 * Data source: workbook Sales_Tax_Compliance_TX_OK_LA_KS_AR.xlsx, sheet
 * "LA Parish Rates (Detailed)", last verified 2026-05-28. Quarterly refresh
 * path: re-run scripts/import_la_lata_rates.ts after updating la_lata_data.json.
 */
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/tax/geocode";

// ─── Public types ──────────────────────────────────────────────────────────
export interface LaJurisdictionLine {
  jurisName: string;
  jurisType: "state" | "parish_combined" | "special";
  jurisRate: number;
}

export interface LaRateResult {
  ok: true;
  combinedRate: number;
  jurisdictions: LaJurisdictionLine[];
  resolvedAddress: {
    street: string;
    city: string;
    state: "LA";
    zip: string;
    lat: number;
    lng: number;
  };
  geocodeAccuracy: string;
  geocodeCached: boolean;
  raw?: unknown;
}

export interface LaRateFailure {
  ok: false;
  reason: "geocode_failed" | "no_match" | "low_confidence" | "rpc_error" | "out_of_state";
  message: string;
  raw?: unknown;
}

export type LaRateLookup = LaRateResult | LaRateFailure;

export interface LaLookupArgs {
  street: string;
  city: string;
  zip: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────
// Rough LA bounding box for sanity-checking geocoder output. A geocode that
// lands outside this box means the address didn't actually resolve to LA
// (e.g., the customer's address is in a different state but the wizard
// passed state=LA by mistake).
const LA_BBOX = { minLat: 28.8, maxLat: 33.1, minLng: -94.1, maxLng: -88.7 };

// ─── Lookup ────────────────────────────────────────────────────────────────
export async function lookupLouisianaRateByAddress(
  args: LaLookupArgs
): Promise<LaRateLookup> {
  // Step 1: geocode
  const geo = await geocodeAddress({
    street: args.street,
    city: args.city,
    state: "LA",
    zip: args.zip,
  });
  if (!geo.ok) {
    return {
      ok: false,
      reason: "geocode_failed",
      message: `Geocoder failed: ${geo.reason} — ${geo.message}`,
    };
  }

  // Step 2: bounding-box sanity check
  if (
    geo.latitude < LA_BBOX.minLat ||
    geo.latitude > LA_BBOX.maxLat ||
    geo.longitude < LA_BBOX.minLng ||
    geo.longitude > LA_BBOX.maxLng
  ) {
    return {
      ok: false,
      reason: "out_of_state",
      message:
        `Address geocoded to (${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}) — ` +
        `outside Louisiana. Caller passed state=LA but the address may be elsewhere.`,
    };
  }

  // Step 3: PL/pgSQL spatial lookup
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("la_lookup_by_latlng", {
    in_lat: geo.latitude,
    in_lng: geo.longitude,
  });

  if (error) {
    return {
      ok: false,
      reason: "rpc_error",
      message: `la_lookup_by_latlng failed: ${error.message}`,
    };
  }

  const rows = (data ?? []) as Array<{
    jurisdiction_name: string;
    jurisdiction_type: string;
    jurisdiction_rate: number | string;
  }>;

  // Need at least the state row + a parish_combined row for high confidence.
  // If only state is returned, the parish polygon contained the point but no
  // LATA row matched — likely Cameron or Jefferson (LATA data gaps).
  const hasParish = rows.some((r) => r.jurisdiction_type === "parish_combined");
  if (!hasParish) {
    return {
      ok: false,
      reason: "low_confidence",
      message:
        "LA address resolved but parish not in LATA data (Cameron or Jefferson " +
        "Parish are known gaps). Combined state-only rate is 5%. " +
        "Pin the venue via /admin/tax-venues with the verified parish rate " +
        "(call the parish Sales Tax Department).",
      raw: data,
    };
  }

  const jurisdictions: LaJurisdictionLine[] = [];
  for (const r of rows) {
    const rate = Number(r.jurisdiction_rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    let jtype: LaJurisdictionLine["jurisType"];
    if (r.jurisdiction_type === "state") jtype = "state";
    else if (r.jurisdiction_type === "parish_combined") jtype = "parish_combined";
    else jtype = "special"; // any la_special_districts row
    jurisdictions.push({
      jurisName: r.jurisdiction_name,
      jurisType: jtype,
      jurisRate: rate,
    });
  }

  const combined = jurisdictions.reduce((s, j) => s + j.jurisRate, 0);

  // Sanity: combined should be in 5-15% range for any LA address
  if (combined < 0.05 || combined > 0.15) {
    return {
      ok: false,
      reason: "low_confidence",
      message: `LA combined rate ${(combined * 100).toFixed(3)}% is out of expected range 5-15%. Verify manually.`,
      raw: data,
    };
  }

  return {
    ok: true,
    combinedRate: combined,
    jurisdictions,
    resolvedAddress: {
      street: args.street,
      city: args.city,
      state: "LA",
      zip: args.zip,
      lat: geo.latitude,
      lng: geo.longitude,
    },
    geocodeAccuracy: geo.accuracy,
    geocodeCached: geo.cached,
    raw: data,
  };
}
