/**
 * Twilio client + helpers.
 *
 * Env vars required (set in Vercel — never commit):
 *   TWILIO_ACCOUNT_SID            — starts with AC...
 *   TWILIO_AUTH_TOKEN             — primary auth token (treat as password)
 *   TWILIO_MESSAGING_SERVICE_SID  — optional, starts with MG... (preferred for 10DLC)
 *   TWILIO_FROM_NUMBER            — optional fallback E.164 number used if no messaging service
 *
 * If both MESSAGING_SERVICE_SID and FROM_NUMBER are set, the messaging service wins
 * (it routes through the registered campaign and applies trust score).
 */

import twilio from "twilio";
import type { Twilio } from "twilio";

let cached: Twilio | null = null;

export function getTwilioClient(): Twilio | null {
  if (cached) return cached;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  cached = twilio(sid, token);
  return cached;
}

export function isTwilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export function isTwilioSendingConfigured(): boolean {
  return (
    isTwilioConfigured() &&
    Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER)
  );
}

interface SendSmsInput {
  to: string;
  body: string;
}

interface SendSmsResult {
  ok: boolean;
  sid?: string;
  status?: string;
  error?: string;
  errorCode?: number | null;
}

/**
 * Send an SMS via Twilio.
 *
 * Returns ok:false (does not throw) on any error — caller decides how to surface
 * the error. The most common pre-10DLC error is 30034 ("US A2P 10DLC — message
 * from an unregistered number"). Until your 10DLC brand + campaign are
 * approved, sends to US numbers will fail with that code; that's expected.
 */
export async function sendSms({ to, body }: SendSmsInput): Promise<SendSmsResult> {
  const client = getTwilioClient();
  if (!client) {
    return { ok: false, error: "Twilio is not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN env vars)." };
  }

  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!messagingServiceSid && !fromNumber) {
    return {
      ok: false,
      error:
        "No sending number configured. Set TWILIO_MESSAGING_SERVICE_SID (preferred, after 10DLC) or TWILIO_FROM_NUMBER (a phone number you own in Twilio).",
    };
  }

  try {
    const message = await client.messages.create({
      to,
      body,
      ...(messagingServiceSid
        ? { messagingServiceSid }
        : { from: fromNumber }),
    });
    return { ok: true, sid: message.sid, status: message.status };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message ?? String(err),
      errorCode: err?.code ?? null,
    };
  }
}

/**
 * Verify an inbound webhook signature so we know the request actually came
 * from Twilio and not a bad actor.
 *
 * Twilio docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Pass the EXACT URL Twilio called (including any query string), the signature
 * from the X-Twilio-Signature header, and the parsed POST body as a flat object.
 */
export function verifyTwilioSignature(
  url: string,
  signature: string | null,
  params: Record<string, string>
): boolean {
  if (!signature) return false;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  try {
    return twilio.validateRequest(token, signature, url, params);
  } catch {
    return false;
  }
}

/**
 * Best-effort phone normalizer to E.164 (US-defaulted).
 * "555-123-4567" → "+15551234567"
 * "(555) 123-4567" → "+15551234567"
 * "+1 555 123 4567" → "+15551234567"
 *
 * Falls back to the cleaned input prefixed with + if we can't be sure.
 */
export function normalizePhoneE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return null;
}
