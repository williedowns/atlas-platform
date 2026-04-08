import { NextResponse } from "next/server";
import { pingZamp } from "@/lib/zamp/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const result = await pingZamp();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
