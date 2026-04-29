// POST /api/admin/view-as   { role?, user_id? }   — admin sets the override
// DELETE /api/admin/view-as                       — clears both cookies
//
// Both cookies are client-readable (HttpOnly: false) so the banner can render
// without an extra round-trip. Security comes from the server-side admin
// check on every consumer (see src/lib/view-as.ts).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  VIEW_AS_ROLE_COOKIE,
  VIEW_AS_USER_COOKIE,
  type ViewAsRole,
} from "@/lib/view-as";

const ALLOWED_ROLES: ReadonlyArray<ViewAsRole> = [
  "admin",
  "manager",
  "sales_rep",
  "bookkeeper",
  "field_crew",
  "customer",
];

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden — admin only" };
  }

  return { ok: true as const, supabase, userId: user.id };
}

const COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false, // client-readable for the banner; server still validates
  secure: process.env.NODE_ENV === "production",
  // 8 hour expiry — long enough for a working session, short enough that you
  // won't accidentally stay impersonated overnight.
  maxAge: 60 * 60 * 8,
};

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { role, user_id } = body as { role?: string; user_id?: string };

  // At least one of the two must be supplied (otherwise this is a no-op)
  if (!role && !user_id) {
    return NextResponse.json(
      { error: "Provide role or user_id (or both)" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();

  if (role !== undefined) {
    if (role && !ALLOWED_ROLES.includes(role as ViewAsRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (role) {
      cookieStore.set(VIEW_AS_ROLE_COOKIE, role, COOKIE_OPTS);
    } else {
      cookieStore.delete(VIEW_AS_ROLE_COOKIE);
    }
  }

  if (user_id !== undefined) {
    if (user_id && !/^[0-9a-f-]{36}$/i.test(user_id)) {
      return NextResponse.json({ error: "Invalid user_id" }, { status: 400 });
    }
    if (user_id) {
      cookieStore.set(VIEW_AS_USER_COOKIE, user_id, COOKIE_OPTS);
    } else {
      cookieStore.delete(VIEW_AS_USER_COOKIE);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_ROLE_COOKIE);
  cookieStore.delete(VIEW_AS_USER_COOKIE);
  return NextResponse.json({ ok: true });
}
