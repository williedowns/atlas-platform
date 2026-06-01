// Quarterly LATA refresh reminder cron.
//
// LATA publishes parish/city rate changes quarterly. The DB seed
// (la_lata_jurisdictions) needs to be re-imported each quarter from an
// updated workbook to stay current. This cron emails admin a
// "time to refresh" reminder at each quarter boundary.
//
// Schedule: noon UTC on the 1st of January, April, July, October —
// the standard state-DOR effective-date cadence. Wired in vercel.json.
//
// This cron does NOT scrape LATA itself — that would be fragile and is
// best done by a human against an authoritative source (the compliance
// workbook). It just nudges the human to do it.
//
// Authenticated via CRON_SECRET (same pattern as delivery-reminders).

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.INVITE_FROM_EMAIL ?? "hello@atlasspas.com";
const RECIPIENTS = (process.env.TAX_REVERIFY_DIGEST_RECIPIENTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });
  }
  const supabase = createClient(url, key);

  // Read current LATA snapshot — counts + oldest verification date.
  const { data: rows, error } = await supabase
    .from("la_lata_jurisdictions")
    .select("parish_name, source_verified_at, effective_date");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = rows?.length ?? 0;
  const uniqueParishes = new Set((rows ?? []).map((r) => r.parish_name));
  const oldestVerified = (rows ?? [])
    .map((r) => r.source_verified_at)
    .filter(Boolean)
    .sort()[0] ?? "(none recorded)";
  const oldestEffective = (rows ?? [])
    .map((r) => r.effective_date)
    .filter(Boolean)
    .sort()[0] ?? "(none recorded)";

  // Quarter boundary check — only fire the email on actual quarter starts.
  const today = new Date();
  const month = today.getUTCMonth() + 1; // 1-12
  const day = today.getUTCDate();
  const onQuarterBoundary = day === 1 && [1, 4, 7, 10].includes(month);

  const subject = onQuarterBoundary
    ? `[Atlas Tax] LATA quarterly refresh due — ${total} rows across ${uniqueParishes.size} parishes`
    : `[Atlas Tax] LATA refresh status — ${total} rows across ${uniqueParishes.size} parishes`;

  const html = `
    <h2>Atlas Spas — Louisiana LATA Rate Refresh</h2>
    <p><b>Run date:</b> ${today.toISOString().slice(0, 10)}</p>
    <p><b>Current snapshot:</b> ${total} LATA jurisdiction rows across ${uniqueParishes.size} of 64 parishes.</p>
    <p><b>Oldest source_verified_at:</b> ${oldestVerified}<br>
       <b>Oldest effective_date:</b> ${oldestEffective}</p>
    ${onQuarterBoundary
      ? `<h3 style="color:#B45309">⚠ Quarter boundary — refresh due</h3>
         <p>LATA publishes parish/city rate changes quarterly. Refresh the snapshot:</p>
         <ol>
           <li>Get an updated copy of <code>Sales_Tax_Compliance_TX_OK_LA_KS_AR.xlsx</code></li>
           <li>Re-run the openpyxl extraction (see <code>docs/tax-system.md</code> → Louisiana → quarterly refresh playbook)</li>
           <li><code>bun scripts/import_la_lata_rates.ts</code></li>
           <li>Spot-check the 6 known addresses in the script's output</li>
         </ol>`
      : `<p>Not on a quarter boundary (Jan 1 / Apr 1 / Jul 1 / Oct 1). Nothing to do.</p>`
    }
    <p style="font-size:11px;color:#666">Cameron + Jefferson parishes are known LATA gaps; see <code>docs/tax-system.md</code> for the manual-entry path.</p>
  `;

  if (RECIPIENTS.length > 0 && process.env.RESEND_API_KEY) {
    try {
      await resend.emails.send({
        from: FROM,
        to: RECIPIENTS,
        subject,
        html,
      });
    } catch (e) {
      console.error("[lata-refresh-reminder] email failed:", e);
    }
  }

  return NextResponse.json({
    ran_at: today.toISOString(),
    on_quarter_boundary: onQuarterBoundary,
    total_rows: total,
    unique_parishes: uniqueParishes.size,
    oldest_source_verified_at: oldestVerified,
    oldest_effective_date: oldestEffective,
    digest_sent_to: RECIPIENTS.length,
  });
}
