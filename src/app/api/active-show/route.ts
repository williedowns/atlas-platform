// POST   /api/active-show   { show_id }      — set this user's active show (clears active location)
// POST   /api/active-show   { location_id }  — set this user's active showroom (clears active show)
// DELETE /api/active-show                    — clear both
//
// Backed by profiles.active_show_id + profiles.active_location_id. App
// treats these as mutually exclusive — the endpoint enforces that by
// nulling the other column when one is set.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { show_id, location_id } = body as { show_id?: string; location_id?: string };

  if (show_id) {
    if (!UUID_RE.test(show_id)) {
      return NextResponse.json({ error: "Invalid show_id" }, { status: 400 });
    }

    const { data: show } = await supabase
      .from("shows")
      .select("id, active")
      .eq("id", show_id)
      .maybeSingle();

    if (!show || !show.active) {
      return NextResponse.json({ error: "Show not found or inactive" }, { status: 404 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ active_show_id: show.id, active_location_id: null })
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (location_id) {
    if (!UUID_RE.test(location_id)) {
      return NextResponse.json({ error: "Invalid location_id" }, { status: 400 });
    }

    const { data: loc } = await supabase
      .from("locations")
      .select("id, active, type")
      .eq("id", location_id)
      .maybeSingle();

    if (!loc || !loc.active || loc.type !== "store") {
      return NextResponse.json({ error: "Showroom not found or inactive" }, { status: 404 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ active_show_id: null, active_location_id: loc.id })
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Provide either show_id or location_id" },
    { status: 400 },
  );
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_show_id: null, active_location_id: null })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
