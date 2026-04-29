// View-As helper — admin-only UI/data override.
//
// Lets an admin "view as" another role (e.g. Sales Rep) and/or impersonate a
// specific user for data filtering on list pages. This is NOT real auth
// impersonation:
//   • All writes use the real admin's auth.uid() (audit logs stay accurate)
//   • RLS continues to enforce against the real user
//   • Only surfaces that explicitly call getViewAsContext() honor the override
//
// Two cookies:
//   • view_as_role     — UI role for nav / page rendering
//   • view_as_user_id  — user id for filtering "my contracts" / "my pipeline"
//
// Cookies are ignored unless the real user is an admin. This is enforced
// server-side on every read (defense in depth — even if a non-admin sets
// the cookie via devtools, this helper drops it).

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ViewAsRole = "admin" | "manager" | "sales_rep" | "bookkeeper" | "field_crew" | "customer";

const ALLOWED_ROLES: ReadonlyArray<ViewAsRole> = [
  "admin",
  "manager",
  "sales_rep",
  "bookkeeper",
  "field_crew",
  "customer",
];

export const VIEW_AS_ROLE_COOKIE = "view_as_role";
export const VIEW_AS_USER_COOKIE = "view_as_user_id";

export interface ViewAsUser {
  id: string;
  full_name: string | null;
  role: string | null;
}

export interface ViewAsContext {
  /** The actual signed-in user id from supabase.auth */
  realUserId: string | null;
  /** The actual role from public.profiles */
  realRole: string | null;
  /** UI role to render the page with (= realRole when not impersonating) */
  effectiveRole: string | null;
  /** User id to filter data with (= realUserId when not impersonating) */
  effectiveUserId: string | null;
  /** When impersonating a specific user, profile snippet for the banner */
  viewAsUser: ViewAsUser | null;
  /** True when the role override cookie is active (admin viewing as another role) */
  isImpersonatingRole: boolean;
  /** True when impersonating a specific user for data filtering */
  isImpersonatingUser: boolean;
}

/**
 * Read the current view-as context. Always call this in server components and
 * API routes that need to respect the override. If you skip it, the override
 * has no effect on that surface (which is fine — Option B only applies where
 * we explicitly wire it).
 */
export async function getViewAsContext(): Promise<ViewAsContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const empty: ViewAsContext = {
    realUserId: null,
    realRole: null,
    effectiveRole: null,
    effectiveUserId: null,
    viewAsUser: null,
    isImpersonatingRole: false,
    isImpersonatingUser: false,
  };

  if (!user) return empty;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const realRole = (profile?.role ?? null) as string | null;
  const isAdmin = realRole === "admin";

  // If the caller isn't an admin, override cookies are ignored — return the
  // real user/role unchanged. Defense in depth — even devtools-set cookies
  // do nothing.
  if (!isAdmin) {
    return {
      ...empty,
      realUserId: user.id,
      realRole,
      effectiveRole: realRole,
      effectiveUserId: user.id,
    };
  }

  const cookieStore = await cookies();
  const roleCookie = cookieStore.get(VIEW_AS_ROLE_COOKIE)?.value as ViewAsRole | undefined;
  const userIdCookie = cookieStore.get(VIEW_AS_USER_COOKIE)?.value;

  // Validate role cookie against the allowed set
  const overrideRole = roleCookie && ALLOWED_ROLES.includes(roleCookie) ? roleCookie : null;

  // Validate user cookie shape (uuid-like) and that the user actually exists
  let viewAsUser: ViewAsUser | null = null;
  if (userIdCookie && /^[0-9a-f-]{36}$/i.test(userIdCookie)) {
    const { data: vu } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", userIdCookie)
      .maybeSingle();
    if (vu) viewAsUser = vu as ViewAsUser;
  }

  const isImpersonatingRole = !!overrideRole;
  const isImpersonatingUser = !!viewAsUser;

  return {
    realUserId: user.id,
    realRole,
    // When impersonating a specific user, prefer THEIR role over the role
    // cookie — feels more natural ("view as Eric" should show Eric's nav).
    effectiveRole: viewAsUser?.role ?? overrideRole ?? realRole,
    effectiveUserId: viewAsUser?.id ?? user.id,
    viewAsUser,
    isImpersonatingRole,
    isImpersonatingUser,
  };
}

/**
 * Helper for API routes that filter "owned by current user" — returns the
 * effective user id (real if not impersonating, impersonated if so). Only
 * the admin gets to override; everyone else gets their own id.
 */
export async function getEffectiveOwnerId(): Promise<string | null> {
  const ctx = await getViewAsContext();
  return ctx.effectiveUserId;
}
