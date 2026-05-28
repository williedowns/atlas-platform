/**
 * Sales tax rate lookup for the OTD calculator and contract entry.
 *
 * DRAFT — paired with migrations 095 + 096 (tax_rate_lookup + sku_taxability_seed).
 *
 * Strategy (per MEMORY/WORK/20260527-114447_custom-sales-tax-system/PRD.md):
 *   - Atlas sells at known venues. Most lookups hit tax_show_locations (venue cache).
 *   - Walk-in / cold lookups fall through to tax_rates_by_zip for TX/OK/KS.
 *   - LA always returns REQUIRES_VERIFICATION — home-rule parishes are not in
 *     tax_rates_by_zip. The caller must source the rate from tax_show_locations
 *     or prompt the salesperson to phone the parish.
 */
import { createClient } from "@/lib/supabase/server";
import { lookupTexasRateByAddress } from "@/lib/tax/txComptrollerApi";
import { lookupKansasRateByAddress } from "@/lib/tax/ksRevenueClient";
import { lookupOklahomaRateByAddress } from "@/lib/tax/okTaxClient";
import { lookupArkansasRateByAddress } from "@/lib/tax/arGisClient";
import { lookupLouisianaRateByAddress } from "@/lib/tax/laParishClient";

// ─── Types ────────────────────────────────────────────────────────────────
export type StateCode = "TX" | "LA" | "OK" | "KS" | "AR";

export type LookupOutcome =
  | "show_location"   // hit on a verified Atlas venue
  | "tx_api"          // hit on TX Comptroller REST API (live lookup)
  | "ks_api"          // hit on KS DOR webLookupResults.cfm (HTML scrape)
  | "ok_api"          // hit on OK OU CSA Rate Locator (HTML scrape, Django)
  | "ar_api"          // hit on AR GIS Rate Locator (HTML scrape)
  | "la_api"          // hit on Mapbox geocode + LATA spatial RPC
  | "by_zip"          // hit on tax_rates_by_zip (legacy, being deprecated)
  | "requires_verification" // Cameron/Jefferson LA gaps, or low-confidence
  | "no_data";        // miss

export interface JurisdictionBreakdown {
  name: string;
  type: "state" | "county" | "parish" | "city" | "transit" | "special" | "combined";
  rate: number; // 0..0.20
}

export interface TaxRateLookupResult {
  outcome: LookupOutcome;
  combined_rate: number | null;          // null when outcome === no_data | requires_verification
  state: StateCode;
  jurisdictions: JurisdictionBreakdown[]; // empty when outcome === no_data
  source: string | null;                  // 'show_location:<id>' | 'TX_EDI' | 'KS_PUB1700' | 'OK_COPO'
  effective_date: string | null;          // ISO date
  warning: string | null;                 // human-readable note for the UI
  verified_by: string | null;             // only set for show_location
}

export interface LookupArgs {
  state: StateCode;
  zip: string;          // 5-digit
  venue_id?: string;    // optional — prefers tax_show_locations row
  street_address?: string; // optional — used only as a tie-breaker
}

