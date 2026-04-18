"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type Invoice,
  type InvoiceStatus,
  type InvoicePayment,
  type CoopAccrual,
  type CoopClaim,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export interface FinanceStats {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  writtenOffCount: number;
  writtenOffTotal: number;
  aging: { current: number; "1-30": number; "31-60": number; "61-90": number; "90+": number };
  dso: number;
  collectionsThisMonth: number;
  paymentCountMonth: number;
  totalAccrued: number;
  totalClaimed: number;
  availableCoop: number;
  pendingCoopClaims: number;
  totalInvoices: number;
  paidCount: number;
}

export interface OverdueDealerRow {
  dealer: { id: string; name: string; city: string; state: string; tier: string };
  openInvoices: number;
  overdueInvoices: number;
  balance: number;
  oldestOverdueDays: number;
}

export interface RecentPaymentRow extends InvoicePayment {
  invoice: Invoice;
}

const STATUS_TABS: (InvoiceStatus | "all")[] = [
  "all",
  "open",
  "partial",
  "overdue",
  "paid",
  "written_off",
];

export default function FinanceClient({
  invoices,
  stats,
  overdueDealers,
  payments,
  coopAccruals,
  coopClaims,
  statusCounts,
}: {
  invoices: Invoice[];
  stats: FinanceStats;
  overdueDealers: OverdueDealerRow[];
  payments: RecentPaymentRow[];
  coopAccruals: CoopAccrual[];
  coopClaims: CoopClaim[];
  statusCounts: Record<InvoiceStatus, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (overdueOnly && i.status !== "overdue") return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !`${i.invoiceNumber} ${i.orderNumber} ${i.dealerName}`.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [invoices, statusFilter, search, overdueOnly]);

  const agingData = [
    { bucket: "Current", amount: stats.aging.current, color: "#059669" },
    { bucket: "1–30 days", amount: stats.aging["1-30"], color: "#0891B2" },
    { bucket: "31–60 days", amount: stats.aging["31-60"], color: "#D97706" },
    { bucket: "61–90 days", amount: stats.aging["61-90"], color: "#DC2626" },
    { bucket: "90+ days", amount: stats.aging["90+"], color: "#7C2D12" },
  ];

  const coopTop = coopAccruals.slice(0, 8);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Finance & Accounting</h2>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              Module 5 · AR & Co-op
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Dealer invoicing, payments, aging, co-op fund tracking — the money side of the network.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.overdueCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {stats.overdueCount} overdue · {fmtCompact(stats.totalOverdue)}
            </div>
          )}
          {stats.pendingCoopClaims > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
              {stats.pendingCoopClaims} co-op claims pending
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Total AR Outstanding"
          value={fmtCompact(stats.totalOutstanding)}
          sublabel={`${stats.totalInvoices - stats.paidCount} open invoices`}
          trend={stats.totalOverdue > stats.totalOutstanding * 0.15 ? "up" : "down"}
          trendValue={stats.totalOverdue > stats.totalOutstanding * 0.15 ? "watch" : "healthy"}
          accentColor={MS_BRAND.colors.primary}
          size="lg"
        />
        <KpiCard
          label="DSO (Days Sales Outstanding)"
          value={`${stats.dso}d`}
          sublabel="Average collection time"
          trend={stats.dso <= 35 ? "up" : "down"}
          trendValue={stats.dso <= 35 ? "fast" : "slow"}
          accentColor={stats.dso <= 35 ? MS_BRAND.colors.success : MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Collections — Last 30d"
          value={fmtCompact(stats.collectionsThisMonth)}
          sublabel={`${stats.paymentCountMonth} payments applied`}
          trend="up"
          trendValue="live"
          accentColor={MS_BRAND.colors.accent}
          size="lg"
        />
        <KpiCard
          label="Co-op Available"
          value={fmtCompact(stats.availableCoop)}
          sublabel={`${fmtCurrency(stats.totalAccrued)} accrued · ${fmtCurrency(stats.totalClaimed)} claimed`}
          accentColor={MS_BRAND.colors.warning}
          size="lg"
        />
      </div>

      {/* AR Aging */}
      <SectionCard
        title="AR Aging Buckets"
        subtitle="Outstanding receivables by days-past-due"
      >
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748B" }}
                tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                formatter={(v) => [fmtCurrency(Number(v)), "Balance"]}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {agingData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-5 gap-3 mt-4">
          {agingData.map((d) => (
            <div key={d.bucket} className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{d.bucket}</p>
              <p className="text-lg font-black tabular-nums mt-1" style={{ color: d.color }}>
                {fmtCurrency(d.amount)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard
          title="Top Overdue Dealers"
          subtitle="Prioritize collections outreach"
        >
          <div className="divide-y divide-slate-100">
            {overdueDealers.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No overdue balances — nice.</div>
            ) : (
              overdueDealers.map((d, i) => (
                <Link
                  key={d.dealer.id}
                  href={`/manufacturer/finance/${d.dealer.id}`}
                  className="py-3 flex items-center gap-4 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                    style={{
                      backgroundColor: d.oldestOverdueDays > 60 ? "#DC2626" : d.oldestOverdueDays > 30 ? "#D97706" : "#F59E0B",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{d.dealer.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {d.dealer.city}, {d.dealer.state} · {d.dealer.tier} · {d.overdueInvoices} overdue of {d.openInvoices} open
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 text-sm tabular-nums">{fmtCurrency(d.balance)}</p>
                    <p className="text-[10px] text-red-600 font-semibold">{d.oldestOverdueDays}d oldest</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent Payments"
          subtitle="Cash received across the network"
        >
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-auto">
            {payments.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{p.invoice.dealerName}</p>
                  <p className="text-[10px] text-slate-500 truncate font-mono">
                    {p.invoice.invoiceNumber} · {p.method.replace("_", " ")} · {p.ref}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <p className="font-bold text-emerald-600 text-sm tabular-nums">+{fmtCurrency(p.amount)}</p>
                  <p className="text-[10px] text-slate-500">
                    {p.receivedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Co-op */}
      <SectionCard
        title="Co-op Fund Tracking"
        subtitle={`${fmtCurrency(stats.totalAccrued)} accrued YTD · ${fmtCurrency(stats.availableCoop)} available to claim`}
      >
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Dealer</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Tier</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Rate</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Accrued YTD</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Claimed</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coopTop.map((c) => {
              const usage = c.ytdAccrued > 0 ? (c.ytdClaimed / c.ytdAccrued) * 100 : 0;
              return (
                <tr key={c.dealerId} className="hover:bg-slate-50">
                  <td className="py-3">
                    <Link
                      href={`/manufacturer/finance/${c.dealerId}`}
                      className="font-semibold text-slate-900 hover:text-cyan-700"
                    >
                      {c.dealerName}
                    </Link>
                  </td>
                  <td className="py-3 text-right text-xs text-slate-700">{c.dealerTier}</td>
                  <td className="py-3 text-right text-xs text-slate-600 tabular-nums">
                    {(c.accrualRate * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 text-right tabular-nums">{fmtCurrency(c.ytdAccrued)}</td>
                  <td className="py-3 text-right tabular-nums text-slate-700">
                    {fmtCurrency(c.ytdClaimed)}
                    <span className="text-[10px] text-slate-400 ml-1">({usage.toFixed(0)}%)</span>
                  </td>
                  <td className="py-3 text-right font-bold tabular-nums" style={{ color: MS_BRAND.colors.warning }}>
                    {fmtCurrency(c.available)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      {/* Invoice table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((s) => {
          const label = s === "all" ? "All Invoices" : INVOICE_STATUS_LABELS[s];
          const count = s === "all" ? stats.totalInvoices : statusCounts[s];
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active ? "text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              style={active ? { backgroundColor: MS_BRAND.colors.primary } : {}}
            >
              {label} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search invoice #, order #, dealer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[260px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded"
          />
          Overdue only
        </label>
        <span className="text-xs text-slate-500 ml-auto">
          Showing {Math.min(filtered.length, 150)} of {filtered.length}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Invoice #</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Dealer</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Terms</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Total</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Balance</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Issued</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Due / Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 150).map((inv) => {
              const statusColor = INVOICE_STATUS_COLORS[inv.status];
              return (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <span className="font-mono font-semibold text-xs text-slate-900">{inv.invoiceNumber}</span>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{inv.orderNumber}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/manufacturer/finance/${inv.dealerId}`} className="text-sm text-slate-800 hover:text-cyan-700">
                      {inv.dealerName}
                    </Link>
                    <p className="text-[10px] text-slate-500">{inv.dealerTier}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                    >
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-700 capitalize">{inv.terms.replace("_", " ")}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">{fmtCurrency(inv.total)}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {inv.balance > 0 ? fmtCurrency(inv.balance) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 tabular-nums">
                    {inv.issuedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 tabular-nums">
                    {inv.status === "paid" ? (
                      <span className="text-emerald-600">Paid</span>
                    ) : inv.daysOverdue > 0 ? (
                      <span className="text-red-600 font-semibold">{inv.daysOverdue}d overdue</span>
                    ) : (
                      <span>Due {inv.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
