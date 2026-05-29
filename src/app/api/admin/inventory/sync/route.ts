import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchInventoryWorkbook } from "@/lib/inventory/sheet-source";
import { extractRows, SHOW_TABS } from "@/lib/inventory/extract";
import { resolveShow, type ShowRow } from "@/lib/inventory/resolve-show";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface NeedsReview { key: string; show_name: string; reason: string }

function chunked<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// POST /api/admin/inventory/sync          → apply the sync (writes)
// POST /api/admin/inventory/sync?preview=1 → dry-run (reads only, no writes)
export async function POST(req: Request) {
  const preview = new URL(req.url).searchParams.get("preview") === "1";

  // ── Authz (admin or manager) ───────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  // Gate on the same org permission matrix the inventory page enforces, so the
  // API isn't weaker than the UI (a manager with inventory toggled off, who
  // can't see the button, must not be able to POST here either).
  const { hasPermission } = await import("@/lib/permissions");
  const orgPerms = (profile?.organization as { role_permissions?: unknown } | null)?.role_permissions ?? null;
  if (!hasPermission(orgPerms as never, profile?.role, "inventory")) {
    return NextResponse.json({ error: "Inventory access required" }, { status: 403 });
  }

  // Inserts stamp organization_id from the caller's profile. Refuse rather than
  // write org-orphaned rows (invisible under RLS) if the profile has no org.
  const orgId = profile?.organization_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "Your profile has no organization; cannot sync." }, { status: 400 });
  }

  const started = Date.now();
  const admin = createAdminClient();

  // ── 1. Fetch + extract the live sheet ───────────────────────────────────────
  let buf: ArrayBuffer;
  try {
    buf = await fetchInventoryWorkbook();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  const { serialized, onOrder } = extractRows(buf);

  // ── 2. Scope = active set only (delivered units sync via a separate job) ────
  const scope = [...serialized.filter((r) => r.status !== "delivered"), ...onOrder];

  // ── 3. Resolve show_id for show-tab rows ────────────────────────────────────
  const { data: shows } = await admin
    .from("shows")
    .select("id,name,start_date,end_date,active");
  const today = new Date();
  const needsReview: NeedsReview[] = [];
  let showLinked = 0;

  const payload = scope.map((r) => {
    let showId: string | null = null;
    if (SHOW_TABS.has(r._source_tab) && r.show_name) {
      const res = resolveShow(r.show_name, (shows ?? []) as ShowRow[], today);
      if (res.reason === "matched") {
        showId = res.showId;
        showLinked++;
      } else {
        needsReview.push({
          key: r.serial_number ?? r.order_number ?? "?",
          show_name: r.show_name,
          reason: res.reason,
        });
      }
    }
    return {
      serial_number: r.serial_number,
      order_number: r.order_number,
      location_name: r.location_name,
      status: r.status,
      model_code: r.model_code,
      shell_color: r.shell_color,
      cabinet_color: r.cabinet_color,
      wrap_status: r.wrap_status,
      customer_name: r.customer_name,
      fin_balance: r.fin_balance,
      received_date: r.received_date,
      notes: r.notes,
      show_id: showId,
    };
  });

  // ── 4. New vs existing + extra-in-DB (for the preview/summary) ──────────────
  const serials = payload.filter((p) => p.serial_number).map((p) => p.serial_number!);
  const orders = payload.filter((p) => !p.serial_number && p.order_number).map((p) => p.order_number!);

  const existingSerials = new Set<string>();
  for (const c of chunked(serials, 300)) {
    const { data } = await admin.from("inventory_units").select("serial_number").in("serial_number", c);
    (data ?? []).forEach((r) => r.serial_number && existingSerials.add(r.serial_number));
  }
  const existingOrders = new Set<string>();
  for (const c of chunked(orders, 300)) {
    const { data } = await admin.from("inventory_units").select("order_number").in("order_number", c);
    (data ?? []).forEach((r) => r.order_number && existingOrders.add(r.order_number));
  }
  const newCount =
    serials.filter((s) => !existingSerials.has(s)).length +
    orders.filter((o) => !existingOrders.has(o)).length;

  const sheetKeys = new Set<string>([...serials, ...orders]);
  const dbActive: { serial_number: string | null; order_number: string | null }[] = [];
  for (let off = 0; ; off += 1000) {
    const { data } = await admin
      .from("inventory_units")
      .select("serial_number,order_number")
      .neq("status", "delivered")
      .order("id", { ascending: true })
      .range(off, off + 999);
    if (!data || data.length === 0) break;
    dbActive.push(...data);
    if (data.length < 1000) break;
  }
  const extraInDb = dbActive
    .map((r) => r.serial_number ?? r.order_number)
    .filter((k): k is string => !!k && !sheetKeys.has(k));

  const summary = {
    scope: scope.length,
    new: newCount,
    updated: scope.length - newCount,
    show_linked: showLinked,
    needs_review: needsReview,
    extra_in_db: extraInDb,
    duration_ms: Date.now() - started,
  };

  if (preview) return NextResponse.json({ preview: true, ...summary });

  // ── 5. Apply via RPC, record sync state ─────────────────────────────────────
  const { data: rpc, error } = await admin.rpc("upsert_inventory_units", {
    rows: payload,
    p_org_id: orgId,
  });
  if (error) {
    return NextResponse.json({ error: error.message, where: "upsert" }, { status: 500 });
  }

  await admin.from("inventory_sync_state").upsert({
    id: "inventory",
    last_synced_at: new Date().toISOString(),
    last_summary: { ...summary, rpc },
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({
    preview: false,
    ...summary,
    ...(rpc as Record<string, number>),
  });
}
