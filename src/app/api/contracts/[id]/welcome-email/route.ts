import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionAndSendWelcome } from "@/lib/email/welcome";

// Manual welcome-email (re)send — the "resend welcome" button for staff.
// The AUTOMATIC sends happen server-side inside the signing flows
// (POST /api/contracts and POST /api/sign/[token]) by calling
// provisionAndSendWelcome() directly. Staff-only: customers have no profiles
// row, so requiring one keeps this endpoint from being an anonymous
// account-creation / email-trigger vector.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await provisionAndSendWelcome(id);
  if (!result.sent) {
    // skipped (no email / no key) is a benign 200; a real failure is a 500.
    return NextResponse.json(result, { status: result.skipped ? 200 : 500 });
  }
  return NextResponse.json(result);
}
