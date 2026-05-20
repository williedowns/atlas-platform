// Active Workspace helper — per-user "where am I working right now" state.
//
// A user can have either an active show (a weekend home-show) or an active
// location (a showroom). They're mutually exclusive — setting one clears the
// other via the /api/active-show endpoint.
//
// Active shows auto-expire when end_date passes (so a Friday-Sunday show
// clears itself on Monday). Active locations never expire — a rep working
// the Lubbock showroom is at the Lubbock showroom indefinitely.
//
// Read access:
//   getActiveShow()      — show only, null if user is at a showroom
//   getActiveLocation()  — showroom only, null if user is at a show
//   getActiveWorkspace() — either, with a type tag (use this for the banner)

import { createClient } from "@/lib/supabase/server";

export const PICKER_DISMISSED_COOKIE = "active_show_picker_dismissed";

export interface ActiveShow {
  type: "show";
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  /** 1-indexed day of the show today falls on (clamped to [1, totalDays]) */
  dayNum: number;
  totalDays: number;
}

export interface ActiveLocation {
  type: "location";
  id: string;
  name: string;
  city: string;
  state: string;
}

export type ActiveWorkspace = ActiveShow | ActiveLocation;

/**
 * Read the current user's active show. Returns null if they're not at a
 * show (might be at a showroom — use getActiveLocation for that).
 */
export async function getActiveShow(): Promise<ActiveShow | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      active_show_id,
      active_show:shows!active_show_id(id, name, start_date, end_date, active)
    `)
    .eq("id", user.id)
    .maybeSingle();

  const show = (profile?.active_show ?? null) as
    | { id: string; name: string; start_date: string; end_date: string; active: boolean }
    | null;

  if (!show || !show.active) return null;

  const today = new Date().toISOString().split("T")[0];
  // Auto-expire: a show whose end_date has passed is treated as not set.
  if (show.end_date < today) return null;

  const start = new Date(show.start_date + "T00:00:00");
  const end = new Date(show.end_date + "T00:00:00");
  const todayDate = new Date(today + "T00:00:00");
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const dayNum = Math.min(
    totalDays,
    Math.max(1, Math.round((todayDate.getTime() - start.getTime()) / 86400000) + 1),
  );

  return {
    type: "show",
    id: show.id,
    name: show.name,
    start_date: show.start_date,
    end_date: show.end_date,
    dayNum,
    totalDays,
  };
}

/**
 * Read the current user's active showroom location, if set. Returns null
 * when they're at a show or haven't picked anything.
 */
export async function getActiveLocation(): Promise<ActiveLocation | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      active_location_id,
      active_location:locations!active_location_id(id, name, city, state, active, type)
    `)
    .eq("id", user.id)
    .maybeSingle();

  const loc = (profile?.active_location ?? null) as
    | { id: string; name: string; city: string; state: string; active: boolean; type: string }
    | null;

  if (!loc || !loc.active) return null;

  return {
    type: "location",
    id: loc.id,
    name: loc.name,
    city: loc.city,
    state: loc.state,
  };
}

/**
 * Combined read — returns whichever of show/location is set. Show takes
 * precedence if somehow both are populated (shouldn't happen in practice;
 * the API enforces mutual exclusion).
 */
export async function getActiveWorkspace(): Promise<ActiveWorkspace | null> {
  const show = await getActiveShow();
  if (show) return show;
  return await getActiveLocation();
}

/**
 * Should /dashboard redirect the user to /select-active-show right now?
 *
 * Conditions (all must be true):
 *   - User is a sales_rep (not manager, not show_manager, not admin)
 *   - User has no active workspace (no show, no showroom)
 *   - User has not dismissed the picker today
 *   - At least one option is available (a show running today OR a showroom exists)
 */
export async function shouldShowPicker(role: string | null | undefined): Promise<boolean> {
  if (role !== "sales_rep") return false;

  const workspace = await getActiveWorkspace();
  if (workspace) return false;

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  if (cookieStore.get(PICKER_DISMISSED_COOKIE)?.value === "1") return false;

  const supabase = await createClient();
  const { count: showroomCount } = await supabase
    .from("locations")
    .select("id", { count: "exact", head: true })
    .eq("type", "store")
    .eq("active", true);

  if ((showroomCount ?? 0) > 0) return true;

  const today = new Date().toISOString().split("T")[0];
  const { count: showCount } = await supabase
    .from("shows")
    .select("id", { count: "exact", head: true })
    .lte("start_date", today)
    .gte("end_date", today)
    .eq("active", true);

  return (showCount ?? 0) > 0;
}
