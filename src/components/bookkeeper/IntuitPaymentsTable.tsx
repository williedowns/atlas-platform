"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

export default function IntuitPaymentsTable({ initialFrom, initialTo, invoiceIdsByContractId }: Props) {
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

  // For each row, decide whether QBO has a matching booked payment.
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-slate-700 font-medium block mb-1">From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700 font-medium block mb-1">To</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-sm" />
          </label>
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              load();
              loadQbo();
            }}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <div className="flex-1 min-w-[200px]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transaction ID, name, contract #, last 4…"
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals strip */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi label="Charges" value={String(totals.chargesCount)} tone="default" />
          <Kpi label="Refunds" value={String(totals.refundsCount)} tone={totals.refundsCount > 0 ? "warn" : "default"} />
          <Kpi label="Gross" value={formatCurrency(totals.gross)} tone="success" />
          <Kpi label="Surcharges" value={formatCurrency(totals.surcharges)} tone="default" />
        </div>
      )}

      {qboError && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          QBO data unavailable: {qboError}. Reconciliation column will show "unknown".
        </div>
      )}
      {qboLoading && (
        <div className="text-xs text-slate-500">Loading QBO reconciliation…</div>
      )}

      {/* Transactions table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {error ? (
            <div className="p-6 text-sm text-red-700">{error}</div>
          ) : loading ? (
            <div className="p-6 text-sm text-slate-500">Loading transactions…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 text-center">
              No transactions in this date range{query ? ` matching "${query}"` : ""}.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Trans ID</th>
                  <th className="text-left px-3 py-2 font-semibold">Cardholder</th>
                  <th className="text-left px-3 py-2 font-semibold">Card</th>
                  <th className="text-left px-3 py-2 font-semibold">Type</th>
                  <th className="text-left px-3 py-2 font-semibold">Contract #</th>
                  <th className="text-right px-3 py-2 font-semibold">Amount</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">QBO</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const qboStatus = qboStatusFor(r);
                  return (
                    <tr key={r.paymentId} className={cn(
                      "border-t border-slate-100 hover:bg-slate-50/60",
                      r.isRefund && "bg-red-50/30"
                    )}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{formatDate(r.date)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.transId}</td>
                      <td className="px-3 py-2 font-medium">{r.cardholderName || "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {r.cardBrand ?? "—"}{r.cardLast4 ? ` ····${r.cardLast4}` : ""}
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
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.contractNumber && r.contractId ? (
                          <Link href={`/contracts/${r.contractId}`} className="text-[#00929C] hover:underline">
                            {r.contractNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={cn("px-3 py-2 text-right font-mono whitespace-nowrap", r.isRefund && "text-red-700")}>
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
            </table>
          )}
        </CardContent>
      </Card>
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
