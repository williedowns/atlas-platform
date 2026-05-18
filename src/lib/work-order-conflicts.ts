// Server-side crew conflict detection for delivery work orders.
//
// "Conflict" = same crew member assigned to another delivery on the same date.
// Free-text scheduled_window cannot be compared reliably, so we flag any
// same-date overlap and let staff decide (warning-only soft gate).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CrewConflict {
  crew_id: string;
  crew_name: string;
  conflicting_order_id: string;
  conflicting_contract_number: string | null;
  conflicting_window: string | null;
}

interface DetectParams {
  scheduledDate: string;
  crewIds: string[];
  excludeOrderId?: string;
}

export async function detectCrewConflicts(
  supabase: SupabaseClient,
  { scheduledDate, crewIds, excludeOrderId }: DetectParams,
): Promise<CrewConflict[]> {
  if (!scheduledDate || crewIds.length === 0) return [];

  let query = supabase
    .from("delivery_work_orders")
    .select(`
      id, assigned_crew_ids, scheduled_window,
      contract:contracts(contract_number)
    `)
    .eq("scheduled_date", scheduledDate)
    .not("status", "in", '("completed","cancelled")')
    .overlaps("assigned_crew_ids", crewIds);

  if (excludeOrderId) query = query.neq("id", excludeOrderId);

  const { data: orders } = await query;
  if (!orders || orders.length === 0) return [];

  // Build a name lookup for the conflicting crew members in one query
  const collidingIds = new Set<string>();
  for (const o of orders) {
    for (const id of (o.assigned_crew_ids ?? [])) {
      if (crewIds.includes(id)) collidingIds.add(id);
    }
  }
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", Array.from(collidingIds));

  const nameById = new Map<string, string>();
  for (const p of profiles ?? []) nameById.set(p.id, p.full_name);

  const conflicts: CrewConflict[] = [];
  for (const o of orders) {
    const contract = Array.isArray(o.contract) ? o.contract[0] : o.contract;
    for (const id of (o.assigned_crew_ids ?? [])) {
      if (crewIds.includes(id)) {
        conflicts.push({
          crew_id: id,
          crew_name: nameById.get(id) ?? "Unknown",
          conflicting_order_id: o.id,
          conflicting_contract_number: contract?.contract_number ?? null,
          conflicting_window: o.scheduled_window ?? null,
        });
      }
    }
  }
  return conflicts;
}

export function conflictSummary(conflicts: CrewConflict[]): string[] {
  return conflicts.map((c) => {
    const window = c.conflicting_window ? ` (${c.conflicting_window})` : "";
    return `${c.crew_name} already on ${c.conflicting_contract_number ?? "another order"}${window}`;
  });
}
