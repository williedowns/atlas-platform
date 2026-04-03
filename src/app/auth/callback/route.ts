import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  // ── PKCE OAuth code flow (GitHub, OAuth, and password recovery) ──────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Recovery and invite both need the user to set a password
      if (type === "recovery" || type === "invite") {
        return NextResponse.redirect(`${origin}/auth/set-password`);
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
        return NextResponse.redirect(`${origin}/auth/set-password`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
