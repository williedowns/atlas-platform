import { NextResponse } from "next/server";
import { pingAvalara } from "@/lib/avalara/client";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await pingAvalara();
    return NextResponse.json({ ok: true, authenticated: result.authenticated, version: result.version });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
