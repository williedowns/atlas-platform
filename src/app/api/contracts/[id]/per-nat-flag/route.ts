import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

const VALID_REASONS = new Set([
  "low_deposit",
  "future_delivery",
  "special_order",
  "manual",
]);

// PATCH /api/contracts/[id]/per-nat-flag
// Body: { is_per_nat: boolean, reason?: 'low_deposit'|'future_delivery'|'special_order'|'manual' }
//
// Toggles the Per Nat flag on a contract. Admin/manager only — matches
// the edit policy chosen for post-sale contract modifications.
//
// When is_per_nat=true, `reason` is required.
// When is_per_nat=false, `reason` must be omitted/null and is cleared on the row.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    return NextResponse.json(
      { error: "Only admin or manager can change the Per Nat flag after contract creation." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const isPerNat: unknown = (body as { is_per_nat?: unknown }).is_per_nat;
  const reasonRaw: unknown = (body as { reason?: unknown }).reason;

  if (typeof isPerNat !== "boolean") {
    return NextResponse.json({ error: "is_per_nat must be a boolean" }, { status: 400 });
  }

  let nextReason: string | null = null;
  if (isPerNat) {
    if (typeof reasonRaw !== "string" || !VALID_REASONS.has(reasonRaw)) {
      return NextResponse.json(
        { error: "reason is required and must be one of: low_deposit, future_delivery, special_order, manual" },
        { status: 400 }
      );
    }
    nextReason = reasonRaw;
  }

  const { data: existing } = await supabase
    .from("contracts")
    .select("is_per_nat, per_nat_reason, contract_number")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("contracts")
    .update({
      is_per_nat: isPerNat,
      per_nat_reason: nextReason,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: isPerNat ? "contract.per_nat_flagged" : "contract.per_nat_unflagged",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: existing.contract_number,
      previous: { is_per_nat: existing.is_per_nat, reason: existing.per_nat_reason ?? null },
      next: { is_per_nat: isPerNat, reason: nextReason },
    },
    req,
  });

  return NextResponse.json({ is_per_nat: isPerNat, per_nat_reason: nextReason });
}
