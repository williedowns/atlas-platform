import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { to_location_id, to_show_id, notes } = body;

  // Fetch current location to record in history
  const { data: unit } = await supabase
    .from("inventory_units")
    .select("location_id, show_id")
    .eq("id", id)
    .single();

  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  // Determine new status based on destination
  const newStatus = to_show_id ? "at_show" : "at_location";

  // Run both updates in parallel
  const [transferResult, updateResult] = await Promise.all([
    supabase.from("inventory_transfers").insert({
      unit_id: id,
      from_location_id: unit.location_id ?? null,
      to_location_id: to_location_id ?? null,
      from_show_id: unit.show_id ?? null,
      to_show_id: to_show_id ?? null,
      transferred_by: user.id,
      notes: notes ?? null,
    }),
    supabase.from("inventory_units").update({
      location_id: to_location_id ?? null,
      show_id: to_show_id ?? null,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", id),
  ]);

  if (transferResult.error) return NextResponse.json({ error: transferResult.error.message }, { status: 500 });
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

  return NextResponse.json({ success: true, new_status: newStatus });
}
