import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { NextResponse } from "next/server";

const VALID_STATUSES = ["new", "contacted", "hot", "converted", "lost"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: lead, error } = await supabase
    .from("leads")
    .select(`
      id, first_name, last_name, phone, email, interest, status, notes,
      created_at, updated_at,
      show:shows(id, name),
      assigned_to_profile:profiles!assigned_to(full_name)
    `)
    .eq("id", id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(lead);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { status, notes, first_name, last_name, phone, email, interest, converted_contract_id } = body;

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (interest !== undefined) updates.interest = interest;
    if (converted_contract_id !== undefined) updates.converted_contract_id = converted_contract_id;

    const { error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (status) {
      await logAction({
        userId: user.id,
        action: "lead.status_changed",
        entityType: "customer",
        entityId: id,
        metadata: { status },
        req,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[leads/id] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
