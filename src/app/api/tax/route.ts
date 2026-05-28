import { NextResponse } from "next/server";
import { calculateTax } from "@/lib/avalara/client";
import { createClient } from "@/lib/supabase/server";
import { lookupRate, type StateCode } from "@/lib/tax/lookupRate";

const LOOKUP_STATES: ReadonlySet<string> = new Set(["TX", "LA", "OK", "KS", "AR"]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { line_items, discounts, show_id, location_id, customer_id, ship_to_address } = body;

  // ── Tax jurisdiction sourcing (per Avalara's destination-rule guidance) ───
  // Priority order:
  //   1) Explicit `ship_to_address` from the caller — wins when supplied.
  //      Used for cross-state deliveries (TX show selling to OK customer who
  //      takes delivery in OK → OK tax applies, not TX).
  //   2) Show address (`show_id`) — trade-show floor sourcing. Customer takes
  //      possession at the show.
  //   3) Location address (`location_id`) — showroom walk-in sourcing.
  //
  // The contract is the system of record for which sourcing rule applies; the
  // caller decides by passing either ship_to_address (delivery) or relying on
  // show_id/location_id (possession at venue). Document this on every sale —
  // it's the legal control surface per the TX Comptroller's §151.330 guidance.
  let shipToAddress:
    | { line1: string; city: string; region: string; postalCode: string; country: string }
    | undefined;
  let sourcing_basis: "ship_to" | "show" | "location" | null = null;

  if (
    ship_to_address &&
    typeof ship_to_address === "object" &&
    typeof ship_to_address.line1 === "string" &&
    typeof ship_to_address.region === "string" &&
    typeof ship_to_address.postalCode === "string"
  ) {
    shipToAddress = {
      line1: ship_to_address.line1,
      city: typeof ship_to_address.city === "string" ? ship_to_address.city : "",
      region: ship_to_address.region,
      postalCode: ship_to_address.postalCode,
      country: typeof ship_to_address.country === "string" ? ship_to_address.country : "US",
    };
    sourcing_basis = "ship_to";
  } else if (show_id) {
    const { data: show } = await supabase
      .from("shows")
      .select("address, city, state, zip")
      .eq("id", show_id)
      .single();
    if (show) {
      shipToAddress = { line1: show.address, city: show.city, region: show.state, postalCode: show.zip, country: "US" };
      sourcing_basis = "show";
    }
  } else if (location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("address, city, state, zip")
      .eq("id", location_id)
      .single();
    if (loc) {
      shipToAddress = { line1: loc.address, city: loc.city, region: loc.state, postalCode: loc.zip, country: "US" };
      sourcing_basis = "location";
    }
  }

  if (!shipToAddress) {
    return NextResponse.json({ error: "Location address required for tax calculation" }, { status: 400 });
  }

  // Compute taxable up front so both the Avalara path and the flat-rate
  // fallback can use it.
  const subtotal = (line_items as { sell_price: number; quantity: number }[])
    .reduce((sum: number, item) => sum + item.sell_price * item.quantity, 0);
  const discountTotal = (discounts as { amount: number }[])
    .reduce((sum: number, d) => sum + d.amount, 0);
  const taxableAmount = Math.max(0, subtotal - discountTotal);

  // ── Production kill switch ────────────────────────────────────────────
  // Set TAX_LOOKUP_ENABLED=false to force-disable the in-house lookup path
  // and fall through to the flat-rate fallback. Use this if multiple state
  // DOR endpoints fail simultaneously (unlikely but possible) and sales
  // need to keep happening with the conservative 8.25% flat rate while
  // engineering investigates. Default = enabled.
  const lookupEnabled = (process.env.TAX_LOOKUP_ENABLED ?? "true").toLowerCase() !== "false";
  if (!lookupEnabled) {
    console.info("[tax] TAX_LOOKUP_ENABLED=false — skipping in-house lookup, using flat-rate fallback");
  }

  // 1) IN-HOUSE LOOKUP PATH — preferred. Calls the state DOR / API for the
  // ship-to address; returns the live state-published combined rate plus
  // audit-log provenance (source / jurisdictions / effective_date). When
  // this succeeds, the response includes those audit fields so the wizard
  // can persist them on the contract per migration 098.
  // Falls through silently if the state isn't one we cover (LA included only
  // via venue cache), or if the lookup itself fails for any reason.
  if (
    lookupEnabled &&
    typeof shipToAddress.region === "string" &&
    LOOKUP_STATES.has(shipToAddress.region.toUpperCase())
  ) {
    try {
      const state = shipToAddress.region.toUpperCase() as StateCode;
      const lookup = await lookupRate({
        state,
        zip: shipToAddress.postalCode,
        street_address: shipToAddress.line1,
      });
      // Only accept high-confidence outcomes for auto-application. Low-conf
      // or requires_verification falls through to the next path.
      const highConfidence =
        lookup.combined_rate !== null &&
        (lookup.outcome === "tx_api" ||
          lookup.outcome === "ks_api" ||
          lookup.outcome === "ok_api" ||
          lookup.outcome === "ar_api" ||
          lookup.outcome === "show_location");
      if (highConfidence && lookup.combined_rate !== null) {
        const rate = lookup.combined_rate;
        const totalTax = Math.round(taxableAmount * rate * 100) / 100;
        const topName = lookup.jurisdictions[0]?.name ?? "State Tax";
        return NextResponse.json({
          tax_amount: totalTax,
          total_tax: totalTax,
          tax_rate: rate,
          jurisdiction: topName,
          // ── Audit-log payload (consumed by Step3Products → contractStore.setTax)
          tax_rate_source: lookup.source,
          tax_rate_effective_date: lookup.effective_date,
          tax_rate_jurisdictions: lookup.jurisdictions,
          lookup_outcome: lookup.outcome,
          sourcing_basis,
        });
      }
      // Non-high-confidence outcome — log for monitoring, fall through.
      if (lookup.warning) {
        console.info(
          `[tax] lookup non-high-confidence for ${state} ${shipToAddress.postalCode}: ${lookup.outcome} — ${lookup.warning}`
        );
      }
    } catch (err) {
      console.error("[tax] lookupRate threw, falling through:", err);
    }
  }

  // 2) Flat-rate fallback: until Avalara is wired up, every order taxes at
  // FLAT_TAX_RATE (default 8.25%). This path also runs when the in-house
  // lookup above failed or returned low confidence. Source = "legacy_default"
  // is captured server-side at /api/contracts; no audit fields returned here.
  if (!process.env.AVALARA_ACCOUNT_ID || !process.env.AVALARA_LICENSE_KEY) {
    // State-aware fallback. When the in-house lookup couldn't resolve
    // (most commonly: LA addresses with no pinned venue, or any state
    // when TAX_LOOKUP_ENABLED=false), use the destination state's BASELINE
    // rate rather than blindly applying 8.25% everywhere.
    //
    // This prevents the worst failure mode — selling at a LA show and
    // collecting 8.25% (TX rate) when LA's combined is typically 8.45%-11%.
    // The state baseline is conservative but at least correct on the state
    // portion; local portion needs venue verification (warning surfaced).
    const STATE_BASELINES: Record<string, number> = {
      TX: 0.0825, // 6.25% state + 2% local cap = typical TX combined
      LA: 0.05,   // 5% LA state only — local rate REQUIRES parish verification
      OK: 0.045,  // 4.5% OK state only — local needs verification
      KS: 0.065,  // 6.5% KS state only — local needs verification
      AR: 0.065,  // 6.5% AR state only — local needs verification
    };
    const destState = (shipToAddress.region ?? "").trim().toUpperCase();
    const envRate = Number(process.env.FLAT_TAX_RATE ?? "0.0825");
    const flatRate =
      STATE_BASELINES[destState] !== undefined
        ? STATE_BASELINES[destState]
        : envRate;
    const totalTax = Math.round(taxableAmount * flatRate * 100) / 100;
    const isStateBaseline = STATE_BASELINES[destState] !== undefined;
    const jurisdictionLabel = isStateBaseline
      ? `${destState} state baseline (${(flatRate * 100).toFixed(2)}%) — local rate not yet resolved`
      : "Flat rate (no high-confidence lookup)";
    return NextResponse.json({
      tax_amount: totalTax,
      total_tax: totalTax,
      tax_rate: flatRate,
      jurisdiction: jurisdictionLabel,
      flat_rate: true,
      // Audit payload so the contract row records WHY this rate was applied.
      // Surfaces in TaxRateProvenance as an amber/low-confidence badge so
      // admin sees "verify before signing — local rate unresolved."
      tax_rate_source: isStateBaseline ? `${destState.toLowerCase()}_state_baseline` : "legacy_default",
      tax_rate_effective_date: null,
      tax_rate_jurisdictions: isStateBaseline
        ? [{ name: `${destState} state`, type: "state", rate: flatRate }]
        : null,
      lookup_outcome: "no_data",
      sourcing_basis,
      warning: isStateBaseline
        ? `${destState} state baseline applied. Local jurisdiction rate NOT auto-resolved — pin the venue via /admin/tax-venues OR verify the local rate (and override on the contract if needed) before signing.`
        : null,
    });
  }

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
