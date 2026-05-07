import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

// Edit policy:
//   - sales_rep can only set delivery_timeframe at contract creation time
//     (handled by POST /api/contracts).
//   - After the contract exists, only admin/manager can change it.
// Customer-visible: this value drives the "Expected Delivery" card in the
// portal until a firm delivery_work_orders.scheduled_date is set.
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
    .maybeSingle();

  const role = profile?.role ?? "";
  if (!["admin", "manager"].includes(role)) {
    return NextResponse.json(
      { error: "Only admin or manager can change the delivery timeframe after contract creation." },
      { status: 403 }
    );
  }

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