// ─── Lookup ───────────────────────────────────────────────────────────────
export async function lookupRate(args: LookupArgs): Promise<TaxRateLookupResult> {
  const supabase = await createClient();
  const zip = (args.zip || "").trim().slice(0, 5);

  // 1) Preferred path: caller specifies a known venue.
  if (args.venue_id) {
    const { data: venue } = await supabase
      .from("tax_show_locations")
      .select("id, combined_rate, jurisdictions, verified_by, verified_at, active")
      .eq("id", args.venue_id)
      .eq("active", true)
      .maybeSingle();

    if (venue && venue.active) {
      return {
        outcome: "show_location",
        combined_rate: Number(venue.combined_rate),
        state: args.state,
        jurisdictions: (venue.jurisdictions as JurisdictionBreakdown[]) ?? [],
        source: `show_location:${venue.id}`,
        effective_date: venue.verified_at?.slice(0, 10) ?? null,
        warning: null,
        verified_by: venue.verified_by ?? null,
      };
    }
  }

  // 2) Try matching a venue by (state, zip) — picks the most recently verified.
  {
    const { data: venues } = await supabase
      .from("tax_show_locations")
      .select("id, combined_rate, jurisdictions, verified_by, verified_at")
      .eq("state", args.state)
      .eq("zip", zip)
      .eq("active", true)
      .order("verified_at", { ascending: false })
      .limit(1);

    if (venues && venues.length > 0) {
      const v = venues[0];
      return {
        outcome: "show_location",
        combined_rate: Number(v.combined_rate),
        state: args.state,
        jurisdictions: (v.jurisdictions as JurisdictionBreakdown[]) ?? [],
        source: `show_location:${v.id}`,
        effective_date: v.verified_at?.slice(0, 10) ?? null,
        warning: "Matched a verified venue at this ZIP — confirm it's the right one.",
        verified_by: v.verified_by ?? null,
      };
    }
  }

  // 3) Louisiana: no usable automated lookup exists. Parish E-File is ASP.NET
  //    WebForms (viewstate-locked); third-party SalesTaxExplorer is paid.
  //    Home-rule parishes administer local tax independently and change rates
  //    with short notice. Force human verification with sharp instructions.
  //
  //    The salesperson's path: pin the venue once via /admin/tax-venues with
  //    the rate confirmed by phoning the destination parish Sales Tax
  //    Department 2+ weeks before the show. All subsequent sales at that
  //    venue then hit the show_location cache and bypass this branch.
  // Louisiana: live Mapbox geocode + spatial RPC against LATA-sourced rates
  // (62 of 64 parishes covered; Cameron + Jefferson fall back to
  // requires_verification with admin-pin guidance).
  if (args.state === "LA" && args.street_address && args.street_address.trim()) {
    const la = await lookupLouisianaRateByAddress({
      street: args.street_address,
      city: "",   // LA client passes the address through to Mapbox; city is informational
      zip,
    });
    if (la.ok) {
      return {
        outcome: "la_api",
        combined_rate: la.combinedRate,
        state: "LA",
        jurisdictions: la.jurisdictions.map((j) => ({
          name: j.jurisName,
          // Map LA-specific types onto the shared JurisdictionBreakdown.type union.
          type:
            j.jurisType === "state"
              ? "state"
              : j.jurisType === "parish_combined"
              ? "parish"
              : "special",
          rate: j.jurisRate,
        })),
        source: "la_lata_spatial",
        effective_date: null, // LATA rate effective_date is stored per-row in la_lata_jurisdictions
        warning:
          la.geocodeAccuracy && la.geocodeAccuracy !== "rooftop"
            ? `Geocode accuracy: ${la.geocodeAccuracy} (not rooftop) — confirm before high-value sale.`
            : null,
        verified_by: null,
      };
    }
    // Failure modes — surface the most useful instruction for each.
    if (la.reason === "low_confidence") {
      return {
        outcome: "requires_verification",
        combined_rate: null,
        state: "LA",
        jurisdictions: [],
        source: "la_lata_spatial",
        effective_date: null,
        warning: la.message,
        verified_by: null,
      };
    }
    if (la.reason === "out_of_state") {
      return {
        outcome: "no_data",
        combined_rate: null,
        state: "LA",
        jurisdictions: [],
        source: "la_lata_spatial",
        effective_date: null,
        warning: la.message,
        verified_by: null,
      };
    }
    // geocode_failed / rpc_error / no_match — verbose warning, no rate.
    return {
      outcome: "requires_verification",
      combined_rate: null,
      state: "LA",
      jurisdictions: [],
      source: "la_lata_spatial",
      effective_date: null,
      warning:
        `LA lookup failed (${la.reason}): ${la.message}. ` +
        "Pin the venue via /admin/tax-venues with the verified parish rate.",
      verified_by: null,
    };
  }

  // LA without street_address — can't geocode. Same manual-verify guidance
  // as before but with a clearer "we need a street" message.
  if (args.state === "LA") {
    return {
      outcome: "requires_verification",
      combined_rate: null,
      state: "LA",
      jurisdictions: [],
      source: null,
      effective_date: null,
      warning:
        "Louisiana lookup requires a street address (the spatial DB needs " +
        "lat/lng resolved via Mapbox). Either supply the customer's street, " +
        "or pin the venue via /admin/tax-venues with the parish-verified rate.",
      verified_by: null,
    };
  }

  // 4) Kansas: call the KS DOR lookup (HTML form, scrape response).
  //    Only attempted when a street address is supplied — KS form requires it.
  if (args.state === "KS" && args.street_address && args.street_address.trim()) {
    // Split "525 N Main St" → streetNumber="525", streetName="N Main St"
    const trimmed = args.street_address.trim();
    const numMatch = trimmed.match(/^(\d+\w?)\s+(.+)$/);
    if (numMatch) {
      const streetNumber = numMatch[1];
      const streetName = numMatch[2];
      // City is required by KS — derive from the lookup args if caller provided
      // it via venue, otherwise leave blank and let KS resolve from ZIP.
      const ks = await lookupKansasRateByAddress({
        streetNumber,
        streetName,
        city: "", // caller would pass via venue; KS infers from ZIP if missing — sometimes
        zip,
      });
      if (ks.ok) {
        return {
          outcome: "ks_api",
          combined_rate: ks.combinedRate,
          state: "KS",
          jurisdictions: ks.jurisdictions.map((j) => ({
            name: j.jurisName,
            type: j.jurisType,
            rate: j.jurisRate,
          })),
          source: "ks_dor_lookup",
          effective_date: null, // KS lookup doesn't return effective date in the response
          warning: ks.foodRate !== null
            ? `Food items in KS have a different rate (${(ks.foodRate * 100).toFixed(2)}%) — Atlas doesn't sell food, but flagged for completeness.`
            : null,
          verified_by: null,
        };
      }
      if (ks.reason === "low_confidence") {
        return {
          outcome: "requires_verification",
          combined_rate: null,
          state: "KS",
          jurisdictions: [],
          source: "ks_dor_lookup",
          effective_date: null,
          warning: ks.message,
          verified_by: null,
        };
      }
      // Other failures: fall through to no_data at the bottom.
    }
  }

  // 4a) Arkansas: call the AR DFA / GIS Rate Locator (HTML form scrape).
  if (args.state === "AR" && (args.street_address || zip)) {
    const ar = await lookupArkansasRateByAddress({
      street: args.street_address,
      city: undefined, // AR endpoint resolves city from address; pass through any value if available
      zip,
    });
    if (ar.ok) {
      return {
        outcome: "ar_api",
        combined_rate: ar.combinedRate,
        state: "AR",
        jurisdictions: ar.jurisdictions.map((j) => ({
          name: j.jurisName,
          type: j.jurisType,
          rate: j.jurisRate,
        })),
        source: "ar_gis_lookup",
        effective_date: null,
        warning: ar.foodRate !== null
          ? `Food rate in AR is ${(ar.foodRate * 100).toFixed(2)}% — separate from general 6.5% state rate. Atlas doesn't sell food.`
          : null,
        verified_by: null,
      };
    }
    if (ar.reason === "low_confidence") {
      return {
        outcome: "requires_verification",
        combined_rate: null,
        state: "AR",
        jurisdictions: [],
        source: "ar_gis_lookup",
        effective_date: null,
        warning: ar.message,
        verified_by: null,
      };
    }
    // Other failures fall through to no_data.
  }

  // 4b) Oklahoma: call the OK OU CSA Rate Locator (HTML form, Django + CSRF).
  if (args.state === "OK" && args.street_address && args.street_address.trim()) {
    const parsed = parseOkStreetAddress(args.street_address);
    if (parsed) {
      const ok = await lookupOklahomaRateByAddress({
        houseNumber: parsed.houseNumber,
        streetDirection: parsed.streetDirection,
        streetName: parsed.streetName,
        streetType: parsed.streetType,
        zip,
      });
      if (ok.ok) {
        return {
          outcome: "ok_api",
          combined_rate: ok.combinedRate,
          state: "OK",
          jurisdictions: ok.jurisdictions.map((j) => ({
            name: j.jurisName,
            type: j.jurisType,
            rate: j.jurisRate,
          })),
          source: "ok_csa_rate_locator",
          effective_date: null,
          warning: null,
          verified_by: null,
        };
      }
      if (ok.reason === "low_confidence") {
        return {
          outcome: "requires_verification",
          combined_rate: null,
          state: "OK",
          jurisdictions: [],
          source: "ok_csa_rate_locator",
          effective_date: null,
          warning: ok.message,
          verified_by: null,
        };
      }
      // Other failures fall through to no_data.
    }
  }

  // 5) Texas: call the TX Comptroller REST API for live address resolution.
  //    Only attempted when a street address is supplied — the API requires it.
  if (args.state === "TX" && args.street_address && args.street_address.trim()) {
    const tx = await lookupTexasRateByAddress({
      street: args.street_address,
      city: "", // empty is OK — API will resolve from ZIP+street; passing the venue city if available is optional
      zip,
    });
    if (tx.ok) {
      return {
        outcome: "tx_api",
        combined_rate: tx.combinedRate,
        state: "TX",
        jurisdictions: tx.jurisdictions.map((j) => ({
          name: j.jurisName,
          type:
            j.jurisType === "STATE"
              ? "state"
              : j.jurisType === "CITY"
              ? "city"
              : j.jurisType === "COUNTY"
              ? "county"
              : j.jurisType === "TRANSIT"
              ? "transit"
              : "special",
          rate: j.jurisRate,
        })),
        source: "tx_comptroller_api",
        effective_date: tx.effectiveDate,
        warning: tx.message,
        verified_by: null,
      };
    }
    // If TX API failed with low_confidence, surface that distinctly so the UI warns.
    if (tx.reason === "low_confidence") {
      return {
        outcome: "requires_verification",
        combined_rate: null,
        state: "TX",
        jurisdictions: [],
        source: "tx_comptroller_api",
        effective_date: null,
        warning: tx.message,
        verified_by: null,
      };
    }
    // Other TX API failures: log via warning string and fall through to legacy by_zip.
    // (by_zip will likely also miss since the sync isn't being maintained.)
  }

  // 5) Legacy fall through to tax_rates_by_zip (deprecated; only meaningful for OK/KS until those have API clients).
  const { data: zipRow } = await supabase
    .from("v_tax_rates_by_zip_current")
    .select("combined_rate, jurisdictions, source, effective_date, state")
    .eq("zip", zip)
    .eq("state", args.state)
    .maybeSingle();

  if (zipRow) {
    return {
      outcome: "by_zip",
      combined_rate: Number(zipRow.combined_rate),
      state: args.state,
      jurisdictions: (zipRow.jurisdictions as JurisdictionBreakdown[]) ?? [],
      source: zipRow.source ?? null,
      effective_date: zipRow.effective_date ?? null,
      warning:
        "ZIP-level rate — accurate for most addresses but does not capture special districts that span partial ZIPs. Verify before high-value sales.",
      verified_by: null,
    };
  }

  // 6) Nothing found.
  return {
    outcome: "no_data",
    combined_rate: null,
    state: args.state,
    jurisdictions: [],
    source: null,
    effective_date: null,
    warning:
      "No rate found in cache. Either the ZIP is unrecognized or the sync script has not been run for this quarter.",
    verified_by: null,
  };
}

