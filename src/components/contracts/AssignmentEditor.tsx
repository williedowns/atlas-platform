"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AssignmentEditorProps {
  contractId: string;
  currentShowId: string | null;
  currentShowName: string | null;
  currentLocationId: string | null;
  currentLocationName: string | null;
  currentSalesRepId: string | null;
  currentSalesRepName: string | null;
  canEdit: boolean;
}

interface ShowOption {
  id: string;
  name: string;
}

interface LocationOption {
  id: string;
  name: string;
}

interface SalesRepOption {
  id: string;
  full_name: string;
}

export default function AssignmentEditor({
  contractId,
  currentShowId,
  currentShowName,
  currentLocationId,
  currentLocationName,
  currentSalesRepId,
  currentSalesRepName,
  canEdit,
}: AssignmentEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [shows, setShows] = useState<ShowOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRepOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [showId, setShowId] = useState<string | null>(currentShowId);
  const [locationId, setLocationId] = useState<string | null>(currentLocationId);
  const [salesRepId, setSalesRepId] = useState<string | null>(currentSalesRepId);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    setLoadingOptions(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("shows").select("id, name").order("name"),
      supabase.from("locations").select("id, name").order("name"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["sales_rep", "manager", "admin"])
        .eq("active", true)
        .order("full_name"),
    ]).then(([showsRes, locationsRes, repsRes]) => {
      if (cancelled) return;
      setShows((showsRes.data as ShowOption[] | null) ?? []);
      setLocations((locationsRes.data as LocationOption[] | null) ?? []);
      setSalesReps((repsRes.data as SalesRepOption[] | null) ?? []);
      setLoadingOptions(false);
    }).catch(() => {
      if (!cancelled) setLoadingOptions(false);
    });
    return () => {
      cancelled = true;
    };
  }, [editing]);

  if (!canEdit) return null;

  const dirty =
    showId !== currentShowId ||
    locationId !== currentLocationId ||
    salesRepId !== currentSalesRepId;

  function save() {
    setError(null);
    const payload: Record<string, string | null> = {};
    if (showId !== currentShowId) payload.show_id = showId;
    if (locationId !== currentLocationId) {
      if (!locationId) {
        setError("Location is required.");
        return;
      }
      payload.location_id = locationId;
    }
    if (salesRepId !== currentSalesRepId) {
      if (!salesRepId) {
        setError("Sales rep is required.");
        return;
      }
      payload.sales_rep_id = salesRepId;
    }
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Update failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setShowId(currentShowId);
    setLocationId(currentLocationId);
    setSalesRepId(currentSalesRepId);
    setError(null);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border-2 border-[#00929C]/20 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#010F21]">Assignment</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Show, location, and sales rep on file for this contract.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 flex-shrink-0 touch-manipulation"
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Show</dt>
            <dd className="text-sm font-semibold text-[#010F21] mt-0.5">
              {currentShowName ?? <span className="italic text-slate-400">No show</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
            <dd className="text-sm font-semibold text-[#010F21] mt-0.5">
              {currentLocationName ?? <span className="italic text-slate-400">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Sales Rep</dt>
            <dd className="text-sm font-semibold text-[#010F21] mt-0.5">
              {currentSalesRepName ?? <span className="italic text-slate-400">—</span>}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-1">
              Show
            </label>
            <select
              value={showId ?? ""}
              onChange={(e) => setShowId(e.target.value === "" ? null : e.target.value)}
              disabled={loadingOptions || saving}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            >
              <option value="">No show</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-1">
              Location
            </label>
            <select
              value={locationId ?? ""}
              onChange={(e) => setLocationId(e.target.value === "" ? null : e.target.value)}
              disabled={loadingOptions || saving}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            >
              <option value="" disabled>
                Select location…
              </option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-1">
              Sales Rep
            </label>
            <select
              value={salesRepId ?? ""}
              onChange={(e) => setSalesRepId(e.target.value === "" ? null : e.target.value)}
              disabled={loadingOptions || saving}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            >
              <option value="" disabled>
                Select sales rep…
              </option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving || loadingOptions}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#00929C] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#007a82] touch-manipulation"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 touch-manipulation"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
