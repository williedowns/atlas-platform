"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface AchQueueRow {
  payment_id: string;
  contract_id: string;
  contract_number: string;
  amount: number;
  customer_name: string;
  customer_phone: string | null;
  sales_rep_name: string | null;
  sale_date: string;
  product_summary: string;
  routing_number: string | null;
  account_number: string | null;
  account_type: string | null;
  account_holder_name: string | null;
  notes: string | null;
  processed_at: string | null;
  processed_by_name: string | null;
}

interface AchQueueTableProps {
  active: AchQueueRow[];
  completed: AchQueueRow[];
  canMarkRan: boolean;
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  PERSONAL_CHECKING: "Personal Checking",
  PERSONAL_SAVINGS: "Personal Savings",
  BUSINESS_CHECKING: "Business Checking",
};

export default function AchQueueTable({ active, completed, canMarkRan }: AchQueueTableProps) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const rows = tab === "active" ? active : completed;
  const totalActive = active.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      {/* ── Summary banner ── */}
      <div className="rounded-2xl border-2 border-[#00929C]/30 bg-[#00929C]/5 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide font-bold text-[#00929C]">Pending To Run</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalActive)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{active.length} ACH{active.length === 1 ? "" : "s"} waiting on the office</p>
        </div>
        {canMarkRan && active.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">
            Action required
          </span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            tab === "active"
              ? "border-[#00929C] text-[#00929C]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Active ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("completed")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            tab === "completed"
              ? "border-[#00929C] text-[#00929C]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Completed in last 30 days ({completed.length})
        </button>
      </div>

      {/* ── Empty state ── */}
      {rows.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            {tab === "active"
              ? "No ACHs waiting on the office. New ones appear here automatically when sales reps save them for office processing."
              : "No ACHs marked ran in the last 30 days."}
          </p>
        </div>
      )}

      {/* ── Row list ── */}
      <ul className="space-y-3">
        {rows.map((row) => (
          <AchQueueRowCard
            key={row.payment_id}
            row={row}
            isActive={tab === "active"}
            canMarkRan={canMarkRan && tab === "active"}
          />
        ))}
      </ul>
    </div>
  );
}

function AchQueueRowCard({
  row,
  isActive,
  canMarkRan,
}: {
  row: AchQueueRow;
  isActive: boolean;
  canMarkRan: boolean;
}) {
  const router = useRouter();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string>(row.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function markRan() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/payments/${row.payment_id}/mark-ran`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/contracts/${row.contract_id}`}
              className="font-bold text-slate-900 hover:text-[#00929C]"
            >
              {row.customer_name}
            </Link>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">{row.contract_number}</span>
            {row.sales_rep_name && (
              <>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">Rep: {row.sales_rep_name}</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Sold {formatDate(row.sale_date)} · {row.product_summary}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-black text-emerald-700">{formatCurrency(row.amount)}</p>
          {row.processed_at && (
            <p className="text-xs text-slate-500 mt-0.5">
              Ran {formatDate(row.processed_at)} by {row.processed_by_name ?? "—"}
            </p>
          )}
        </div>
      </div>

      {/* Bank info grid */}
      <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-lg p-3">
        <Field label="Routing #" value={row.routing_number ?? "—"} mono />
        <Field label="Account #" value={row.account_number ?? "—"} mono />
        <Field label="Type" value={ACCOUNT_TYPE_LABEL[row.account_type ?? ""] ?? row.account_type ?? "—"} />
        <Field label="Account Holder" value={row.account_holder_name ?? "—"} />
      </div>

      {/* Notes display / editor */}
      {!editingNotes && row.notes && (
        <div className="text-xs italic text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {row.notes}
        </div>
      )}

      {canMarkRan && (
        <>
          {!editingNotes ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={markRan}
                disabled={pending}
                className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700"
              >
                {pending ? "Marking…" : "Mark as Ran"}
              </button>
              <button
                type="button"
                onClick={() => setEditingNotes(true)}
                disabled={pending}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {row.notes ? "Edit Note" : "Add Note"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={2}
                placeholder='e.g. "Re-ran on 9-11 — first attempt rejected, account # corrected with customer"'
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={markRan}
                  disabled={pending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700"
                >
                  {pending ? "Saving…" : "Save Note & Mark Ran"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNotes(false);
                    setNotesDraft(row.notes ?? "");
                  }}
                  disabled={pending}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!canMarkRan && isActive && (
        <p className="text-xs text-slate-400 italic">
          The office (Lindy) runs this one. You&apos;ll see the status update here once it&apos;s done.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </li>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{label}</p>
      <p className={`text-sm text-slate-900 ${mono ? "font-mono" : ""} truncate`}>{value}</p>
    </div>
  );
}
