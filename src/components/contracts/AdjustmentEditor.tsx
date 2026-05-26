"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface AdjustmentEditorProps {
  contractId: string;
  amount: number;
  reason: string | null;
  canEdit: boolean;
}

const MAX_ADJUSTMENT_ABS = 5;

export default function AdjustmentEditor({
  contractId,
  amount,
  reason,
  canEdit,
}: AdjustmentEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState<string>(amount ? amount.toFixed(2) : "");
  const [draftReason, setDraftReason] = useState<string>(reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (!canEdit) return null;

  const parsedAmount = draftAmount.trim() === "" ? 0 : Number(draftAmount);
  const amountInvalid = !Number.isFinite(parsedAmount) || Math.abs(parsedAmount) > MAX_ADJUSTMENT_ABS;
  const reasonMissing = parsedAmount !== 0 && draftReason.trim().length === 0;
  const unchanged =
    Math.round(parsedAmount * 100) === Math.round(amount * 100) &&
    draftReason.trim() === (reason ?? "").trim();
  const saveDisabled = amountInvalid || reasonMissing || unchanged || saving;

  function save() {
    setError(null);
    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/adjustment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          reason: draftReason.trim(),
        }),
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
    setDraftAmount(amount ? amount.toFixed(2) : "");
    setDraftReason(reason ?? "");
    setError(null);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border-2 border-[#00929C]/20 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Total Adjustment</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin-only. Penny-level reconciliation for financing/payment mismatches. Capped at ±${MAX_ADJUSTMENT_ABS.toFixed(2)}. Editing archives the current PDF and flags the contract for QBO resync.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraftAmount(amount ? amount.toFixed(2) : "");
              setDraftReason(reason ?? "");
              setEditing(true);
            }}
            className="text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 flex-shrink-0 touch-manipulation"
          >
            {amount === 0 ? "Add Adjustment" : "Edit"}
          </button>
        )}
      </div>

      {!editing ? (
        <div>
          {amount === 0 ? (
            <p className="text-sm italic text-slate-400">No adjustment applied</p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">Current adjustment</span>
                <span className={`font-semibold ${amount < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {amount > 0 ? "+" : ""}{formatCurrency(amount)}
                </span>
              </div>
              {reason && (
                <p className="text-xs text-slate-500 italic">{reason}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Amount (use negative for credit, positive for charge)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={-MAX_ADJUSTMENT_ABS}
              max={MAX_ADJUSTMENT_ABS}
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              placeholder="-0.01"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            />
            {amountInvalid && draftAmount.trim() !== "" && (
              <p className="text-xs text-red-600">
                Amount must be a number between -{MAX_ADJUSTMENT_ABS.toFixed(2)} and {MAX_ADJUSTMENT_ABS.toFixed(2)}.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Reason {parsedAmount !== 0 && <span className="text-red-600">*</span>}
            </label>
            <input
              type="text"
              value={draftReason}
              onChange={(e) => setDraftReason(e.target.value)}
              placeholder="e.g. GreenSky funded $0.01 under calculated total"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            />
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
              disabled={saveDisabled}
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
