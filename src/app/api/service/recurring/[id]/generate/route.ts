import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function calcNextDate(current: string, frequency: string): string {
  const d = new Date(current + "T12:00:00");
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else if (frequency === "seasonal") d.setDate(d.getDate() + 91);
  else d.setMonth(d.getMonth() + 1); // monthly
  return d.toISOString().slice(0, 10);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: template, error: tErr } = await supabase
    .from("recurring_service_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (tErr || !template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!template.active) return NextResponse.json({ error: "Template is inactive" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const scheduledDate = template.next_generate_date ?? today;

  const { data: job, error: jErr } = await supabase
    .from("service_jobs")
    .insert({
      customer_id: template.customer_id,
      equipment_id: template.equipment_id,
      job_type: template.job_type,
      title: template.title,
      description: template.description,
      assigned_tech_id: template.assigned_tech_id,
      scheduled_date: scheduledDate,
      status: "scheduled",
      created_by: user.id,
    })
    .select()
    .single();

  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 });

  const newNext = calcNextDate(scheduledDate, template.frequency);
  const { data: updatedTemplate } = await supabase
    .from("recurring_service_templates")
    .update({ last_generated_at: new Date().toISOString(), next_generate_date: newNext, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  return NextResponse.json({ job, template: updatedTemplate });
}
