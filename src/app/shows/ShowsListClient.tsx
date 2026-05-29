"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

type Show = {
  id: string;
  name: string;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  start_date: string;
  end_date: string;
  active: boolean | null;
};

type StatusFilter = "upcoming" | "past" | "all";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

export default function ShowsListClient({
  shows,
  today,
  canEditShows,
}: {
  shows: Show[];
  today: string;
  canEditShows: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("upcoming");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = shows.filter((s) => {
      if (status === "upcoming" && s.end_date < today) return false;
      if (status === "past" && s.end_date >= today) return false;
      if (!q) return true;
      return [s.name, s.venue_name, s.city, s.state]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
    });
    // Upcoming: soonest first. Past/All: most recent first.
    return matches.sort((a, b) =>
      status === "upcoming"
        ? a.start_date.localeCompare(b.start_date)
        : b.start_date.localeCompare(a.start_date)
    );
  }, [shows, query, status, today]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Input
          type="search"
          placeholder="Search by show name, venue, city, or state…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search shows"
        />
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={
                status === f.value
                  ? "rounded-full px-4 py-1.5 text-sm font-medium bg-[#00929C] text-white"
                  : "rounded-full px-4 py-1.5 text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
              }
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-slate-500">
            {filtered.length} {filtered.length === 1 ? "show" : "shows"}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="No shows match"
            description="Try a different search term or filter."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((show) => {
            const isPast = show.end_date < today;
            const isInactive = show.active === false;
            return (
              <div key={show.id} className="relative">
                <Link href={`/shows/${show.id}`} className="block">
                  <Card
                    className={
                      "active:bg-slate-50 hover:shadow-md transition-shadow cursor-pointer" +
                      (isPast || isInactive ? " opacity-70" : "")
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 text-lg">{show.name}</p>
                          <p className="text-slate-600 mt-0.5">{show.venue_name}</p>
                          <p className="text-slate-500 text-sm">
                            {show.city}, {show.state}
                          </p>
                        </div>
                        <div className="text-right ml-3">
                          {isInactive ? (
                            <Badge variant="secondary" className="mb-1">Inactive</Badge>
                          ) : isPast ? (
                            <Badge variant="secondary" className="mb-1">Past</Badge>
                          ) : (
                            <Badge variant="default" className="mb-1">Active</Badge>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(show.start_date)}
                            {show.start_date !== show.end_date && ` – ${formatDate(show.end_date)}`}
                          </p>
                          {canEditShows && <span className="text-xs invisible block">Edit / QBO</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                {canEditShows && (
                  <Link
                    href={`/admin/shows/${show.id}`}
                    className="absolute bottom-4 right-4 text-xs text-[#00929C] underline hover:text-[#007a82] transition-colors"
                  >
                    Edit / QBO
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
