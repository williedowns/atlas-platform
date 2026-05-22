import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateContractNumber } from "@/lib/utils";
import { assignConcretePadEstimate } from "@/lib/concrete-pad-assignment";
import { countOutTheDoorDiscounts } from "@/lib/discounts";

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
    tax_exempt,
    surcharge_amount,
    surcharge_rate,
    surcharge_enabled,
    doc_fee_amount,
    doc_fee_waived,
    doc_fee_tax_amount,
    total,
    deposit_amount,
    notes,
    external_notes,
    needs_permit,
    needs_hoa,
    permit_jurisdiction,
    concrete_estimate_pending,
    concrete_estimate_notes,
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

  // Concrete pad estimate auto-routing on quote save: mirrors the same gate
  // and mapping used in /api/contracts so a Save-as-Quote doesn't lose the
  // concrete pad state or its assignee. OK/KS → Ryan Frank, others → Alex
  // Broyles. Null result = unassigned.
  const concreteEstimateAssignedTo = concrete_estimate_pending
    ? await assignConcretePadEstimate(supabase, customer?.state)
    : null;

  if (Array.isArray(discounts) && countOutTheDoorDiscounts(discounts) > 1) {
    return NextResponse.json(
      { error: "Only one out-the-door discount is allowed per contract" },
      { status: 400 }
    );
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
      // Marks the quote as Salta-originated so it appears in the /contracts
      // list (the list filter scopes to idempotency_key IS NOT NULL).
      // Server-generated per save so Step7's draft key stays distinct.
      idempotency_key: crypto.randomUUID(),
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
      tax_exempt: !!tax_exempt,
      surcharge_amount: surcharge_enabled ? surcharge_amount : 0,
      surcharge_rate: surcharge_enabled ? surcharge_rate : 0,
      doc_fee_amount: doc_fee_amount ?? 99,
      doc_fee_waived: !!doc_fee_waived,
      doc_fee_tax_amount: doc_fee_tax_amount ?? 0,
      total,
      deposit_amount: deposit_amount ?? 0,
      deposit_paid: 0,
      balance_due: balanceDue,
      notes,
      external_notes: external_notes ?? null,
      needs_permit: !!needs_permit,
      needs_hoa: !!needs_hoa,
      permit_jurisdiction: permit_jurisdiction ?? null,
      permit_status: needs_permit ? "pending" : null,
      hoa_status: needs_hoa ? "pending" : null,
      concrete_estimate_pending: !!concrete_estimate_pending,
      concrete_estimate_notes: concrete_estimate_pending ? (concrete_estimate_notes?.trim() || null) : null,
      concrete_estimate_assigned_to: concreteEstimateAssignedTo,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quote_id: quote.id, contract_number: quoteNumber }, { status: 201 });
}
