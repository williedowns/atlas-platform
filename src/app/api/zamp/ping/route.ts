import { NextResponse } from "next/server";
import { pingZamp } from "@/lib/zamp/client";

export async function POST() {
  try {
    const result = await pingZamp();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
