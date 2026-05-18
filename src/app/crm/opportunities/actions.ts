"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fields that can be safely patched on an opportunity from the detail UI.
// Adding a field here makes it inline-editable.
const ALLOWED_PATCH_FIELDS = new Set([
  "name",
  "value_estimate",
  "value_actual",
  "expected_close_date",
  "source",
  "interest_category",
  "owner_id",
  "primary_contact_id",
  "household_id",
  "notes",
  "lost_reason",
  "lost_notes",
]);

/**
 * Generic partial update for an opportunity. Used by the inline-edit UX
 * on the detail page. Field allowlist prevents the client from setting
 * status / pipeline_id / contract_id / system timestamps via this path —
 * those have dedicated actions (moveOpportunityStage, etc).
 */
export async function updateOpportunity(
  opportunityId: string,
  patch: Record<string, unknown>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) continue;
    // Normalize empty strings to null so optional text fields can be cleared.
    if (value === "" || value === undefined) {
      clean[key] = null;
    } else {
      clean[key] = value;
    }
  }

  if (Object.keys(clean).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { data: updated, error } = await supabase
    .from("opportunities")
    .update(clean)
    .eq("id", opportunityId)
    .select("id, primary_contact_id, household_id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/crm/opportunities/${opportunityId}`);
  revalidatePath("/crm/pipeline");
  if (updated?.primary_contact_id) revalidatePath(`/crm/contacts/${updated.primary_contact_id}`);
  if (updated?.household_id) revalidatePath(`/crm/households/${updated.household_id}`);

  return { ok: true };
}

interface LostReasonInput {
  opportunityId: string;
  reason: string;
  notes?: string | null;
}

/**
 * Specifically for replacing the "needs_reason" placeholder set by the stage
 * move when an opportunity is dragged to a Lost stage. Logs an activity
 * documenting the reason so the timeline tells the story.
 */
export async function setLostReason(input: LostReasonInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  if (!input.reason?.trim()) {
    return { ok: false, error: "Reason is required." };
  }

  const { data: opp, error } = await supabase
    .from("opportunities")
    .update({
      lost_reason: input.reason.trim(),
      lost_notes: input.notes?.trim() || null,
    })
    .eq("id", input.opportunityId)
    .select("id, primary_contact_id, household_id, name")
    .single();

  if (error) return { ok: false, error: error.message };

  // Log an activity so the rep + manager can see who set the reason and when
  await supabase.from("activities").insert({
    type: "system",
    body: `Lost reason set: ${input.reason.trim()}${input.notes?.trim() ? ` — ${input.notes.trim()}` : ""}`,
    opportunity_id: input.opportunityId,
    contact_id: opp?.primary_contact_id ?? null,
    household_id: opp?.household_id ?? null,
    created_by: user.id,
    occurred_at: new Date().toISOString(),
    metadata: { reason: input.reason.trim(), notes: input.notes?.trim() ?? null },
  });

  revalidatePath(`/crm/opportunities/${input.opportunityId}`);
  if (opp?.primary_contact_id) revalidatePath(`/crm/contacts/${opp.primary_contact_id}`);
  if (opp?.household_id) revalidatePath(`/crm/households/${opp.household_id}`);

  return { ok: true };
}

export async function moveOpportunityStage(opportunityId: string, newStageId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated." };
  }

  // Look up the destination stage to enforce cross-pipeline integrity.
  const { data: stage, error: stageErr } = await supabase
    .from("pipeline_stages")
    .select("id, pipeline_id, name, is_won, is_lost, probability")
    .eq("id", newStageId)
    .single();

  if (stageErr || !stage) {
    return { ok: false, error: "Destination stage not found." };
  }

  // Confirm the opportunity is in the same pipeline as the destination stage,
  // and capture the current stage for the activity log.
  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .select(`
      id, pipeline_id, status, name, primary_contact_id, household_id,
      current_stage:pipeline_stages!stage_id(id, name)
    `)
    .eq("id", opportunityId)
    .single();

  if (oppErr || !opp) {
    return { ok: false, error: "Opportunity not found." };
  }

  if (opp.pipeline_id !== stage.pipeline_id) {
    return { ok: false, error: "Stage belongs to a different pipeline." };
  }

  const fromStage = (opp.current_stage as any) ?? null;

  // No-op if same stage
  if (fromStage?.id === newStageId) {
    return { ok: true };
  }

  // Compute derived fields when transitioning to won / lost
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    stage_id: newStageId,
    probability: stage.probability,
    // Reset the "time in current stage" clock. This is the column the
    // forecast at-risk calculation reads. Stays constant on edits to other
    // fields — only stage moves reset it.
    stage_entered_at: nowIso,
  };

  if (stage.is_won) {
    update.status = "won";
    update.won_at = nowIso;
  } else if (stage.is_lost) {
    update.status = "lost";
    update.lost_at = nowIso;
    // The lost_reason CHECK constraint requires a reason. We default to a
    // placeholder so the stage move doesn't fail; the rep can fill in the
    // real reason on the detail page.
    update.lost_reason = "needs_reason";
  } else {
    update.status = "open";
  }

  const { error: updateErr } = await supabase
    .from("opportunities")
    .update(update)
    .eq("id", opportunityId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  // Auto-log the stage change as an activity so the timeline tells the story.
  // Fire-and-forget: if it fails we still consider the move a success.
  const fromName = fromStage?.name ?? "(none)";
  const toName = stage.name ?? "(unknown)";
  const summaryLine = stage.is_won
    ? `Stage moved: ${fromName} → ${toName} — marked WON`
    : stage.is_lost
      ? `Stage moved: ${fromName} → ${toName} — marked LOST`
      : `Stage moved: ${fromName} → ${toName}`;

  await supabase.from("activities").insert({
    type: "stage_change",
    body: summaryLine,
    opportunity_id: opportunityId,
    contact_id: opp.primary_contact_id ?? null,
    household_id: opp.household_id ?? null,
    created_by: user.id,
    occurred_at: new Date().toISOString(),
    metadata: {
      from_stage_id: fromStage?.id ?? null,
      from_stage_name: fromName,
      to_stage_id: newStageId,
      to_stage_name: toName,
      is_won: stage.is_won,
      is_lost: stage.is_lost,
    },
  });

  revalidatePath("/crm/pipeline");
  revalidatePath(`/crm/opportunities/${opportunityId}`);
  if (opp.primary_contact_id) revalidatePath(`/crm/contacts/${opp.primary_contact_id}`);
  if (opp.household_id) revalidatePath(`/crm/households/${opp.household_id}`);

  return { ok: true };
}
