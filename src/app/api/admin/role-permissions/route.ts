import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RolePermissions } from "@/lib/permissions";

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { permissions } = await req.json() as { permissions: RolePermissions };
  if (!permissions || typeof permissions !== "object") {
    return NextResponse.json({ error: "permissions object required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("organizations")
    .update({ role_permissions: permissions })
    .eq("id", profile.organization_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
