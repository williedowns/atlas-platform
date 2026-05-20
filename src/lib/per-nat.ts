// Per Nat helpers — parsing the freeform delivery_timeframe text into a
// month bucket, since the XLSX groups rows under month-divider rows. The
// XLSX content is freeform (e.g. "Feb-April", "End of April?", "May?",
// "Jan-April 2026", "2026-03-01"), so we extract the earliest recognizable
// month and pair it with a year if one is present.

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const MONTH_ABBREV: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

const SHORT_LABEL = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const LONG_LABEL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface MonthBucket {
  key: string;       // "2026-04" or "tbd"
  label: string;     // "April 2026" or "TBD"
  sortKey: number;   // numeric sort — Infinity for TBD
}

/**
 * Parse a freeform delivery_timeframe string into a month bucket.
 *
 * Examples:
 *   "Jan-April 2026" -> { key: "2026-01", label: "January 2026" }
 *   "Feb-April"      -> { key: "<currentYear>-02", label: "February <year>" }
 *   "April?"         -> { key: "<currentYear>-04", label: "April <year>" }
 *   "End of April"   -> { key: "<currentYear>-04", label: "April <year>" }
 *   "2026-03-01"     -> { key: "2026-03", label: "March 2026" }
 *   "???" / null     -> { key: "tbd", label: "TBD" }
 */
export function parseDeliveryTimeframeToBucket(
  raw: string | null | undefined,
  referenceYear: number = new Date().getFullYear()
): MonthBucket {
  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    return { key: "tbd", label: "TBD", sortKey: Number.POSITIVE_INFINITY };
  }
  const text = raw.trim();

  const isoMatch = text.match(/(\d{4})-(\d{2})-\d{2}/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    if (m >= 0 && m <= 11) {
      return monthBucket(y, m);
    }
  }

  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : referenceYear;

  const lower = text.toLowerCase();
  let earliestMonth: number | null = null;

  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (lower.includes(MONTH_NAMES[i])) {
      if (earliestMonth === null || i < earliestMonth) earliestMonth = i;
    }
  }
  if (earliestMonth === null) {
    for (const [abbr, idx] of Object.entries(MONTH_ABBREV)) {
      const pattern = new RegExp(`\\b${abbr}\\b`, "i");
      if (pattern.test(lower)) {
        if (earliestMonth === null || idx < earliestMonth) earliestMonth = idx;
      }
    }
  }
  if (earliestMonth !== null) return monthBucket(year, earliestMonth);

  return { key: "tbd", label: "TBD", sortKey: Number.POSITIVE_INFINITY };
}

function monthBucket(year: number, monthIdx: number): MonthBucket {
  const m = String(monthIdx + 1).padStart(2, "0");
  return {
    key: `${year}-${m}`,
    label: `${LONG_LABEL[monthIdx]} ${year}`,
    sortKey: year * 12 + monthIdx,
  };
}

/** Days held — null if no assignment timestamp. */
export function daysHeld(stockAssignedAt: string | null | undefined): number | null {
  if (!stockAssignedAt) return null;
  const t = new Date(stockAssignedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/** Hold severity for the 90-day rule. */
export function holdSeverity(days: number | null): "ok" | "warn" | "critical" | "unknown" {
  if (days === null) return "unknown";
  if (days >= 90) return "critical";
  if (days >= 60) return "warn";
  return "ok";
}

export const PER_NAT_REASON_LABEL: Record<string, string> = {
  low_deposit: "Low deposit",
  future_delivery: "Future delivery",
  special_order: "Special order",
  manual: "Manual",
};

export { SHORT_LABEL, LONG_LABEL };
