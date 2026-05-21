import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface AdminOrManagerContext {
  user: User;
  supabase: SupabaseClient;
  role: "admin" | "manager";
}

// Centralized guard for the post-sale "modify contract" surface. Every PATCH
// endpoint under /api/contracts/[id]/* that mutates a signed contract uses
// this — keeps the role policy in one place so it can't drift between routes.
export async function requireAdminOrManager(): Promise<AdminOrManagerContext | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Admin or manager role required" },
      { status: 403 }
    );
  }

  return { user, supabase, role: profile.role as "admin" | "manager" };
}
