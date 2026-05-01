import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction, type AuditAction } from "@/lib/audit";

// Catches client-side failures (Step 7 contract submit errors, Step 8 missing
// contract ID, etc.) and writes them to audit_logs so we can see what really
// happened on a rep's iPad after the fact. Without this, a silent failure
// leaves no trace and we have to wait for it to happen again with someone
// watching the screen.
//
// Allowed events are an explicit allow-list — clients cannot inject arbitrary
// audit actions. Always returns 200 (even on validation failure) so a logging
// outage never blocks the contract flow.

const ALLOWED_EVENTS: AuditAction[] = [
  "contract.submission_failed",
];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: true });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: true });

    const event = body.event as string | undefined;
    if (!event || !ALLOWED_EVENTS.includes(event as AuditAction)) {
      return NextResponse.json({ ok: true });
    }

    const context = body.context && typeof body.context === "object" ? body.context : {};
    const entityId = typeof body.entity_id === "string" ? body.entity_id : undefined;

    await logAction({
      userId: user.id,
      action: event as AuditAction,
      entityType: "contract",
      entityId,
      metadata: { ...context, source: "client" },
      req,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never let logging outages break the caller
    return NextResponse.json({ ok: true });
  }
}
