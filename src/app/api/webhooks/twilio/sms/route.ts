/**
 * Inbound SMS webhook from Twilio.
 *
 * Configure in Twilio console:
 *   Phone Number → Messaging → A MESSAGE COMES IN → Webhook (HTTP POST)
 *   URL: https://{your-atlas-prod-url}/api/webhooks/twilio/sms
 *
 * Twilio POSTs an application/x-www-form-urlencoded body with fields like:
 *   MessageSid, From, To, Body, NumMedia, MediaUrl0, etc.
 *
 * This handler:
 *   1. Verifies the X-Twilio-Signature header (so randos can't spoof inbound SMS)
 *   2. Normalizes the From number to E.164
 *   3. Upserts a contact in this org (matched by phone, created if new)
 *   4. Inserts an activity row of type=sms, direction=inbound
 *   5. Responds 200 with empty TwiML (no auto-reply yet — Phase 2)
 *
 * RLS note: this runs as the service role (no user session). The contact/
 * activity rows are inserted with the organization_id explicitly set on the
 * payload, since the auto_set_organization_id trigger relies on the auth
 * session which isn't present in a webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTwilioSignature, normalizePhoneE164 } from "@/lib/twilio";

export const dynamic = "force-dynamic";

// Empty TwiML — tells Twilio "I got it, no auto-reply." Auto-reply / AI
// receptionist is Phase 2/3.
const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

function twimlResponse(body = EMPTY_TWIML, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: NextRequest) {
  // --- 1. Read body as form data + signature ---
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    params[k] = typeof v === "string" ? v : "";
  }

  const signature = req.headers.get("x-twilio-signature");

  // Reconstruct the full URL Twilio called. Vercel + Next.js sometimes drop
  // protocol info, so prefer x-forwarded-proto / host.
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? new URL(req.url).host;
  const url = `${proto}://${host}${new URL(req.url).pathname}`;

  // --- 2. Verify signature ---
  // In production we MUST verify. In dev (TWILIO_SKIP_SIGNATURE=1) skip for
  // local curl tests — never set that env in production.
  const skipVerify = process.env.TWILIO_SKIP_SIGNATURE === "1";
  if (!skipVerify) {
    const valid = verifyTwilioSignature(url, signature, params);
    if (!valid) {
      console.warn("[twilio/sms] signature verification failed", { url, signature });
      return new NextResponse("Invalid signature", { status: 403 });
    }
  }

  const fromRaw = params.From;
  const toRaw = params.To;
  const body = params.Body ?? "";
  const messageSid = params.MessageSid ?? params.SmsSid ?? null;
  const numMedia = parseInt(params.NumMedia ?? "0", 10) || 0;

  if (!fromRaw) {
    console.warn("[twilio/sms] missing From in payload");
    return twimlResponse(EMPTY_TWIML, 200);
  }

  const fromE164 = normalizePhoneE164(fromRaw) ?? fromRaw;

  // --- 3. Find or create the contact ---
  // We use the admin client because this webhook has no user session.
  // Strategy:
  //   a) Look up contact by exact phone_primary match (any org)
  //   b) If found, use that contact + their org
  //   c) If not, we need to know which org to write to. Twilio's `To`
  //      number tells us which Atlas org this came in for IF we've mapped
  //      numbers to orgs. For now, we route to the SINGLE org that exists
  //      and surface a warning if multiple orgs are present without a map.
  const admin = createAdminClient();

  let contactId: string | null = null;
  let orgId: string | null = null;

  // Try to find existing contact by phone (either primary or alt)
  const { data: existing } = await admin
    .from("contacts")
    .select("id, organization_id, household_id")
    .eq("phone_primary", fromE164)
    .limit(1)
    .maybeSingle();

  if (existing) {
    contactId = existing.id;
    orgId = existing.organization_id;
  } else {
    // No contact yet — figure out which org to put them in.
    // For a single-org install (current Atlas state), pick the only org.
    // For multi-org, we'd need a number→org map (TODO when first dealer signs).
    const { data: orgs } = await admin.from("organizations").select("id").limit(2);
    if (!orgs || orgs.length === 0) {
      console.warn("[twilio/sms] no organizations exist — dropping inbound");
      return twimlResponse(EMPTY_TWIML, 200);
    }
    if (orgs.length > 1) {
      console.warn(
        "[twilio/sms] multiple orgs and no number routing map — assigning inbound to the first org. Set up number→org mapping when adding the 2nd dealer."
      );
    }
    orgId = orgs[0].id;

    // Create a new "unnamed" contact for this inbound number. Rep can
    // rename + assign later from /crm/inbox.
    const { data: created, error: createErr } = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        first_name: "Unknown",
        last_name: null,
        phone_primary: fromE164,
        source: "sms_inbound",
        notes: `Auto-created from inbound SMS on ${new Date().toISOString()}`,
      })
      .select("id")
      .single();

    if (createErr || !created) {
      console.error("[twilio/sms] contact create failed", createErr);
      return twimlResponse(EMPTY_TWIML, 200);
    }
    contactId = created.id;
  }

  // --- 4. Log the activity (the inbound SMS body) ---
  const mediaList: string[] = [];
  for (let i = 0; i < numMedia; i++) {
    const url = params[`MediaUrl${i}`];
    if (url) mediaList.push(url);
  }

  const { error: actErr } = await admin.from("activities").insert({
    organization_id: orgId,
    contact_id: contactId,
    type: "sms",
    direction: "inbound",
    channel: "sms",
    body,
    metadata: {
      twilio_sid: messageSid,
      from: fromE164,
      to: toRaw,
      num_media: numMedia,
      media_urls: mediaList,
    },
    occurred_at: new Date().toISOString(),
  });

  if (actErr) {
    console.error("[twilio/sms] activity insert failed", actErr);
    // Still 200 so Twilio doesn't retry — we already failed once and will see it in logs
  }

  // --- 5. Bump contact's last_activity_at so it floats to the top of lists ---
  await admin
    .from("contacts")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", contactId);

  // --- 6. Mirror to sms_log table for delivery analytics ---
  await admin.from("sms_log").insert({
    organization_id: orgId,
    contact_id: contactId,
    direction: "inbound",
    twilio_sid: messageSid,
    from_number: fromE164,
    to_number: toRaw,
    body,
    status: "received",
  });

  // Empty TwiML response — we acknowledge receipt, no auto-reply.
  return twimlResponse(EMPTY_TWIML, 200);
}
