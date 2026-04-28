import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/deliveries/[id]/complete
// Body: { customer_signature_url?, notes?, override_balance?: boolean, override_reason? }
// Marks the DWO completed AND flips the contract.status to "delivered" if balance is paid.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { customer_signature_url, notes, override_balance, override_reason } = body;

  // Pull DWO + contract
  const { data: dwo } = await supabase
    .from("delivery_work_orders")
    .select("id, contract_id, status, contract:contracts(id, balance_due, status)")
    .eq("id", id)
    .single();

  if (!dwo) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (dwo.status === "completed") {
    return NextResponse.json({ error: "Delivery already completed" }, { status: 400 });
  }

  const contract = Array.isArray(dwo.contract) ? dwo.contract[0] : dwo.contract;
  const balanceDue = (contract?.balance_due ?? 0);

  if (balanceDue > 0.01 && !override_balance) {
    return NextResponse.json(
      {
        error: "Outstanding balance — collect payment or override",
        balance_due: balanceDue,
        can_override: true,
      },
      { status: 409 }
    );
  }

  // Mark DWO completed
  const { error: dwoErr } = await supabase
    .from("delivery_work_orders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      customer_signature_url: customer_signature_url ?? null,
      notes: notes ?? null,
      ...(override_balance ? { readiness_override_reason: override_reason ?? "Balance not collected at delivery" } : {}),
    })
    .eq("id", id);

  if (dwoErr) return NextResponse.json({ error: dwoErr.message }, { status: 500 });

  // Flip contract status if not already delivered
  if (contract?.id && contract.status !== "delivered") {
    await supabase
      .from("contracts")
      .update({ status: "delivered" })
      .eq("id", contract.id);
  }

  return NextResponse.json({ ok: true, balance_due: balanceDue });
}
