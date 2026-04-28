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
]);

// PATCH /api/contracts/[id]/financing/[idx]
// Updates a single financing entry within the contract's financing array.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; idx: string }> }) {
  const { id, idx: idxStr } = await params;
  const idx = parseInt(idxStr, 10);
  if (isNaN(idx) || idx < 0) return NextResponse.json({ error: "invalid idx" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (ALLOWED_KEYS.has(k)) updates[k] = body[k];
  }
  if (updates.funding_status && !ALLOWED_STATUSES.has(String(updates.funding_status))) {
    return NextResponse.json({ error: "invalid funding_status" }, { status: 400 });
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no allowed fields to update" }, { status: 400 });
  }

  // Pull current financing array, mutate the indexed entry, write back
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
