"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fields safe to patch via inline edit from the contact detail page.
const ALLOWED_CONTACT_PATCH_FIELDS = new Set([
  "first_name",
  "last_name",
  "email_primary",
  "phone_primary",
  "dob",
  "address",
  "city",
  "state",
  "zip",
  "source",
  "score",
  "owner_id",
  "notes",
  "role_in_household",
]);

export async function updateContact(contactId: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_CONTACT_PATCH_FIELDS.has(key)) continue;
    if (value === "" || value === undefined) {
      clean[key] = null;
    } else {
      clean[key] = value;
    }
  }

  if (Object.keys(clean).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  // Normalize email to lowercase to align with the unique partial index
  // contacts_org_email_unique_idx (migration 046).
  if (typeof clean.email_primary === "string") {
    clean.email_primary = clean.email_primary.toLowerCase().trim() || null;
  }

  const { data: updated, error } = await supabase
    .from("contacts")
    .update(clean)
    .eq("id", contactId)
    .select("id, household_id")
    .single();

  if (error) {
    if ((error as any).code === "23505") {
      return { ok: false, error: "Another contact in this organization already uses that email." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/crm/contacts/${contactId}`);
  revalidatePath("/crm/contacts");
  if (updated?.household_id) revalidatePath(`/crm/households/${updated.household_id}`);

  return { ok: true };
}
