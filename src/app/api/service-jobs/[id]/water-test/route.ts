import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager", "field_crew"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { ph, alkalinity, sanitizer_ppm, temp_f, hardness, notes } = body;

  const { data, error } = await supabase
    .from("service_job_water_tests")
    .insert({
      job_id: id,
      ph: ph ?? null,
      alkalinity: alkalinity ?? null,
      sanitizer_ppm: sanitizer_ppm ?? null,
      temp_f: temp_f ?? null,
      hardness: hardness ?? null,
      notes: notes ?? null,
      tested_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
