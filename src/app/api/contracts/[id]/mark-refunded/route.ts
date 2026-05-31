import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { userManagesContractShow } from "@/lib/auth-guard";
import { canActOnContract } from "@/lib/contract-access";

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

  // admin/manager (any contract) + bookkeeper (financial action, org-wide) +
  // show_manager scoped to the show this deal was sold at. The DB lookup only
  // runs for show_manager; everyone else is decided by role alone.
  const role = profile?.role ?? "";
  const managesThisShow =
    role === "show_manager" ? await userManagesContractShow(supabase, user.id, id) : false;
  if (!canActOnContract({ role, managesThisShow, allowBookkeeper: true })) {
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
