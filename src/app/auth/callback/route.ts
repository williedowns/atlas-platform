import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Only allow internal, single-leading-slash paths — blocks open-redirect
// abuse via a crafted ?next=//evil.com or ?next=https://evil.com.
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Customers carry next=/portal/dashboard so they land in the portal after
  // setting a password. Staff invites/resets omit it and fall back to /dashboard.
  const next = safeNext(searchParams.get("next"));
  const setPasswordUrl = next
    ? `${origin}/auth/set-password?next=${encodeURIComponent(next)}`
    : `${origin}/auth/set-password`;

  const supabase = await createClient();

  // ── PKCE OAuth code flow (GitHub, OAuth, and password recovery) ──────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Recovery and invite both need the user to set a password
      if (type === "recovery" || type === "invite") {
        return NextResponse.redirect(setPasswordUrl);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // ── Magic link / invite token flow ───────────────────────────────────────
  // Supabase invite emails send ?token_hash=XXX&type=invite
  // We exchange the token, then send new users to set-password.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "magiclink" | "recovery" | "email",
    });
    if (!error) {
      // Invite and password recovery both need the set-password page
      if (type === "invite" || type === "recovery") {
        return NextResponse.redirect(setPasswordUrl);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
