// Timezone-aware day boundaries.
//
// Atlas runs in Central Time (Texas). The dashboard previously computed
// "today" / "yesterday" / "this month" using `new Date().toISOString()` —
// which is UTC. That caused the today-revenue cards to keep showing late-
// evening Central contracts as "today's" for ~24 hours after they were
// signed (UTC midnight ≠ Central midnight; in May UTC = CDT + 5h).
//
// These helpers compute day boundaries in a named timezone and return
// instants suitable for `created_at >= ?` queries against a timestamptz
// column.
//
// Default tz is America/Chicago. Override per-call if you need a different
// org's timezone later.

export const ATLAS_TIMEZONE = "America/Chicago" as const;

/**
 * Returns the UTC instant corresponding to 00:00:00 of the given date, as
 * observed in the named timezone. DST-safe via Intl.DateTimeFormat.
 *
 * Example: localDayStartUTC(new Date("2026-05-07T18:00:00Z"), "America/Chicago")
 *          → 2026-05-07T05:00:00Z   (= midnight CDT on May 7)
 */
export function localDayStartUTC(now: Date, tz: string = ATLAS_TIMEZONE): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const Y = Number(pick("year"));
  const M = Number(pick("month"));
  const D = Number(pick("day"));
  // en-US returns "24" at midnight in some runtimes — wrap with mod 24
  const h = Number(pick("hour")) % 24;
  const m = Number(pick("minute"));
  const s = Number(pick("second"));
  // Offset between UTC clock and the tz clock at this instant
  const asIfUtc = Date.UTC(Y, M - 1, D, h, m, s);
  const offsetMs = asIfUtc - now.getTime();
  // Local midnight, expressed as if UTC, shifted by the same offset
  const midnightAsIfUtc = Date.UTC(Y, M - 1, D, 0, 0, 0);
  return new Date(midnightAsIfUtc - offsetMs);
}

/** Today's start in the given tz, as a UTC instant. */
export function todayStartUTC(tz: string = ATLAS_TIMEZONE): Date {
  return localDayStartUTC(new Date(), tz);
}

/** N days ago at start-of-day in tz, as a UTC instant. */
export function daysAgoStartUTC(days: number, tz: string = ATLAS_TIMEZONE): Date {
  const start = todayStartUTC(tz);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

/** First day of the current month at start-of-day in tz, as a UTC instant. */
export function monthStartUTC(tz: string = ATLAS_TIMEZONE): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const Y = Number(pick("year"));
  const M = Number(pick("month"));
  // Construct the 1st of this month in tz, then convert to UTC instant
  // by reusing localDayStartUTC's offset math via a synthetic anchor
  const anchorAsIfUtc = Date.UTC(Y, M - 1, 1, 12, 0, 0); // noon to dodge DST edges
  const anchor = new Date(anchorAsIfUtc);
  return localDayStartUTC(anchor, tz);
}

/** Same date as `today` but as an ISO yyyy-mm-dd string in the given tz. */
export function todayDateStringInTZ(tz: string = ATLAS_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** YYYY-MM-DD shifted by N days from today in the given tz (DST-safe via calendar math on the string). */
export function dateStringInTZOffsetDays(offsetDays: number, tz: string = ATLAS_TIMEZONE): string {
  const today = todayDateStringInTZ(tz);
  const [y, m, d] = today.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return shifted.toISOString().slice(0, 10);
}

/** Render a YYYY-MM-DD date string as "Wed · May 20" (matches list-view labels). */
export function formatDayShort(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T12:00:00");
  return d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .replace(",", " ·");
}
