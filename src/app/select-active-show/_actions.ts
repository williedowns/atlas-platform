"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PICKER_DISMISSED_COOKIE } from "@/lib/active-show";

/**
 * Skip the show picker for the rest of today. Sets a session-scoped cookie
 * so the dashboard redirect logic stops sending the user back here on every
 * navigation. Cookie expires at the end of the calendar day (local server
 * time) so tomorrow's login re-triggers the picker.
 */
export async function dismissPickerAction(): Promise<void> {
  const cookieStore = await cookies();

  // Expire at end of today (server local). Falls back to 8 hours if the math
  // somehow yields a negative window (e.g., near midnight).
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const maxAge = Math.max(60 * 60 * 1, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));

  cookieStore.set(PICKER_DISMISSED_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  });

  redirect("/dashboard");
}
