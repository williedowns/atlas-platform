import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const allowedRoles = ["admin", "manager", "bookkeeper"];
  if (!allowedRoles.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { reason, refund_amount } = await req.json().catch(() => ({}));

  // Fetch contract with line items
  const { data: contract } = await supabase
    .from("contracts")
    .select("*, customer:customers(id)")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status === "cancelled") return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  if (contract.status === "delivered") return NextResponse.json({ error: "Cannot cancel a delivered contract" }, { status: 400 });

  // 1 — Cancel contract
  const { error: cancelError } = await supabase
    .from("contracts")
    .update({
      status: "cancelled",
      notes: contract.notes
        ? `${contract.notes}\n\nCANCELLED: ${reason ?? "No reason provided"}`
        : `CANCELLED: ${reason ?? "No reason provided"}`,
    })
    .eq("id", id);

  if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 });

  // 2 — Return inventory units to stock
  const lineItems = Array.isArray(contract.line_items) ? contract.line_items : [];
  const unitIds = lineItems
    .map((item: { inventory_unit_id?: string }) => item.inventory_unit_id)
    .filter(Boolean) as string[];

  let unitsReturned = 0;
  if (unitIds.length > 0) {
    const { error: invError } = await supabase
      .from("inventory_units")
      .update({ status: "at_location", contract_id: null })
      .in("id", unitIds);

    if (!invError) unitsReturned = unitIds.length;
  }

  // 3 — Record refund amount in notes if provided
  let refundNote = "";
  if (refund_amount && refund_amount > 0) {
    refundNote = ` Refund of $${Number(refund_amount).toFixed(2)} to be processed manually.`;
    // Update the cancellation note
    await supabase
      .from("contracts")
      .update({
        notes: contract.notes
          ? `${contract.notes}\n\nCANCELLED: ${reason ?? "No reason provided"}.${refundNote}`
          : `CANCELLED: ${reason ?? "No reason provided"}.${refundNote}`,
      })
      .eq("id", id);
  }

  // 4 — Audit log
  logAction({
    userId: user.id,
    action: "contract.cancelled",
    entityType: "contract",
    entityId: id,
    metadata: {
      reason: reason ?? "",
      refund_amount: refund_amount ?? 0,
      units_returned: unitsReturned,
    },
    req,
  });

  return NextResponse.json({
    success: true,
    units_returned: unitsReturned,
    refund_amount: refund_amount ?? 0,
  });
}
