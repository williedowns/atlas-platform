import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const body = await req.json();
  const { role, email } = body as { role?: string; email?: string };

  if (!role && !email) {
    return NextResponse.json({ error: "role or email is required" }, { status: 400 });
  }

  // Profile writes must bypass RLS — profiles_update_own only allows a user
  // to update their own row, so the cookie-auth client silently no-ops when
  // an admin tries to edit another user. Use the service-role client.
  const admin = createAdminClient();

  if (email !== undefined) {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (id === user.id) {
      return NextResponse.json(
        { error: "Use your account settings to change your own email" },
        { status: 400 }
      );
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      email: trimmed,
      email_confirm: true,
    });
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    const { data: emailRows, error: profErr } = await admin
      .from("profiles")
      .update({ email: trimmed })
      .eq("id", id)
      .select("id");
    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }
    if (!emailRows || emailRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  }

  if (role !== undefined) {
    const { data: roleRows, error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", id)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!roleRows || roleRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ success: true });
}
