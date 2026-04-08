import { NextResponse } from "next/server";
import { calculateTax } from "@/lib/zamp/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { line_items, discounts, show_id, location_id, customer_id } = body;

  // Get show/location address for tax jurisdiction
  let shipToAddress;
  if (show_id) {
    const { data: show } = await supabase
      .from("shows")
      .select("address, city, state, zip")
      .eq("id", show_id)
      .single();
    if (show) {
      shipToAddress = { line1: show.address, city: show.city, state: show.state, zip: show.zip };
    }
  } else if (location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("address, city, state, zip")
      .eq("id", location_id)
      .single();
    if (loc) {
      shipToAddress = { line1: loc.address, city: loc.city, state: loc.state, zip: loc.zip };
    }
  }

  if (!shipToAddress) {
    return NextResponse.json({ error: "Location address required for tax calculation" }, { status: 400 });
  }

  // Guard: token not configured — return gracefully instead of throwing
  if (!process.env.ZAMP_API_TOKEN) {
    console.warn("[tax] ZAMP_API_TOKEN not set — skipping tax calculation");
    return NextResponse.json({ tax_amount: 0, total_tax: 0, tax_rate: 0, jurisdiction: null, unconfigured: true });
  }

  const subtotal = (line_items as { sell_price: number; quantity: number }[])
    .reduce((sum: number, item) => sum + item.sell_price * item.quantity, 0);
  const discountTotal = (discounts as { amount: number }[])
    .reduce((sum: number, d) => sum + d.amount, 0);
  const taxableAmount = Math.max(0, subtotal - discountTotal);

  const shipFrom = {
    line1: process.env.SHIP_FROM_ADDRESS ?? "123 Main St",
    city: process.env.SHIP_FROM_CITY ?? "Wichita",
    state: process.env.SHIP_FROM_STATE ?? "KS",
    zip: process.env.SHIP_FROM_ZIP ?? "67201",
  };

  const taxResult = await calculateTax({
    id: `QUOTE-${customer_id ?? "GUEST"}-${Date.now()}`,
    transactedAt: new Date().toISOString(),
    subtotal: taxableAmount,
    total: taxableAmount,
    shipToAddress,
    shipFromAddress: shipFrom,
    lineItems: [
      {
        id: "1",
        amount: taxableAmount,
        quantity: 1,
        productName: "Hot Tub / Spa",
        productSku: "SPA",
        productTaxCode: "R_TPP", // Tangible personal property — hot tubs/spas
      },
    ],
  });

  const totalTax = taxResult.taxDue;
  const effectiveRate = taxableAmount > 0 ? totalTax / taxableAmount : 0;
  const topJurisdiction = taxResult.taxes?.[0]?.jurisdictionName ?? "State Tax";

  return NextResponse.json({
    tax_amount: totalTax,
    total_tax: totalTax,
    tax_rate: effectiveRate,
    jurisdiction: topJurisdiction,
  });
}
