import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  if (!["admin", "manager", "field_crew"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tech_id = searchParams.get("tech_id");
  const date = searchParams.get("date");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200);

  let query = supabase
    .from("service_jobs")
    .select("id, job_type, title, status, scheduled_date, scheduled_time_start, scheduled_time_end, created_at, customer:customers(first_name,last_name,email,phone), equipment:equipment(product_name,serial_number), assigned_tech:profiles(full_name)")
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (role === "field_crew") query = query.eq("assigned_tech_id", user.id);
  if (status) query = query.eq("status", status);
  if (tech_id) query = query.eq("assigned_tech_id", tech_id);
  if (date) query = query.eq("scheduled_date", date);

  const { data, error } = await query;
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
  const { customer_id, equipment_id, job_type, title, description, assigned_tech_id, scheduled_date, scheduled_time_start, scheduled_time_end, notes } = body;

  if (!customer_id || !job_type || !title?.trim()) {
    return NextResponse.json({ error: "customer_id, job_type, and title are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("service_jobs")
    .insert({
      customer_id,
      equipment_id: equipment_id || null,
      job_type,
      title: title.trim(),
      description: description || null,
      assigned_tech_id: assigned_tech_id || null,
      scheduled_date: scheduled_date || null,
      scheduled_time_start: scheduled_time_start || null,
      scheduled_time_end: scheduled_time_end || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
