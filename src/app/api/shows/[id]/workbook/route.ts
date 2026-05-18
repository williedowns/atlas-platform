import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type RolePermissions } from "@/lib/permissions";
import { loadWorkbookDeals } from "@/lib/show-sales/workbook-loader";

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

  const { data: show, error: showErr } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date")
    .eq("id", id)
    .single();
  if (showErr || !show) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  const deals = await loadWorkbookDeals(supabase, id);
  return NextResponse.json({ show, deals });
}
