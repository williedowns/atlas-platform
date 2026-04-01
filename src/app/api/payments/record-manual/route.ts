import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("total, deposit_paid")
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

  // Accumulate deposit_paid
  const newDepositPaid = (contract.deposit_paid ?? 0) + Number(amount);
  await supabase
    .from("contracts")
    .update({
      status: "deposit_collected",
      deposit_paid: newDepositPaid,
      balance_due: Math.max(0, contract.total - newDepositPaid),
    })
    .eq("id", contract_id);

  return NextResponse.json({ success: true, payment_id: payment.id, amount_recorded: amount });
}