// ─── SKU taxability lookup ────────────────────────────────────────────────
export type SkuCategory =
  | "spa_unit"
  | "delivery"
  | "install_labor_portable"
  | "install_labor_builtin"
  | "granite_pad_residential"
  | "granite_pad_commercial"
  | "cover"
  | "lifter"
  | "steps"
  | "chemicals"
  | "warranty_extended";

export interface SkuTaxability {
  sku_category: SkuCategory;
  state: StateCode;
  is_taxable: boolean;
  notes: string | null;
  citation: string | null;
  ian_approved_at: string | null;
}

/**
 * Returns the taxability matrix for a state. The caller iterates line items and
 * applies is_taxable per SKU category. Rows without ian_approved_at should be
 * treated with caution — the UI should warn.
 */
export async function loadSkuTaxability(state: StateCode): Promise<SkuTaxability[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_sku_taxability")
    .select("sku_category, state, is_taxable, notes, citation, ian_approved_at")
    .eq("state", state);
  return (data ?? []) as SkuTaxability[];
}

/**
 * Apply taxability rules to a contract's line items.
 *
 * lines: [{ sku_category, amount }]
 * Returns: { taxable_subtotal, tax_amount, warnings[] }
 */
export interface LineForTax {
  sku_category: SkuCategory;
  amount: number; // pre-tax line amount
}

