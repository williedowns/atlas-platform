import type { SupabaseClient } from "@supabase/supabase-js";
import { COORDINATOR_EMAIL, OK_KS_REP_EMAIL } from "./concrete-pad-team";
import { getProfileByEmail } from "./profile-lookup";

// ── Concrete Pad Estimate — assignment routing ───────────────────────────────
// When a sales rep flags a contract for a concrete pad estimate, the
// post-show site visit gets auto-routed based on the customer's state:
//
//   Oklahoma + Kansas       → Ryan Frank   (OK_KS_REP_EMAIL)
//   All other states / null → Alex Broyles (COORDINATOR_EMAIL)
//
// Alex can manually reassign individual estimates to Chip Stewart from the
// Site Visits page. The mapping below intentionally only covers the
// auto-routing step; reassignment is a UI action that overrides this value
// directly on the contract row.

const STATE_ROUTING: Record<string, string> = {
  OK: OK_KS_REP_EMAIL,
  KS: OK_KS_REP_EMAIL,
};

/**
 * Returns the profile UUID that should be assigned to a concrete pad
 * estimate based on the customer's state. Returns null if the lookup fails
 * (e.g., the assignee's profile doesn't exist) — caller should treat null
 * as "unassigned" and the row will surface in Site Visits with no owner.
 */
export async function assignConcretePadEstimate(
  supabase: SupabaseClient,
  customerState: string | null | undefined,
): Promise<string | null> {
  const normalized = customerState?.trim().toUpperCase();
  const email = (normalized && STATE_ROUTING[normalized]) ?? COORDINATOR_EMAIL;
  const profile = await getProfileByEmail(supabase, email);
  return profile?.id ?? null;
}
