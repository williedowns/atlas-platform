import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["pending", "approved", "denied"]);

// PATCH /api/contracts/[id]/contingencies
// Body: { permit_status?, hoa_status?, permit_number?, permit_jurisdiction? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (body.permit_status !== undefined) {
    if (body.permit_status !== null && !ALLOWED.has(body.permit_status)) {
      return NextResponse.json({ error: "invalid permit_status" }, { status: 400 });
    }
    update.permit_status = body.permit_status;
    if (body.permit_status === "approved") update.permit_approved_at = new Date().toISOString();
  }
  if (body.hoa_status !== undefined) {
    if (body.hoa_status !== null && !ALLOWED.has(body.hoa_status)) {
      return NextResponse.json({ error: "invalid hoa_status" }, { status: 400 });
    }
    update.hoa_status = body.hoa_status;
    if (body.hoa_status === "approved") update.hoa_approved_at = new Date().toISOString();
  }
  if (typeof body.permit_number === "string") update.permit_number = body.permit_number || null;
  if (typeof body.permit_jurisdiction === "string") update.permit_jurisdiction = body.permit_jurisdiction || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contracts")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}
