"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TransactionRow {
  payment_id: string;
  contract_id: string;
  date: string;
  customer_name: string;
  product_size: string;
  sales_location: string;
  payment_type: string;
  amount: number;
  method_type: string;
  card_type: string | null;
  card_last4: string | null;
  contract_number: string;
  provider: string | null;
}

const METHOD_BADGE: Record<string, string> = {
  "Credit Card": "bg-blue-50 text-blue-700",
  "Debit Card":  "bg-indigo-50 text-indigo-700",
  "ACH":         "bg-violet-50 text-violet-700",
  "Financing":   "bg-emerald-50 text-emerald-700",
  "Cash":        "bg-slate-100 text-slate-600",
  "Check":       "bg-slate-100 text-slate-600",
};


function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function thirtyDaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric",
  });
}

// contracts prop kept for API compatibility but not used in this view
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ReconciliationView({ contracts: _ }: { contracts: unknown[] }) {
  const [expanded, setExpanded] = useState(true);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgoStr);
  const [dateTo, setDateTo]     = useState(todayStr);
  const [search, setSearch]     = useState("");
  const [rows, setRows]         = useState<TransactionRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ dateFrom, dateTo, ...(search ? { search } : {}) });
      const res  = await fetch(`/api/bookkeeper/cc-report?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const downloadPdf = () => {
    const p = new URLSearchParams({ dateFrom, dateTo, ...(search ? { search } : {}) });
    window.open(`/api/bookkeeper/cc-report/pdf?${p}`, "_blank");
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

      {/* ── Collapsible header ── */}
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
          <p className="text-xs text-slate-500">
            {loading ? "Loading…" : `${rows.length} transaction${rows.length !== 1 ? "s" : ""} · ${formatCurrency(total)}`}
          </p>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <>
          {/* ── Filters row ── */}
          <div className="border-t border-slate-100 px-4 py-3 flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 font-medium whitespace-nowrap">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 font-medium whitespace-nowrap">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              />
            </div>
            <input
              type="text"
              placeholder="Search customer, contract, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchRows()}
              className="flex-1 min-w-[160px] text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
            />
            <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
              {loading ? "…" : "Search"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadPdf}
              disabled={rows.length === 0}
              className="flex items-center gap-1.5 text-[#00929C] border-[#00929C]/30 hover:bg-[#00929C]/5 whitespace-nowrap"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </Button>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-t border-red-100">{error}</div>
          )}

          {/* ── Empty state ── */}
          {!loading && rows.length === 0 && !error && (
            <div className="px-4 py-8 text-center text-slate-400 text-sm border-t border-slate-100">
              No transactions found for this period.
            </div>
          )}

          {/* ── Table ── */}
          {rows.length > 0 && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Customer</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Product / Size</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Location</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Amount</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, i) => (
                    <tr key={row.payment_id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(row.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.contract_id ? (
                          <Link
                            href={`/contracts/${row.contract_id}`}
                            className="group block hover:text-[#00929C] transition-colors"
                          >
                            <p className="font-medium text-slate-900 group-hover:text-[#00929C]">{row.customer_name}</p>
                            <p className="text-xs text-slate-400 group-hover:text-[#00929C]/70">{row.contract_number}</p>
                          </Link>
                        ) : (
                          <>
                            <p className="font-medium text-slate-900">{row.customer_name}</p>
                            <p className="text-xs text-slate-400">{row.contract_number}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[180px]">
                        <p className="truncate">{row.product_size}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap max-w-[140px]">
                        <p className="truncate">{row.sales_location}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.payment_type === "Paid in Full"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}>
                          {row.payment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          METHOD_BADGE[row.method_type] ?? "bg-slate-100 text-slate-600"
                        }`}>
                          {row.method_type === "Financing" && row.provider
                            ? row.provider
                            : row.method_type}
                        </span>
                        {row.card_last4 && (
                          <span className="text-slate-400 text-xs ml-1.5">···{row.card_last4}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-700">
                      Total — {rows.length} transaction{rows.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-base font-bold text-[#010F21]">
                      {formatCurrency(total)}
                    </td>
                    <td />
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
