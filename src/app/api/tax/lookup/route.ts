/**
 * POST /api/tax/lookup — resolve a sales tax rate for a given address.
 *
 * This is a PURE LOOKUP endpoint. It does NOT compute the tax owed on a
 * specific contract (use /api/tax for that). It only answers: "given an
 * address in TX/LA/OK/KS, what is the combined sales tax rate?"
 *
 * Used by:
 *   - Show/venue entry UI (so admin can verify rate before pinning)
 *   - OTD calculator (to drive line-item taxability + rate)
 *
 * Request body:
 *   {
 *     state: "TX" | "LA" | "OK" | "KS",
 *     zip: "12345",                  // 5-digit
 *     street_address?: "200 N Walker Ave",  // optional but required for live API
 *     venue_id?: "uuid"              // optional — prefers tax_show_locations row
 *   }
 *
 * Response (200):
 *   {
 *     outcome: "show_location" | "tx_api" | "ks_api" | "ok_api" | "by_zip"
 *              | "requires_verification" | "no_data",
 *     combined_rate: 0.0825 | null,
 *     state: "TX",
 *     jurisdictions: [{name, type, rate}, ...],
 *     source: "tx_comptroller_api" | "ks_dor_lookup" | "ok_csa_rate_locator"
 *              | "show_location:<id>" | null,
 *     effective_date: "2026-04-01" | null,
 *     warning: string | null,        // surface in UI if present
 *     verified_by: string | null
 *   }
 *
 * Errors:
 *   401 Unauthorized — no session
 *   400 Bad Request — missing/invalid state or zip
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupRate, type StateCode } from "@/lib/tax/lookupRate";

const VALID_STATES: ReadonlySet<StateCode> = new Set(["TX", "LA", "OK", "KS", "AR"]);

export async function POST(req: Request) {
  // ── Auth ──
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const { state, zip, street_address, venue_id } = body as {
    state?: unknown;
    zip?: unknown;
    street_address?: unknown;
    venue_id?: unknown;
  };

  // ── Validate ──
  if (typeof state !== "string" || !VALID_STATES.has(state as StateCode)) {
    return NextResponse.json(
      { error: "state must be one of: TX, LA, OK, KS, AR" },
      { status: 400 }
    );
  }
  if (typeof zip !== "string" || !/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { error: "zip must be a 5-digit string" },
      { status: 400 }
    );
  }
  if (street_address !== undefined && typeof street_address !== "string") {
    return NextResponse.json(
      { error: "street_address must be a string if provided" },
      { status: 400 }
    );
  }
  if (venue_id !== undefined && typeof venue_id !== "string") {
    return NextResponse.json(
      { error: "venue_id must be a string if provided" },
      { status: 400 }
    );
  }

  // ── Lookup ──
  try {
    const result = await lookupRate({
      state: state as StateCode,
      zip,
      street_address: street_address as string | undefined,
      venue_id: venue_id as string | undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[tax/lookup] failed:", err);
    return NextResponse.json(
      { error: "Tax lookup failed", details: String(err) },
      { status: 500 }
    );
  }
}
