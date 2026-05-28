/**
 * /api/tax/venues — manage pinned tax venues in tax_show_locations.
 *
 * GET  — list active venues (any authenticated user)
 * POST — pin a new verified venue (admin/manager/bookkeeper only)
 *
 * When a venue is pinned, future contracts at the same (state, zip) will
 * resolve via this row instead of calling the live state lookup API. This
 * is the primary "cache" in the system.
 *
 * POST body:
 *   {
 *     venue_name:    "Texas State Fair Park",
 *     street_address: "3921 Martin Luther King Jr Blvd",
 *     city:          "Dallas",
 *     state:         "TX",
 *     zip:           "75215",
 *     combined_rate: 0.0825,
 *     jurisdictions: [{name, type, rate}, ...],
 *     verified_by:   "willie@hqatlas.com via TX API 2026-05-27",
 *     verification_notes?: "string"
 *   }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface JurisdictionInput {
  name: string;
  type: string;
  rate: number;
}

const ALLOWED_STATES = new Set(["TX", "LA", "OK", "KS", "AR"]);
const ALLOWED_TYPES = new Set([
  "state",
  "county",
  "parish",
  "city",
  "transit",
  "special",
  "combined",
]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("tax_show_locations")
    .select(
      "id, venue_name, street_address, city, state, zip, combined_rate, jurisdictions, verified_by, verified_at, verification_notes, active"
    )
    .eq("active", true)
    .order("verified_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ venues: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Role check: admin/manager/bookkeeper only — matches migration 095 RLS.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["admin", "manager", "bookkeeper"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Admin, manager, or bookkeeper role required" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const venue_name = typeof b.venue_name === "string" ? b.venue_name.trim() : "";
  const street_address =
    typeof b.street_address === "string" ? b.street_address.trim() : null;
  const city = typeof b.city === "string" ? b.city.trim() : "";
  const state = typeof b.state === "string" ? b.state.trim() : "";
  const zip = typeof b.zip === "string" ? b.zip.trim() : "";
  const combined_rate = Number(b.combined_rate);
  const verified_by =
    typeof b.verified_by === "string" ? b.verified_by.trim() : "";
  const verification_notes =
    typeof b.verification_notes === "string"
      ? b.verification_notes.trim()
      : null;
  const jurisdictionsRaw = Array.isArray(b.jurisdictions) ? b.jurisdictions : [];

  // Validate
  if (!venue_name) {
    return NextResponse.json({ error: "venue_name required" }, { status: 400 });
  }
  if (!city) {
    return NextResponse.json({ error: "city required" }, { status: 400 });
  }
  if (!ALLOWED_STATES.has(state)) {
    return NextResponse.json(
      { error: "state must be TX/LA/OK/KS/AR" },
      { status: 400 }
    );
  }
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "zip must be 5 digits" }, { status: 400 });
  }
  if (!Number.isFinite(combined_rate) || combined_rate < 0 || combined_rate > 0.2) {
    return NextResponse.json(
      { error: "combined_rate must be a decimal between 0 and 0.20" },
      { status: 400 }
    );
  }
  if (!verified_by) {
    return NextResponse.json(
      { error: "verified_by required (e.g., 'willie@hqatlas.com via TX API 2026-05-27')" },
      { status: 400 }
    );
  }

  // Normalize jurisdictions
  const jurisdictions: JurisdictionInput[] = [];
  for (const j of jurisdictionsRaw) {
    if (!j || typeof j !== "object") continue;
    const o = j as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const type = typeof o.type === "string" ? o.type.trim() : "";
    const rate = Number(o.rate);
    if (!name || !ALLOWED_TYPES.has(type) || !Number.isFinite(rate) || rate < 0)
      continue;
    jurisdictions.push({ name, type, rate });
  }
  if (jurisdictions.length === 0) {
    return NextResponse.json(
      { error: "at least one jurisdiction required" },
      { status: 400 }
    );
  }

  // Sanity: jurisdictions sum within rounding of combined_rate
  const sum = jurisdictions.reduce((s, j) => s + j.rate, 0);
  if (Math.abs(sum - combined_rate) > 0.0005) {
    return NextResponse.json(
      {
        error: `jurisdiction sum ${sum.toFixed(5)} doesn't match combined_rate ${combined_rate.toFixed(5)}`,
      },
      { status: 400 }
    );
  }

  // Insert
  const { data, error } = await supabase
    .from("tax_show_locations")
    .insert({
      venue_name,
      street_address,
      city,
      state,
      zip,
      combined_rate,
      jurisdictions,
      verified_by,
      verified_at: new Date().toISOString(),
      verification_notes,
      active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ venue: data }, { status: 201 });
}
