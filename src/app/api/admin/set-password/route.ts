import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { userId, password } = body as { userId?: string; password?: string };

  if (!userId || !password) {
    return NextResponse.json({ error: "userId and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // 2. Admins cannot change their own password via this route (use account settings)
  if (userId === user.id) {
    return NextResponse.json({ error: "Use your account settings to change your own password" }, { status: 400 });
  }

  // 3. Set the password AND force-confirm the email so they can sign in immediately
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