export interface ComputeTaxResult {
  combined_rate: number;
  taxable_subtotal: number;
  exempt_subtotal: number;
  tax_amount: number;
  warnings: string[];
}

export async function computeTax(
  state: StateCode,
  combined_rate: number,
  lines: LineForTax[]
): Promise<ComputeTaxResult> {
  const matrix = await loadSkuTaxability(state);
  const byCat = new Map<string, SkuTaxability>(matrix.map((m) => [m.sku_category, m]));

  let taxable = 0;
  let exempt = 0;
  const warnings: string[] = [];

  for (const line of lines) {
    const rule = byCat.get(line.sku_category);
    if (!rule) {
      // No row in matrix → conservative default: taxable, warn.
      taxable += line.amount;
      warnings.push(
        `No taxability rule for "${line.sku_category}" in ${state}. Treated as taxable. Add a row to tax_sku_taxability.`
      );
      continue;
    }
    if (!rule.ian_approved_at) {
      warnings.push(
        `"${line.sku_category}" rule for ${state} is not yet Ian-approved. Verify before relying.`
      );
    }
    if (rule.is_taxable) taxable += line.amount;
    else exempt += line.amount;
  }

  const tax_amount = Math.round(taxable * combined_rate * 100) / 100;
  return {
    combined_rate,
    taxable_subtotal: taxable,
    exempt_subtotal: exempt,
    tax_amount,
    warnings,
  };
}

