import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.QBO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "QBO_CLIENT_ID not configured" }, { status: 500 });
  }

  const redirectUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/qbo/callback`
  );
  const scope = encodeURIComponent(
    "com.intuit.quickbooks.accounting com.intuit.quickbooks.payment"
  );
  const state = Math.random().toString(36).substring(7);

  const authUrl =
    `https://appcenter.intuit.com/connect/oauth2` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&state=${state}`;

  return NextResponse.redirect(authUrl);
}
