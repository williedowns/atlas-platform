"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendSms, isTwilioSendingConfigured, normalizePhoneE164 } from "@/lib/twilio";

export type ActivityType =
  | "note"
  | "call"
  | "sms"
  | "email"
  | "meeting"
  | "task"
  | "system";

export interface LogActivityInput {
  type: ActivityType;
  body: string;
  contactId?: string | null;
  opportunityId?: string | null;
  householdId?: string | null;
  direction?: "inbound" | "outbound" | null;
  durationSeconds?: number | null;
  occurredAt?: string | null;
}

/**
 * Log an activity row against a contact / opportunity / household.
 * Server action — runs with the user's session, so RLS + the
 * auto_set_organization_id trigger gate inserts correctly.
 */
export async function logActivity(input: LogActivityInput) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated." };
  }

  if (!input.contactId && !input.opportunityId && !input.householdId) {
    return { ok: false, error: "Activity must attach to a contact, opportunity, or household." };
  }

  if (!input.body?.trim()) {
    return { ok: false, error: "Activity body is required." };
  }

  // Auto-bubble household_id from the contact / opportunity so household
  // timelines aggregate naturally without callers needing to know about it.
  let resolvedHouseholdId = input.householdId ?? null;
  if (!resolvedHouseholdId && input.contactId) {
    const { data: c } = await supabase
      .from("contacts")
      .select("household_id")
      .eq("id", input.contactId)
      .single();
    if (c?.household_id) resolvedHouseholdId = c.household_id;
  }
  if (!resolvedHouseholdId && input.opportunityId) {
    const { data: o } = await supabase
      .from("opportunities")
      .select("household_id")
      .eq("id", input.opportunityId)
      .single();
    if (o?.household_id) resolvedHouseholdId = o.household_id;
  }

  const payload: Record<string, unknown> = {
    type: input.type,
    body: input.body.trim(),
    contact_id: input.contactId ?? null,
    opportunity_id: input.opportunityId ?? null,
    household_id: resolvedHouseholdId,
    direction: input.direction ?? null,
    duration_seconds: input.durationSeconds ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    created_by: user.id,
    metadata: {},
  };

  const { data: insertedRow, error } = await supabase
    .from("activities")
    .insert(payload)
    .select("id, organization_id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  // --- Outbound SMS: when a rep logs type=sms AND direction=outbound on a
  // contact, also actually SEND the message via Twilio. The activity row is
  // already saved as our system-of-record; the send result is appended to
  // its metadata. If Twilio isn't configured (no env vars) or the 10DLC
  // brand isn't approved yet, the activity remains as a "logged but not
  // sent" record and the caller gets a warning. ---
  let warning: string | null = null;
  if (
    input.type === "sms" &&
    input.direction === "outbound" &&
    input.contactId &&
    isTwilioSendingConfigured()
  ) {
    // Pull the contact's phone to know where to send
    const { data: contact } = await supabase
      .from("contacts")
      .select("phone_primary")
      .eq("id", input.contactId)
      .single();

    const to = normalizePhoneE164(contact?.phone_primary ?? null);
    if (!to) {
      warning = "Logged but not sent — contact has no usable phone number.";
    } else {
      const result = await sendSms({ to, body: input.body });
      if (result.ok) {
        // Append twilio_sid to the activity metadata + mirror to sms_log
        await supabase
          .from("activities")
          .update({
            metadata: {
              ...(payload.metadata as object),
              twilio_sid: result.sid,
              twilio_status: result.status,
              sent_at: new Date().toISOString(),
            },
          })
          .eq("id", insertedRow.id);

        await supabase.from("sms_log").insert({
          contact_id: input.contactId,
          direction: "outbound",
          twilio_sid: result.sid,
          to_number: to,
          body: input.body,
          status: result.status ?? "queued",
          sent_at: new Date().toISOString(),
        });
      } else {
        // Tag the activity so reps see the send failed (and why)
        await supabase
          .from("activities")
          .update({
            metadata: {
              ...(payload.metadata as object),
              twilio_error: result.error,
              twilio_error_code: result.errorCode,
              attempted_at: new Date().toISOString(),
            },
          })
          .eq("id", insertedRow.id);
        warning = `SMS logged but not delivered: ${result.error}${
          result.errorCode === 30034
            ? " (Code 30034 = 10DLC brand not yet approved — common until carrier vetting completes)"
            : ""
        }`;
      }
    }
  }

  // Also bump the parent record's last_activity_at so list views sort fresh
  if (input.contactId) {
    await supabase
      .from("contacts")
      .update({ last_activity_at: payload.occurred_at })
      .eq("id", input.contactId);
    revalidatePath(`/crm/contacts/${input.contactId}`);
  }
  if (input.opportunityId) {
    revalidatePath(`/crm/opportunities/${input.opportunityId}`);
  }
  if (resolvedHouseholdId) {
    revalidatePath(`/crm/households/${resolvedHouseholdId}`);
  }

  return { ok: true, warning };
}
