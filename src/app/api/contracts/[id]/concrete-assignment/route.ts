import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { COORDINATOR_EMAIL } from "@/lib/concrete-pad-team";
import { getProfileByEmail } from "@/lib/profile-lookup";

// ── Concrete pad estimate reassignment ───────────────────────────────────────
// Alex Broyles (the default coordinator) can hand off individual estimates
// to Chip Stewart from the Site Visits page. This endpoint exists as a
// separate route from /api/contracts/[id]/assignment because:
//   1. The site-visit assignee is sales_rep, not admin/manager — the existing
//      endpoint's requireAdminOrManager() gate would block Alex.
//   2. The existing endpoint archives the customer-facing contract PDF on
//      assignment change. Reassigning a site visit doesn't alter the signed
//      contract document, so PDF archival is not appropriate here.

interface ConcreteAssignmentBody {
  concrete_estimate_assigned_to?: string | null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only the coordinator can reassign concrete pad estimates. Look up by
  // email so a profile re-create or environment swap doesn't break the gate.
  const coordinatorProfile = await getProfileByEmail(supabase, COORDINATOR_EMAIL);
  if (!coordinatorProfile || coordinatorProfile.id !== user.id) {
    return NextResponse.json(
      { error: "Only the concrete pad coordinator can reassign estimates." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as ConcreteAssignmentBody;
  if (
    !Object.prototype.hasOwnProperty.call(body, "concrete_estimate_assigned_to")
  ) {
    return NextResponse.json(
      { error: "concrete_estimate_assigned_to is required (string or null)." },
      { status: 400 },
    );
  }
  const target = body.concrete_estimate_assigned_to;
  if (target !== null && (typeof target !== "string" || target.length === 0)) {
    return NextResponse.json(
      {
        error:
          "concrete_estimate_assigned_to must be a non-empty UUID string or null.",
      },
      { status: 400 },
    );
  }

  // Validate the target profile exists (when not clearing). Avoids dangling
  // FK errors and gives a clearer 400 than a 500 from the DB layer.
  if (target) {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", target)
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json(
        {
          error:
            "concrete_estimate_assigned_to does not reference a valid profile.",
        },
        { status: 400 },
      );
    }
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_number, concrete_estimate_assigned_to")
    .eq("id", id)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const { error: writeError } = await supabase
    .from("contracts")
    .update({ concrete_estimate_assigned_to: target })
    .eq("id", id);
  if (writeError) {
    return NextResponse.json({ error: writeError.message }, { status: 500 });
  }

  logAction({
    userId: user.id,
    action: "contract.concrete_assignment_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      before: { concrete_estimate_assigned_to: contract.concrete_estimate_assigned_to },
      after: { concrete_estimate_assigned_to: target },
    },
    req,
  });

  return NextResponse.json({ ok: true });
}
