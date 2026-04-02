import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
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
  const {
    status, unit_type, location_id, show_id,
    shell_color, cabinet_color, wrap_status, sub_location,
    serial_number, order_number, notes,
    delivery_team, customer_name, fin_balance,
    delivery_info, foundation_financing, scheduled_owes,
  } = body;

  const { data, error } = await supabase
    .from("inventory_units")
    .update({
      status,
      unit_type,
      location_id: location_id ?? null,
      show_id: show_id ?? null,
      shell_color: shell_color ?? null,
      cabinet_color: cabinet_color ?? null,
      wrap_status: wrap_status ?? "WR",
      sub_location: sub_location ?? null,
      serial_number: serial_number ?? null,
      order_number: order_number ?? null,
      notes: notes ?? null,
      delivery_team: delivery_team || null,
      customer_name: customer_name || null,
      fin_balance: fin_balance || null,
      delivery_info: delivery_info || null,
      foundation_financing: foundation_financing ?? false,
      scheduled_owes: scheduled_owes ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
