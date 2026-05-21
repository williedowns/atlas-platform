"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface DiscountRow {
  label: string;
  amount: number;
}

interface DiscountsEditorProps {
  contractId: string;
  discounts: DiscountRow[];
  canEdit: boolean;
}

interface DraftRow {
  label: string;
  amount: string;
}

function toDraftRows(rows: DiscountRow[]): DraftRow[] {
  return rows.map((r) => ({
    label: r.label ?? "",
    amount: r.amount != null ? String(r.amount) : "",
  }));
}

export default function DiscountsEditor({
  contractId,
  discounts,
  canEdit,
}: DiscountsEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>(() => toDraftRows(discounts));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (!canEdit) return null;

  function addRow() {
    setRows((prev) => [...prev, { label: "", amount: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function save() {
    setError(null);
    const payload: DiscountRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const label = rows[i].label.trim();
      if (label.length === 0) {
        setError(`Row ${i + 1}: label is required`);
        return;
      }
      const amount = Number(rows[i].amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError(`Row ${i + 1}: amount must be a positive number`);
        return;
      }
      payload.push({ label, amount });
    }

    startSaving(async () => {
      const res = await fetch(`/api/contracts/${contractId}/discounts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discounts: payload }),
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
    setRows(toDraftRows(discounts));
    setError(null);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border-2 border-[#00929C]/20 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Discounts</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin-only. Editing archives the current PDF and flags the contract for QBO resync.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setRows(toDraftRows(discounts));
              setEditing(true);
            }}
            className="text-xs font-semibold text-[#00929C] border border-[#00929C]/40 rounded-lg px-3 py-1.5 hover:bg-[#00929C]/10 flex-shrink-0 touch-manipulation"
          >
            Edit Discounts
          </button>
        )}
      </div>

      {!editing ? (
        <div>
          {discounts.length === 0 ? (
            <p className="text-sm italic text-slate-400">No discounts applied</p>
          ) : (
            <ul className="space-y-1">
              {discounts.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm text-slate-700"
                >
                  <span className="truncate">{d.label}</span>
                  <span className="font-semibold text-slate-900 ml-3">
                    −{formatCurrency(Number(d.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-xs italic text-slate-400">
              No discounts. Click &quot;Add discount&quot; to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={r.label}
                    onChange={(e) => updateRow(i, { label: e.target.value })}
                    placeholder="Discount label"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={r.amount}
                    onChange={(e) => updateRow(i, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-28 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 touch-manipulation"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addRow}
            className="w-full px-3 py-2 rounded-xl border border-dashed border-[#00929C]/40 text-xs font-semibold text-[#00929C] hover:bg-[#00929C]/5 touch-manipulation"
          >
            Add discount
          </button>

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
