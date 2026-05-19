"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fields safe to patch via inline edit from the household detail page.
const ALLOWED_HOUSEHOLD_PATCH_FIELDS = new Set([
  "name",
  "household_type",
  "lifecycle_stage",
  "primary_address",
  "city",
  "state",
  "zip",
  "source",
  "score",
  "owner_id",
  "primary_location_id",
  "marketing_eligible",
  "notes",
]);

export async function updateHousehold(householdId: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_HOUSEHOLD_PATCH_FIELDS.has(key)) continue;
    if (value === "" || value === undefined) {
      clean[key] = null;
    } else {
      clean[key] = value;
    }
  }

  if (Object.keys(clean).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { error } = await supabase
    .from("households")
    .update(clean)
    .eq("id", householdId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/crm/households/${householdId}`);
  revalidatePath("/crm/households");

  return { ok: true };
}

interface CreateHouseholdInput {
  name: string;
  household_type?: "residential" | "commercial" | "hoa" | "referral";
  lifecycle_stage?: "lead" | "mql" | "sql" | "customer" | "inactive";
  primary_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  source?: string | null;
  notes?: string | null;
  /** Optional: link an existing contact to this household on creation. */
  initialContactId?: string | null;
  initialContactRole?: "primary" | "partner" | "child" | "other" | null;
}

/**
 * Create a new household; optionally link an initial contact to it.
 * Returns the new household id on success.
 */
export async function createHousehold(input: CreateHouseholdInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  if (!input.name?.trim()) {
    return { ok: false, error: "Household name is required." };
  }

  const { data: household, error: hhErr } = await supabase
    .from("households")
    .insert({
      name: input.name.trim(),
      household_type: input.household_type ?? "residential",
      lifecycle_stage: input.lifecycle_stage ?? "lead",
      primary_address: input.primary_address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zip: input.zip?.trim() || null,
      source: input.source?.trim() || null,
      notes: input.notes?.trim() || null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (hhErr || !household) {
    return { ok: false, error: hhErr?.message ?? "Failed to create household." };
  }

  // Optionally link a starter contact
  if (input.initialContactId) {
    const linkResult = await linkContactToHousehold({
      contactId: input.initialContactId,
      householdId: household.id,
      role: input.initialContactRole ?? "primary",
    });
    if (!linkResult.ok) {
      // Household was created; surface the link failure but don't roll back.
      return { ok: true, id: household.id, warning: `Household created but linking contact failed: ${linkResult.error}` };
    }
  }

  revalidatePath("/crm/households");
  return { ok: true, id: household.id };
}

interface LinkContactInput {
  contactId: string;
  householdId: string;
  role?: "primary" | "partner" | "child" | "other";
}

/**
 * Set contacts.household_id (and role_in_household) on an existing contact.
 */
export async function linkContactToHousehold(input: LinkContactInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("contacts")
    .update({
      household_id: input.householdId,
      role_in_household: input.role ?? "primary",
    })
    .eq("id", input.contactId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/crm/contacts/${input.contactId}`);
  revalidatePath(`/crm/households/${input.householdId}`);
  revalidatePath("/crm/households");
  revalidatePath("/crm/contacts");

  return { ok: true };
}

export async function unlinkContactFromHousehold(contactId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: existing } = await supabase
    .from("contacts")
    .select("household_id")
    .eq("id", contactId)
    .single();

  const { error } = await supabase
    .from("contacts")
    .update({ household_id: null, role_in_household: null })
    .eq("id", contactId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/crm/contacts/${contactId}`);
  if (existing?.household_id) {
    revalidatePath(`/crm/households/${existing.household_id}`);
  }
  revalidatePath("/crm/households");
  return { ok: true };
}

/**
 * "Quick household from this contact" — creates a household whose name is the
 * contact's last name (or full name fallback) and links the contact as primary.
 * Most common rep flow: on contact detail, click "Create household" → done.
 */
export async function createHouseholdFromContact(contactId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, address, city, state, zip, source")
    .eq("id", contactId)
    .single();

  if (cErr || !contact) return { ok: false, error: "Contact not found." };

  // Default household name: "Smith household" if last_name, else "Bob Smith"
  const baseName =
    contact.last_name?.trim()
      ? `${contact.last_name.trim()} household`
      : [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "New household";

  const result = await createHousehold({
    name: baseName,
    primary_address: contact.address,
    city: contact.city,
    state: contact.state,
    zip: contact.zip,
    source: contact.source,
    initialContactId: contactId,
    initialContactRole: "primary",
  });

  return result;
}
