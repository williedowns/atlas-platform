// Internal lead-attribution checklist captured in Step 5 of the contract
// builder (Issue 6, May 2026). Structured replacement for the free-text
// marketing_feedback on the show workbook (show_deal_overrides). Stored as jsonb
// on contracts.marketing_feedback. INTERNAL ONLY — never rendered on the
// customer PDF (the PDF route emits external_notes, not this).

export interface MarketingFeedback {
  // How the customer heard about the show. Multi-select — a customer can hear
  // via more than one channel. Values are MARKETING_CHANNELS keys.
  heard_about: string[];
  // Free text, only meaningful when heard_about includes "other".
  heard_about_other?: string;
  // First time visiting an Atlas show. A flag: true = first-timer; absent = not
  // flagged (either a repeat visitor or not asked).
  first_time_visitor?: boolean;
  // Optional free text — what specifically drew them to the Atlas booth.
  booth_draw?: string;
}

// Lead-attribution channels for the show floor. Order is the display order on
// the checklist. Keep "other" last (it reveals the free-text box).
export const MARKETING_CHANNELS = [
  { key: "tv", label: "TV" },
  { key: "radio", label: "Radio" },
  { key: "social", label: "Facebook / Instagram" },
  { key: "google", label: "Google / online search" },
  { key: "mailer", label: "Mailer / flyer" },
  { key: "drove_by", label: "Drove by / walk-in" },
  { key: "prior_customer", label: "Prior Atlas customer" },
  { key: "referral", label: "Referral (friend / family)" },
  { key: "other", label: "Other" },
] as const;

const CHANNEL_KEYS: ReadonlySet<string> = new Set(MARKETING_CHANNELS.map((c) => c.key));

export function marketingChannelLabel(key: string): string {
  return MARKETING_CHANNELS.find((c) => c.key === key)?.label ?? key;
}

export function isMarketingFeedbackEmpty(mf: MarketingFeedback | null | undefined): boolean {
  if (!mf) return true;
  return (
    (!mf.heard_about || mf.heard_about.length === 0) &&
    !mf.heard_about_other?.trim() &&
    mf.first_time_visitor !== true &&
    !mf.booth_draw?.trim()
  );
}

// Coerce arbitrary input (client draft or API body) into a clean
// MarketingFeedback: drop unknown channel keys, dedupe, trim text, keep the
// "other" note only when "other" is actually selected. Returns null when
// nothing meaningful was captured so an untouched checklist persists as NULL,
// not an empty object. This is the validation boundary for /api/contracts.
export function normalizeMarketingFeedback(input: unknown): MarketingFeedback | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const heard_about = Array.isArray(raw.heard_about)
    ? Array.from(
        new Set(
          raw.heard_about.filter(
            (k): k is string => typeof k === "string" && CHANNEL_KEYS.has(k),
          ),
        ),
      )
    : [];

  const otherText = typeof raw.heard_about_other === "string" ? raw.heard_about_other.trim() : "";
  const boothDraw = typeof raw.booth_draw === "string" ? raw.booth_draw.trim() : "";
  const firstTime = raw.first_time_visitor === true;

  const cleaned: MarketingFeedback = {
    heard_about,
    ...(heard_about.includes("other") && otherText ? { heard_about_other: otherText } : {}),
    ...(boothDraw ? { booth_draw: boothDraw } : {}),
    ...(firstTime ? { first_time_visitor: true } : {}),
  };

  return isMarketingFeedbackEmpty(cleaned) ? null : cleaned;
}
