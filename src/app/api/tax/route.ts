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

  const subtotal = (line_items as { sell_price: number; quantity: number }[])
    .reduce((sum: number, item) => sum + item.sell_price * item.quantity, 0);
  const discountTotal = (discounts as { amount: number }[])
    .reduce((sum: number, d) => sum + d.amount, 0);
  const taxableAmount = Math.max(0, subtotal - discountTotal);

  const taxResult = await calculateTax({
    lines: [{ number: "1", amount: taxableAmount, itemCode: "SPA", description: "Hot Tub / Spa" }],
    customerCode: customer_id ?? "GUEST",
    date: new Date().toISOString().split("T")[0],
    shipTo: shipToAddress,
    shipFrom: {
      line1: process.env.AVALARA_SHIP_FROM_ADDRESS ?? "123 Main St",
      city: process.env.AVALARA_SHIP_FROM_CITY ?? "Wichita",
      region: process.env.AVALARA_SHIP_FROM_STATE ?? "KS",
      postalCode: process.env.AVALARA_SHIP_FROM_ZIP ?? "67201",
      country: "US",
    },
    type: "SalesOrder",
    commit: false,
  });

  return NextResponse.json({
    tax_amount: taxResult.totalTax,
    tax_rate: taxableAmount > 0 ? taxResult.totalTax / taxableAmount : 0,
    jurisdiction: taxResult.lines?.[0]?.details?.[0]?.taxName ?? "State Tax",
  });
}
