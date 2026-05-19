"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";

export type ShowRow = {
  id: string;
  name: string;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  start_date: string;
  end_date: string;
  contract_count: number;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Display name = "{City} Expo {Month} {Year}" derived from city + start_date.
 * Falls back to the underlying show name if city is missing.
 */
function displayName(show: ShowRow): string {
  if (!show.city || !show.start_date) {
    return show.name.replace(/\s*\[backfill[^\]]*\]\s*/i, "").trim() || show.name;
  }
  const d = new Date(show.start_date + "T00:00:00");
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${show.city} Expo ${month} ${year}`;
}

function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export default function ShowSalesList({ shows }: { shows: ShowRow[] }) {
  const [query, setQuery] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shows;
    return shows.filter((s) => {
      return (
        displayName(s).toLowerCase().includes(q) ||
        (s.city || "").toLowerCase().includes(q) ||
        (s.state || "").toLowerCase().includes(q) ||
        (s.venue_name || "").toLowerCase().includes(q) ||
        s.start_date.includes(q)
      );
    });
  }, [shows, query]);

  // Already sorted by start_date desc from the server query
  const upcoming = filtered.filter((s) => s.end_date >= today);
  const past = filtered.filter((s) => s.end_date < today);

  return (
    <>
      {/* Search */}
      <div className="relative max-w-xl">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by city, state, venue, date…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/40 focus:border-[#00929C]"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        {query && (
          <p className="text-xs text-slate-500 mt-1.5">
            {filtered.length} of {shows.length} shows match
          </p>
        )}
      </div>

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Upcoming &amp; Active ({upcoming.length})
          </h2>
          <div className="space-y-2">
            {upcoming.map((s) => (
              <Row key={s.id} show={s} active />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Past Shows ({past.length})
        </h2>
        {past.length === 0 ? (
          <Card>
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6"
                  />
                </svg>
              }
              title={query ? "No matches in past shows" : "No past shows yet"}
              description={
                query
                  ? "Try a different search term."
                  : "Once shows happen, they'll appear here for review and export."
              }
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {past.map((s) => (
              <Row key={s.id} show={s} active={false} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Row({ show, active }: { show: ShowRow; active: boolean }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Link href={`/shows/${show.id}/workbook`} className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold text-slate-900 truncate">{displayName(show)}</p>
            {active && <Badge variant="default">Active</Badge>}
            {show.contract_count > 0 ? (
              <Badge variant="accent">
                {show.contract_count} {show.contract_count === 1 ? "deal" : "deals"}
              </Badge>
            ) : (
              <Badge variant="outline">No deals yet</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 truncate">
            {formatDateRange(show.start_date, show.end_date)}
            {show.venue_name ? ` · ${show.venue_name}` : ""}
            {[show.city, show.state].filter(Boolean).length
              ? ` · ${[show.city, show.state].filter(Boolean).join(", ")}`
              : ""}
          </p>
        </Link>
        <div className="flex gap-2 sm:shrink-0">
          <Link
            href={`/shows/${show.id}/workbook`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00929C] hover:bg-[#007a82] text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Open Workbook
          </Link>
          <a
            href={`/api/shows/${show.id}/spreadsheet`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
            title="Download Lori-format show sales XLSX (snapshot)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
              />
            </svg>
            .xlsx
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
