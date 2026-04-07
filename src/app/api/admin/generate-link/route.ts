import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
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

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const link = data?.properties?.action_link;
  if (!link) {
    return NextResponse.json({ error: "No link returned from Supabase" }, { status: 500 });
  }

  return NextResponse.json({ link });
}
