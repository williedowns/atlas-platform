// Daily WF authorize-future watcher.
// Finds contracts where WF financing is in "authorize_future" mode and the contract
// is older than 7 days but not yet funded, then emails Robert + Lindy a digest.
// Schedule wired in vercel.json.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com";
const RECIPIENTS = (process.env.WF_WATCHER_RECIPIENTS ?? process.env.DELIVERY_DIGEST_RECIPIENTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });
  const supabase = createClient(url, key);

  const { data: contractsRaw, error } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, created_at, financing,
      customer:customers(first_name, last_name)
    `)
    .not("status", "in", '("quote","draft","cancelled")')
    .not("financing", "eq", "[]")
    .not("financing", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const stale: Array<{ contract_number: string; customerName: string; createdAt: string; futureDate: string | null; financedAmount: number; ageDays: number; fundedAmount: number }> = [];

  for (const c of contractsRaw ?? []) {
    const arr = Array.isArray((c as any).financing) ? (c as any).financing : [];
    for (const f of arr) {
      const isWf = (f.financer_name ?? "").toLowerCase().includes("wells");
      if (!isWf) continue;
      if (f.wf_charge_mode !== "authorize_future") continue;
      const fundedAmt = f.funded_amount ?? 0;
      if (fundedAmt >= (f.financed_amount ?? 0) - 0.01) continue; // already funded
      const ageMs = now - new Date((c as any).created_at).getTime();
      if (ageMs < SEVEN_DAYS_MS) continue;
      const customer = Array.isArray((c as any).customer) ? (c as any).customer[0] : (c as any).customer;
      stale.push({
        contract_number: (c as any).contract_number,
        customerName: `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "—",
        createdAt: (c as any).created_at,
        futureDate: f.wf_future_charge_date ?? null,
        financedAmount: f.financed_amount ?? 0,
        fundedAmount: fundedAmt,
        ageDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
      });
    }
  }

  if (stale.length === 0) {
    return NextResponse.json({ stale: 0, sent: false });
  }

  if (RECIPIENTS.length === 0) {
    return NextResponse.json({ stale: stale.length, sent: false, reason: "no recipients configured" });
  }

  const rows = stale.map((s) => `<tr>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${s.contract_number}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${s.customerName}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${s.ageDays}d</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${s.futureDate ?? "—"}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#b45309;">$${s.financedAmount.toFixed(2)}</td>
  </tr>`).join("");

  await resend.emails.send({
    from: FROM,
    to: RECIPIENTS,
    subject: `WF Authorize-Future stale — ${stale.length} contract${stale.length === 1 ? "" : "s"} need Run Final`,
    html: `<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;">
      <h2 style="color:#010F21;">Wells Fargo authorize-future contracts not yet funded</h2>
      <p>The following contracts were authorized in WF as future-charge and have NOT been funded for 7+ days. "Run Final" likely needs to be executed in WF.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:8px;">Contract</th>
            <th style="padding:8px;">Customer</th>
            <th style="padding:8px;">Age</th>
            <th style="padding:8px;">Scheduled charge date</th>
            <th style="padding:8px;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:12px;color:#64748b;margin-top:16px;">Auto-generated — Salta WF watcher.</p>
    </div>`,
  });

  return NextResponse.json({ stale: stale.length, sent: true });
}
