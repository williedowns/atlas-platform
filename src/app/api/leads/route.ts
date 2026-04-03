import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { show_id, first_name, last_name, phone, email, interest, notes } = body;

    if (!first_name?.trim()) {
      return NextResponse.json({ error: "first_name is required" }, { status: 400 });
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        show_id: show_id ?? null,
        assigned_to: user.id,
        first_name: first_name.trim(),
        last_name: last_name?.trim() ?? null,
        phone: phone?.trim() ?? null,
        email: email?.trim() ?? null,
        interest: interest?.trim() ?? null,
        notes: notes?.trim() ?? null,
        status: "new",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[leads] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAction({
      userId: user.id,
      action: "lead.created",
      entityType: "customer",
      entityId: lead.id,
      metadata: { show_id, first_name, last_name, interest },
      req,
    });

    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (err) {
    console.error("[leads] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
