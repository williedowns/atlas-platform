import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const message: string | undefined = body.message;

  const { data: job, error } = await supabase
    .from("service_jobs")
    .select("*, customer:customers(first_name,last_name,email), assigned_tech:profiles(full_name)")
    .eq("id", id)
    .single();

  if (error || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const customer = (job as any).customer;
  const tech = (job as any).assigned_tech;
  if (!customer?.email) return NextResponse.json({ error: "Customer has no email" }, { status: 400 });

  const dateStr = job.scheduled_date
    ? new Date(job.scheduled_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "To be determined";
  const timeStr = job.scheduled_time_start ? ` at ${job.scheduled_time_start.slice(0, 5)}` : "";

  await resend.emails.send({
    from: process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com",
    to: customer.email,
    subject: `Your service appointment is confirmed — ${job.title}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#010F21;padding:20px 24px;border-radius:8px 8px 0 0;">
        <p style="color:white;font-size:18px;font-weight:bold;margin:0;">Atlas Spas</p>
      </div>
      <div style="padding:24px;background:#ffffff;">
        <h2 style="color:#010F21;margin-top:0;">Service Appointment Confirmed</h2>
        <p style="color:#475569;">Hi ${customer.first_name}, your service appointment has been scheduled.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
          <tr><td style="padding:6px 8px;color:#64748b;font-weight:500;">Service</td><td style="padding:6px 8px;">${job.title}</td></tr>
          <tr><td style="padding:6px 8px;color:#64748b;font-weight:500;">Date</td><td style="padding:6px 8px;">${dateStr}${timeStr}</td></tr>
          ${tech ? `<tr><td style="padding:6px 8px;color:#64748b;font-weight:500;">Technician</td><td style="padding:6px 8px;">${tech.full_name}</td></tr>` : ""}
          <tr><td style="padding:6px 8px;color:#64748b;font-weight:500;">Type</td><td style="padding:6px 8px;">${job.job_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</td></tr>
        </table>
        ${message ? `<div style="background:#f8fafc;padding:12px 16px;border-left:3px solid #00929C;border-radius:4px;margin:16px 0;color:#475569;">${message}</div>` : ""}
        <p style="color:#94a3b8;font-size:13px;margin-top:24px;">Questions? Contact us at ${process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com"}</p>
      </div>
    </div>`,
  });

  return NextResponse.json({ sent: true });
}
