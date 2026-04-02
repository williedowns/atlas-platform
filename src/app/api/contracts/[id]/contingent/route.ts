import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch current value and toggle it
  const { data: contract, error: fetchErr } = await supabase
    .from("contracts")
    .select("is_contingent, status")
    .eq("id", id)
    .single();

  if (fetchErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Only signed/active contracts can be toggled
  if (["quote", "draft", "cancelled"].includes(contract.status)) {
    return NextResponse.json(
      { error: "Only signed contracts can be marked contingent" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("contracts")
    .update({ is_contingent: !contract.is_contingent })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ is_contingent: !contract.is_contingent });
}
