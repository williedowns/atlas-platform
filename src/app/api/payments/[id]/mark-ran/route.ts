import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

// POST /api/payments/[id]/mark-ran
//
// Bookkeeper / manager / admin marks a pending office-processed ACH as ran
// from the ACH Queue. Flips the payment status pending → completed, records
// who ran it (processed_by) and when (processed_at), and optionally persists
// a notes string Lindy may have annotated (re-run history, bank rejections).
//
// Sales reps cannot mark ACH ran — only the office side (Lindy + admins).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paymentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? "";
  if (!["admin", "manager", "bookkeeper"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  // Sanity-check the row before flipping. Must be a pending, office-processed
  // ACH (method=ach AND ach_routing_number is set). Refuse to flip anything else.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, contract_id, amount, method, status, ach_routing_number")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.method !== "ach") {
    return NextResponse.json({ error: "Not an ACH payment" }, { status: 400 });
  }
  if (!payment.ach_routing_number) {
    return NextResponse.json({ error: "Not an office-processed ACH" }, { status: 400 });
  }
  if (payment.status !== "pending") {
    return NextResponse.json({ error: `Cannot mark a ${payment.status} payment as ran` }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "completed",
      processed_at: nowIso,
      processed_by: user.id,
      ...(notes ? { notes } : {}),
    })
    .eq("id", paymentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  logAction({
    userId: user.id,
    action: "payment.ach_ran",
    entityType: "payment",
    entityId: paymentId,
    metadata: {
      contract_id: payment.contract_id,
      amount: payment.amount,
      ...(notes ? { notes } : {}),
    },
    req,
  });

  return NextResponse.json({
    success: true,
    payment_id: paymentId,
    status: "completed",
    processed_at: nowIso,
    processed_by: user.id,
  });
}
