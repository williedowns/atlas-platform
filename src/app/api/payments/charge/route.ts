import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCharge } from "@/lib/payments/intuit";
import { createQBODepositInvoice } from "@/lib/qbo/client";
import { logAction } from "@/lib/audit";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contract_id, amount, surcharge_amount, method, card_token, card_present_token } = await req.json();

  // Fetch contract
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select(`*, customer:customers(*), location:locations(*)`)
    .eq("id", contract_id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const totalCharge = Number(amount) + Number(surcharge_amount ?? 0);
  // Only GreenSky/WF (deduct_from_balance !== false) offset the balance; Foundation carries
  const financedAtSale = Array.isArray(contract.financing)
    ? (contract.financing as { financed_amount?: number; deduct_from_balance?: boolean }[])
        .filter((f) => f.deduct_from_balance !== false)
        .reduce((sum, f) => sum + (f.financed_amount ?? 0), 0)
    : 0;

  // Create payment record (pending)
  const { data: payment } = await supabase
    .from("payments")
    .insert({
      contract_id,
      amount,
      surcharge_amount: surcharge_amount ?? 0,
      method,
      status: "processing",
    })
    .select()
    .single();

  if (method === "credit_card" || method === "debit_card") {
    // Charge via Intuit Payments
    let chargeResult;
    try {
      chargeResult = await createCharge({
        amount: totalCharge,
        card_token,
        card_present_token,
        description: `Atlas Spas Deposit - ${contract.contract_number}`,
        capture: true,
        context: { mobile: true, isEcommerce: false },
      });
    } catch (err) {
      await supabase
        .from("payments")
        .update({ status: "failed", error: String(err) } as Record<string, unknown>)
        .eq("id", payment!.id);
      return NextResponse.json({ error: "Payment failed", details: String(err) }, { status: 402 });
    }

    if (chargeResult.status !== "CAPTURED") {
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment!.id);
      return NextResponse.json({ error: "Card declined" }, { status: 402 });
    }

    // Update payment to completed
    await supabase
      .from("payments")
      .update({
        status: "completed",
        intuit_charge_id: chargeResult.id,
        processed_at: new Date().toISOString(),
      })
      .eq("id", payment!.id);

    // Update contract — accumulate deposit_paid
    const newDepositPaid = (contract.deposit_paid ?? 0) + Number(amount);
    await supabase
      .from("contracts")
      .update({
        status: "deposit_collected",
        deposit_paid: newDepositPaid,
        balance_due: Math.max(0, contract.total - financedAtSale - newDepositPaid),
        intuit_payment_id: chargeResult.id,
      })
      .eq("id", contract_id);

    // Create deposit invoice in QBO (best-effort)
    if (contract.customer?.qbo_customer_id) {
      try {
        const invoice = await createQBODepositInvoice({
          qbo_customer_id: contract.customer.qbo_customer_id,
          deposit_amount: amount,
          contract_number: contract.contract_number,
        });
        await supabase
          .from("contracts")
          .update({ qbo_deposit_invoice_id: invoice.Invoice?.Id })
          .eq("id", contract_id);
      } catch (err) {
        console.error("QBO deposit invoice failed (non-fatal):", err);
      }
    }

    // Fire-and-forget audit log
    logAction({
      userId: user.id,
      action: "payment.collected",
      entityType: "payment",
      entityId: payment!.id,
      metadata: {
        contract_id,
        amount,
        method,
        charge_id: chargeResult.id,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      payment_id: payment!.id,
      charge_id: chargeResult.id,
      last4: chargeResult.card?.last4,
      brand: chargeResult.card?.brand,
      amount_charged: totalCharge,
    });
  }

  // ACH / Cash — record manually, no card processing
  await supabase
    .from("payments")
    .update({ status: "completed", processed_at: new Date().toISOString() })
    .eq("id", payment!.id);

  const newDepositPaidManual = (contract.deposit_paid ?? 0) + Number(amount);
  await supabase
    .from("contracts")
    .update({
      status: "deposit_collected",
      deposit_paid: newDepositPaidManual,
      balance_due: Math.max(0, contract.total - newDepositPaidManual),
    })
    .eq("id", contract_id);

  // Fire-and-forget audit log
  logAction({
    userId: user.id,
    action: "payment.collected",
    entityType: "payment",
    entityId: payment!.id,
    metadata: {
      contract_id,
      amount,
      method,
    },
    req,
  });

  return NextResponse.json({ success: true, payment_id: payment!.id, amount_charged: amount });
}
