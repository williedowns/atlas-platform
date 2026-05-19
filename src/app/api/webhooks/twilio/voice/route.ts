/**
 * Inbound voice webhook stub.
 *
 * Configure in Twilio console:
 *   Phone Number → Voice & Fax → A CALL COMES IN → Webhook (HTTP POST)
 *   URL: https://{your-atlas-prod-url}/api/webhooks/twilio/voice
 *
 * Phase 2 will fill this in with proper IVR / forwarding / Bland.ai handoff.
 * For now, return a minimal TwiML that plays a holding message so the call
 * doesn't drop or play Twilio's default error message.
 *
 * Signature verification mirrors the SMS webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyTwilioSignature } from "@/lib/twilio";

export const dynamic = "force-dynamic";

// Minimal TwiML — politely ask the caller to leave a message.
// Phase 2: replace with Bland.ai handoff or rep forwarding.
const HOLDING_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for calling Atlas Spas. Please leave a brief message after the tone and a team member will return your call shortly.</Say>
  <Record maxLength="120" finishOnKey="#" />
  <Say voice="Polly.Joanna">Thank you. Goodbye.</Say>
  <Hangup />
</Response>`;

function twimlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    params[k] = typeof v === "string" ? v : "";
  }

  const signature = req.headers.get("x-twilio-signature");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? new URL(req.url).host;
  const url = `${proto}://${host}${new URL(req.url).pathname}`;

  const skipVerify = process.env.TWILIO_SKIP_SIGNATURE === "1";
  if (!skipVerify) {
    const valid = verifyTwilioSignature(url, signature, params);
    if (!valid) {
      console.warn("[twilio/voice] signature verification failed");
      return new NextResponse("Invalid signature", { status: 403 });
    }
  }

  // TODO Phase 2: lookup contact by `params.From`, create activity row,
  //               then route to Bland.ai or a rep's number based on time-of-day.

  return twimlResponse(HOLDING_TWIML, 200);
}
