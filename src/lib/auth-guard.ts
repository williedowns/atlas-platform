import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface AdminOrManagerContext {
  user: User;
  supabase: SupabaseClient;
  role: "admin" | "manager" | "show_manager";
}

// Centralized guard for the post-sale "modify contract" surface. Every PATCH
// endpoint under /api/contracts/[id]/* that mutates a signed contract uses
// this — keeps the role policy in one place so it can't drift between routes.
//
// admin/manager may edit any contract in their org. A show_manager may edit
// ONLY contracts sold at a show they manage — pass `contractId` so the guard
// can verify membership (a show_manager call without it is rejected). RLS
// (migration 108) is the second enforcement layer on the write itself.
export async function requireAdminOrManager(
  contractId?: string,
): Promise<AdminOrManagerContext | NextResponse> {
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

  if (!profile || !["admin", "manager", "show_manager"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Admin or manager role required" },
      { status: 403 }
    );
  }

  if (profile.role === "show_manager") {
    if (!contractId) {
      return NextResponse.json(
        { error: "Show managers can only edit contracts at shows they manage" },
        { status: 403 }
      );
    }
    // Verify the contract is sold at a show this manager runs. The contract's
    // show_id is only visible here because contracts_read_show_manager already
    // scopes reads to managed shows — so a miss means "not yours".
    const { data: contract } = await supabase
      .from("contracts")
      .select("show_id")
      .eq("id", contractId)
      .maybeSingle();
    const showId = contract?.show_id as string | null | undefined;
    if (!showId) {
      return NextResponse.json(
        { error: "Show managers can only edit contracts at shows they manage" },
        { status: 403 }
      );
    }
    const { data: managed } = await supabase
      .from("show_managers")
      .select("id")
      .eq("show_id", showId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!managed) {
      return NextResponse.json(
        { error: "Show managers can only edit contracts at shows they manage" },
        { status: 403 }
      );
    }
  }

  return { user, supabase, role: profile.role as "admin" | "manager" | "show_manager" };
}
