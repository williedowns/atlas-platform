import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createECheck } from "@/lib/payments/intuit";
import { createQBODeposit } from "@/lib/qbo/client";
import { logAction } from "@/lib/audit";

export async function POST(req: Request) {
  const supabase = await createClient();
  // Service-role client for payments status updates — see charge/route.ts for rationale.
  const adminSupabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    contract_id,
    amount,
    routing_number,
    account_number,
    account_type,
    account_holder_name,
  } = await req.json();

  if (!contract_id || !amount || !routing_number || !account_number || !account_type || !account_holder_name) {
    return NextResponse.json({ error: "All bank account fields are required" }, { status: 400 });
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("*, customer:customers(*), location:locations(qbo_deposit_account_id, qbo_department_id, qbo_deposit_income_item_id, qbo_deposit_liability_item_id, name), show:shows(qbo_deposit_account_id, qbo_department_id, qbo_deposit_income_item_id, qbo_deposit_liability_item_id, name)")
    .eq("id", contract_id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Create payment record (pending — eChecks settle in 1-2 business days)
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      contract_id,
      amount: Number(amount),
      surcharge_amount: 0,
      method: "ach",
      status: "pending",
    })
    .select()
    .single();

  if (paymentError || !payment) {
    return NextResponse.json({ error: paymentError?.message ?? "Failed to create payment record" }, { status: 500 });
  }

  // Submit eCheck to Intuit Payments
  let echeckResult;
  try {
    echeckResult = await createECheck({
      amount: Number(amount),
      routingNumber: String(routing_number),
      accountNumber: String(account_number),
      accountType: account_type as "PERSONAL_CHECKING" | "PERSONAL_SAVINGS" | "BUSINESS_CHECKING",
      name: String(account_holder_name),
      description: `Atlas Spas - ${contract.contract_number}`,
    });
  } catch (err) {
    await adminSupabase
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id);
    return NextResponse.json({ error: "ACH submission failed", details: String(err) }, { status: 402 });
  }

  if (echeckResult.status === "DECLINED") {
    await adminSupabase
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id);
    return NextResponse.json({ error: "eCheck was declined" }, { status: 402 });
  }

  // Update payment with eCheck ID (reuse intuit_charge_id column)
  await adminSupabase
    .from("payments")
    .update({
      intuit_charge_id: echeckResult.id,
      processed_at: new Date().toISOString(),
      // Keep status "pending" — eChecks settle async; bookkeeper confirms when cleared
    })
    .eq("id", payment.id);

  // Optimistically update contract deposit_paid — treat ACH as collected at submission
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

  // Sync to QBO (best-effort — non-fatal). Mirrors charge/route.ts and
  // record-manual/route.ts so ACH deposits appear in QuickBooks accounting
  // alongside card and check deposits.
  const customer = contract.customer as { qbo_customer_id?: string; first_name?: string; last_name?: string } | null;
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
    }).catch((err) => console.error("QBO ACH deposit sync failed (non-fatal):", err));
  }

  logAction({
    userId: user.id,
    action: "payment.collected",
    entityType: "payment",
    entityId: payment.id,
    metadata: {
      contract_id,
      amount,
      echeck_id: echeckResult.id,
    },
    req,
  });

  return NextResponse.json({
    success: true,
    payment_id: payment.id,
    echeck_id: echeckResult.id,
    status: echeckResult.status,
    amount_submitted: amount,
    note: "ACH payments typically settle within 1-2 business days.",
  });
}
