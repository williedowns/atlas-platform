"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

type ContractRow = Record<string, any>;

const PAYMENT_METHODS = [
  { key: "credit_card", label: "Credit Card" },
  { key: "debit_card", label: "Debit Card" },
  { key: "ach", label: "ACH" },
  { key: "cash", label: "Cash" },
  { key: "financing", label: "Financing" },
];

interface ReconcRow {
  groupName: string;
  groupType: "show" | "location";
  dateRange: string;
  byMethod: Record<string, number>;
  total: number;
  contractCount: number;
}

function buildReconciliation(contracts: ContractRow[]): ReconcRow[] {
  const map = new Map<string, ReconcRow>();

  for (const c of contracts) {
    if (!c.deposit_paid || c.deposit_paid <= 0) continue;

    const isShow = !!c.show?.id;
    const key = isShow ? `show-${c.show.id}` : `loc-${c.location?.id ?? "unknown"}`;
    const name = isShow ? c.show.name : (c.location?.name ?? "Unknown");
    const type: "show" | "location" = isShow ? "show" : "location";

    if (!map.has(key)) {
      map.set(key, {
        groupName: name,
        groupType: type,
        dateRange: "",
        byMethod: {},
        total: 0,
        contractCount: 0,
      });
    }

    const row = map.get(key)!;
    const method = c.payment_method ?? "unknown";
    row.byMethod[method] = (row.byMethod[method] ?? 0) + (c.deposit_paid ?? 0);
    row.total += c.deposit_paid ?? 0;
    row.contractCount += 1;
  }

  return [...map.values()].sort((a, b) => {
    if (a.groupType !== b.groupType) return a.groupType === "show" ? -1 : 1;
    return b.total - a.total;
  });
}

export default function ReconciliationView({ contracts }: { contracts: ContractRow[] }) {
  const [expanded, setExpanded] = useState(true);
  const rows = buildReconciliation(contracts);

  // Grand totals by method
  const grandTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const row of rows) {
    for (const [method, amount] of Object.entries(row.byMethod)) {
      grandTotals[method] = (grandTotals[method] ?? 0) + amount;
    }
    grandTotal += row.total;
  }

  const activeMethods = PAYMENT_METHODS.filter(
    (m) => rows.some((r) => r.byMethod[m.key])
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="font-semibold text-slate-900">Deposit Reconciliation</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#00929C]">{formatCurrency(grandTotal)} total</span>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center border-t border-slate-100">No deposits to reconcile.</p>
          ) : (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Location / Event</th>
                    {activeMethods.map((m) => (
                      <th key={m.key} className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{m.label}</th>
                    ))}
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${row.groupType === "show" ? "bg-[#00929C]/10 text-[#00929C]" : "bg-slate-100 text-slate-500"}`}>
                            {row.groupType === "show" ? "Event" : "Store"}
                          </span>
                          <span className="font-medium text-slate-900">{row.groupName}</span>
                        </div>
                      </td>
                      {activeMethods.map((m) => (
                        <td key={m.key} className="px-3 py-3 text-right text-slate-700">
                          {row.byMethod[m.key] ? formatCurrency(row.byMethod[m.key]) : <span className="text-slate-300">&mdash;</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(row.total)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{row.contractCount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-4 py-3 font-bold text-slate-900">Grand Total</td>
                    {activeMethods.map((m) => (
                      <td key={m.key} className="px-3 py-3 text-right font-bold text-slate-900">
                        {grandTotals[m.key] ? formatCurrency(grandTotals[m.key]) : <span className="text-slate-300">&mdash;</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold text-[#00929C] text-base">{formatCurrency(grandTotal)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{rows.reduce((s, r) => s + r.contractCount, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
