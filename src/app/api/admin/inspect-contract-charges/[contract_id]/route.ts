// GET /api/admin/inspect-contract-charges/[contract_id]
//
// Admin-only. Fetches all payments on a contract that have an
// intuit_charge_id, calls Intuit's getCharge for each, and returns the raw
// responses so we can see the actual card-object shape. No writes.
//
// Usage: swap "/contracts/<id>" with "/api/admin/inspect-contract-charges/<id>"
// in any browser URL — no need to look up the Intuit charge ID separately.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCharge } from "@/lib/payments/intuit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contract_id: string }> }
) {
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

  const { contract_id } = await params;
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from("payments")
    .select("id, method, status, amount, intuit_charge_id, card_brand, card_last4")
    .eq("contract_id", contract_id)
    .not("intuit_charge_id", "is", null);

  if (!payments || payments.length === 0) {
    return NextResponse.json({ ok: true, contract_id, message: "No payments with intuit_charge_id on this contract." });
  }

  const inspections = await Promise.all(
    payments.map(async (p) => {
      try {
        const charge = await getCharge(p.intuit_charge_id as string);
        return {
          payment_id: p.id,
          intuit_charge_id: p.intuit_charge_id,
          stored: { card_brand: p.card_brand, card_last4: p.card_last4 },
          top_level_keys: Object.keys(charge),
          card_keys: (charge as { card?: object }).card ? Object.keys((charge as { card: object }).card) : null,
          raw: charge,
        };
      } catch (err) {
        return {
          payment_id: p.id,
          intuit_charge_id: p.intuit_charge_id,
          error: String(err),
        };
      }
    })
  );

  return NextResponse.json({ ok: true, contract_id, count: inspections.length, inspections });
}
