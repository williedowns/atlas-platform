import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("service_jobs")
    .select("*, customer:customers(first_name,last_name,email,phone), equipment:equipment(product_name,serial_number), assigned_tech:profiles(full_name), water_tests:service_job_water_tests(*), photos:service_job_photos(*), invoice:service_invoices(id,status,total)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  const body = await req.json();

  if (!["admin", "manager"].includes(role)) {
    const { data: job } = await supabase.from("service_jobs").select("assigned_tech_id").eq("id", id).single();
    if (job?.assigned_tech_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    const { data, error } = await supabase.from("service_jobs").update(updates).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of ["status", "assigned_tech_id", "scheduled_date", "scheduled_time_start", "scheduled_time_end", "notes", "admin_notes", "title", "description"]) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  const { data, error } = await supabase.from("service_jobs").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("service_jobs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
