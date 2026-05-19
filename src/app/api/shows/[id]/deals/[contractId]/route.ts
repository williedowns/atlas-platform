import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  NUMERIC_OVERRIDE_FIELDS,
  OVERRIDE_FIELDS,
  type WorkbookDealOverride,
} from "@/lib/show-sales/workbook-deal";

export const dynamic = "force-dynamic";

/**
 * Upsert workbook overrides for a single deal (contract).
 *
 * Body: a partial WorkbookDealOverride. Only whitelisted keys are accepted.
 * Empty strings are coerced to null; numeric fields are parsed from strings.
 * RLS does the org-scoping; we only enforce role + show-membership here.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; contractId: string }> },
) {
  const { id: showId, contractId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify the contract belongs to this show (so editing /shows/A/deals/B
  // can't touch a contract that's on show C).
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select("id, show_id")
    .eq("id", contractId)
    .single();
  if (contractErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.show_id !== showId) {
    return NextResponse.json({ error: "Contract not on this show" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const numericFields = new Set<string>(NUMERIC_OVERRIDE_FIELDS as readonly string[]);
  const allowed = new Set<string>(OVERRIDE_FIELDS as readonly string[]);

  const update: Partial<WorkbookDealOverride> = {};
  for (const [k, rawV] of Object.entries(body)) {
    if (!allowed.has(k)) continue;
    let v: unknown = rawV;
    if (v === "" || v === undefined) v = null;
    if (v !== null && numericFields.has(k)) {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      v = Number.isFinite(n) ? n : null;
    }
    (update as Record<string, unknown>)[k] = v;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields in body" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("show_deal_overrides")
    .upsert(
      { contract_id: contractId, updated_by: user.id, ...update },
      { onConflict: "contract_id" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ override: row });
}
