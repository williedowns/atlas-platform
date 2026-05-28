/**
 * Kansas Department of Revenue — Sales Tax Rate Locator client.
 *
 * Server-side only. Never call from the browser.
 *
 * BACKGROUND (validated 2026-05-27):
 * KS DOR provides a public lookup at https://www.ksrevenue.gov/atrladdress.html
 * which posts to https://www.kssst.kdor.ks.gov/webLookupResults.cfm — a
 * ColdFusion form that returns HTML, NOT JSON. There is no documented JSON
 * API. This client scrapes the response table.
 *
 * Form fields (POST):
 *   StrAddrNum            house number
 *   StrAddress            street name (no number)
 *   StrSecondaryAddress   apt/suite (optional, often empty)
 *   StrCity               city
 *   IntZip5               5-digit ZIP
 *   IntZip4               +4 (optional)
 *   IntAmount             taxable amount (defaults to 100 for sanity)
 *
 * Required: a session cookie from a prior GET of the landing page +
 * Referer header. Without these the lookup silently returns an empty result.
 *
 * Response shape (relevant cells):
 *   Combined Jurisdiction:    Wichita
 *   Combined Non-Food Code:   WICSG
 *   Total Non-Food Tax Rate:  7.5%
 *   Combined Food Code:       SGWIC
 *   Total Food Tax Rate:      1%
 *   State Of Kansas:          6.500%
 *   Sedgwick County:          1.000%
 *   <city/CID rows as applicable>
 *
 * Verified addresses (Q2 2026):
 *   525 N Main St, Wichita 67203 → 7.5% (state 6.5% + Sedgwick County 1%)
 *
 * Caveats:
 *   - HTML scraping is fragile. KS could redesign the page without notice.
 *   - No published SLA. Treat failures as transient + cache aggressively.
 *   - Response is from a ColdFusion app — older infrastructure, occasionally slow.
 */

// ─── Endpoints ─────────────────────────────────────────────────────────────
const LANDING_URL = "https://www.ksrevenue.gov/atrladdress.html";
const LOOKUP_URL = "https://www.kssst.kdor.ks.gov/webLookupResults.cfm";

// ─── Types ─────────────────────────────────────────────────────────────────
import type { TxJurisdictionLine, TxRateFailure } from "./txComptrollerApi";

export interface KsJurisdictionLine {
  jurisName: string;
  jurisType: "state" | "county" | "city" | "special";
  jurisRate: number; // decimal e.g. 0.065
}

export interface KsRateResult {
  ok: true;
  combinedRate: number; // decimal e.g. 0.075
  foodRate: number | null; // separate KS quirk — food rate
  jurisdictions: KsJurisdictionLine[];
  resolvedAddress: {
    street: string;
    city: string;
    state: "KS";
    zip: string;
    zip4: string | null;
  };
  combinedJurisdictionName: string | null; // e.g. "Wichita"
  combinedCode: string | null; // e.g. "WICSG"
  raw: string; // raw HTML for audit
}

export interface KsRateFailure {
  ok: false;
  reason: "no_match" | "http_error" | "network_error" | "parse_error" | "low_confidence";
  message: string;
  status?: number;
  raw?: string;
}

export type KsRateLookup = KsRateResult | KsRateFailure;

export interface KsLookupArgs {
  /** House number alone, e.g. "525" */
  streetNumber: string;
  /** Street name without number, e.g. "N Main St" */
  streetName: string;
  city: string;
  zip: string;
  zip4?: string;
  /** Defaults to "100" — KS form expects a value or it silently returns empty */
  amount?: string;
}

// ─── HTML extraction helpers ───────────────────────────────────────────────
/**
 * Pull the value cell that follows a known-label cell.
 * KS response uses pattern: <td class="t_cls">Label : </td><td ...>Value</td>
 */
