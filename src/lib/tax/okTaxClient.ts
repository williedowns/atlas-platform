/**
 * Oklahoma Tax Commission — Sales Tax Rate Locator client.
 *
 * Server-side only. Never call from the browser.
 *
 * BACKGROUND (validated 2026-05-27):
 * OK's official rate locator is hosted by the OU Center for Spatial Analysis
 * at https://taxproject.csa.ou.edu/Rate_Locator/. It's a Django web app with
 * an HTML form that requires CSRF token + session cookie. No JSON API; the
 * response is HTML containing a table of matching address-ranges and rates.
 *
 * Two-step flow:
 *   1. GET https://taxproject.csa.ou.edu/Rate_Locator/address/
 *      → captures `csrftoken` cookie and extracts `csrfmiddlewaretoken` from
 *        the form HTML.
 *   2. POST https://taxproject.csa.ou.edu/Rate_Locator/address-results/
 *      with form fields + token + cookie + Referer.
 *
 * Form fields:
 *   csrfmiddlewaretoken      (required — from step 1)
 *   tax_type                 "STS" (sales) | "STU" (use)
 *   house_number             required
 *   street_direction         N|E|S|W|NE|SE|SW|NW or empty
 *   street_name              required (no number, no direction, no type)
 *   street_type              AVE|BLVD|ST|RD|... or empty
 *   zip                      required (5 digit)
 *   tax_amount               optional
 *
 * Response table columns (HTML <th>):
 *   Low Address Range, High Address Range, Street Dir, Street Name, Street
 *   Type, Street Even/Odd/Both, Zip, City, City Code, County, County Code,
 *   City Rate, County Rate, State Rate, Total Rate
 *
 * OK state rate is 4.5% as of Q2 2026.
 *
 * Verified addresses (Q2 2026):
 *   200 N Walker Ave, Oklahoma City 73102 → 8.625% (state 4.5% + OKC city 4.125%)
 *
 * Caveats:
 *   - HTML scraping. OU CSA could redesign without notice.
 *   - The form may return multiple address-range rows for one query. The
 *     parser picks the row whose [low, high] range contains the input house
 *     number AND whose even/odd indicator matches; falls back to the first row.
 *   - If rows disagree on rate, surface as low_confidence.
 *   - **Rate limiting (verified 2026-05-27):** 7+ rapid sequential requests
 *     triggers an nginx 503 that persists for ~60-90 seconds. The client
 *     implements a single 503-retry with backoff; callers should cache results
 *     aggressively to avoid bursts. For Atlas's show workflow this is fine
 *     (verify-once-per-venue) but bulk validation needs explicit pacing.
 */

// ─── Endpoints ─────────────────────────────────────────────────────────────
const FORM_URL = "https://taxproject.csa.ou.edu/Rate_Locator/address/";
const RESULTS_URL = "https://taxproject.csa.ou.edu/Rate_Locator/address-results/";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface OkJurisdictionLine {
  jurisName: string;
  jurisType: "state" | "county" | "city";
  jurisRate: number; // decimal e.g. 0.045
}

export interface OkRateResult {
  ok: true;
  combinedRate: number;
  jurisdictions: OkJurisdictionLine[];
  resolvedAddress: {
    street: string;
    city: string;
    state: "OK";
    zip: string;
  };
  cityCode: string | null;
  countyCode: string | null;
  addressRange: { low: string; high: string; evenOdd: string } | null;
  raw: string;
}

export interface OkRateFailure {
  ok: false;
  reason: "no_match" | "http_error" | "network_error" | "parse_error" | "low_confidence";
  message: string;
  status?: number;
  raw?: string;
}

export type OkRateLookup = OkRateResult | OkRateFailure;

