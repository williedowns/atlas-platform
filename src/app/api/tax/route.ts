import { NextResponse } from "next/server";
import { calculateTax } from "@/lib/avalara/client";
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
      shipToAddress = { line1: show.address, city: show.city, region: show.state, postalCode: show.zip, country: "US" };
    }
  } else if (location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("address, city, state, zip")
      .eq("id", location_id)
      .single();
    if (loc) {
      shipToAddress = { line1: loc.address, city: loc.city, region: loc.state, postalCode: loc.zip, country: "US" };
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

  // Flat-rate fallback: until Avalara is wired up, every order taxes at 8.25%
  // (Willie 04-29). When Avalara credentials get added, this branch stops
  // running and the live API call below takes over. Override the rate via
  // FLAT_TAX_RATE env var if needed.
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
