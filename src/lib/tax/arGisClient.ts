/**
 * Arkansas DFA — Sales Tax Rate Locator client (via Arkansas GIS endpoint).
 *
 * Server-side only. Never call from the browser.
 *
 * BACKGROUND (validated 2026-05-28):
 * AR DFA's address/ZIP lookup tool is embedded on
 *   https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/local-tax-lookup-tools/
 * The form POSTs to https://gis.arkansas.gov/Lookup/Results.php which returns
 * HTML with rate cells at predictable element IDs (tblCStateRate, tblCOutCoRate,
 * tblCOutCiRate, tblCTotalRate). No JSON API; HTML scrape with targeted regex.
 *
 * AR is a Streamlined Sales Tax (SST) member. State rate is 6.5% general,
 * with a separate reduced food rate (0%) and manufacturing utility rate (0.625%).
 * Atlas doesn't sell food, so combined rate is what matters for spa sales.
 *
 * Two POST modes:
 *   1. Address mode — fields: Street, City, State, ZIP
 *   2. ZIP+4 mode   — fields: Zip5, Zip4
 *
 * Verified addresses (2026-05-28):
 *   500 Woodlane St, Little Rock 72201 → 8.625% (state 6.5% + Pulaski 1% + Little Rock 1.125%)
 *   ZIP 72201 + Zip4 2615             → 8.625% (same)
 *
 * Caveats:
 *   - HTML scrape — AR GIS could redesign without notice
 *   - Atlas does "very rarely" do business in AR ("brand new"). Lookup needed,
 *     but pinning verified AR venues via tax_show_locations is the durable answer
 *   - No published SLA. No documented rate limit observed but it's an old GIS
 *     stack — don't burst
 */

// ─── Endpoints ─────────────────────────────────────────────────────────────
const LOOKUP_URL = "https://gis.arkansas.gov/Lookup/Results.php";
const REFERER =
  "https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/local-tax-lookup-tools/";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface ArJurisdictionLine {
  jurisName: string;
  jurisType: "state" | "county" | "city";
  jurisRate: number; // decimal e.g. 0.065
}

export interface ArRateResult {
  ok: true;
  combinedRate: number;
  foodRate: number | null;
  jurisdictions: ArJurisdictionLine[];
  resolvedAddress: {
    street: string;
    city: string;
    state: "AR";
    zip: string;
  };
  raw: string;
}

export interface ArRateFailure {
  ok: false;
  reason: "no_match" | "http_error" | "network_error" | "parse_error" | "low_confidence";
  message: string;
  status?: number;
  raw?: string;
}

export type ArRateLookup = ArRateResult | ArRateFailure;

export interface ArLookupArgs {
  street?: string;     // full street address e.g. "500 Woodlane St"
  city?: string;
  zip: string;         // 5-digit
  zip4?: string;       // optional 4-digit extension
}

// ─── HTML extraction helpers ───────────────────────────────────────────────
function extractCellById(html: string, id: string): string | null {
  const re = new RegExp(`id=['"]${id}['"][^>]*>([^<]+)`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function parsePercent(s: string | null): number | null {
  if (!s) return null;
  const t = s.replace(/[%\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n / 100; // AR shows "8.625" meaning 8.625%, convert to 0.08625
}

// ─── Lookup ────────────────────────────────────────────────────────────────
export async function lookupArkansasRateByAddress(
  args: ArLookupArgs
): Promise<ArRateLookup> {
  // Choose form mode: prefer address if street + city are present, else ZIP+4
  const hasAddress = !!(args.street && args.street.trim() && args.city && args.city.trim());
  const body = new URLSearchParams();
  if (hasAddress) {
    body.set("Street", args.street!.trim());
    body.set("City", args.city!.trim());
    body.set("State", "AR");
    body.set("ZIP", args.zip);
  } else {
    body.set("Zip5", args.zip);
    body.set("Zip4", args.zip4 ?? "");
  }

  let res: Response;
  try {
    res = await fetch(LOOKUP_URL, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
        Referer: REFERER,
      },
      body: body.toString(),
    });
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
      message: `AR lookup ${res.status}`,
    };
  }

  const html = await res.text();

  // Empty/short response is the "no match" signal
  if (html.length < 200 || /Error\s+no\s+(Address|Zip)/i.test(html)) {
    return {
      ok: false,
      reason: "no_match",
      message: "AR lookup returned no rate (address or ZIP not recognized)",
      raw: html,
    };
  }

  // Extract cells by ID
  const stateRate = parsePercent(extractCellById(html, "tblCStateRate"));
  const countyName = extractCellById(html, "tblCOutCoName");
  const countyRate = parsePercent(extractCellById(html, "tblCOutCoRate"));
  const cityName = extractCellById(html, "tblCOutCiName");
  const cityRate = parsePercent(extractCellById(html, "tblCOutCiRate"));
  const totalRate = parsePercent(extractCellById(html, "tblCTotalRate"));
  const foodRate = parsePercent(extractCellById(html, "tblCTotalFood"));

  if (totalRate === null || totalRate <= 0) {
    return {
      ok: false,
      reason: "parse_error",
      message: "AR lookup: total rate not found in response. AR DFA may have redesigned.",
      raw: html,
    };
  }

  const jurisdictions: ArJurisdictionLine[] = [];
  if (stateRate !== null && stateRate > 0) {
    jurisdictions.push({ jurisName: "Arkansas", jurisType: "state", jurisRate: stateRate });
  }
  if (countyName && countyRate !== null && countyRate > 0) {
    jurisdictions.push({ jurisName: countyName, jurisType: "county", jurisRate: countyRate });
  }
  if (cityName && cityRate !== null && cityRate > 0) {
    jurisdictions.push({ jurisName: cityName, jurisType: "city", jurisRate: cityRate });
  }

  if (jurisdictions.length === 0) {
    return {
      ok: false,
      reason: "parse_error",
      message: "AR lookup: returned total rate but no jurisdiction breakdown",
      raw: html,
    };
  }

  // Sanity: sum should equal total within rounding
  const sum = jurisdictions.reduce((s, j) => s + j.jurisRate, 0);
  if (Math.abs(sum - totalRate) > 0.0005) {
    return {
      ok: false,
      reason: "low_confidence",
      message: `AR jurisdictions sum to ${(sum * 100).toFixed(3)}% but total reported ${(
        totalRate * 100
      ).toFixed(3)}%. Verify manually.`,
      raw: html,
    };
  }

  return {
    ok: true,
    combinedRate: totalRate,
    foodRate,
    jurisdictions,
    resolvedAddress: {
      street: args.street?.trim() ?? "",
      city: args.city?.trim() ?? cityName ?? "",
      state: "AR",
      zip: args.zip,
    },
    raw: html,
  };
}
