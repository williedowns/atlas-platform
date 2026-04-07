import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildResetEmailHtml } from "@/lib/email/reset-template";

const COMPANY_NAME = process.env.COMPANY_NAME ?? "Atlas Spas";
const FROM_EMAIL = process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com";
const FROM_NAME = process.env.INVITE_FROM_NAME ?? COMPANY_NAME;

// Public endpoint — no auth required (self-service password reset)
// Uses admin SDK to generate a recovery link, then sends via Resend.
// Never reveals whether an email exists — always returns 200.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { email } = body as { email?: string };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Generate recovery link via admin SDK — Supabase sends NO email
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: email.toLowerCase().trim(),
    });

    // If the email doesn't exist in auth.users, Supabase returns an error.
    // We still return 200 to avoid leaking whether an account exists.
    if (linkError || !linkData?.properties?.action_link) {
      console.warn("[request-reset] generateLink failed (user may not exist):", linkError?.message);
      return NextResponse.json({ success: true });
    }

    const resetLink = linkData.properties.action_link;

    // Send via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.warn("[request-reset] RESEND_API_KEY not set — skipping email");
      return NextResponse.json({ success: true });
    }

    const html = buildResetEmailHtml({ reset_link: resetLink, email });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: `Reset your ${COMPANY_NAME} platform password`,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[request-reset] Resend error:", errBody);
    }
  } catch (err) {
    console.error("[request-reset] Unexpected error:", err);
  }

  // Always 200 — never reveal whether the account exists
  return NextResponse.json({ success: true });
}
