import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set([
  "awaiting_customer_accept",
  "authorized_no_charge",
  "pending_funding",
  "partially_funded",
  "fully_funded",
  "failed",
  "manual_reconcile",
]);

const ALLOWED_KEYS = new Set([
  "funding_status",
  "funded_amount",
  "funded_at",
  "external_application_id",
  "external_charge_request_id",
  "external_status",
  "approval_number",
  "lifecycle_notes",
  "inhouse_app_status",
  "inhouse_app_sent_at",
  "inhouse_docusign_signed_at",
  "inhouse_app_notes",
]);

const ALLOWED_INHOUSE_STATUSES = new Set([
  "application_sent",
  "docusign_sent",
  "cleared_for_delivery",
  "in_repayment",
  "paid_off",
  "failed",
]);

// PATCH /api/contracts/[id]/financing/[idx]
// Two body shapes:
//   1. Field updates: { funding_status?, funded_amount?, external_application_id?, ... }
//      → REPLACES values on the financing entry.
//   2. Log a draw: { add_draw: { amount: number, reference?, notes? } }
//      → ACCUMULATES amount into funded_amount, appends a draw_history entry,
//        and auto-flips funding_status (partial / fully_funded). Use this when
//        Robert ran an ACH through GreenSky/WF/etc portal and is logging it
//        in Salta after the fact.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; idx: string }> }) {
  const { id, idx: idxStr } = await params;
  const idx = parseInt(idxStr, 10);
  if (isNaN(idx) || idx < 0) return NextResponse.json({ error: "invalid idx" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const isAddDraw = body && typeof body === "object" && body.add_draw && typeof body.add_draw === "object";

  if (!isAddDraw) {
    const updates: Record<string, unknown> = {};
    for (const k of Object.keys(body)) {
      if (ALLOWED_KEYS.has(k)) updates[k] = body[k];
    }
    if (updates.funding_status && !ALLOWED_STATUSES.has(String(updates.funding_status))) {
      return NextResponse.json({ error: "invalid funding_status" }, { status: 400 });
    }
    if (updates.inhouse_app_status && !ALLOWED_INHOUSE_STATUSES.has(String(updates.inhouse_app_status))) {
      return NextResponse.json({ error: "invalid inhouse_app_status" }, { status: 400 });
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "no allowed fields to update" }, { status: 400 });
    }

    const { data: contract, error: readError } = await supabase
      .from("contracts")
      .select("financing")
      .eq("id", id)
      .single();
    if (readError || !contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

    const arr = Array.isArray(contract.financing) ? [...contract.financing] : [];
    if (idx >= arr.length) return NextResponse.json({ error: "idx out of bounds" }, { status: 400 });
    arr[idx] = { ...(arr[idx] ?? {}), ...updates, updated_at: new Date().toISOString(), updated_by: user.id };

    const { error: writeError } = await supabase
      .from("contracts")
      .update({ financing: arr })
      .eq("id", id);
    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

    return NextResponse.json({ entry: arr[idx] });
  }

  // ─── add_draw: accumulate a portal-ACH draw on the entry ───────────────
  const drawAmount = Number(body.add_draw.amount);
  if (!Number.isFinite(drawAmount) || drawAmount <= 0) {
    return NextResponse.json({ error: "add_draw.amount must be a positive number" }, { status: 400 });
  }
  const reference: string | undefined = body.add_draw.reference;
  const notes: string | undefined = body.add_draw.notes;

  const { data: contract, error: readError } = await supabase
    .from("contracts")
    .select("financing")
    .eq("id", id)
    .single();
  if (readError || !contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const arr = Array.isArray(contract.financing) ? [...contract.financing] : [];
  if (idx >= arr.length) return NextResponse.json({ error: "idx out of bounds" }, { status: 400 });
  const entry = { ...(arr[idx] ?? {}) };

  const total = Number(entry.financed_amount ?? 0);
  const priorFunded = Number(entry.funded_amount ?? 0);
  const newFunded = priorFunded + drawAmount;
  const isFull = newFunded >= total - 0.01;
  const priorHistory = Array.isArray(entry.draw_history) ? entry.draw_history as Array<Record<string, unknown>> : [];

  arr[idx] = {
    ...entry,
    funded_amount: newFunded,
    funded_at: new Date().toISOString(),
    funding_status: isFull ? "fully_funded" : "partially_funded",
    draw_history: [
      ...priorHistory,
      {
        amount: drawAmount,
        reference: reference ?? null,
        notes: notes ?? null,
        drawn_at: new Date().toISOString(),
        drawn_by: user.id,
      },
    ],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const { error: writeError } = await supabase
    .from("contracts")
    .update({ financing: arr })
    .eq("id", id);
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  return NextResponse.json({ entry: arr[idx] });
}
