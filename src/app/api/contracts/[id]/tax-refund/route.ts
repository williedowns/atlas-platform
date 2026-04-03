import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check contract exists and hasn't already had a refund recorded
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, tax_refund_amount, tax_amount, contract_number")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  if (contract.tax_refund_amount != null) {
    return NextResponse.json({ error: "A tax refund has already been recorded for this contract" }, { status: 409 });
  }

  const body = await req.json();
  const amount = parseFloat(body.amount);
  const notes = (body.notes ?? "").trim();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  const { error } = await supabase
    .from("contracts")
    .update({
      tax_refund_amount: amount,
      tax_refund_issued_at: new Date().toISOString(),
      tax_refund_notes: notes || null,
      tax_refund_issued_by: user.id,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({
    userId: user.id,
    action: "contract.tax_refund_issued",
    entityType: "contract",
    entityId: id,
    metadata: {
      amount,
      notes,
      contract_number: contract.contract_number,
    },
    req,
  });

  return NextResponse.json({ ok: true, amount, issued_at: new Date().toISOString() });
}
