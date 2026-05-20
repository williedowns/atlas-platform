import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { DEFAULT_LOW_DEPOSIT_THRESHOLD } from "@/lib/low-deposit";

interface AssignBody {
  inventory_unit_id?: string;
  serial_number?: string;
}

interface ReleaseBody {
  reason?: string;
}

// POST /api/contracts/[id]/inventory-unit
// Body: { inventory_unit_id: string }
// Assigns a specific stock unit (by serial) to this contract. Admin/manager
// only.
//
// 30% deposit guardrail (Natalie's transcript 2026-05-20): a stock unit can
// only be tagged to a contract when the customer has at least 30% down
// (cash + financing combined). Returns 400 with a customer-facing message
// matching Natalie's quote when the guardrail trips.
//
// The DB trigger trg_inventory_unit_assignment_history opens an
// inventory_unit_assignments row automatically on the contract_id update.
export async function POST(
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
      { error: "Only admin or manager can assign an inventory unit after contract creation." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as AssignBody;
  let unitId = typeof body.inventory_unit_id === "string" && body.inventory_unit_id.length > 0
    ? body.inventory_unit_id
    : null;
  const serial = typeof body.serial_number === "string" && body.serial_number.trim().length > 0
    ? body.serial_number.trim()
    : null;

  if (!unitId && !serial) {
    return NextResponse.json(
      { error: "inventory_unit_id or serial_number is required" },
      { status: 400 }
    );
  }

  if (!unitId && serial) {
    const { data: lookup } = await supabase
      .from("inventory_units")
      .select("id")
      .eq("serial_number", serial)
      .maybeSingle();
    if (!lookup) {
      return NextResponse.json(
        { error: `No inventory unit found with serial ${serial}.` },
        { status: 404 }
      );
    }
    unitId = lookup.id;
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_number, total, deposit_paid, financing, status")
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // 30% guardrail. Counts deposit_paid plus the sum of financing entries
  // that deduct from balance (Wells Fargo / GreenSky / In-house). Foundation
  // entries which "carry to balance" don't count.
  const total = Number(contract.total ?? 0);
  const depositPaid = Number(contract.deposit_paid ?? 0);
  const financingArr = Array.isArray(contract.financing) ? contract.financing : [];
  const financedDeducting = financingArr.reduce((sum: number, f: { financed_amount?: number; deduct_from_balance?: boolean }) => {
    if (f.deduct_from_balance !== false) return sum + Number(f.financed_amount ?? 0);
    return sum;
  }, 0);
  const securedFraction = total > 0 ? (depositPaid + financedDeducting) / total : 0;

  if (total > 0 && securedFraction < DEFAULT_LOW_DEPOSIT_THRESHOLD) {
    return NextResponse.json(
      {
        error: "You have to add at least a 30% deposit in order to tag it.",
        code: "deposit_below_30_pct",
        details: {
          total,
          deposit_paid: depositPaid,
          financed_deducting: financedDeducting,
          pct: Number((securedFraction * 100).toFixed(2)),
          threshold_pct: DEFAULT_LOW_DEPOSIT_THRESHOLD * 100,
        },
      },
      { status: 400 }
    );
  }

  // Verify the unit exists and is currently available.
  const { data: unit } = await supabase
    .from("inventory_units")
    .select("id, serial_number, contract_id, status")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return NextResponse.json({ error: "Inventory unit not found" }, { status: 404 });
  if (unit.contract_id && unit.contract_id !== id) {
    return NextResponse.json(
      { error: "That unit is currently assigned to another contract." },
      { status: 409 }
    );
  }

  // Capture the prior contract_id so we can backfill released_by on the row
  // the trigger is about to close (Supabase doesn't expose PG GUCs from JS,
  // so the trigger writes released_by=NULL — we patch it after the update).
  const priorContractId = unit.contract_id;

  const { error: updateError } = await supabase
    .from("inventory_units")
    .update({
      contract_id: id,
      status: "allocated",
    })
    .eq("id", unitId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (priorContractId && priorContractId !== id) {
    await supabase
      .from("inventory_unit_assignments")
      .update({ released_by: user.id })
      .eq("inventory_unit_id", unitId)
      .eq("contract_id", priorContractId)
      .is("released_by", null)
      .not("released_at", "is", null);
  }

  logAction({
    userId: user.id,
    action: "contract.inventory_unit_assigned",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      inventory_unit_id: unitId,
      serial_number: unit.serial_number,
      secured_pct: Number((securedFraction * 100).toFixed(2)),
    },
    req,
  });

  return NextResponse.json({
    inventory_unit_id: unitId,
    serial_number: unit.serial_number,
  });
}

// DELETE /api/contracts/[id]/inventory-unit
// Body: { reason?: string }
// Releases whichever unit is currently assigned to this contract. Admin/manager only.
// The DB trigger closes the open inventory_unit_assignments row.
export async function DELETE(
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
      { error: "Only admin or manager can release an inventory unit." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as ReleaseBody;
  const reason = typeof body.reason === "string" && body.reason.trim().length > 0
    ? body.reason.trim()
    : null;

  const { data: contract } = await supabase
    .from("contracts")
    .select("contract_number")
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // Find currently-assigned unit(s) for this contract.
  const { data: units } = await supabase
    .from("inventory_units")
    .select("id, serial_number")
    .eq("contract_id", id);

  if (!units || units.length === 0) {
    return NextResponse.json({ error: "No inventory unit currently assigned to this contract." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("inventory_units")
    .update({
      contract_id: null,
      status: "at_location",
    })
    .eq("contract_id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Backfill released_by on the rows the trigger just closed (Supabase JS
  // can't set the app.actor_id PG GUC, so we patch after the fact).
  await supabase
    .from("inventory_unit_assignments")
    .update({ released_by: user.id })
    .in("inventory_unit_id", units.map((u) => u.id))
    .eq("contract_id", id)
    .is("released_by", null)
    .not("released_at", "is", null);

  // Annotate the released history row with the reason (if provided). Targets
  // any row this contract just closed in the trigger.
  if (reason) {
    await supabase
      .from("inventory_unit_assignments")
      .update({ release_reason: reason })
      .in("inventory_unit_id", units.map((u) => u.id))
      .eq("contract_id", id);
  }

  logAction({
    userId: user.id,
    action: "contract.inventory_unit_released",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      released_units: units.map((u) => ({ id: u.id, serial_number: u.serial_number })),
      reason,
    },
    req,
  });

  return NextResponse.json({ released: units.length });
}