export interface OkLookupArgs {
  houseNumber: string;
  streetDirection?: string; // N/E/S/W/NE/SE/SW/NW or empty
  streetName: string;       // bare name e.g. "Walker"
  streetType?: string;      // AVE/BLVD/ST/... or empty
  zip: string;
  taxType?: "STS" | "STU";  // default STS (sales)
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getSetCookieHeaders(res: Response): string {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  const list = typeof h.getSetCookie === "function" ? h.getSetCookie() : [];
  return (list as string[])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function extractCsrfToken(html: string): string | null {
  const m = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * Pull the response table from address-results HTML.
 * Returns the list of rows where each row is {col_name: value}.
 */
interface OkRow {
  low: string;
  high: string;
  dir: string;
  name: string;
  type: string;
  evenOdd: string;
  zip: string;
  city: string;
  cityCode: string;
  county: string;
  countyCode: string;
  cityRate: number;   // decimal
  countyRate: number;
  stateRate: number;
  totalRate: number;
}

function parseRows(html: string): OkRow[] {
  // Find the first <table> ... </table>
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];
  const table = tableMatch[0];
  // Pull rows (skip <thead>)
  const rows: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(table)) !== null) {
    const tds: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdm: RegExpExecArray | null;
    while ((tdm = tdRe.exec(m[1])) !== null) {
      tds.push(tdm[1].replace(/<[^>]+>/g, "").trim());
    }
    if (tds.length >= 15) rows.push(tds);
  }
  return rows.map((r) => ({
    low: r[0],
    high: r[1],
    dir: r[2],
    name: r[3],
    type: r[4],
    evenOdd: r[5],
    zip: r[6],
    city: r[7],
    cityCode: r[8],
    county: r[9],
    countyCode: r[10],
    cityRate: pctToDec(r[11]),
    countyRate: pctToDec(r[12]),
    stateRate: pctToDec(r[13]),
    totalRate: pctToDec(r[14]),
  }));
}

