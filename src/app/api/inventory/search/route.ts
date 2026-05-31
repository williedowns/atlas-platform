import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_Q_LEN = 64;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Inventory typeahead for tagging a stock unit to a contract. admin/manager +
  // show_manager (so they can tag stock at a show they manage). Results are
  // org-scoped by RLS (inventory_read, migration 109) — a show_manager only sees
  // their own org's unassigned units. Not contract-scoped: the search spans all
  // unassigned org stock, which is what the assign flow needs.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!["admin", "manager", "show_manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const raw = (url.searchParams.get("q") ?? "").trim();
  if (raw.length === 0) return NextResponse.json([]);

  // Strip PostgREST filter separators (`,()`) and ILIKE wildcards (`%_\`) — both
  // would let a typed query break out of the intended filter or force a full
  // scan via wildcard expansion. Cap length to bound the worst-case ILIKE cost.
  const safe = raw.replace(/[,()%_\\]/g, " ").trim().slice(0, MAX_Q_LEN);
  if (safe.length === 0) return NextResponse.json([]);
  const pattern = `%${safe}%`;

  const { data, error } = await supabase
    .from("inventory_units")
    .select(`
      id, serial_number, order_number, status, model_code,
      product:products(id, name, model_code),
      location:locations(id, name)
    `)
    .is("contract_id", null)
    .or(`serial_number.ilike.${pattern},order_number.ilike.${pattern}`)
    .order("serial_number", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
