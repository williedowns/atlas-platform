"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ContractRow = Record<string, unknown>;

const SUMMARY_METHODS = [
  { key: "credit_card", label: "Credit Card" },
  { key: "debit_card", label: "Debit Card" },
  { key: "ach", label: "ACH" },
  { key: "cash", label: "Cash" },
  { key: "financing", label: "Financing" },
];

interface ReconcRow {
  groupName: string;
  groupType: "show" | "location";
  byMethod: Record<string, number>;
  total: number;
  contractCount: number;
}

interface TransactionRow {
  payment_id: string;
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

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function buildSummary(contracts: ContractRow[]): ReconcRow[] {
  const map = new Map<string, ReconcRow>();
  for (const c of contracts) {
    if (!c.deposit_paid || (c.deposit_paid as number) <= 0) continue;
    const isShow = !!(c as { show?: { id?: string } }).show?.id;
    const key = isShow
      ? `show-${(c as { show: { id: string } }).show.id}`
      : `loc-${(c as { location?: { id?: string } }).location?.id ?? "unknown"}`;
    const name = isShow
      ? (c as { show: { name: string } }).show.name
      : ((c as { location?: { name?: string } }).location?.name ?? "Unknown");
    const type: "show" | "location" = isShow ? "show" : "location";

    if (!map.has(key)) {
      map.set(key, { groupName: name, groupType: type, byMethod: {}, total: 0, contractCount: 0 });
    }
    const row = map.get(key)!;
    const method = (c.payment_method as string) ?? "unknown";
    row.byMethod[method] = (row.byMethod[method] ?? 0) + (c.deposit_paid as number);
    row.total += c.deposit_paid as number;
    row.contractCount += 1;
  }
  return [...map.values()].sort((a, b) => {
    if (a.groupType !== b.groupType) return a.groupType === "show" ? -1 : 1;
    return b.total - a.total;
  });
}

const METHOD_COLORS: Record<string, string> = {
  "Credit Card": "bg-blue-50 text-blue-700",
  "Debit Card":  "bg-indigo-50 text-indigo-700",
  "ACH":         "bg-violet-50 text-violet-700",
  "Financing":   "bg-emerald-50 text-emerald-700",
  "Down Payment":"bg-blue-50 text-blue-700",
  "Paid in Full":"bg-emerald-50 text-emerald-700",
};

export default function ReconciliationView({ contracts }: { contracts: ContractRow[] }) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "detail">("summary");

  // ── Transaction Detail state ─────────────────────────────────────────────
  const today = todayStr();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo, ...(search ? { search } : {}) });
      const res = await fetch(`/api/bookkeeper/cc-report?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load report");
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search]);

  useEffect(() => {
    if (activeTab === "detail") fetchDetail();
  }, [activeTab, fetchDetail]);

  const downloadPdf = () => {
    const params = new URLSearchParams({ dateFrom, dateTo, ...(search ? { search } : {}) });
    window.open(`/api/bookkeeper/cc-report/pdf?${params}`, "_blank");
  };

  // ── Summary data ─────────────────────────────────────────────────────────
  const summaryRows = buildSummary(contracts);
  const grandTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const row of summaryRows) {
    for (const [method, amount] of Object.entries(row.byMethod)) {
      grandTotals[method] = (grandTotals[method] ?? 0) + amount;
    }
    grandTotal += row.total;
  }
  const activeMethods = SUMMARY_METHODS.filter((m) => summaryRows.some((r) => r.byMethod[m.key]));

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

      {/* ── Header ── */}
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
          {/* ── Tabs ── */}
          <div className="border-t border-slate-100 flex">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === "summary"
                  ? "text-[#00929C] border-b-2 border-[#00929C] bg-white"
                  : "text-slate-500 border-b border-slate-100 hover:text-slate-700"
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("detail")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === "detail"
                  ? "text-[#00929C] border-b-2 border-[#00929C] bg-white"
                  : "text-slate-500 border-b border-slate-100 hover:text-slate-700"
              }`}
            >
              Transaction Detail
            </button>
          </div>

          {/* ── Summary Tab ── */}
          {activeTab === "summary" && (
            summaryRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No deposits to reconcile.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Location / Event</th>
                      {activeMethods.map((m) => (
                        <th key={m.key} className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{m.label}</th>
                      ))}
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Total</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">#</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaryRows.map((row, i) => (
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
                          <td key={m.key} className="px-3 py-3 text-right text-slate-700 whitespace-nowrap">
                            {row.byMethod[m.key] ? formatCurrency(row.byMethod[m.key]) : <span className="text-slate-300">&mdash;</span>}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(row.total)}</td>
                        <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">{row.contractCount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="px-4 py-3 font-bold text-slate-900">Grand Total</td>
                      {activeMethods.map((m) => (
                        <td key={m.key} className="px-3 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {grandTotals[m.key] ? formatCurrency(grandTotals[m.key]) : <span className="text-slate-300">&mdash;</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-bold text-[#00929C] text-base whitespace-nowrap">{formatCurrency(grandTotal)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{summaryRows.reduce((s, r) => s + r.contractCount, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}

          {/* ── Transaction Detail Tab ── */}
          {activeTab === "detail" && (
            <div>
              {/* Filters */}
              <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2 items-center border-b border-slate-100">
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
                  onKeyDown={(e) => e.key === "Enter" && fetchDetail()}
                  className="flex-1 min-w-[160px] text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
                />
                <Button variant="outline" size="sm" onClick={fetchDetail} disabled={loading}>
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

              {/* Status bar */}
              <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-50">
                {loading ? "Loading…" : `${rows.length} transaction${rows.length !== 1 ? "s" : ""} · ${formatCurrency(total)}`}
              </div>

              {error && (
                <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>
              )}

              {!loading && rows.length === 0 && !error && (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">
                  No transactions found for this period.
                </div>
              )}

              {rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Customer</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Location</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Type</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Amount</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((row, i) => (
                        <tr key={row.payment_id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(row.date)}</td>
                          <td className="px-4 py-3 min-w-[140px]">
                            <p className="font-medium text-slate-900 whitespace-nowrap">{row.customer_name}</p>
                            <p className="text-xs text-slate-400">{row.contract_number}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap max-w-[160px] truncate">{row.sales_location}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              METHOD_COLORS[row.payment_type] ?? "bg-slate-100 text-slate-600"
                            }`}>
                              {row.payment_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              METHOD_COLORS[row.method_type] ?? "bg-slate-100 text-slate-600"
                            }`}>
                              {row.method_type}
                            </span>
                            {row.card_last4 && (
                              <span className="text-slate-400 text-xs ml-1.5">···{row.card_last4}</span>
                            )}
                            {row.method_type === "Financing" && row.provider && row.provider !== "Financing" && (
                              <span className="text-slate-500 text-xs ml-1">({row.provider})</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-700">
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
