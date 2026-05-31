import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { logAction } from "@/lib/audit";

// Edit policy:
//   - sales_rep can only set delivery_timeframe at contract creation time
//     (handled by POST /api/contracts).
//   - After the contract exists, admin/manager (any contract in their org) or a
//     show_manager scoped to the show this deal was sold at may change it.
//     requireAdminOrManager(id) enforces that scope; RLS (108/109) is the second
//     layer on the write itself.
// Customer-visible: this value drives the "Expected Delivery" card in the
// portal until a firm delivery_work_orders.scheduled_date is set.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAdminOrManager(id);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const body = await req.json().catch(() => ({}));
  const raw: unknown = (body as { delivery_timeframe?: unknown }).delivery_timeframe;
  // Allow clearing by passing empty string or null. Otherwise require a string.
  const next: string | null = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

  // Capture the previous value so the audit log shows what changed.
  const { data: existing } = await supabase
    .from("contracts")
    .select("delivery_timeframe, contract_number")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("contracts")
    .update({
      delivery_timeframe: next,
      delivery_timeframe_updated_at: nowIso,
      delivery_timeframe_updated_by: user.id,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: "contract.delivery_timeframe_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: existing.contract_number,
      previous: existing.delivery_timeframe ?? null,
      next,
    },
    req,
  });

  return NextResponse.json({
    delivery_timeframe: next,
    delivery_timeframe_updated_at: nowIso,
  });
}
