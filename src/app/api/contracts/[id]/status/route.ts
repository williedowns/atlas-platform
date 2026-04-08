import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

const FORWARD_TRANSITIONS: Record<string, string> = {
  draft: "pending_signature",
  pending_signature: "signed",
  signed: "deposit_collected",
  deposit_collected: "in_production",
  in_production: "ready_for_delivery",
  ready_for_delivery: "delivered",
};

export async function PATCH(
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

  const { status: newStatus } = await req.json();
  const isAdminOrManager = ["admin", "manager"].includes(profile?.role ?? "");

  const { data: contract } = await supabase
    .from("contracts")
    .select("status, sales_rep_id, customer_id, line_items")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reps can only update their own contracts
  if (!isAdminOrManager && contract.sales_rep_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate transition
  const allowedNext = FORWARD_TRANSITIONS[contract.status];
  const isCancellation = newStatus === "cancelled";

  if (isCancellation && !isAdminOrManager) {
    return NextResponse.json({ error: "Only managers can cancel contracts" }, { status: 403 });
  }

  if (!isCancellation && newStatus !== allowedNext) {
    return NextResponse.json(
      { error: `Invalid transition: ${contract.status} → ${newStatus}` },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("contracts")
    .update({ status: newStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-create equipment registry entries on delivery
  if (newStatus === "delivered" && contract.customer_id) {
    const lineItems: any[] = Array.isArray(contract.line_items) ? contract.line_items : [];
    const products = lineItems.filter((i: any) => !i.waived && i.product_name);
    if (products.length > 0) {
      await supabase.from("equipment").insert(
        products.map((item: any) => ({
          customer_id: contract.customer_id,
          contract_id: id,
          product_name: item.product_name,
          purchase_date: new Date().toISOString().slice(0, 10),
        }))
      );
    }
  }

  // Fire-and-forget audit log
  logAction({
    userId: user.id,
    action: "contract.status_changed",
    entityType: "contract",
    entityId: id,
    metadata: {
      from_status: contract.status,
      to_status: newStatus,
    },
    req,
  });

  return NextResponse.json(updated);
}
