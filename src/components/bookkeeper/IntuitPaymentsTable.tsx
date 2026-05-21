"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface IntuitRow {
  transId: string;
  date: string;
  cardholderName: string;
  cardBrand: string | null;
  cardLast4: string | null;
  creditDebit: string;
  type: string;
  status: string;
  comment: string;
  amount: number;
  fee: number | null;
  contractNumber: string | null;
  contractId: string | null;
  isRefund: boolean;
  surchargeAmount: number;
  receiptUrl: string | null;
  paymentId: string;
}

interface IntuitTotals {
  chargesCount: number;
  refundsCount: number;
  gross: number;
  surcharges: number;
}

interface QBOMatchEntry {
  qbo_payment_id: string;
  total: number;
  txn_date: string;
  customer_name: string | null;
}

interface Props {
  initialFrom: string;
  initialTo: string;
  invoiceIdsByContractId: Record<string, string[]>;
  defaultExpanded?: boolean;
}

export default function IntuitPaymentsTable({
  initialFrom,
  initialTo,
  invoiceIdsByContractId,
  defaultExpanded = true,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<IntuitRow[]>([]);
  const [totals, setTotals] = useState<IntuitTotals | null>(null);
  const [qboByInvoice, setQboByInvoice] = useState<Record<string, QBOMatchEntry[]>>({});
  const [qboLoading, setQboLoading] = useState(false);
  const [qboError, setQboError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/bookkeeper/intuit-payments?from=${from}&to=${to}`);
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Failed to load");
        setRows([]);
        setTotals(null);
      } else {
        setRows(data.rows ?? []);
        setTotals(data.totals ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadQbo() {
    setQboLoading(true);
    setQboError(null);
    try {
      const r = await fetch(`/api/qbo/reports/payments?from=${from}&to=${to}`);
      const data = await r.json();
      if (!r.ok) {
        setQboError(data.error ?? "QBO fetch failed");
        setQboByInvoice({});
      } else {
        setQboByInvoice(data.byInvoiceId ?? {});
      }
    } finally {
      setQboLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadQbo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) =>
      [r.transId, r.cardholderName, r.cardBrand, r.cardLast4, r.contractNumber, r.comment]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  function qboStatusFor(row: IntuitRow): "matched" | "missing" | "unknown" {
    if (!row.contractId) return "unknown";
    const invoiceIds = invoiceIdsByContractId[row.contractId] ?? [];
    if (invoiceIds.length === 0) return "unknown";
    for (const invoiceId of invoiceIds) {
      const matches = qboByInvoice[invoiceId];
      if (matches && matches.length > 0) return "matched";
    }
    return "missing";
  }

  function downloadPdf() {
    const p = new URLSearchParams({ from, to, ...(query.trim() ? { search: query.trim() } : {}) });
    const url = `/api/bookkeeper/intuit-payments/pdf?${p}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `intuit-payments-${from}${to !== from ? `-to-${to}` : ""}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const grossLabel = totals ? formatCurrency(totals.gross) : null;

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
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span className="font-semibold text-slate-900">Intuit Payments Report</span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">
            {loading
              ? "Loading…"
              : `${filtered.length} transaction${filtered.length !== 1 ? "s" : ""}${grossLabel ? ` · Gross ${grossLabel}` : ""}`}
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
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 font-medium whitespace-nowrap">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
              />
            </div>
            <input
              type="text"
              placeholder="Search trans ID, name, contract #, last 4…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 min-w-[160px] text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                load();
                loadQbo();
              }}
              disabled={loading}
            >
              {loading ? "…" : "Refresh"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadPdf}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 text-[#00929C] border-[#00929C]/30 hover:bg-[#00929C]/5 whitespace-nowrap"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </Button>
          </div>

          {/* ── Totals strip ── */}
          {totals && (
            <div className="border-t border-slate-100 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Kpi label="Charges" value={String(totals.chargesCount)} tone="default" />
              <Kpi label="Refunds" value={String(totals.refundsCount)} tone={totals.refundsCount > 0 ? "warn" : "default"} />
              <Kpi label="Gross" value={formatCurrency(totals.gross)} tone="success" />
              <Kpi label="Surcharges" value={formatCurrency(totals.surcharges)} tone="default" />
            </div>
          )}

          {/* ── Inline notices ── */}
          {qboError && (
            <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              QBO data unavailable: {qboError}. Reconciliation column will show &ldquo;unknown&rdquo;.
            </div>
          )}
          {qboLoading && (
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Loading QBO reconciliation…</div>
          )}
          {error && (
            <div className="border-t border-red-100 px-4 py-3 text-sm text-red-700 bg-red-50">{error}</div>
          )}

          {/* ── Empty state ── */}
          {!loading && filtered.length === 0 && !error && (
            <div className="px-4 py-8 text-center text-slate-400 text-sm border-t border-slate-100">
              No Intuit transactions{query ? ` matching "${query}"` : ""} for this period.
            </div>
          )}

          {/* ── Transactions table ── */}
          {filtered.length > 0 && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Date</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Trans ID</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Cardholder</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Card</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Type</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Contract #</th>
                    <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Amount</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Status</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">QBO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((r, i) => {
                    const qboStatus = qboStatusFor(r);
                    return (
                      <tr key={r.paymentId} className={cn(
                        r.isRefund
                          ? "bg-red-50/60"
                          : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      )}>
                        <td className={cn("px-3 py-2 whitespace-nowrap", r.isRefund ? "text-red-600" : "text-slate-600")}>{formatDate(r.date)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">{r.transId}</td>
                        <td className={cn("px-3 py-2 font-medium whitespace-nowrap", r.isRefund ? "text-red-700" : "text-slate-900")}>{r.cardholderName || "—"}</td>
                        <td className={cn("px-3 py-2 text-xs whitespace-nowrap", r.isRefund ? "text-red-600" : "text-slate-600")}>
                          {r.cardBrand ?? "—"}{r.cardLast4 ? ` ···${r.cardLast4}` : ""}
                        </td>
                        <td className="px-3 py-2">
                          {r.isRefund ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-red-100 text-red-800 border-red-300">
                              Refund
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-300">
                              Charge
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {r.contractNumber && r.contractId ? (
                            <Link href={`/contracts/${r.contractId}`} className="text-[#00929C] hover:underline">
                              {r.contractNumber}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className={cn("px-3 py-2 text-right font-mono whitespace-nowrap", r.isRefund ? "text-red-700" : "text-slate-900 font-semibold")}>
                          {r.isRefund ? "−" : ""}{formatCurrency(Math.abs(r.amount))}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide",
                            r.status === "completed" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : r.status === "refunded" ? "bg-red-100 text-red-800 border-red-300"
                              : r.status === "failed" ? "bg-red-100 text-red-800 border-red-300"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                          )}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {qboStatus === "matched" && (
                            <span className="px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border-emerald-300" title="Matching QBO payment found">
                              ✓ Booked
                            </span>
                          )}
                          {qboStatus === "missing" && (
                            <span className="px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border-amber-300" title="No QBO payment found for this contract's invoice in date range">
                              ⚠ Not in QBO
                            </span>
                          )}
                          {qboStatus === "unknown" && (
                            <span className="text-slate-400" title="Contract has no QBO invoice yet">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={6} className="px-3 py-3 text-sm font-semibold text-slate-700">
                        Total — {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-3 py-3 text-right text-base font-bold text-[#010F21] font-mono">
                        {formatCurrency(totals.gross)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "default" | "success" | "warn" }) {
  const cls =
    tone === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "warn" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <div className={cn("rounded-lg border p-3", cls)}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-xl font-bold font-mono mt-0.5">{value}</p>
    </div>
  );
}
