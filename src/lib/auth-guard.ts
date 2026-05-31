import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface AdminOrManagerContext {
  user: User;
  supabase: SupabaseClient;
  role: "admin" | "manager" | "show_manager";
}

// Does this user manage the show that `contractId` was sold at? Pure DB lookup,
// no role check — callers combine it with role policy via canActOnContract
// (lib/contract-access). This is the shared scope check behind every
// show_manager grant on the post-sale surface (edit, refund, readiness
// override, audit). Runs under the caller's RLS: the contract's show_id is only
// readable when contracts_read_show_manager already scopes it to a managed show,
// and the show_managers junction check then confirms membership explicitly.
// Returns false when the contract has no show_id — a show_manager's scope is the
// show floor, so an off-show deal is never theirs.
export async function userManagesContractShow(
  supabase: SupabaseClient,
  userId: string,
  contractId: string,
): Promise<boolean> {
  const { data: contract } = await supabase
    .from("contracts")
    .select("show_id")
    .eq("id", contractId)
    .maybeSingle();
  const showId = contract?.show_id as string | null | undefined;
  if (!showId) return false;
  const { data: managed } = await supabase
    .from("show_managers")
    .select("id")
    .eq("show_id", showId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!managed;
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
    const manages = await userManagesContractShow(supabase, user.id, contractId);
    if (!manages) {
      return NextResponse.json(
        { error: "Show managers can only edit contracts at shows they manage" },
        { status: 403 }
      );
    }
  }

  return { user, supabase, role: profile.role as "admin" | "manager" | "show_manager" };
}
