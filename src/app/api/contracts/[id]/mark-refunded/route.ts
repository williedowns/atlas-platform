import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: contract } = await supabase
    .from("contracts")
    .select("status, notes, deposit_paid")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "cancelled") {
    return NextResponse.json({ error: "Only cancelled contracts can be marked refunded" }, { status: 400 });
  }
  if (contract.notes?.includes("REFUND PROCESSED IN QB")) {
    return NextResponse.json({ error: "Already marked as refunded" }, { status: 400 });
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric",
  });
  const marker = `\nREFUND PROCESSED IN QB: ${dateStr} by ${profile?.role ?? "bookkeeper"}`;
  const newNotes = (contract.notes ?? "") + marker;

  const { error: updateError } = await supabase
    .from("contracts")
    .update({ notes: newNotes })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: "contract.refund_marked",
    entityType: "contract",
    entityId: id,
    metadata: { deposit_paid: contract.deposit_paid },
    req,
  });

  return NextResponse.json({ success: true });
}
