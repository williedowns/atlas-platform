"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ServiceRequest = {
  id: string;
  description: string;
  urgency: string;
  contact_method: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  customer: { first_name: string; last_name: string; phone: string | null; email: string } | null;
  equipment: { product_name: string; serial_number: string | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  new: "destructive",
  acknowledged: "warning",
  scheduled: "default",
  completed: "success",
  cancelled: "secondary",
};

const URGENCY_COLORS: Record<string, string> = {
  routine: "secondary",
  urgent: "warning",
  emergency: "destructive",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ServiceRequestsPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("new");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    let q = supabase
      .from("service_requests")
      .select(`
        id, description, urgency, contact_method, status, admin_notes, created_at,
        customer:customers(first_name, last_name, phone, email),
        equipment(product_name, serial_number)
      `)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      q = q.eq("status", statusFilter);
    }

    const { data } = await q;
    const rows = (data ?? []) as unknown as ServiceRequest[];
    setRequests(rows);
    const notes: Record<string, string> = {};
    for (const r of rows) {
      notes[r.id] = r.admin_notes ?? "";
    }
    setNoteValues(notes);
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    await fetch(`/api/admin/service-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setSaving(null);
  }

  async function saveNotes(id: string) {
    setSaving(id + "-notes");
    await fetch(`/api/admin/service-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_notes: noteValues[id] ?? "" }),
    });
    await load();
    setSaving(null);
  }

  const STATUS_OPTIONS = ["new", "acknowledged", "scheduled", "completed", "cancelled"];
  const FILTER_OPTIONS = ["new", "acknowledged", "scheduled", "all"];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Service Requests</h1>
            <p className="text-white/60 text-xs">Customer-submitted service & repair requests</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto pb-24 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors border ${
                statusFilter === s
                  ? "bg-[#010F21] text-white border-[#010F21]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-slate-400 text-sm">
              No {statusFilter === "all" ? "" : statusFilter} requests.
            </CardContent>
          </Card>
        ) : (
          requests.map((r) => (
            <Card key={r.id} className={r.urgency === "emergency" ? "border-red-300" : ""}>
              <CardContent className="p-4">
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-slate-900 text-sm">
                        {r.customer?.first_name} {r.customer?.last_name}
                      </p>
                      <Badge variant={URGENCY_COLORS[r.urgency] as any}>{r.urgency}</Badge>
                      <Badge variant={STATUS_COLORS[r.status] as any}>{r.status}</Badge>
                    </div>
                    {r.equipment && (
                      <p className="text-xs text-slate-500 mb-1">{r.equipment.product_name}</p>
                    )}
                    <p className="text-sm text-slate-700 line-clamp-2">{r.description}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(r.created_at)} · via {r.contact_method}</p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${expanded === r.id ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {expanded === r.id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Full Description</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.description}</p>
                    </div>

                    {r.customer && (
                      <div className="text-sm text-slate-600 space-y-0.5">
                        <p>{r.customer.email}</p>
                        {r.customer.phone && <p>{r.customer.phone}</p>}
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Update Status</p>
                      <div className="flex gap-2 flex-wrap">
                        {STATUS_OPTIONS.filter((s) => s !== r.status).map((s) => (
                          <button
                            key={s}
                            disabled={saving === r.id}
                            onClick={() => updateStatus(r.id, s)}
                            className="py-1 px-3 rounded-lg text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
                          >
                            {saving === r.id ? "…" : `Mark ${s}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Admin Notes</p>
                      <textarea
                        rows={3}
                        value={noteValues[r.id] ?? ""}
                        onChange={(e) => setNoteValues((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Internal notes…"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] resize-none"
                      />
                      <button
                        onClick={() => saveNotes(r.id)}
                        disabled={saving === r.id + "-notes"}
                        className="mt-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-[#00929C] text-white hover:bg-[#007a82] transition-colors disabled:opacity-50"
                      >
                        {saving === r.id + "-notes" ? "Saving…" : "Save Notes"}
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
