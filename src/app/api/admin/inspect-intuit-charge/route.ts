// GET /api/admin/inspect-intuit-charge?id=<intuit_charge_id>
//
// Admin-only diagnostic. Calls Intuit's getCharge endpoint and returns the
// raw response so we can see the actual response shape — specifically where
// card brand and last 4 live. Intuit's response uses different field names
// than our charge route currently assumes (card.brand / card.last4 are null
// on every row), so we use this to discover the real keys before patching
// the field mapping.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCharge } from "@/lib/payments/intuit";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id query param" }, { status: 400 });
  }

  try {
    const charge = await getCharge(id);
    return NextResponse.json({
      ok: true,
      top_level_keys: Object.keys(charge),
      card_keys: (charge as { card?: object }).card ? Object.keys((charge as { card: object }).card) : null,
      raw: charge,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
