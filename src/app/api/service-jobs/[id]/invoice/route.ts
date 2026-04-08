import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: job } = await supabase.from("service_jobs").select("customer_id, invoice_id").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.invoice_id) return NextResponse.json({ error: "Invoice already exists for this job" }, { status: 409 });

  const { line_items } = await req.json();
  if (!Array.isArray(line_items) || line_items.length === 0) {
    return NextResponse.json({ error: "line_items array is required" }, { status: 400 });
  }

  const subtotal = line_items.reduce((s: number, i: any) => s + (Number(i.qty) * Number(i.unit_price)), 0);

  const { data: invoice, error: invErr } = await supabase
    .from("service_invoices")
    .insert({
      service_job_id: id,
      customer_id: job.customer_id,
      line_items,
      subtotal,
      tax_amount: 0,
      total: subtotal,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  await supabase.from("service_jobs").update({ invoice_id: invoice.id, updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json(invoice, { status: 201 });
}
