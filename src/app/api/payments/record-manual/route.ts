import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { createQBODeposit } from "@/lib/qbo/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    contract_id,
    amount,
    method,
    check_number,
    bank_name,
    // Credit-card-terminal fields — the card was run on an external terminal,
    // so we record (not charge) the payment and keep the last 4 for the
    // contract record. card_brand defaults to "Card" client-side so the
    // contract page's "<brand> ending in <last4>" line renders.
    card_last4,
    card_brand,
    // ACH office-processing fields — saved on the payment row so the office can
    // run the ACH manually after the contract is signed. Only required when
    // method === "ach".
    ach_routing_number,
    ach_account_number,
    ach_account_type,
    ach_account_holder_name,
  } = await req.json();

  if (!contract_id || !amount || !method) {
    return NextResponse.json({ error: "contract_id, amount, and method are required" }, { status: 400 });
  }

  // ACH via record-manual is the "save for office processing" fallback — the
  // rep entered bank info but we are NOT calling Intuit. Office runs ACH later.
  // Require all four bank fields so the office has what it needs.
  if (method === "ach") {
    if (!ach_routing_number || !ach_account_number || !ach_account_type || !ach_account_holder_name) {
      return NextResponse.json(
        { error: "ach_routing_number, ach_account_number, ach_account_type, and ach_account_holder_name are required when method is ach" },
        { status: 400 }
      );
    }
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("total, deposit_paid, financing, contract_number, line_items, location:locations(qbo_deposit_account_id, qbo_department_id, qbo_deposit_income_item_id, qbo_deposit_liability_item_id, name), show:shows(qbo_deposit_account_id, qbo_department_id, qbo_deposit_income_item_id, qbo_deposit_liability_item_id, name), customer:customers(qbo_customer_id, first_name, last_name)")
    .eq("id", contract_id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Insert payment record
  // ACH office-processing: status stays "pending" because the actual ACH won't
  // be run until the office processes it. Bookkeeper flips to "completed" after
  // they confirm the ACH cleared at the bank. Other manual methods (cash,
  // check, financing) are "completed" at the point of sale.
  const isOfficeProcessedAch = method === "ach";
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      contract_id,
      amount: Number(amount),
      surcharge_amount: 0,
      method,
      status: isOfficeProcessedAch ? "pending" : "completed",
      processed_at: new Date().toISOString(),
      ...(check_number ? { check_number } : {}),
      ...(bank_name ? { bank_name } : {}),
      ...(card_last4 ? { card_last4 } : {}),
      ...(card_brand ? { card_brand } : {}),
      ...(isOfficeProcessedAch
        ? {
            ach_routing_number,
            ach_account_number,
            ach_account_type,
            ach_account_holder_name,
          }
        : {}),
    })
    .select()
    .single();

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }

  // Accumulate deposit_paid — only GreenSky/WF offsets balance at POS; Foundation carries
  const financedAtSale = Array.isArray(contract.financing)
    ? (contract.financing as { financed_amount?: number; deduct_from_balance?: boolean }[])
        .filter((f) => f.deduct_from_balance !== false)
        .reduce((sum, f) => sum + (f.financed_amount ?? 0), 0)
    : 0;
  const newDepositPaid = (contract.deposit_paid ?? 0) + Number(amount);
  await supabase
    .from("contracts")
    .update({
      status: "deposit_collected",
      deposit_paid: newDepositPaid,
      balance_due: Math.max(0, contract.total - financedAtSale - newDepositPaid),
    })
    .eq("id", contract_id);

  // Sync to QBO (best-effort — non-fatal)
  const customer = contract.customer as any;
  const show = (contract as any).show as { qbo_deposit_account_id?: string; qbo_department_id?: string; qbo_deposit_income_item_id?: string; qbo_deposit_liability_item_id?: string; name?: string } | null;
  const location = (contract as any).location as { qbo_deposit_account_id?: string; qbo_department_id?: string; qbo_deposit_income_item_id?: string; qbo_deposit_liability_item_id?: string; name?: string } | null;
  const qboContext = show ?? location;
  const locationName = show?.name ?? location?.name ?? undefined;
  const customerFullName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || undefined;
  const rawLineItems = (contract as any).line_items as { product_name?: string; quantity?: number }[] | null;
  const lineItemsSummary = rawLineItems?.length
    ? rawLineItems.map((i) => `${i.product_name ?? "Item"}${i.quantity && i.quantity > 1 ? ` (${i.quantity})` : ""}`).join(", ")
    : undefined;
  if (customer?.qbo_customer_id) {
    createQBODeposit({
      qbo_customer_id: customer.qbo_customer_id,
      deposit_amount: Number(amount),
      contract_number: (contract as any).contract_number ?? contract_id,
      customer_name: customerFullName,
      location_name: locationName,
      line_items_summary: lineItemsSummary,
      deposit_account_id: qboContext?.qbo_deposit_account_id ?? undefined,
      department_id: qboContext?.qbo_department_id ?? undefined,
      qbo_deposit_income_item_id: qboContext?.qbo_deposit_income_item_id ?? undefined,
      qbo_deposit_liability_item_id: qboContext?.qbo_deposit_liability_item_id ?? undefined,
    }).catch((err) => console.error("QBO manual payment sync failed (non-fatal):", err));
  }

  // Fire-and-forget audit log
  logAction({
    userId: user.id,
    action: "payment.manual_recorded",
    entityType: "payment",
    entityId: payment.id,
    metadata: {
      contract_id,
      amount,
      method,
    },
    req,
  });

  return NextResponse.json({ success: true, payment_id: payment.id, amount_recorded: amount });
}
