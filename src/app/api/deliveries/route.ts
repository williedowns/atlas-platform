import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateReadiness, blockerLabels } from "@/lib/readiness";
import { detectCrewConflicts, conflictSummary } from "@/lib/work-order-conflicts";

// POST /api/deliveries
// Body: {
//   contract_id, scheduled_date, scheduled_window?, delivery_address?,
//   special_instructions?, assigned_crew_ids?,
//   override_readiness?: boolean, override_reason?: string,
//   override_conflicts?: boolean, conflict_reason?: string
// }
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    contract_id,
    scheduled_date,
    scheduled_window,
    delivery_address,
    special_instructions,
    assigned_crew_ids,
    override_readiness,
    override_reason,
    override_conflicts,
    conflict_reason,
  } = body;

  if (!contract_id || !scheduled_date) {
    return NextResponse.json({ error: "contract_id and scheduled_date are required" }, { status: 400 });
  }

  // Pull caller role and contract in parallel — independent queries.
  const [{ data: callerProfile }, { data: contract }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("contracts")
      .select(`
        id, status, balance_due, financing, customer_id,
        needs_permit, permit_status, needs_hoa, hoa_status
      `)
      .eq("id", contract_id)
      .single(),
  ]);
  const isAdminOrManager = ["admin", "manager"].includes(callerProfile?.role ?? "");

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  let dlPresent = false;
  if (contract.customer_id) {
    const { data: dl } = await supabase
      .from("customer_files")
      .select("id")
      .eq("customer_id", contract.customer_id)
      .eq("category", "drivers_license")
      .limit(1);
    dlPresent = (dl ?? []).length > 0;
  }

  const readiness = evaluateReadiness(contract, dlPresent);

  if (!readiness.ok && !override_readiness) {
    return NextResponse.json(
      {
        error: "Readiness check failed",
        blockers: blockerLabels(readiness),
        can_override: isAdminOrManager,
      },
      { status: 409 },
    );
  }

  // Role gate on the override path
  if (override_readiness && !isAdminOrManager) {
    return NextResponse.json(
      { error: "Only admins and managers can override the readiness gate." },
      { status: 403 },
    );
  }

  if (override_readiness && !(override_reason ?? "").trim()) {
    return NextResponse.json(
      { error: "Override reason is required." },
      { status: 400 },
    );
  }

  // Crew schedule conflict check (warning-only soft gate, runs after readiness passes/overridden).
  const crewIds = Array.isArray(assigned_crew_ids) ? assigned_crew_ids : [];
  if (crewIds.length > 0 && !override_conflicts) {
    const conflicts = await detectCrewConflicts(supabase, {
      scheduledDate: scheduled_date,
      crewIds,
    });
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "Crew schedule conflict",
          conflicts: conflictSummary(conflicts),
          can_override_conflicts: true,
        },
        { status: 409 },
      );
    }
  }

  // If overriding conflicts with a reason, append it to special_instructions for audit.
  const finalInstructions = override_conflicts && conflict_reason
    ? [special_instructions, `Conflict override: ${conflict_reason}`].filter(Boolean).join("\n")
    : special_instructions;

  const { data: dwo, error } = await supabase
    .from("delivery_work_orders")
    .insert({
      contract_id,
      scheduled_date,
      scheduled_window: scheduled_window ?? null,
      delivery_address: delivery_address ?? null,
      special_instructions: finalInstructions ?? null,
      assigned_crew_ids: crewIds,
      readiness_overridden: !!override_readiness,
      readiness_overridden_by: override_readiness ? user.id : null,
      readiness_override_reason: override_readiness ? (override_reason ?? null) : null,
      status: "scheduled",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ delivery: dwo }, { status: 201 });
}
