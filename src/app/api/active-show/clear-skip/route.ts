// POST /api/active-show/clear-skip
//
// Clears the picker-dismissed cookie so the next /dashboard visit re-prompts
// the rep to choose their active workspace. Called by the login form (right
// after sign-in) and the sign-out handler so "Skip for now" only suppresses
// the picker for the current session, not the calendar day.
//
// Unauthenticated — the cookie is just session state, not security.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PICKER_DISMISSED_COOKIE } from "@/lib/active-show";

export async function POST() {
  const cookieStore = await cookies();
  // Must match the path the cookie was set with (path: "/") — Next's
  // default delete uses the current route's path, which here is
  // /api/active-show/clear-skip and won't match the cookie set at /.
  cookieStore.set(PICKER_DISMISSED_COOKIE, "", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
