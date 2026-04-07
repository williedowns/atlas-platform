import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify caller is admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Use admin client to bypass RLS
  const admin = createAdminClient();

  // Null out location references on contracts and shows before deleting
  // to avoid FK constraint errors
  await Promise.all([
    admin.from("contracts").update({ location_id: null }).eq("location_id", id),
    admin.from("shows").update({ location_id: null }).eq("location_id", id),
    admin.from("inventory_units").update({ location_id: null }).eq("location_id", id),
    admin.from("profiles").update({ assigned_location_id: null }).eq("assigned_location_id", id),
  ]);

  const { error } = await admin.from("locations").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
