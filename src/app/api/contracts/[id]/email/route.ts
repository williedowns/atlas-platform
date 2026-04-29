import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, customer:customers(*)")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping email for contract", id);
    return NextResponse.json({ ok: true, skipped: true });
  }

  const customer = contract.customer;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:#00929C;padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:bold;">ATLAS SPAS</h1>
      <p style="color:#00929C;margin:8px 0 0;font-size:14px;">Your Sales Contract</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="font-size:18px;font-weight:bold;color:#0f172a;">
        Thank you, ${customer.first_name}!
      </p>
      <p style="color:#475569;">Your Atlas Spas purchase contract has been created. Here's your summary:</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <tr style="background:#f1f5f9;">
          <td style="padding:12px;font-weight:bold;color:#334155;">Contract #</td>
          <td style="padding:12px;color:#0f172a;">${contract.contract_number}</td>
        </tr>
        <tr>
          <td style="padding:12px;font-weight:bold;color:#334155;">Date</td>
          <td style="padding:12px;color:#0f172a;">${formatDate(contract.created_at)}</td>
        </tr>
        <tr style="background:#f1f5f9;">
          <td style="padding:12px;font-weight:bold;color:#334155;">Total</td>
          <td style="padding:12px;color:#0f172a;font-weight:bold;">${formatCurrency(contract.total)}</td>
        </tr>
        <tr>
          <td style="padding:12px;font-weight:bold;color:#334155;">Deposit Paid</td>
          <td style="padding:12px;color:#059669;font-weight:bold;">${formatCurrency(contract.deposit_paid ?? 0)}</td>
        </tr>
        <tr style="background:#f1f5f9;">
          <td style="padding:12px;font-weight:bold;color:#334155;">Balance Due at Delivery</td>
          <td style="padding:12px;color:#d97706;font-weight:bold;">${formatCurrency(contract.balance_due)}</td>
        </tr>
      </table>
      <p style="color:#475569;font-size:14px;">
        Questions? Contact your Atlas Spas representative or visit us at
        <a href="https://atlasspas.com" style="color:#00929C;">atlasspas.com</a>.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        Atlas Spas · This is an automated confirmation email.
      </p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Atlas Spas <contracts@atlasspas.com>",
      to: [customer.email],
      subject: `Your Atlas Spas Contract - ${contract.contract_number}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
