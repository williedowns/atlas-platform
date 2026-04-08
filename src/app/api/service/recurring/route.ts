import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("recurring_service_templates")
    .select("*, customer:customers(first_name,last_name), equipment:equipment(product_name), assigned_tech:profiles(full_name)")
    .eq("active", true)
    .order("next_generate_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { customer_id, equipment_id, job_type, title, description, frequency, assigned_tech_id, next_generate_date } = body;

  if (!customer_id || !job_type || !title?.trim() || !frequency) {
    return NextResponse.json({ error: "customer_id, job_type, title, frequency required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("recurring_service_templates")
    .insert({
      customer_id,
      equipment_id: equipment_id || null,
      job_type,
      title: title.trim(),
      description: description || null,
      frequency,
      assigned_tech_id: assigned_tech_id || null,
      next_generate_date: next_generate_date || null,
      active: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
