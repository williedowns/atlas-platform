// POST /api/admin/backfill-card-details
//
// One-shot backfill for payment rows that have an intuit_charge_id but
// NULL card_brand / card_last4 — historical charges captured before the
// charge route was reading Intuit's actual response shape (cardType +
// masked number instead of brand/last4). Calls Intuit's getCharge for
// each affected row and updates the columns.
//
// Admin-only. POST so it can't be triggered by an accidental GET.
//
// Optional ?contract_id=<uuid> query param scopes the backfill to one
// contract (useful for testing on a single record first).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCharge } from "@/lib/payments/intuit";

export async function POST(req: Request) {
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
  const contractId = searchParams.get("contract_id");

  const admin = createAdminClient();
  let query = admin
    .from("payments")
    .select("id, contract_id, intuit_charge_id, card_brand, card_last4")
    .not("intuit_charge_id", "is", null)
    .or("card_brand.is.null,card_last4.is.null");
  if (contractId) query = query.eq("contract_id", contractId);

  const { data: rows, error: selectError } = await query;
  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, skipped: 0, errors: [], message: "Nothing to backfill." });
  }

  let updated = 0;
  let skipped = 0;
  const errors: Array<{ payment_id: string; error: string }> = [];

  for (const row of rows) {
    try {
      const charge = await getCharge(row.intuit_charge_id as string);
      const brand = charge.card?.cardType ?? null;
      const masked = charge.card?.number ?? null;
      const last4 = masked ? String(masked).slice(-4) : null;

      if (!brand || !last4) {
        skipped++;
        continue;
      }

      const { error: updateError } = await admin
        .from("payments")
        .update({ card_brand: brand, card_last4: last4 })
        .eq("id", row.id);

      if (updateError) {
        errors.push({ payment_id: row.id, error: updateError.message });
      } else {
        updated++;
      }
    } catch (err) {
      errors.push({ payment_id: row.id, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, scanned: rows.length, updated, skipped, errors });
}
