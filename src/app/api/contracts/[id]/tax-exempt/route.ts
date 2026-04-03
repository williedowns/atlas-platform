import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed = ["admin", "manager", "bookkeeper"].includes(profile?.role ?? "");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { received } = await req.json() as { received: boolean };

  const { data, error } = await supabase
    .from("contracts")
    .update({
      tax_exempt_cert_received: received,
      tax_exempt_cert_received_at: received ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id, tax_exempt_cert_received, tax_exempt_cert_received_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
