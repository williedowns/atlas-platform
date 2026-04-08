import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  if (!["admin", "manager", "field_crew"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (role === "field_crew") {
    const { data: job } = await supabase.from("service_jobs").select("assigned_tech_id").eq("id", id).single();
    if (job?.assigned_tech_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const completedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("service_jobs")
    .update({ status: "completed", completed_at: completedAt, updated_at: completedAt })
    .eq("id", id)
    .select("*, customer:customers(first_name,last_name,email)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send completion email (best-effort)
  try {
    const customer = (updated as any).customer;
    const { data: tests } = await supabase
      .from("service_job_water_tests")
      .select("*")
      .eq("job_id", id)
      .order("tested_at", { ascending: false })
      .limit(1);

    const t = tests?.[0];
    const waterSection = t ? `
      <h3 style="color:#010F21;margin:16px 0 8px;">Water Test Results</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${t.ph != null ? `<tr><td style="padding:4px 8px;color:#64748b;">pH</td><td style="padding:4px 8px;font-weight:600;">${t.ph}</td></tr>` : ""}
        ${t.sanitizer_ppm != null ? `<tr><td style="padding:4px 8px;color:#64748b;">Sanitizer</td><td style="padding:4px 8px;font-weight:600;">${t.sanitizer_ppm} ppm</td></tr>` : ""}
        ${t.temp_f != null ? `<tr><td style="padding:4px 8px;color:#64748b;">Temperature</td><td style="padding:4px 8px;font-weight:600;">${t.temp_f}°F</td></tr>` : ""}
        ${t.alkalinity != null ? `<tr><td style="padding:4px 8px;color:#64748b;">Alkalinity</td><td style="padding:4px 8px;font-weight:600;">${t.alkalinity} ppm</td></tr>` : ""}
        ${t.hardness != null ? `<tr><td style="padding:4px 8px;color:#64748b;">Hardness</td><td style="padding:4px 8px;font-weight:600;">${t.hardness} ppm</td></tr>` : ""}
      </table>` : "";

    if (customer?.email) {
      await resend.emails.send({
        from: process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com",
        to: customer.email,
        subject: `Your service visit is complete — ${(updated as any).title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#010F21;padding:20px 24px;border-radius:8px 8px 0 0;">
            <p style="color:white;font-size:18px;font-weight:bold;margin:0;">Atlas Spas</p>
          </div>
          <div style="padding:24px;background:#ffffff;">
            <h2 style="color:#010F21;margin-top:0;">Service Complete</h2>
            <p style="color:#475569;">Hi ${customer.first_name}, your service visit has been completed.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
              <tr><td style="padding:6px 8px;color:#64748b;font-weight:500;">Job</td><td style="padding:6px 8px;">${(updated as any).title}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-weight:500;">Completed</td><td style="padding:6px 8px;">${new Date(completedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</td></tr>
            </table>
            ${waterSection}
            <p style="color:#94a3b8;font-size:13px;margin-top:24px;">Thank you for choosing Atlas Spas & Swim Spas.</p>
          </div>
        </div>`,
      });
    }
  } catch (_) {}

  return NextResponse.json(updated);
}
