// AI verification that a document uploaded as a "prescription" (Rx) really is
// one — before it's allowed to trigger the Texas hydrotherapy tax exemption
// (Tax Code §151.313). The exemption requires a doctor's prescription on file;
// without this gate, someone could upload a driver's license / ID / random
// photo and wrongly zero the customer's sales tax.
//
// Design (chosen behavior: "Charge tax + allow override", powered by Claude):
//   - No ANTHROPIC_API_KEY        → feature inactive. ranAi=false. The caller
//                                   falls back to legacy behavior (allow) so a
//                                   deploy is safe until the key is added.
//   - AI says prescription        → verified=true. Upload proceeds, tax exempts.
//   - AI says NOT a prescription  → verified=false, ranAi=true. Caller blocks
//                                   (keeps tax) but offers a manual override.
//   - AI errors / can't decide    → verified=false, ranAi=true. Same as a
//                                   rejection: fail-CLOSED. Staff can override.
//
// The library only reports facts (did the AI run? what did it conclude?). The
// route decides policy (allow / block / require override). This keeps the
// no-key fail-open path entirely in the caller.
//
// Anthropic Messages API is called with raw fetch (no SDK) per repo convention.

export interface RxVerifyResult {
  /** True only when the AI ran AND classified the document as a prescription
   *  at/above the confidence threshold. */
  verified: boolean;
  /** Granular classification from the model (prescription / drivers_license /
   *  id_card / insurance_card / photo / blank / other) or an internal marker
   *  ("no_api_key", "unsupported_type", "error") when the AI didn't decide. */
  documentType: string;
  /** Model's self-reported confidence 0..1 (0 when the AI didn't run). */
  confidence: number;
  /** Human-readable explanation, surfaced to staff on the upload screen. */
  reason: string;
  /** Whether the AI verification actually executed. False ONLY when no API key
   *  is configured (feature inactive) — the caller uses this to decide whether
   *  to fall back to legacy behavior or to enforce the gate. */
  ranAi: boolean;
}

/** Minimum model confidence required to treat a document as a verified Rx. */
export const RX_VERIFY_CONFIDENCE_THRESHOLD = 0.6;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Sniff a file's true media type from its leading "magic bytes". Never trust a
 * filename extension or a (spoofable) client MIME type for the exemption gate.
 * Returns a canonical MIME string for the formats Claude vision accepts, or
 * null if the bytes don't match a supported image/PDF signature.
 */
export function sniffMediaType(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;

  // PDF: "%PDF-"
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: "GIF8"
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }

  // WEBP: "RIFF"...."WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

const VERIFY_PROMPT = [
  "You are validating a document uploaded to claim the Texas hydrotherapy",
  "sales-tax exemption (Texas Tax Code §151.313). That exemption requires a",
  "doctor's written PRESCRIPTION (or a licensed healthcare provider's written",
  "order/recommendation) for therapeutic hydrotherapy / spa / hot tub use.",
  "",
  "Look at the attached document and decide what it is. A valid prescription",
  "typically shows: a patient name, a prescriber / clinic / provider name,",
  "a date, and a medical instruction, treatment, medication, or recommendation.",
  "",
  "It is NOT a prescription if it is a driver's license, a state/government ID",
  "card, an insurance card, a generic or personal photo, a blank/illegible page,",
  "a sales contract, or any other non-medical document.",
  "",
  "Respond with ONLY a single JSON object and nothing else — no markdown, no",
  "code fences, no commentary. Use exactly this shape:",
  '{"is_prescription": <true|false>, "document_type": "prescription|drivers_license|id_card|insurance_card|photo|blank|other", "confidence": <0.0-1.0>, "reason": "<one short sentence>"}',
  "",
  "Set is_prescription to true ONLY for a genuine medical prescription or a",
  "provider's written medical order/recommendation. When in doubt, set it false.",
].join("\n");

interface ParsedModelJson {
  is_prescription?: unknown;
  document_type?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

/** Pull the first {...} block out of the model text and parse it defensively. */
function parseModelJson(text: string): ParsedModelJson | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as ParsedModelJson;
  } catch {
    return null;
  }
}

/**
 * Ask Claude whether a base64-encoded document is a medical prescription.
 *
 * @param base64Data Base64 (no data: prefix) of the file bytes.
 * @param mediaType  Canonical MIME (from sniffMediaType): an image/* type or
 *                   "application/pdf".
 */
export async function verifyPrescriptionDocument(
  base64Data: string,
  mediaType: string,
): Promise<RxVerifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ── Feature inactive: no key → fail OPEN at the caller ──────────────────────
  // This is the ONLY path that sets ranAi=false. A deploy without the key keeps
  // the legacy "upload always allowed" behavior so nothing breaks before Willie
  // adds ANTHROPIC_API_KEY to Vercel.
  if (!apiKey) {
    return {
      verified: false,
      documentType: "no_api_key",
      confidence: 0,
      reason: "AI verification is not configured (no API key).",
      ranAi: false,
    };
  }

  // ── Build the media content block (image vs PDF) ───────────────────────────
  const isImage = mediaType.startsWith("image/");
  const isPdf = mediaType === "application/pdf";
  if (!isImage && !isPdf) {
    // Unsupported type reaching the lib is fail-CLOSED (feature is active).
    return {
      verified: false,
      documentType: "unsupported_type",
      confidence: 0,
      reason: `Unsupported file type for verification: ${mediaType}.`,
      ranAi: true,
    };
  }

  const mediaBlock = isPdf
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64Data },
      }
    : {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64Data },
      };

  // Current vision-capable model (claude-3-5-sonnet was retired Jan 2026).
  // Override with RX_VERIFY_MODEL — e.g. "claude-haiku-4-5" for lower cost.
  const model = process.env.RX_VERIFY_MODEL || "claude-sonnet-4-6";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [mediaBlock, { type: "text", text: VERIFY_PROMPT }],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        verified: false,
        documentType: "error",
        confidence: 0,
        reason: `Verification service error (${res.status}). ${detail.slice(0, 160)}`.trim(),
        ranAi: true,
      };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      data.content?.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("") ?? "";

    const parsed = parseModelJson(text);
    if (!parsed) {
      return {
        verified: false,
        documentType: "error",
        confidence: 0,
        reason: "Could not parse a verification result from the AI response.",
        ranAi: true,
      };
    }

    const isPrescription = parsed.is_prescription === true;
    const confidence =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;
    const documentType =
      typeof parsed.document_type === "string" && parsed.document_type
        ? parsed.document_type
        : isPrescription
          ? "prescription"
          : "other";
    const reason =
      typeof parsed.reason === "string" && parsed.reason
        ? parsed.reason
        : isPrescription
          ? "Document appears to be a prescription."
          : "Document does not appear to be a prescription.";

    return {
      verified: isPrescription && confidence >= RX_VERIFY_CONFIDENCE_THRESHOLD,
      documentType,
      confidence,
      reason,
      ranAi: true,
    };
  } catch (err) {
    // Network failure, timeout/abort, etc. Feature is active → fail CLOSED.
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      verified: false,
      documentType: "error",
      confidence: 0,
      reason: aborted
        ? "Verification timed out. You can retry or override."
        : "Verification could not be completed. You can retry or override.",
      ranAi: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}
