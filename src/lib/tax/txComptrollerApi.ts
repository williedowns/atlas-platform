/**
 * Texas Comptroller Sales Tax Rate Locator — REST API client.
 *
 * Server-side only. Never call from the browser.
 *
 * BACKGROUND (validated 2026-05-27):
 * The TX Comptroller publishes a free public REST API behind the GIS Sales
 * Tax Rate Locator at https://gis.cpa.texas.gov/search. The endpoint and
 * credentials below were extracted from `gis.cpa.texas.gov/config/appconfig.js`
 * (shipped to every browser using the web tool). It is NOT in the officially-
 * documented API portal at `api-doc.comptroller.texas.gov` — so treat it as
 * "public-but-undocumented" with all the stability caveats that implies.
 *
 * Caveats / risks:
 *   - The client_id / client_secret are effectively public (shipped in JS).
 *     TX could rotate them, breaking us. Configurable via env vars below.
 *   - No published SLA, rate limits, or stability guarantees.
 *   - Endpoint runs on port 8088 with a non-standard cert path. Atlas's Node
 *     fetch should handle this, but log failures clearly.
 *
 * Mitigation: cache aggressively (caller's responsibility). Verify rate at
 * venue-entry time, not at every contract sale, unless the venue ages > 90 days.
 *
 * Verified addresses (Q2 2026):
 *   1500 McKinney St,  Houston   77002 → 8.25%
 *   500 S Ervay St,    Dallas    75201 → 8.25%
 *   1818 Rodeo Dr,     Mesquite  75149 → 8.25%
 */

// ─── Credentials (effectively public — overridable via env) ────────────────
const CLIENT_ID =
  process.env.TX_COMPTROLLER_CLIENT_ID ?? "89a040b596ae483682f87d5cde1cd664";
const CLIENT_SECRET =
  process.env.TX_COMPTROLLER_CLIENT_SECRET ?? "CA1Ba231e6Cc402D9Afc6FDC4B440A9E";

const BASE_URL = "https://mulesoft.cpa.texas.gov:8088/api/cpa/gis/v1/salestaxrate";

// ─── Public types ──────────────────────────────────────────────────────────
export type TxJurisdictionType = "STATE" | "CITY" | "COUNTY" | "TRANSIT" | "SPD" | string;

export interface TxJurisdictionLine {
  jurisName: string;
  jurisCode: string;
  jurisType: TxJurisdictionType;
  jurisRate: number; // decimal e.g. 0.0625
}

export interface TxRateResult {
  ok: true;
  combinedRate: number; // decimal e.g. 0.0825
  jurisdictions: TxJurisdictionLine[];
  resolvedAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    zip4: string | null;
    county: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  effectiveDate: string | null; // e.g. "4/01/2026"
  message: string | null;
  /** Raw response for audit / debugging. */
  raw: unknown;
}

export interface TxRateFailure {
  ok: false;
  reason:
    | "no_match"
    | "http_error"
    | "network_error"
    | "parse_error"
    | "low_confidence";
  message: string;
  status?: number;
  raw?: unknown;
}

export type TxRateLookup = TxRateResult | TxRateFailure;

