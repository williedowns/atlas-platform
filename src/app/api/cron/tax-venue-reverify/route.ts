// Quarterly tax-venue re-verification cron.
//
// Iterates active rows in tax_show_locations, re-runs the live state DOR
// lookup for each venue, and emits an email digest summarizing matches,
// mismatches, and lookup failures. Does NOT auto-update venue rows — admin
// reviews mismatches via /admin/tax-venues and re-pins manually.
//
// Schedule: quarterly at noon UTC on the 1st of Jan/Apr/Jul/Oct (state DOR
// rate-change effective dates). Wired in vercel.json.
//
// Authenticated via CRON_SECRET (same pattern as delivery-reminders).
//
// LA venues are SKIPPED — home-rule parishes require human phone verification,
// not state DOR API lookup. The digest flags LA venues as "manual".

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { lookupTexasRateByAddress } from "@/lib/tax/txComptrollerApi";
import { lookupKansasRateByAddress } from "@/lib/tax/ksRevenueClient";
import { lookupOklahomaRateByAddress } from "@/lib/tax/okTaxClient";
import { lookupArkansasRateByAddress } from "@/lib/tax/arGisClient";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com";
const DIGEST_RECIPIENTS = (process.env.TAX_REVERIFY_DIGEST_RECIPIENTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface VenueRow {
  id: string;
  venue_name: string;
  street_address: string | null;
  city: string;
  state: string;
  zip: string;
  combined_rate: number;
  verified_by: string;
  verified_at: string;
}

interface ReverifyResult {
  venue: VenueRow;
  status: "match" | "mismatch" | "failed" | "manual_skip";
  newRate?: number;
  delta?: number;
  message?: string;
}

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// Small helper: pause between requests to avoid OK CSA rate-limit (60-90s
// recovery on burst). 5s between venues is conservative.
const VENUE_PAUSE_MS = 5_000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function reverifyVenue(v: VenueRow): Promise<ReverifyResult> {
  const street = v.street_address?.trim() ?? "";
  const city = v.city.trim();
  const zip = v.zip;

  if (v.state === "LA") {
    return {
      venue: v,
      status: "manual_skip",
      message:
        "LA home-rule parish — phone verification only. Re-check rate against the parish tax collector.",
    };
  }

  try {
    if (v.state === "TX") {
      const r = await lookupTexasRateByAddress({ street, city, zip });
      if (!r.ok) return { venue: v, status: "failed", message: `TX: ${r.reason} ${r.message}` };
      const delta = Math.abs(r.combinedRate - Number(v.combined_rate));
      return delta < 0.00005
        ? { venue: v, status: "match", newRate: r.combinedRate }
        : { venue: v, status: "mismatch", newRate: r.combinedRate, delta };
    }
    if (v.state === "KS") {
      // KS form needs streetNumber + streetName separated. Parse heuristically.
      const m = street.match(/^(\d+[A-Z]?)\s+(.+)$/);
      if (!m) return { venue: v, status: "failed", message: "KS: street parse failed" };
      const r = await lookupKansasRateByAddress({
        streetNumber: m[1],
        streetName: m[2],
        city,
        zip,
      });
      if (!r.ok) return { venue: v, status: "failed", message: `KS: ${r.reason} ${r.message}` };
      const delta = Math.abs(r.combinedRate - Number(v.combined_rate));
      return delta < 0.00005
        ? { venue: v, status: "match", newRate: r.combinedRate }
        : { venue: v, status: "mismatch", newRate: r.combinedRate, delta };
    }
    if (v.state === "OK") {
      // OK form needs structured fields. Parse heuristically; bail on failure
      // rather than guess — the digest will flag it.
      const m = street.match(/^(\d+[A-Z]?)\s+(?:(N|E|S|W|NE|SE|SW|NW)\s+)?(.+?)\s+([A-Z]+)$/i);
      if (!m) return { venue: v, status: "failed", message: "OK: street parse failed" };
      const r = await lookupOklahomaRateByAddress({
        houseNumber: m[1],
        streetDirection: m[2] ?? "",
        streetName: m[3],
        streetType: m[4],
        zip,
      });
      if (!r.ok) return { venue: v, status: "failed", message: `OK: ${r.reason} ${r.message}` };
      const delta = Math.abs(r.combinedRate - Number(v.combined_rate));
      return delta < 0.00005
        ? { venue: v, status: "match", newRate: r.combinedRate }
        : { venue: v, status: "mismatch", newRate: r.combinedRate, delta };
    }
    if (v.state === "AR") {
      const r = await lookupArkansasRateByAddress({ street, city, zip });
      if (!r.ok) return { venue: v, status: "failed", message: `AR: ${r.reason} ${r.message}` };
      const delta = Math.abs(r.combinedRate - Number(v.combined_rate));
      return delta < 0.00005
        ? { venue: v, status: "match", newRate: r.combinedRate }
        : { venue: v, status: "mismatch", newRate: r.combinedRate, delta };
    }
    return { venue: v, status: "failed", message: `Unsupported state: ${v.state}` };
  } catch (err) {
    return {
      venue: v,
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function renderDigest(results: ReverifyResult[]): { subject: string; html: string; text: string } {
  const matches = results.filter((r) => r.status === "match");
  const mismatches = results.filter((r) => r.status === "mismatch");
  const failed = results.filter((r) => r.status === "failed");
  const manual = results.filter((r) => r.status === "manual_skip");

  const subject = `[Atlas Tax] Quarterly venue re-verify — ${results.length} venues, ${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"}, ${failed.length} failure${failed.length === 1 ? "" : "s"}`;

  const fmtPct = (n: number) => `${(n * 100).toFixed(3)}%`;

  let html = `
    <h2>Atlas Spas — Quarterly Tax Venue Re-Verification</h2>
    <p><b>Run date:</b> ${new Date().toISOString().slice(0, 10)}</p>
    <p><b>Venues checked:</b> ${results.length}
       &nbsp;|&nbsp; <b>Matches:</b> ${matches.length}
       &nbsp;|&nbsp; <b>Mismatches:</b> ${mismatches.length}
       &nbsp;|&nbsp; <b>Failures:</b> ${failed.length}
       &nbsp;|&nbsp; <b>LA manual skip:</b> ${manual.length}</p>
  `;

  if (mismatches.length > 0) {
    html += `<h3 style="color:#B45309">⚠ Mismatches (review at <a href="https://getsalta.com/admin/tax-venues">/admin/tax-venues</a>)</h3>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
      <tr><th>Venue</th><th>State</th><th>Pinned</th><th>State DOR now</th><th>Δ</th></tr>`;
    for (const r of mismatches) {
      html += `<tr>
        <td>${r.venue.venue_name}<br><small>${r.venue.city}, ${r.venue.state} ${r.venue.zip}</small></td>
        <td>${r.venue.state}</td>
        <td>${fmtPct(Number(r.venue.combined_rate))}</td>
        <td><b>${fmtPct(r.newRate ?? 0)}</b></td>
        <td>${fmtPct(r.delta ?? 0)}</td>
      </tr>`;
    }
    html += `</table>`;
  }

  if (failed.length > 0) {
    html += `<h3 style="color:#991B1B">✗ Lookup failures</h3><ul>`;
    for (const r of failed) {
      html += `<li><b>${r.venue.venue_name}</b> (${r.venue.city}, ${r.venue.state}) — ${r.message}</li>`;
    }
    html += `</ul>`;
  }

  if (manual.length > 0) {
    html += `<h3>📞 LA venues — manual verification required</h3><ul>`;
    for (const r of manual) {
      html += `<li><b>${r.venue.venue_name}</b> (${r.venue.city}, LA ${r.venue.zip}) — call the parish to re-verify pinned rate ${fmtPct(Number(r.venue.combined_rate))}.</li>`;
    }
    html += `</ul>`;
  }

  if (matches.length > 0 && mismatches.length === 0 && failed.length === 0) {
    html += `<p style="color:#065F46">✓ All non-LA venues match their state DOR rate. No action needed.</p>`;
  }

  const text =
    `Atlas Tax — Quarterly Venue Re-Verify (${new Date().toISOString().slice(0, 10)})\n` +
    `Checked ${results.length} venues: ${matches.length} match, ${mismatches.length} mismatch, ${failed.length} failed, ${manual.length} LA manual.\n` +
    (mismatches.length
      ? "\nMISMATCHES:\n" +
        mismatches
          .map(
            (r) =>
              `- ${r.venue.venue_name} (${r.venue.state} ${r.venue.zip}): pinned ${fmtPct(
                Number(r.venue.combined_rate),
              )} → state DOR now ${fmtPct(r.newRate ?? 0)} (Δ ${fmtPct(r.delta ?? 0)})`,
          )
          .join("\n") +
        "\n"
      : "") +
    (failed.length
      ? "\nFAILURES:\n" +
        failed.map((r) => `- ${r.venue.venue_name} (${r.venue.state}): ${r.message}`).join("\n") +
        "\n"
      : "");

  return { subject, html, text };
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

  const { data: venues, error } = await supabase
    .from("tax_show_locations")
    .select("id, venue_name, street_address, city, state, zip, combined_rate, verified_by, verified_at")
    .eq("active", true)
    .order("state")
    .order("city");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (venues ?? []) as VenueRow[];
  const results: ReverifyResult[] = [];

  // Sequential with pacing — OK CSA rate-limits aggressively, and we'd rather
  // a slow cron than a flood of 503s.
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await sleep(VENUE_PAUSE_MS);
    results.push(await reverifyVenue(rows[i]));
  }

  const { subject, html, text } = renderDigest(results);

  // Send digest if recipients configured. Skip silently if not.
  if (DIGEST_RECIPIENTS.length > 0 && process.env.RESEND_API_KEY) {
    try {
      await resend.emails.send({
        from: FROM,
        to: DIGEST_RECIPIENTS,
        subject,
        html,
        text,
      });
    } catch (e) {
      console.error("[tax-venue-reverify] digest email failed:", e);
    }
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    checked: results.length,
    matches: results.filter((r) => r.status === "match").length,
    mismatches: results.filter((r) => r.status === "mismatch").length,
    failed: results.filter((r) => r.status === "failed").length,
    manual_skip: results.filter((r) => r.status === "manual_skip").length,
    digest_sent_to: DIGEST_RECIPIENTS.length,
    results: results.map((r) => ({
      venue_id: r.venue.id,
      venue_name: r.venue.venue_name,
      state: r.venue.state,
      status: r.status,
      pinned_rate: Number(r.venue.combined_rate),
      new_rate: r.newRate,
      delta: r.delta,
      message: r.message,
    })),
  });
}
