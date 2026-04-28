import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/deliveries
// Body: {
//   contract_id, scheduled_date, scheduled_window?, delivery_address?,
//   special_instructions?, assigned_crew_ids?,
//   override_readiness?: boolean, override_reason?: string
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
  } = body;

  if (!contract_id || !scheduled_date) {
    return NextResponse.json({ error: "contract_id and scheduled_date are required" }, { status: 400 });
  }

  // Pull contract + DL files to evaluate readiness server-side
  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, status, balance_due, financing, customer_id,
      needs_permit, permit_status, needs_hoa, hoa_status
    `)
    .eq("id", contract_id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const financing = Array.isArray(contract.financing) ? contract.financing : (contract.financing ? [contract.financing] : []);
  const hasFinancing = financing.length > 0;

  let dlOk = true;
  if (hasFinancing && contract.customer_id) {
    const { data: dl } = await supabase
      .from("customer_files")
      .select("id")
      .eq("customer_id", contract.customer_id)
      .eq("category", "drivers_license")
      .limit(1);
    dlOk = (dl ?? []).length > 0;
  }

  const balanceCleared = (contract.balance_due ?? 0) <= 0.01;
  const permitOk = !contract.needs_permit || contract.permit_status === "approved";
  const hoaOk = !contract.needs_hoa || contract.hoa_status === "approved";
  const readinessOk = balanceCleared && dlOk && permitOk && hoaOk;

  if (!readinessOk && !override_readiness) {
    const blockers: string[] = [];
    if (!balanceCleared) blockers.push("balance not cleared");
    if (!dlOk) blockers.push("driver's license missing");
    if (!permitOk) blockers.push(`permit status: ${contract.permit_status ?? "not started"}`);
    if (!hoaOk) blockers.push(`HOA status: ${contract.hoa_status ?? "not started"}`);
    return NextResponse.json(
      { error: "Readiness check failed", blockers, can_override: true },
      { status: 409 }
    );
  }

  const { data: dwo, error } = await supabase
    .from("delivery_work_orders")
    .insert({
      contract_id,
      scheduled_date,
      scheduled_window: scheduled_window ?? null,
      delivery_address: delivery_address ?? null,
      special_instructions: special_instructions ?? null,
      assigned_crew_ids: Array.isArray(assigned_crew_ids) ? assigned_crew_ids : [],
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
