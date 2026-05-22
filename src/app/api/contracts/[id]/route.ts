import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

// Hard-delete a contract. Admin only — managers use the cancel route for
// real contracts. This exists to clean up test contracts and stray quotes
// that should never have existed in the first place. Irreversible.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Admin role required to delete contracts" },
      { status: 403 },
    );
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_number, status, customer_id, line_items, total")
    .eq("id", id)
    .maybeSingle();

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // 1 — Audit log BEFORE deletion so the trail survives. logAction swallows
  // its own errors, so this won't block the delete on transient log failures.
  await logAction({
    userId: user.id,
    action: "contract.deleted",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      status: contract.status,
      total: contract.total,
      customer_id: contract.customer_id,
    },
    req,
  });

  // 2 — Release any assigned inventory units back to stock.
  const lineItems = Array.isArray(contract.line_items) ? contract.line_items : [];
  const unitIds = lineItems
    .map((item: { inventory_unit_id?: string }) => item.inventory_unit_id)
    .filter(Boolean) as string[];

  if (unitIds.length > 0) {
    await supabase
      .from("inventory_units")
      .update({ status: "at_location", contract_id: null })
      .in("id", unitIds);
  }
  // Also catch units pointing at the contract that aren't tracked in line_items.
  await supabase
    .from("inventory_units")
    .update({ status: "at_location", contract_id: null })
    .eq("contract_id", id);

  // 3 — Remove dependent rows that don't cascade.
  // payments, delivery_work_orders both have NO ACTION on FK to contracts.
  await supabase.from("payments").delete().eq("contract_id", id);
  await supabase.from("delivery_work_orders").delete().eq("contract_id", id);

  // 4 — Detach any child add-on contracts (e.g. concrete pad add-ons) so
  // their FK doesn't block the parent delete.
  await supabase
    .from("contracts")
    .update({ parent_contract_id: null })
    .eq("parent_contract_id", id);

  // 5 — Delete the contract row.
  const { error: deleteError } = await supabase
    .from("contracts")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    contract_number: contract.contract_number,
  });
}
