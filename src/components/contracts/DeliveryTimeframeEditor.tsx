"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const TIMEFRAME_PRESETS = [
  "1-2 weeks",
  "2-3 weeks",
  "3-4 weeks",
  "4-6 weeks",
  "6-8 weeks",
  "8-10 weeks",
  "10-12 weeks",
] as const;

interface DeliveryTimeframeEditorProps {
  contractId: string;
  currentValue: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  /**
   * If false, render read-only (no edit UI). Sales reps see the current
   * timeframe but cannot change it after contract creation per business
   * rule — only admin/manager can edit.
   */
  canEdit: boolean;
  /**
   * Firm scheduled delivery date (delivery_work_orders.scheduled_date) — when
   * present, the customer-facing portal swaps from showing the timeframe to
   * showing the firm date. Surfaced here so admins know when their estimate
   * has been superseded by a real schedule.
   */
  firmScheduledDate: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DeliveryTimeframeEditor({
  contractId,
  currentValue,
  updatedAt,
  updatedByName,
  canEdit,
  firmScheduledDate,
}: DeliveryTimeframeEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">(() =>
    currentValue && !(TIMEFRAME_PRESETS as readonly string[]).includes(currentValue) ? "custom" : "preset"
  );
  const [presetValue, setPresetValue] = useState<string>(
    currentValue && (TIMEFRAME_PRESETS as readonly string[]).includes(currentValue) ? currentValue : ""
  );
  const [customValue, setCustomValue] = useState<string>(
    currentValue && !(TIMEFRAME_PRESETS as readonly string[]).includes(currentValue) ? currentValue : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const draftValue = mode === "preset" ? presetValue : customValue.trim();
  const dirty = draftValue !== (currentValue ?? "");

  function save() {
    setError(null);
    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/delivery-timeframe`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_timeframe: draftValue }),
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
    setMode(currentValue && !(TIMEFRAME_PRESETS as readonly string[]).includes(currentValue) ? "custom" : "preset");
    setPresetValue(currentValue && (TIMEFRAME_PRESETS as readonly string[]).includes(currentValue) ? currentValue : "");
    setCustomValue(currentValue && !(TIMEFRAME_PRESETS as readonly string[]).includes(currentValue) ? currentValue : "");
    setError(null);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border-2 border-[#00929C]/20 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Estimated Delivery Timeframe</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer sees this in their portal until a firm delivery date is scheduled.
          </p>
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 flex-shrink-0 touch-manipulation"
          >
            {currentValue ? "Edit" : "Set"}
          </button>
        )}
      </div>

      {firmScheduledDate && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-800">
            Firm delivery scheduled · {formatDate(firmScheduledDate)}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            The customer's portal now shows this scheduled date instead of the timeframe estimate below.
          </p>
        </div>
      )}

      {!editing ? (
        <div>
          {currentValue ? (
            <p className="text-base font-semibold text-slate-900">{currentValue}</p>
          ) : (
            <p className="text-sm italic text-slate-400">No timeframe set yet</p>
          )}
          {updatedAt && (
            <p className="text-xs text-slate-400 mt-1">
              Last updated {formatDate(updatedAt)}
              {updatedByName ? ` by ${updatedByName}` : ""}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 w-full">
            <button
              type="button"
              onClick={() => setMode("preset")}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === "preset" ? "bg-[#00929C] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Quick pick
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === "custom" ? "bg-[#00929C] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom
            </button>
          </div>

          {mode === "preset" ? (
            <div className="flex flex-wrap gap-2">
              {TIMEFRAME_PRESETS.map((p) => {
                const active = presetValue === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPresetValue(p)}
                    className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors touch-manipulation ${
                      active
                        ? "bg-[#00929C] text-white border-[#00929C]"
                        : "bg-white text-slate-700 border-slate-200 hover:border-[#00929C]/40"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder='e.g. "Mid-June", "After July 4th"'
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            />
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
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
            {currentValue && draftValue !== "" && (
              <button
                type="button"
                onClick={() => {
                  setPresetValue("");
                  setCustomValue("");
                }}
                disabled={saving}
                className="px-3 py-2.5 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 touch-manipulation"
                title="Clear the timeframe"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
