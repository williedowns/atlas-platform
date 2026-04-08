import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { createQBODepositInvoice } from "@/lib/qbo/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contract_id, amount, method, check_number, bank_name } = await req.json();

  if (!contract_id || !amount || !method) {
    return NextResponse.json({ error: "contract_id, amount, and method are required" }, { status: 400 });
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("total, deposit_paid, financing, contract_number, line_items, location:locations(qbo_deposit_account_id, qbo_department_id, name), show:shows(qbo_deposit_account_id, qbo_department_id, name), customer:customers(qbo_customer_id, first_name, last_name)")
    .eq("id", contract_id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Insert payment record
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      contract_id,
      amount: Number(amount),
      surcharge_amount: 0,
      method,
      status: "completed",
      processed_at: new Date().toISOString(),
      ...(check_number ? { check_number } : {}),
      ...(bank_name ? { bank_name } : {}),
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
  const show = (contract as any).show as { qbo_deposit_account_id?: string; qbo_department_id?: string; name?: string } | null;
  const location = (contract as any).location as { qbo_deposit_account_id?: string; qbo_department_id?: string; name?: string } | null;
  const qboContext = show ?? location;
  const locationName = show?.name ?? location?.name ?? undefined;
  const customerFullName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || undefined;
  const rawLineItems = (contract as any).line_items as { product_name?: string; quantity?: number }[] | null;
  const lineItemsSummary = rawLineItems?.length
    ? rawLineItems.map((i) => `${i.product_name ?? "Item"}${i.quantity && i.quantity > 1 ? ` (${i.quantity})` : ""}`).join(", ")
    : undefined;
  if (customer?.qbo_customer_id) {
    createQBODepositInvoice({
      qbo_customer_id: customer.qbo_customer_id,
      deposit_amount: Number(amount),
      contract_number: (contract as any).contract_number ?? contract_id,
      customer_name: customerFullName,
      location_name: locationName,
      line_items_summary: lineItemsSummary,
      deposit_account_id: qboContext?.qbo_deposit_account_id ?? undefined,
      department_id: qboContext?.qbo_department_id ?? undefined,
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
