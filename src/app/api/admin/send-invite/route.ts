import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInviteEmailHtml } from "@/lib/email/invite-template";

const COMPANY_NAME = process.env.COMPANY_NAME ?? "Atlas Spas";
const FROM_EMAIL = process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com";
const FROM_NAME = process.env.INVITE_FROM_NAME ?? COMPANY_NAME;

export async function POST(req: Request) {
  // 1. Verify caller is admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, full_name, role } = body;

  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2. Check if user already exists; if not, create them
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!existingUser) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? "", role },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
  }

  // 3. Upsert profile row so role is set immediately
  const userId = existingUser?.id ?? (
    (await admin.auth.admin.listUsers()).data?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )?.id
  );

  if (userId) {
    await admin.from("profiles").upsert(
      { id: userId, email, full_name: full_name ?? "", role },
      { onConflict: "id" }
    );
  }

  // 4. Generate a recovery link (no email sent by Supabase)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkError?.message ?? "Failed to generate login link" },
      { status: 500 }
    );
  }

  const loginLink = linkData.properties.action_link;

  // 5. Send branded invite email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[send-invite] RESEND_API_KEY not set — skipping email");
    return NextResponse.json({ success: true, skipped_email: true, link: loginLink });
  }

  const html = buildInviteEmailHtml({
    company_name: COMPANY_NAME,
    invitee_name: full_name || email,
    role,
    login_link: loginLink,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `You're invited to ${COMPANY_NAME}'s sales platform`,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[send-invite] Resend error:", errBody);
    // Still succeed — admin can use the generate-link button as fallback
    return NextResponse.json({ success: true, email_failed: true, link: loginLink });
  }

  return NextResponse.json({ success: true });
}
