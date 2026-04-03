"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type LeadStatus = "new" | "contacted" | "hot" | "converted" | "lost";

interface Lead {
  id: string;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  interest?: string | null;
  status: LeadStatus;
  created_at: string;
  show?: { name: string } | null;
}

const STATUS_COLORS: Record<LeadStatus, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  new: "default",
  contacted: "warning",
  hot: "warning",
  converted: "success",
  lost: "destructive",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  hot: "🔥 Hot",
  converted: "Converted",
  lost: "Lost",
};

type FilterStatus = "active" | "all" | LeadStatus;

const FILTER_OPTIONS: { label: string; value: FilterStatus }[] = [
  { label: "Active", value: "active" },
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Hot 🔥", value: "hot" },
  { label: "Converted", value: "converted" },
  { label: "Lost", value: "lost" },
];

export default function LeadsPipeline({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState<FilterStatus>("active");

  if (leads.length === 0) return null;

  const filtered = leads.filter((l) => {
    if (filter === "active") return l.status !== "converted" && l.status !== "lost";
    if (filter === "all") return true;
    return l.status === filter;
  });

  const activeCount = leads.filter((l) => l.status !== "converted" && l.status !== "lost").length;
  const hotCount = leads.filter((l) => l.status === "hot").length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Section header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">Leads Pipeline</p>
          {activeCount > 0 && (
            <span className="bg-[#00929C] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
          {hotCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {hotCount} 🔥
            </span>
          )}
        </div>
        <Link href="/leads" className="text-xs text-[#00929C] font-medium hover:underline">
          View all →
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-slate-100">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              filter === f.value
                ? "bg-[#010F21] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Leads list */}
      {filtered.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-400 text-center">No leads match this filter.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">
                    {lead.first_name} {lead.last_name ?? ""}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {lead.phone ?? "No phone"}
                    {lead.interest ? ` · ${lead.interest}` : ""}
                    {lead.show?.name ? ` · ${lead.show.name}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                  <Badge variant={STATUS_COLORS[lead.status]}>
                    {STATUS_LABELS[lead.status]}
                  </Badge>
                  <p className="text-xs text-slate-400">{formatDate(lead.created_at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
