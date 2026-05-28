import { NextResponse } from "next/server";
import { calculateTax } from "@/lib/avalara/client";
import { createClient } from "@/lib/supabase/server";
import { lookupRate, type StateCode } from "@/lib/tax/lookupRate";

// States the custom lookupRate system supports. Anything else falls through
// to the Avalara branch (and then the flat-rate fallback if Avalara isn't
// configured).
const COVERED_STATES = new Set<StateCode>(["TX", "LA", "OK", "KS", "AR"]);

function normalizeState(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase().slice(0, 2);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    line_items,
    discounts,
    show_id,
    location_id,
    customer_id,
    // Optional caller-provided ship-to override. When the customer is in a
    // different state than the venue (cross-state sourcing), Step3Products
    // passes this so destination wins over origin (per Avalara consultation
    // 2026-05-28 and TX Tax Code §151.330).
    ship_to_address,
    // Raw customer fields — used to derive cross-state ship-to when
    // ship_to_address isn't pre-built.
    customer_state,
    customer_address,
    customer_city,
    customer_zip,
  } = body;

  // ─── Load venue address ─────────────────────────────────────────────────
  let venueAddress: { line1: string; city: string; region: string; postalCode: string; country: "US" } | undefined;
  if (show_id) {
    const { data: show } = await supabase
      .from("shows")
      .select("address, city, state, zip")
      .eq("id", show_id)
      .single();
    if (show) {
      venueAddress = {
        line1: show.address ?? "",
        city: show.city ?? "",
        region: show.state ?? "",
        postalCode: show.zip ?? "",
        country: "US",
      };
    }
  } else if (location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("address, city, state, zip")
      .eq("id", location_id)
      .single();
    if (loc) {
      venueAddress = {
        line1: loc.address ?? "",
        city: loc.city ?? "",
        region: loc.state ?? "",
        postalCode: loc.zip ?? "",
        country: "US",
      };
    }
  }

  // ─── Build ship-to (cross-state sourcing) ──────────────────────────────
  // Priority: explicit ship_to_address → derived from customer fields →
  // venueAddress. Falls back to venue when customer is in same state or
  // outside our coverage.
  let resolvedShipTo: { line1: string; city: string; region: string; postalCode: string; country: "US" } | undefined;

  if (ship_to_address && typeof ship_to_address === "object" && ship_to_address.region) {
    resolvedShipTo = {
      line1: String(ship_to_address.line1 ?? ""),
      city: String(ship_to_address.city ?? ""),
      region: normalizeState(ship_to_address.region),
      postalCode: String(ship_to_address.postalCode ?? ""),
      country: "US",
    };
  } else {
    const cState = normalizeState(customer_state);
    const vState = normalizeState(venueAddress?.region);
    const cZipOk = typeof customer_zip === "string" && /^\d{5}$/.test(customer_zip);
    if (
      cState &&
      cState !== vState &&
      COVERED_STATES.has(cState as StateCode) &&
      typeof customer_address === "string" && customer_address.trim() &&
      typeof customer_city === "string" && customer_city.trim() &&
      cZipOk
    ) {
      resolvedShipTo = {
        line1: customer_address.trim(),
        city: customer_city.trim(),
        region: cState,
        postalCode: customer_zip,
        country: "US",
      };
    }
  }

  const shipToAddress = resolvedShipTo ?? venueAddress;
  if (!shipToAddress) {
    return NextResponse.json({ error: "Location address required for tax calculation" }, { status: 400 });
  }

  // ─── Compute taxable up front ──────────────────────────────────────────
  const subtotal = (line_items as { sell_price: number; quantity: number }[])
    .reduce((sum: number, item) => sum + item.sell_price * item.quantity, 0);
  const discountTotal = (discounts as { amount: number }[])
    .reduce((sum: number, d) => sum + d.amount, 0);
  const taxableAmount = Math.max(0, subtotal - discountTotal);

  // ─── PRIMARY PATH: Atlas custom lookupRate ─────────────────────────────
  // Routes to TX Comptroller API / LA Mapbox+LATA / OK CSA scraper /
  // KS DOR scraper / AR GIS scraper based on the resolved state.
  // Audit fields (source / effective_date / jurisdictions) flow back to the
  // contract row via Step3Products → /api/contracts (migration 098).
  const lookupState = normalizeState(shipToAddress.region) as StateCode;
  if (COVERED_STATES.has(lookupState)) {
    try {
      const result = await lookupRate({
        state: lookupState,
        zip: shipToAddress.postalCode,
        street_address: shipToAddress.line1,
      });

      // Outcomes that yield a real combined_rate.
      const realOutcomes = new Set([
        "show_location",
        "tx_api",
        "ks_api",
        "ok_api",
        "ar_api",
        "la_api",
        "by_zip",
      ]);

      if (realOutcomes.has(result.outcome) && typeof result.combined_rate === "number") {
        const tax = Math.round(taxableAmount * result.combined_rate * 100) / 100;
        const topJur = result.jurisdictions.find((j) => j.type !== "state")?.name
          ?? result.jurisdictions[0]?.name
          ?? `${lookupState} tax`;
        return NextResponse.json({
          tax_amount: tax,
          total_tax: tax,
          tax_rate: result.combined_rate,
          jurisdiction: topJur,
          // Audit fields for /api/contracts to persist
          tax_rate_source: result.source,
          tax_rate_effective_date: result.effective_date,
          tax_rate_jurisdictions: result.jurisdictions,
          tax_lookup_outcome: result.outcome,
          tax_lookup_warning: result.warning,
        });
      }

      // requires_verification: surface clearly so the rep knows to verify.
      // We still return the flat-rate so the contract can progress, but the
      // UI gets the warning.
      if (result.outcome === "requires_verification") {
        const flatRate = Number(process.env.FLAT_TAX_RATE ?? "0.0825");
        const tax = Math.round(taxableAmount * flatRate * 100) / 100;
        return NextResponse.json({
          tax_amount: tax,
          total_tax: tax,
          tax_rate: flatRate,
          jurisdiction: `${lookupState} (manual verification required)`,
          flat_rate: true,
          tax_lookup_outcome: result.outcome,
          tax_lookup_warning:
            result.warning ??
            "Rate could not be auto-verified for this address. Please pin the venue or verify manually.",
        });
      }
      // no_data — fall through to Avalara/flat-rate below.
    } catch (err) {
      console.error("[tax] lookupRate threw:", err);
      // Fall through to Avalara/flat-rate.
    }
  }

  // ─── Flat-rate fallback (preserved from original) ──────────────────────
  // Runs when AVALARA isn't configured AND lookupRate didn't yield a rate
  // (uncovered state, lookup error, or no_data outcome).
  if (!process.env.AVALARA_ACCOUNT_ID || !process.env.AVALARA_LICENSE_KEY) {
    const flatRate = Number(process.env.FLAT_TAX_RATE ?? "0.0825");
    const totalTax = Math.round(taxableAmount * flatRate * 100) / 100;
    return NextResponse.json({
      tax_amount: totalTax,
      total_tax: totalTax,
      tax_rate: flatRate,
      jurisdiction: "Flat rate (Avalara not yet connected)",
      flat_rate: true,
    });
  }

  // ─── Legacy Avalara path (only runs when Avalara creds are present) ────
  const shipFrom = {
    line1: process.env.SHIP_FROM_ADDRESS ?? "123 Main St",
    city: process.env.SHIP_FROM_CITY ?? "Wichita",
    region: process.env.SHIP_FROM_STATE ?? "KS",
    postalCode: process.env.SHIP_FROM_ZIP ?? "67201",
    country: "US",
  };

  try {
    const taxResult = await calculateTax({
      customerCode: customer_id ?? "GUEST",
      date: new Date().toISOString().slice(0, 10),
      type: "SalesOrder",
      shipTo: shipToAddress,
      shipFrom,
      purchaseOrderNo: `QUOTE-${customer_id ?? "GUEST"}-${Date.now()}`,
      lines: (line_items as { sell_price: number; quantity: number; product_name?: string }[]).map(
        (item, i) => ({
          number: String(i + 1),
          amount: item.sell_price * item.quantity,
          description: item.product_name ?? "Hot Tub / Spa",
          itemCode: "SPA",
        })
      ),
    });

    const totalTax = taxResult.totalTax;
    const effectiveRate = taxableAmount > 0 ? totalTax / taxableAmount : 0;
    const topJurisdiction = taxResult.lines?.[0]?.details?.[0]?.taxName ?? "State Tax";

    return NextResponse.json({
      tax_amount: totalTax,
      total_tax: totalTax,
      tax_rate: effectiveRate,
      jurisdiction: topJurisdiction,
    });
  } catch (err) {
    console.error("[tax] Avalara calculation failed:", err);
    return NextResponse.json({ error: "Tax calculation failed", details: String(err) }, { status: 500 });
  }
}
