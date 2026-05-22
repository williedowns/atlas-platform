import type { SupabaseClient } from "@supabase/supabase-js";

// ── Profile lookup helpers ───────────────────────────────────────────────────
// Case-insensitive email → profile lookup, used wherever code needs to resolve
// a known team member's profile UUID at runtime (rather than hardcoding it
// per environment). Returns null on miss so callers can branch cleanly.

export async function getProfileByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
