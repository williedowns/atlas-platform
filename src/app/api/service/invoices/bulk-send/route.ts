import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: drafts, error } = await supabase
    .from("service_invoices")
    .select("*, customer:customers(first_name,last_name,email), job:service_jobs(title)")
    .eq("status", "draft");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const inv of drafts ?? []) {
    const customer = (inv as any).customer;
    if (!customer?.email) continue;

    const items: any[] = (inv.line_items as any[]) ?? [];
    const rows = items.map((i) =>
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${i.description}</td><td style="padding:6px 8px;text-align:center;border-bottom:1px solid #f1f5f9;">${i.qty}</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9;">$${Number(i.unit_price).toFixed(2)}</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9;">$${(Number(i.qty) * Number(i.unit_price)).toFixed(2)}</td></tr>`
    ).join("");

    try {
      await resend.emails.send({
        from: process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com",
        to: customer.email,
        subject: `Invoice for your recent service — ${(inv as any).job?.title ?? "Service Visit"}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#010F21;padding:20px 24px;border-radius:8px 8px 0 0;">
            <p style="color:white;font-size:18px;font-weight:bold;margin:0;">Atlas Spas</p>
          </div>
          <div style="padding:24px;">
            <h2 style="color:#010F21;margin-top:0;">Service Invoice</h2>
            <p style="color:#475569;">Hi ${customer.first_name}, here is your invoice for recent service.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
              <thead><tr style="background:#f8fafc;">
                <th style="padding:8px;text-align:left;font-weight:600;">Description</th>
                <th style="padding:8px;text-align:center;font-weight:600;">Qty</th>
                <th style="padding:8px;text-align:right;font-weight:600;">Unit Price</th>
                <th style="padding:8px;text-align:right;font-weight:600;">Amount</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr><td colspan="3" style="padding:8px;text-align:right;color:#64748b;">Total Due</td><td style="padding:8px;text-align:right;font-weight:bold;color:#00929C;font-size:16px;">$${Number(inv.total).toFixed(2)}</td></tr>
              </tfoot>
            </table>
            <p style="color:#475569;">Please contact us to arrange payment.</p>
            <p style="color:#94a3b8;font-size:13px;margin-top:24px;">Thank you for choosing Atlas Spas &amp; Swim Spas.</p>
          </div>
        </div>`,
      });

      await supabase.from("service_invoices").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", inv.id);
      sent++;
    } catch (_) {}
  }

  return NextResponse.json({ sent });
}
