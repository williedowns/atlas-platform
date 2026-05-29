"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Summary {
  scope: number;
  new: number;
  updated: number;
  show_linked: number;
  needs_review: { key: string; show_name: string; reason: string }[];
  extra_in_db: string[];
  duration_ms: number;
}

type Phase = "idle" | "previewing" | "preview" | "syncing" | "done" | "error";

export function SyncSheetButton({ lastSynced }: { lastSynced: string | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(preview: boolean): Promise<Summary> {
    const res = await fetch(`/api/admin/inventory/sync${preview ? "?preview=1" : ""}`, { method: "POST" });
    // A gateway timeout (504) returns HTML, not JSON — parse defensively so the
    // user gets a real message instead of "Unexpected token <".
    const text = await res.text();
    let json: (Summary & { error?: string }) | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) throw new Error(json?.error ?? `Sync failed (HTTP ${res.status})`);
    if (!json) throw new Error("The server returned an unexpected response. The sync may still have run — reload to check.");
    return json;
  }

  async function startPreview() {
    setError(null);
    setPhase("previewing");
    try {
      setSummary(await call(true));
      setPhase("preview");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function applySync() {
    setError(null);
    setPhase("syncing");
    try {
      setSummary(await call(false));
      setPhase("done");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  function close() {
    setPhase("idle");
    setSummary(null);
    setError(null);
  }

  const busy = phase === "previewing" || phase === "syncing";
  const lastLabel = lastSynced
    ? `Synced ${new Date(lastSynced).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : "Never synced";

  return (
    <>
      <div className="flex flex-col items-end">
        <button
          onClick={startPreview}
          disabled={busy}
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
        >
          <svg
            className={`w-4 h-4 ${phase === "previewing" ? "animate-spin" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {phase === "previewing" ? "Checking…" : "Sync from Sheet"}
        </button>
        <span className="text-white/50 text-[11px] mt-0.5">{lastLabel}</span>
      </div>

      {(phase === "preview" || phase === "syncing" || phase === "done" || phase === "error") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : close}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-5 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[#010F21]">
              {phase === "done" ? "Sync complete" : phase === "error" ? "Sync error" : "Review sync"}
            </h2>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            {summary && phase !== "error" && (
              <div className="mt-3 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="In scope" value={summary.scope} />
                  <Stat label="Show-linked" value={summary.show_linked} />
                  <Stat label={phase === "done" ? "Added" : "New"} value={summary.new} />
                  <Stat label={phase === "done" ? "Updated" : "To update"} value={summary.updated} />
                </div>

                {summary.needs_review.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                    <p className="font-semibold text-amber-800">
                      {summary.needs_review.length} unit(s) need a show match
                    </p>
                    <ul className="mt-1 text-xs text-amber-700 space-y-0.5 max-h-32 overflow-y-auto">
                      {summary.needs_review.map((n) => (
                        <li key={n.key}>{n.key} — “{n.show_name}” ({n.reason})</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.extra_in_db.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {summary.extra_in_db.length} active unit(s) in the system aren’t on the sheet — left untouched (never deleted).
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end mt-5">
              {phase === "preview" && (
                <>
                  <button onClick={close} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600">
                    Cancel
                  </button>
                  <button onClick={applySync} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00929C] text-white">
                    Apply Sync
                  </button>
                </>
              )}
              {phase === "syncing" && <span className="text-sm text-slate-500 py-2">Syncing…</span>}
              {(phase === "done" || phase === "error") && (
                <button onClick={close} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#010F21] text-white">
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5 text-center">
      <p className="text-xl font-bold text-[#010F21]">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
