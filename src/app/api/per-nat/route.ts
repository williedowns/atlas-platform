import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/per-nat
// Returns contracts currently on the Per Nat list. Filters:
//   - ?status=active|completed|cancelled  (default: active)
//   - ?salesperson_id=<uuid>              (optional)
//
// Active: is_per_nat = true AND status NOT IN ('delivered','cancelled')
// Completed: status = 'delivered' AND (was at some point flagged Per Nat;
//            simplest signal today: contract still has is_per_nat = true
//            OR delivery_timeframe set)
// Cancelled: status = 'cancelled' AND is_per_nat = true
//
// Joins customer, sales rep profile, location, and the most recent
// inventory_unit assignment for color-coding the row.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "active").toLowerCase();
  const salespersonId = url.searchParams.get("salesperson_id");

  let query = supabase
    .from("contracts")
    .select(`
      id,
      contract_number,
      status,
      is_per_nat,
      per_nat_reason,
      delivery_timeframe,
      delivery_timeframe_updated_at,
      total,
      deposit_paid,
      balance_due,
      created_at,
      notes,
      external_notes,
      line_items,
      financing,
      customer:customers ( id, first_name, last_name, email, phone ),
      sales_rep:profiles!contracts_sales_rep_id_fkey ( id, full_name ),
      location:locations ( id, name )
    `)
    .order("delivery_timeframe", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (status === "active") {
    query = query.eq("is_per_nat", true).not("status", "in", "(delivered,cancelled)");
  } else if (status === "completed") {
    query = query.eq("status", "delivered").or("is_per_nat.eq.true,delivery_timeframe.not.is.null");
  } else if (status === "cancelled") {
    query = query.eq("status", "cancelled").eq("is_per_nat", true);
  } else {
    return NextResponse.json({ error: "invalid status filter" }, { status: 400 });
  }

  if (salespersonId) {
    query = query.eq("sales_rep_id", salespersonId);
  }

  const { data: contracts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch the open inventory_unit assignment (if any) for each returned contract.
  const contractIds = (contracts ?? []).map((c) => c.id);
  let unitsByContract: Record<string, {
    inventory_unit_id: string;
    serial_number: string | null;
    model: string | null;
    color: string | null;
    skirt: string | null;
    stock_assigned_at: string | null;
    days_held: number | null;
  }> = {};

  if (contractIds.length > 0) {
    const { data: units } = await supabase
      .from("inventory_units")
      .select(`
        id,
        serial_number,
        contract_id,
        stock_assigned_at,
        product:products ( name )
      `)
      .in("contract_id", contractIds);

    const nowMs = Date.now();
    for (const u of units ?? []) {
      if (!u.contract_id) continue;
      const assignedAt = u.stock_assigned_at ? new Date(u.stock_assigned_at).getTime() : null;
      const productAny = u.product as { name?: string } | { name?: string }[] | null | undefined;
      const productName: string | null = Array.isArray(productAny)
        ? (productAny[0]?.name ?? null)
        : (productAny?.name ?? null);
      unitsByContract[u.contract_id] = {
        inventory_unit_id: u.id,
        serial_number: u.serial_number ?? null,
        model: productName,
        color: null,
        skirt: null,
        stock_assigned_at: u.stock_assigned_at ?? null,
        days_held: assignedAt !== null ? Math.floor((nowMs - assignedAt) / 86_400_000) : null,
      };
    }
  }

  const rows = (contracts ?? []).map((c) => {
    const firstLine = Array.isArray(c.line_items) && c.line_items.length > 0
      ? c.line_items[0] as { product_name?: string; color?: string; skirt?: string }
      : null;
    return {
      contract_id: c.id,
      contract_number: c.contract_number,
      status: c.status,
      is_per_nat: c.is_per_nat,
      per_nat_reason: c.per_nat_reason,
      delivery_timeframe: c.delivery_timeframe,
      total: Number(c.total ?? 0),
      deposit_paid: Number(c.deposit_paid ?? 0),
      balance_due: Number(c.balance_due ?? 0),
      created_at: c.created_at,
      notes: c.notes ?? null,
      external_notes: c.external_notes ?? null,
      customer: c.customer,
      sales_rep: c.sales_rep,
      location: c.location,
      model: firstLine?.product_name ?? null,
      color: firstLine?.color ?? null,
      skirt: firstLine?.skirt ?? null,
      inventory_unit: unitsByContract[c.id] ?? null,
      has_low_deposit: c.per_nat_reason === "low_deposit",
      financing: Array.isArray(c.financing) ? c.financing : [],
    };
  });

  return NextResponse.json({ rows, total: rows.length });
}