function extractLabelValue(html: string, label: string): string | null {
  // Match the label cell, then capture the next <td>...</td> value.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<td[^>]*class="t_cls"[^>]*>\\s*${escaped}\\s*:?\\s*</td>\\s*<td[^>]*>\\s*([^<]*?)\\s*</td>`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function parsePercent(s: string | null): number | null {
  if (!s) return null;
  const t = s.replace(/[%\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  // KS shows "7.5" or "7.500" as a percent — convert to decimal
  return n / 100;
}

/**
 * Extract the per-entity jurisdiction breakdown from the "Tax Entities" section.
 * Each row looks like:
 *   <td class="t_cls">State Of Kansas: </td><td align="right" ...>6.500%</td>
 *   <td class="t_cls">Sedgwick County: </td><td align="right" ...>1.000%</td>
 *
 * We extract all label/percent pairs between "Tax Entities" and "Tax Calculation".
 */
function extractJurisdictions(html: string): KsJurisdictionLine[] {
  // Narrow to the entities section
  const startIdx = html.indexOf("Tax Entities");
  const endIdx = html.indexOf("Tax Calculation", startIdx);
  const section = startIdx >= 0 && endIdx > startIdx ? html.slice(startIdx, endIdx) : html;

  const out: KsJurisdictionLine[] = [];
  const re = /<td[^>]*class="t_cls"[^>]*>\s*([^<:]+?)\s*:?\s*<\/td>\s*<td[^>]*>\s*([\d.]+)\s*%\s*<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(section)) !== null) {
    const name = match[1].trim();
    const pct = Number(match[2]);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    // Skip rows that aren't real jurisdictions (e.g. "Total Non-Food Tax Rate")
    const lower = name.toLowerCase();
    if (
      lower.includes("total") ||
      lower.includes("rate") ||
      lower.includes("amount") ||
      lower.startsWith("tax")
    )
      continue;

    let type: KsJurisdictionLine["jurisType"];
    if (/state\s+of\s+kansas/i.test(name) || /^kansas$/i.test(name)) type = "state";
    else if (/county/i.test(name)) type = "county";
    else if (/(cid|star\s*bond|district|tdd|tourism)/i.test(name)) type = "special";
    else type = "city";

    out.push({ jurisName: name, jurisType: type, jurisRate: pct / 100 });
  }
  return out;
}

// ─── Lookup ────────────────────────────────────────────────────────────────
export async function lookupKansasRateByAddress(
  args: KsLookupArgs
): Promise<KsRateLookup> {
  // Step 1: GET landing to obtain a session cookie. KS silently fails without it.
  let cookieHeader = "";
  try {
    const landingRes = await fetch(LANDING_URL, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });
    // Collect Set-Cookie headers — Node's fetch puts them in headers.getSetCookie() (Node 20+).
    const headersWithCookies = landingRes.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies =
      typeof headersWithCookies.getSetCookie === "function"
        ? headersWithCookies.getSetCookie()
        : [];
    cookieHeader = (setCookies as string[])
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
  } catch (e) {
    return {
      ok: false,
      reason: "network_error",
      message: `KS landing fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Step 2: POST lookup form
  const body = new URLSearchParams({
    StrAddrNum: args.streetNumber,
    StrAddress: args.streetName,
    StrSecondaryAddress: "",
    StrCity: args.city,
    IntZip5: args.zip,
    IntZip4: args.zip4 ?? "",
    IntAmount: args.amount ?? "100",
  });

  let res: Response;
  try {
    res = await fetch(LOOKUP_URL, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
        Referer: LANDING_URL,
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

  if (!res.ok) {
    return {
      ok: false,
      reason: "http_error",
      status: res.status,
      message: `KS lookup ${res.status}`,
    };
  }

  const html = await res.text();

  // Step 3: Parse response
  const combinedJurisdiction = extractLabelValue(html, "Combined Jurisdiction");
  const combinedCode = extractLabelValue(html, "Combined Non-Food Code");
  const totalRateStr = extractLabelValue(html, "Total Non-Food Tax Rate");
  const foodRateStr = extractLabelValue(html, "Total Food Tax Rate");
  const totalRate = parsePercent(totalRateStr);
  const foodRate = parsePercent(foodRateStr);
  const jurisdictions = extractJurisdictions(html);

  if (totalRate === null || totalRate <= 0) {
    return {
      ok: false,
      reason: "no_match",
      message:
        "KS lookup returned no combined rate. Verify the address — KS silently returns an empty result on bad input.",
      raw: html,
    };
  }
  if (jurisdictions.length === 0) {
    return {
      ok: false,
      reason: "parse_error",
      message: "KS lookup returned a rate but no jurisdiction breakdown could be parsed.",
      raw: html,
    };
  }

  // Sanity: jurisdictions should sum to combined within rounding (small floats)
  const sum = jurisdictions.reduce((s, j) => s + j.jurisRate, 0);
  if (Math.abs(sum - totalRate) > 0.0005) {
    // Surface as low_confidence — the math doesn't line up. Could be a CID
    // that's partly captured.
    return {
      ok: false,
      reason: "low_confidence",
      message: `KS jurisdictions sum to ${(sum * 100).toFixed(3)}% but combined reported ${(
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
      street: `${args.streetNumber} ${args.streetName}`.trim(),
      city: args.city,
      state: "KS",
      zip: args.zip,
      zip4: args.zip4 ?? null,
    },
    combinedJurisdictionName: combinedJurisdiction,
    combinedCode,
    raw: html,
  };
}
