import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set([
  "not_started",
  "photo_uploaded",
  "submitted_to_lyon",
  "funded",
  "skipped",
]);

const ALLOWED_KEYS = new Set([
  "status",
  "photo_url",
  "customer_initial_status",
  "funded_amount",
  "funded_at",
  "notes",
]);

// PATCH /api/contracts/[id]/financing/[idx]/lyon-stage/[stage]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; idx: string; stage: string }> }) {
  const { id, idx: idxStr, stage: stageStr } = await params;
  const idx = parseInt(idxStr, 10);
  const stageNum = parseInt(stageStr, 10);
  if (isNaN(idx) || idx < 0 || isNaN(stageNum) || stageNum < 1) {
    return NextResponse.json({ error: "invalid idx or stage" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (ALLOWED_KEYS.has(k)) updates[k] = body[k];
  }
  if (updates.status && !ALLOWED_STATUSES.has(String(updates.status))) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no allowed fields" }, { status: 400 });
  }

  const { data: contract, error: readError } = await supabase
    .from("contracts")
    .select("financing, updated_at")
    .eq("id", id)
    .single();
  if (readError || !contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const arr = Array.isArray(contract.financing) ? [...contract.financing] : [];
  if (idx >= arr.length) return NextResponse.json({ error: "idx out of bounds" }, { status: 400 });
  const entry = { ...(arr[idx] ?? {}) };
  const stages = Array.isArray(entry.lyon_stages) ? [...entry.lyon_stages] : [];
  const stageIdx = stages.findIndex((s: any) => s.stage_num === stageNum);
  if (stageIdx === -1) return NextResponse.json({ error: "stage not found" }, { status: 404 });

  stages[stageIdx] = { ...stages[stageIdx], ...updates };

  // Auto-roll up entry-level funding_status if any stage was just marked funded
  entry.lyon_stages = stages;
  const fundedTotal = stages
    .filter((s: any) => s.status === "funded")
    .reduce((sum: number, s: any) => sum + (s.funded_amount ?? 0), 0);
  entry.funded_amount = fundedTotal;
  if (fundedTotal >= (entry.financed_amount ?? 0) - 0.01) entry.funding_status = "fully_funded";
  else if (fundedTotal > 0) entry.funding_status = "partially_funded";

  arr[idx] = { ...entry, updated_at: new Date().toISOString(), updated_by: user.id };

  // Optimistic concurrency: only commit if updated_at hasn't changed since we
  // read it. Stale writes get 409; client must refetch and retry.
  const { data: updated, error: writeError } = await supabase
    .from("contracts")
    .update({ financing: arr })
    .eq("id", id)
    .eq("updated_at", contract.updated_at)
    .select("id");
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "Conflict — another change landed first. Refetch and retry." },
      { status: 409 }
    );
  }

  return NextResponse.json({ stage: stages[stageIdx] });
}