export interface TxLookupArgs {
  street: string;
  city: string;
  zip: string; // 5-digit
  /** Effective date for the rate (defaults to today). Determines quarter+year. */
  effectiveDate?: Date;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function quarterOf(d: Date): number {
  return Math.floor(d.getUTCMonth() / 3) + 1;
}

function headers(): HeadersInit {
  return {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    Accept: "application/json",
  };
}

function parseRateFixed(s: string | number | null | undefined): number {
  // TOTALTAXRATE comes back as a fixed-point string like "825000" meaning 0.0825.
  // Individual TAXRATES come back as decimal strings like ".0625000".
  if (s === null || s === undefined) return 0;
  if (typeof s === "number") {
    return s > 1 ? s / 1e7 : s;
  }
  const t = s.trim();
  if (!t) return 0;
  // Heuristic: if it contains a decimal point treat as decimal string;
  // otherwise treat as fixed-point integer × 1e7.
  if (t.includes(".")) {
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n / 1e7 : 0;
}

function normalizeJurisdictions(arr: unknown): TxJurisdictionLine[] {
  if (!Array.isArray(arr)) return [];
  const out: TxJurisdictionLine[] = [];
  for (const j of arr) {
    if (!j || typeof j !== "object") continue;
    const obj = j as Record<string, unknown>;
    const name = typeof obj.JURISNAME === "string" ? obj.JURISNAME.trim() : "";
    const code = typeof obj.JURISCODE === "string" ? obj.JURISCODE.trim() : "";
    const type = (typeof obj.JURISTYPE === "string" ? obj.JURISTYPE.trim() : "") as TxJurisdictionType;
    const rate = parseRateFixed(obj.JURISRATE as string | number | undefined);
    if (!name || rate <= 0) continue;
    out.push({ jurisName: name, jurisCode: code, jurisType: type, jurisRate: rate });
  }
  return out;
}

// ─── Address lookup ────────────────────────────────────────────────────────
export async function lookupTexasRateByAddress(
  args: TxLookupArgs
): Promise<TxRateLookup> {
  const eff = args.effectiveDate ?? new Date();
  const params = new URLSearchParams({
    state: "TX",
    city: args.city,
    zipcode: args.zip,
    street: args.street,
    quarter: String(quarterOf(eff)),
    year: String(eff.getUTCFullYear()),
  });
  const url = `${BASE_URL}/salestaxrate?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: headers() });
  } catch (e) {
    return {
      ok: false,
      reason: "network_error",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      reason: "http_error",
      status: res.status,
      message: `TX API ${res.status}`,
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

  if (!body || typeof body !== "object") {
    return { ok: false, reason: "parse_error", message: "empty body", raw: body };
  }
  const d = body as Record<string, unknown>;

  // GISRETURNCODE / PROBABLECORRECTNESS / CONFIDENCECODE can indicate quality.
  // PROBABLECORRECTNESS = "0" means a perfect match; other values reduce confidence.
  // We treat anything other than a STREET-level match ("S") as low confidence.
  const addressType = typeof d.ADDRESSTYPECODE === "string" ? d.ADDRESSTYPECODE : "";
  if (!d.TAXRATES || !Array.isArray(d.TAXRATES)) {
    return { ok: false, reason: "no_match", message: "no taxrates in response", raw: body };
  }

  const jurisdictions = normalizeJurisdictions(d.TAXRATES);
  if (jurisdictions.length === 0) {
    return { ok: false, reason: "no_match", message: "no jurisdictions returned", raw: body };
  }

  const combined = parseRateFixed(d.TOTALTAXRATE as string | number | undefined);
  if (combined <= 0) {
    return { ok: false, reason: "parse_error", message: "TOTALTAXRATE missing or zero", raw: body };
  }

  const result: TxRateResult = {
    ok: true,
    combinedRate: combined,
    jurisdictions,
    resolvedAddress: {
      street: String(d.STREET ?? args.street),
      city: String(d.CITY ?? args.city),
      state: String(d.STATE ?? "TX"),
      zip: String(d.ZIPCODE ?? args.zip),
      zip4: typeof d.ZIP4 === "string" && d.ZIP4 ? d.ZIP4 : null,
      county: typeof d.CPACOUNTYNAME === "string" ? d.CPACOUNTYNAME : null,
      latitude: d.LATITUDE ? Number(d.LATITUDE) : null,
      longitude: d.LONGITUDE ? Number(d.LONGITUDE) : null,
    },
    effectiveDate: typeof d.JURISDATE === "string" ? d.JURISDATE : null,
    message: typeof d.TOTALTAXMSG === "string" ? d.TOTALTAXMSG : null,
    raw: body,
  };

  // Surface low-confidence as a soft failure so the UI can warn / require manual confirm.
  if (addressType && addressType !== "S") {
    return {
      ok: false,
      reason: "low_confidence",
      message: `TX API matched but addressType=${addressType} (not street-level). Combined ${combined}; verify manually.`,
      raw: body,
    };
  }

  // Thin-response guard: a TX address returning ONLY the state rate (no city /
  // county / MTA) is suspicious — TX addresses almost always have a county rate
  // on top of 6.25%. Treat as low-confidence rather than silently accept.
  const hasLocalJurisdiction = jurisdictions.some(
    (j) => j.jurisType !== "STATE"
  );
  if (!hasLocalJurisdiction) {
    return {
      ok: false,
      reason: "low_confidence",
      message: `TX API returned only the state rate (${combined}) — no city/county/MTA. Address probably failed to match a local jurisdiction. Verify manually before relying on this rate.`,
      raw: body,
    };
  }

  return result;
}

// ─── Lat/Lon lookup (alternative entry) ────────────────────────────────────
export interface TxLatLngArgs {
  latitude: number;
  longitude: number;
  effectiveDate?: Date;
}

export async function lookupTexasRateByLatLng(
  args: TxLatLngArgs
): Promise<TxRateLookup> {
  const eff = args.effectiveDate ?? new Date();
  const params = new URLSearchParams({
    latitude: String(args.latitude),
    longitude: String(args.longitude),
    quarter: String(quarterOf(eff)),
    year: String(eff.getUTCFullYear()),
  });
  const url = `${BASE_URL}/latlongrate?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: headers() });
  } catch (e) {
    return {
      ok: false,
      reason: "network_error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
  if (!res.ok) {
    return { ok: false, reason: "http_error", status: res.status, message: `TX API ${res.status}` };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    return { ok: false, reason: "parse_error", message: e instanceof Error ? e.message : String(e) };
  }

  if (!body || typeof body !== "object") {
    return { ok: false, reason: "parse_error", message: "empty body", raw: body };
  }
  const d = body as Record<string, unknown>;
  const jurisdictions = normalizeJurisdictions(d.TAXRATES);
  const combined = parseRateFixed(d.TOTALTAXRATE as string | number | undefined);
  if (combined <= 0 || jurisdictions.length === 0) {
    return { ok: false, reason: "no_match", message: "no rate at lat/lng", raw: body };
  }

  return {
    ok: true,
    combinedRate: combined,
    jurisdictions,
    resolvedAddress: {
      street: String(d.STREET ?? ""),
      city: String(d.CITY ?? ""),
      state: "TX",
      zip: String(d.ZIPCODE ?? ""),
      zip4: typeof d.ZIP4 === "string" && d.ZIP4 ? d.ZIP4 : null,
      county: typeof d.CPACOUNTYNAME === "string" ? d.CPACOUNTYNAME : null,
      latitude: args.latitude,
      longitude: args.longitude,
    },
    effectiveDate: typeof d.JURISDATE === "string" ? d.JURISDATE : null,
    message: typeof d.TOTALTAXMSG === "string" ? d.TOTALTAXMSG : null,
    raw: body,
  };
}
