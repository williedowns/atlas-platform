import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("status, sales_rep_id")
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

  return NextResponse.json(updated);
}
