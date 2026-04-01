import { NextResponse } from "next/server";
import { refreshQBOToken } from "@/lib/qbo/client";

// QuickBooks OAuth2 callback — receives auth code after user authorizes
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin?qbo_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !realmId) {
    return NextResponse.json({ error: "Missing code or realmId" }, { status: 400 });
  }

  // Exchange code for tokens
  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/qbo/callback`,
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/settings?error=token_exchange_failed`
    );
  }

  // In production: store tokens in database (encrypted)
  // For now: log them for manual .env update
  console.log("QBO Tokens received:", {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    realm_id: realmId,
    expires_in: tokens.expires_in,
  });

  // TODO: Store in Supabase qbo_tokens table (encrypted) and auto-refresh
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/admin?qbo=connected`
  );
}
