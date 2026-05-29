// Resolves a sheet show-tab name (e.g. "Will Rogers") to a single DB show row.
//
// The shows table has heavy duplication (e.g. 7 "Bastrop" rows, 4 "Henderson"),
// so a bare name match is ambiguous. We disambiguate by date window: only an
// active show that hasn't ended and starts within WINDOW_DAYS is a candidate —
// which uniquely picks the one that's actually live this week. If 0 or >1
// candidates survive, we return null and flag it for manual review rather than
// guess wrong (guessing wrong is exactly the bug that caused the Henderson mess).

export interface ShowRow {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  active: boolean;
}

export type ShowResolution =
  | { showId: string; matchedName: string; reason: "matched" }
  | { showId: null; reason: "not-show" | "no-match" | "ambiguous"; candidates?: string[] };

const WINDOW_DAYS = 10;

// Lowercase, strip punctuation, collapse whitespace. This lets a sheet token
// like "Wichita KS" match the DB show "Wichita, KS Hartman Arena — May 2026"
// (the comma/dash would otherwise break a literal substring match).
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Parse YYYY-MM-DD as a local date (no UTC shift).
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function resolveShow(
  showName: string | null,
  shows: ShowRow[],
  today: Date,
): ShowResolution {
  if (!showName || !showName.trim()) return { showId: null, reason: "not-show" };

  const token = norm(showName);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const windowEnd = new Date(startOfToday);
  windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);

  // Name match: the sheet token must appear as a whole whitespace-delimited
  // phrase in the DB show name (space-padding avoids "waco" matching
  // "wacobridge" while still letting "wichita ks" match "Wichita, KS Hartman…").
  const named = shows.filter((s) => s.active && ` ${norm(s.name)} `.includes(` ${token} `));
  if (named.length === 0) return { showId: null, reason: "no-match" };

  // Keep only shows that are live/upcoming within the window (not yet ended,
  // starting on or before windowEnd).
  const inWindow = named.filter((s) => {
    const start = parseISO(s.start_date);
    const end = parseISO(s.end_date);
    return end >= startOfToday && start <= windowEnd;
  });

  if (inWindow.length === 0) {
    return { showId: null, reason: "no-match", candidates: named.map((s) => s.name) };
  }

  // Soonest start wins; a genuine tie on start_date is ambiguous → flag it.
  inWindow.sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime());
  const first = inWindow[0];
  const tie = inWindow.filter((s) => s.start_date === first.start_date);
  if (tie.length > 1) {
    return { showId: null, reason: "ambiguous", candidates: tie.map((s) => s.name) };
  }

  return { showId: first.id, matchedName: first.name, reason: "matched" };
}
