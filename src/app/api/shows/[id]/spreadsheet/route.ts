import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type RolePermissions } from "@/lib/permissions";
import { exportShowSalesWorkbook } from "@/lib/show-sales/xlsx-export";
import {
  buildShowConfig,
  contractToDeal,
  type MapperContract,
} from "@/lib/show-sales/contract-mapper";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const orgPerms = (profile?.organization as { role_permissions?: RolePermissions } | null)
    ?.role_permissions;
  if (!hasPermission(orgPerms, profile?.role, "shows")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Spreadsheet export is a wrap-up/reporting tool: managers, admins, bookkeepers.
  const allowedRoles = new Set(["admin", "manager", "bookkeeper"]);
  if (!allowedRoles.has(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: show, error: showErr } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date, assigned_rep_ids")
    .eq("id", id)
    .single();
  if (showErr || !show) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  // Contracts on this show, oldest first so the spreadsheet row order matches
  // chronological deal order (matches Lori's manual entry pattern).
  const { data: contracts, error: contractsErr } = await supabase
    .from("contracts")
    .select(`
      id, status, created_at, is_contingent, notes, subtotal, tax_rate,
      line_items, financing, deposit_paid, payment_method,
      customer:customers(first_name, last_name, address, city, state, zip),
      sales_rep:profiles!sales_rep_id(full_name),
      payments(method, card_brand, amount, status),
      override:show_deal_overrides(*)
    `)
    .eq("show_id", id)
    .order("created_at", { ascending: true });
  if (contractsErr) {
    return NextResponse.json({ error: contractsErr.message }, { status: 500 });
  }

  // PostgREST returns a 1-to-1 embed as an array; flatten to single object.
  const deals = (contracts ?? []).map((c) => {
    const raw = c as Record<string, unknown>;
    const ov = raw.override;
    const flat = Array.isArray(ov) ? (ov[0] ?? null) : ov;
    return contractToDeal({ ...raw, override: flat } as unknown as MapperContract);
  });

  // Salesman roster: assigned reps on the show, falling back to distinct reps
  // who actually wrote contracts here.
  let rosterNames: string[] = [];
  const assignedIds = (show.assigned_rep_ids ?? []) as string[];
  if (assignedIds.length > 0) {
    const { data: assignedProfiles } = await supabase
      .from("profiles")
      .select("full_name")
      .in("id", assignedIds);
    rosterNames = (assignedProfiles ?? [])
      .map((p) => p.full_name)
      .filter((n): n is string => !!n);
  }
  if (rosterNames.length === 0) {
    const seen = new Set<string>();
    for (const c of contracts ?? []) {
      const name = (c as { sales_rep?: { full_name?: string } | null }).sales_rep?.full_name;
      if (name && !seen.has(name)) {
        seen.add(name);
        rosterNames.push(name);
      }
    }
  }

  const showConfig = buildShowConfig(
    {
      name: show.name,
      venue_name: show.venue_name,
      city: show.city,
      state: show.state,
      start_date: show.start_date,
      end_date: show.end_date,
    },
    rosterNames,
  );

  const buf = await exportShowSalesWorkbook(showConfig, deals);

  const safeName = show.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60) || "show";
  const filename = `${safeName}-sales-${show.end_date}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
