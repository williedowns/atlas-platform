"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface TaxSettingsEditorProps {
  contractId: string;
  taxRate: number;
  taxExempt: boolean;
  canEdit: boolean;
}

export default function TaxSettingsEditor({
  contractId,
  taxRate,
  taxExempt,
  canEdit,
}: TaxSettingsEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [ratePercent, setRatePercent] = useState<string>(
    (taxRate * 100).toFixed(3).replace(/\.?0+$/, "")
  );
  const [exempt, setExempt] = useState<boolean>(taxExempt);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (!canEdit) return null;

  function cancel() {
    setRatePercent((taxRate * 100).toFixed(3).replace(/\.?0+$/, ""));
    setExempt(taxExempt);
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    const parsed = Number(ratePercent);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 20) {
      setError("Tax rate must be a number between 0 and 20 (percent).");
      return;
    }
    const nextRate = Math.round(parsed * 10000) / 1000000;
    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/tax-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tax_rate: nextRate,
          tax_exempt: exempt,
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

  const displayPercent = (taxRate * 100).toFixed(3).replace(/\.?0+$/, "");

  return (
    <div className="rounded-2xl border-2 border-[#00929C]/20 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#010F21]">Tax Settings</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Sales tax rate and exemption status for this contract.
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
        <div className="space-y-1">
          <p className="text-base font-semibold text-[#010F21]">
            {displayPercent}% tax rate
          </p>
          <p className="text-xs font-medium text-slate-600">
            {taxExempt ? "Tax-exempt (items tax zeroed)" : "Not tax-exempt"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tax rate (%)
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                max="20"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
                className="w-full pl-3 pr-8 py-3 rounded-xl border border-slate-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                %
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Enter as percentage (e.g. 8.25 for 8.25%). Max 20%.
            </p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={exempt}
              onChange={(e) => setExempt(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#00929C] focus:ring-[#00929C]/40"
            />
            <span className="text-sm text-[#010F21]">
              Tax-exempt
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Zeroes items tax for Rx-on-file customers. Doc fee tax still collected.
              </span>
            </span>
          </label>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-900">
              Re-archives PDF and triggers QBO resync.
            </p>
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
              disabled={saving}
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
