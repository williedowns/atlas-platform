import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  // Verify caller is admin
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

  // Send invite — creates auth.users row immediately
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name ?? "", role },
  });

  if (inviteError) {
    // 422 means user already exists
    if (inviteError.message?.includes("already been registered")) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  // Upsert profile so role is set even before the user accepts the invite
  if (inviteData?.user?.id) {
    await admin
      .from("profiles")
      .upsert(
        { id: inviteData.user.id, email, full_name: full_name ?? "", role },
        { onConflict: "id" }
      );
  }

  return NextResponse.json({ success: true });
}
