import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateContractNumber } from "@/lib/utils";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    customer,
    show_id,
    location_id,
    line_items,
    discounts,
    financing,
    subtotal,
    discount_total,
    tax_amount,
    tax_rate,
    surcharge_amount,
    surcharge_rate,
    surcharge_enabled,
    total,
    deposit_amount,
    notes,
  } = body;

  // Ensure customer exists in DB
  let customerId = customer?.id;
  if (!customerId) {
    const { data: newCustomer, error: custError } = await supabase
      .from("customers")
      .insert({
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
      })
      .select()
      .single();
    if (custError) return NextResponse.json({ error: custError.message }, { status: 500 });
    customerId = newCustomer.id;
  }

  const quoteNumber = generateContractNumber();

  // Only GreenSky/WF (deduct_from_balance !== false) reduce balance at POS
  const financingArr = Array.isArray(financing) ? financing : [];
  const financedAtSale = financingArr
    .filter((f: { deduct_from_balance?: boolean }) => f.deduct_from_balance !== false)
    .reduce((sum: number, f: { financed_amount?: number }) => sum + (f.financed_amount ?? 0), 0);
  const balanceDue = Math.max(0, total - financedAtSale - (deposit_amount ?? 0));

  const { data: quote, error } = await supabase
    .from("contracts")
    .insert({
      contract_number: quoteNumber,
      status: "quote",
      customer_id: customerId,
      sales_rep_id: user.id,
      // Guard: synthetic "store-{uuid}" IDs must not be persisted as FKs
      show_id: (show_id && !show_id.startsWith("store-")) ? show_id : null,
      location_id: location_id ?? null,
      line_items,
      discounts,
      financing,
      subtotal,
      discount_total,
      tax_amount,
      tax_rate,
      surcharge_amount: surcharge_enabled ? surcharge_amount : 0,
      surcharge_rate: surcharge_enabled ? surcharge_rate : 0,
      total,
      deposit_amount: deposit_amount ?? 0,
      deposit_paid: 0,
      balance_due: balanceDue,
      notes,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quote_id: quote.id, contract_number: quoteNumber }, { status: 201 });
}