// ─── OK street-address parser (heuristic) ──────────────────────────────────
/**
 * Parse a single-line OK address into the structured fields the OK lookup
 * form requires. Heuristic — for shows at known venues, recommend pinning
 * via tax_show_locations rather than relying on this parser.
 *
 * "200 N Walker Ave" → { houseNumber: "200", streetDirection: "N", streetName: "Walker", streetType: "AVE" }
 * "723 S Main St"    → { houseNumber: "723", streetDirection: "S", streetName: "Main",   streetType: "ST"  }
 * "100 1st St"       → { houseNumber: "100", streetName: "1st", streetType: "ST" }
 */
const OK_DIRS = new Set(["N", "E", "S", "W", "NE", "SE", "SW", "NW"]);
const OK_TYPES = new Set([
  "ST", "STREET",
  "AVE", "AVENUE",
  "BLVD", "BOULEVARD",
  "RD", "ROAD",
  "DR", "DRIVE",
  "LN", "LANE",
  "CT", "COURT",
  "WAY",
  "HWY", "HIGHWAY",
  "PKWY", "PARKWAY",
  "CIR", "CIRCLE",
  "PL", "PLACE",
  "TER", "TERRACE",
  "TRL", "TRAIL",
  "LOOP",
  "ALY", "ALLEY",
]);
const OK_TYPE_NORMALIZE: Record<string, string> = {
  STREET: "ST", AVENUE: "AVE", BOULEVARD: "BLVD", ROAD: "RD", DRIVE: "DR",
  LANE: "LN", COURT: "CT", HIGHWAY: "HWY", PARKWAY: "PKWY", CIRCLE: "CIR",
  PLACE: "PL", TERRACE: "TER", TRAIL: "TRL", ALLEY: "ALY",
};

function parseOkStreetAddress(input: string): {
  houseNumber: string;
  streetDirection: string;
  streetName: string;
  streetType: string;
} | null {
  const tokens = input.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  // First token must be a house number (digits, possibly with a trailing letter like "100A")
  const houseMatch = tokens[0].match(/^(\d+[A-Z]?)$/);
  if (!houseMatch) return null;
  const houseNumber = houseMatch[1];

  let i = 1;
  let streetDirection = "";
  if (OK_DIRS.has(tokens[i])) {
    streetDirection = tokens[i];
    i += 1;
  }

  // Last token might be a street type
  let streetType = "";
  let endIdx = tokens.length;
  if (tokens.length > i && OK_TYPES.has(tokens[tokens.length - 1])) {
    const raw = tokens[tokens.length - 1];
    streetType = OK_TYPE_NORMALIZE[raw] ?? raw;
    endIdx = tokens.length - 1;
  }

  // Token before last MIGHT be a trailing direction (e.g., "Main St N")
  // But that's uncommon for OK — skip handling it for now.

  const streetName = tokens.slice(i, endIdx).join(" ");
  if (!streetName) return null;

  return { houseNumber, streetDirection, streetName, streetType };
}