function pctToDec(s: string): number {
  if (!s) return 0;
  const t = s.replace(/[%\s]/g, "");
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

function pickRowFor(houseNumber: string, rows: OkRow[]): OkRow | null {
  if (rows.length === 0) return null;
  const num = Number(houseNumber);
  if (!Number.isFinite(num)) return rows[0];
  const isEven = num % 2 === 0;

  for (const r of rows) {
    const low = Number(r.low);
    const high = Number(r.high);
    if (!Number.isFinite(low) || !Number.isFinite(high)) continue;
    if (num < low || num > high) continue;
    const eo = r.evenOdd.toUpperCase();
    if (eo === "B" || eo === "BOTH" || eo === "") return r;
    if (isEven && (eo === "E" || eo === "EVEN")) return r;
    if (!isEven && (eo === "O" || eo === "ODD")) return r;
  }
  return rows[0]; // fallback
}

// ─── Lookup ────────────────────────────────────────────────────────────────
async function getFormWithRetry(): Promise<
  | { ok: true; cookieHeader: string; csrfToken: string }
  | { ok: false; reason: "network_error" | "http_error" | "parse_error"; message: string; status?: number }
> {
  // Single 503 retry with backoff. OK CSA's nginx rate-limits bursts.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      // Backoff before retry — 503 typically clears within 60-90s.
      await new Promise((r) => setTimeout(r, 60_000));
    }
    let formRes: Response;
    try {
      formRes = await fetch(FORM_URL, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      });
    } catch (e) {
      return {
        ok: false,
        reason: "network_error",
        message: `OK form GET failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    if (formRes.status === 503) {
      if (attempt === 0) continue;
      return { ok: false, reason: "http_error", status: 503, message: "OK form: rate-limited (503) after retry" };
    }
    if (!formRes.ok) {
      return { ok: false, reason: "http_error", status: formRes.status, message: `OK form GET ${formRes.status}` };
    }
    const cookieHeader = getSetCookieHeaders(formRes);
    const html = await formRes.text();
    const csrfToken = extractCsrfToken(html);
    if (!csrfToken) {
      return { ok: false, reason: "parse_error", message: "OK form: could not extract csrfmiddlewaretoken from landing page" };
    }
    return { ok: true, cookieHeader, csrfToken };
  }
  return { ok: false, reason: "http_error", message: "OK form: unreachable" };
}

export async function lookupOklahomaRateByAddress(
  args: OkLookupArgs
): Promise<OkRateLookup> {
  // Step 1: GET form page for CSRF + cookie (with 503 retry)
  const formResult = await getFormWithRetry();
  if (!formResult.ok) {
    return formResult;
  }
  const { cookieHeader, csrfToken } = formResult;

  // Step 2: POST with token + cookie
  const body = new URLSearchParams({
    csrfmiddlewaretoken: csrfToken,
    tax_type: args.taxType ?? "STS",
    house_number: args.houseNumber,
    street_direction: args.streetDirection ?? "",
    street_name: args.streetName,
    street_type: args.streetType ?? "",
    zip: args.zip,
    tax_amount: "",
  });

  let res: Response | null = null;
  // Single 503 retry on the POST too — OK CSA rate-limits aggressively.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 60_000));
    try {
      res = await fetch(RESULTS_URL, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "text/html",
          Referer: FORM_URL,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
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
    if (res.status !== 503) break;
    if (attempt === 1) {
      return {
        ok: false,
        reason: "http_error",
        status: 503,
        message: "OK lookup: rate-limited (503) after retry. Cache aggressively; bulk lookups need pacing.",
      };
    }
  }

  if (!res || !res.ok) {
    return {
      ok: false,
      reason: "http_error",
      status: res?.status ?? 0,
      message: `OK lookup ${res?.status ?? "no-response"}`,
    };
  }

  const html = await res.text();
  const rows = parseRows(html);

  if (rows.length === 0) {
    return {
      ok: false,
      reason: "no_match",
      message: "OK lookup returned no rows for this address",
      raw: html,
    };
  }

  // Pick the row whose range contains the house number with matching even/odd
  const chosen = pickRowFor(args.houseNumber, rows);
  if (!chosen || chosen.totalRate <= 0) {
    return {
      ok: false,
      reason: "no_match",
      message: "OK lookup returned rows but none matched the house number",
      raw: html,
    };
  }

  // Check if multiple matching rows disagree on totalRate — surface low_confidence.
  const matchingRates = new Set(
    rows
      .filter((r) => {
        const num = Number(args.houseNumber);
        const low = Number(r.low);
        const high = Number(r.high);
        return Number.isFinite(num) && Number.isFinite(low) && Number.isFinite(high) && num >= low && num <= high;
      })
      .map((r) => r.totalRate)
  );
  if (matchingRates.size > 1) {
    return {
      ok: false,
      reason: "low_confidence",
      message: `OK lookup returned multiple address-range rows with conflicting rates: ${[
        ...matchingRates,
      ]
        .map((r) => (r * 100).toFixed(3) + "%")
        .join(", ")}. Verify manually.`,
      raw: html,
    };
  }

  const jurisdictions: OkJurisdictionLine[] = [];
  if (chosen.stateRate > 0)
    jurisdictions.push({ jurisName: "Oklahoma", jurisType: "state", jurisRate: chosen.stateRate });
  if (chosen.countyRate > 0)
    jurisdictions.push({ jurisName: chosen.county || "County", jurisType: "county", jurisRate: chosen.countyRate });
  if (chosen.cityRate > 0)
    jurisdictions.push({ jurisName: chosen.city || "City", jurisType: "city", jurisRate: chosen.cityRate });

  // Sanity: sum should equal total within rounding
  const sum = jurisdictions.reduce((s, j) => s + j.jurisRate, 0);
  if (Math.abs(sum - chosen.totalRate) > 0.0005) {
    return {
      ok: false,
      reason: "low_confidence",
      message: `OK jurisdictions sum to ${(sum * 100).toFixed(3)}% but total reported ${(
        chosen.totalRate * 100
      ).toFixed(3)}%.`,
      raw: html,
    };
  }

  return {
    ok: true,
    combinedRate: chosen.totalRate,
    jurisdictions,
    resolvedAddress: {
      street: `${args.houseNumber} ${args.streetDirection ?? ""} ${args.streetName} ${
        args.streetType ?? ""
      }`
        .replace(/\s+/g, " ")
        .trim(),
      city: chosen.city,
      state: "OK",
      zip: chosen.zip || args.zip,
    },
    cityCode: chosen.cityCode || null,
    countyCode: chosen.countyCode || null,
    addressRange: { low: chosen.low, high: chosen.high, evenOdd: chosen.evenOdd },
    raw: html,
  };
}
