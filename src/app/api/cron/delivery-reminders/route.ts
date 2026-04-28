// Daily T-24h reminder cron — fires customer balance reminders + staff digest.
// Schedule wired in vercel.json (runs 13:00 UTC = 8 AM CT). Authenticated via CRON_SECRET.
//
// Behavior:
//   1. Find delivery_work_orders with scheduled_date == tomorrow and status = 'scheduled'.
//   2. For each delivery with balance > 0 → email customer "balance due" reminder (skip silently if no email).
//   3. Aggregate per-manager staff digest of "Tomorrow's Deliveries" with readiness flags.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com";
const STAFF_DIGEST_RECIPIENTS = (process.env.DELIVERY_DIGEST_RECIPIENTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use service-role client to read across RLS for the cron job
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });
  const supabase = createClient(url, key);

  const target = tomorrowIso();

  const { data: deliveries, error } = await supabase
    .from("delivery_work_orders")
    .select(`
      id, scheduled_date, scheduled_window, delivery_address, special_instructions,
      contract:contracts(
        id, contract_number, total, balance_due, status,
        needs_permit, permit_status, needs_hoa, hoa_status, customer_id, financing,
        customer:customers(first_name, last_name, email),
        location:locations(name),
        sales_rep:profiles(full_name)
      )
    `)
    .eq("scheduled_date", target)
    .eq("status", "scheduled");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (deliveries ?? []) as any[];

  // Pull DL files for these customers so the digest can flag missing DLs
  const customerIds = list.map((d) => d.contract?.customer_id).filter(Boolean);
  const { data: dlFiles } = customerIds.length
    ? await supabase
        .from("customer_files")
        .select("customer_id, category")
        .in("customer_id", customerIds)
    : { data: [] };
  const dlSet = new Set((dlFiles ?? []).filter((f: any) => f.category === "drivers_license").map((f: any) => f.customer_id));

  const customerEmailsSent: string[] = [];
  const customerEmailsSkipped: string[] = [];

  for (const dwo of list) {
    const c = dwo.contract;
    if (!c) continue;
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const balanceDue = c.balance_due ?? 0;
    const email = customer?.email;
    if (!email) {
      customerEmailsSkipped.push(`${c.contract_number} (no email)`);
      continue;
    }
    if (balanceDue <= 0.01) {
      customerEmailsSkipped.push(`${c.contract_number} (no balance)`);
      continue;
    }

    const dateStr = new Date(dwo.scheduled_date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric"
    });

    try {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Delivery tomorrow — balance due $${balanceDue.toFixed(2)}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#010F21;">Your Atlas Spas delivery is tomorrow</h2>
          <p>Hi ${customer.first_name ?? "there"},</p>
          <p>Just a heads-up — your delivery is scheduled for <strong>${dateStr}${dwo.scheduled_window ? `, ${dwo.scheduled_window}` : ""}</strong>.</p>
          <p>Your remaining balance is <strong style="color:#00929C;font-size:18px;">$${balanceDue.toFixed(2)}</strong>, due upon delivery.</p>
          <p>You can pay ahead of time by replying to this email or calling us. Otherwise, please have payment ready (cash, check, or card) when our team arrives.</p>
          <p>Contract #: <strong>${c.contract_number}</strong></p>
          <p>Thanks,<br/>Atlas Spas &amp; Swim Spas</p>
        </div>`,
      });
      customerEmailsSent.push(`${c.contract_number} → ${email}`);
    } catch (e: any) {
      customerEmailsSkipped.push(`${c.contract_number} (send failed: ${e?.message ?? "unknown"})`);
    }
  }

  // Build staff digest
  if (STAFF_DIGEST_RECIPIENTS.length > 0 && list.length > 0) {
    const rows = list.map((dwo) => {
      const c = dwo.contract;
      const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
      const location = Array.isArray(c.location) ? c.location[0] : c.location;
      const rep = Array.isArray(c.sales_rep) ? c.sales_rep[0] : c.sales_rep;
      const financing = Array.isArray(c.financing) ? c.financing : [];
      const hasFinancing = financing.length > 0;
      const balanceDue = c.balance_due ?? 0;

      const blockers: string[] = [];
      if (balanceDue > 0.01) blockers.push(`Balance $${balanceDue.toFixed(2)}`);
      if (hasFinancing && c.customer_id && !dlSet.has(c.customer_id)) blockers.push("DL missing");
      if (c.needs_permit && c.permit_status !== "approved") blockers.push("Permit pending");
      if (c.needs_hoa && c.hoa_status !== "approved") blockers.push("HOA pending");

      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${c.contract_number}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${customer?.first_name ?? ""} ${customer?.last_name ?? ""}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${dwo.scheduled_window ?? "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${location?.name ?? "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${rep?.full_name ?? "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:${balanceDue > 0.01 ? "#b45309" : "#059669"};">$${balanceDue.toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${blockers.length === 0 ? '<span style="color:#059669;">All clear</span>' : `<span style="color:#b45309;font-weight:bold;">${blockers.join(" · ")}</span>`}</td>
      </tr>`;
    }).join("");

    try {
      await resend.emails.send({
        from: FROM,
        to: STAFF_DIGEST_RECIPIENTS,
        subject: `Tomorrow's deliveries — ${list.length} scheduled`,
        html: `<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;">
          <h2 style="color:#010F21;">Tomorrow's Deliveries — ${list.length} scheduled</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f1f5f9;text-align:left;">
                <th style="padding:8px;">Contract</th>
                <th style="padding:8px;">Customer</th>
                <th style="padding:8px;">Window</th>
                <th style="padding:8px;">Location</th>
                <th style="padding:8px;">Rep</th>
                <th style="padding:8px;">Balance</th>
                <th style="padding:8px;">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="font-size:12px;color:#64748b;margin-top:16px;">Auto-generated daily — Salta delivery scheduler.</p>
        </div>`,
      });
    } catch (e) {
      console.error("[cron] staff digest failed:", e);
    }
  }

  return NextResponse.json({
    target,
    deliveries_found: list.length,
    customer_emails_sent: customerEmailsSent.length,
    customer_emails_skipped: customerEmailsSkipped.length,
    customer_emails_sent_list: customerEmailsSent,
    customer_emails_skipped_list: customerEmailsSkipped,
    staff_digest_sent: STAFF_DIGEST_RECIPIENTS.length > 0 && list.length > 0,
  });
}
