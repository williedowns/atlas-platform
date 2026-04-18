"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type DealerOrder,
  type DealerOrderStatus,
  DEALER_ORDER_STATUS_LABELS,
  DEALER_ORDER_STATUS_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import { KpiCard } from "@/components/ui/KpiCard";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export interface DealerOrderStatsInput {
  totalOrders: number;
  last24hCount: number;
  last24hValue: number;
  last7dCount: number;
  last7dValue: number;
  inProductionCount: number;
  inProductionUnits: number;
  readyToShipCount: number;
  shippedCount: number;
  awaitingApprovalCount: number;
  creditHoldCount: number;
  rushOrderCount: number;
  backlogValue: number;
  unitsInPipeline: number;
}

const STATUS_TABS: (DealerOrderStatus | "all")[] = [
  "all",
  "submitted",
  "approved",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
];

export default function DealerOrdersClient({
  orders,
  stats,
  countsByStatus,
}: {
  orders: DealerOrder[];
  stats: DealerOrderStatsInput;
  countsByStatus: Record<DealerOrderStatus, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<DealerOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [priorityOnly, setPriorityOnly] = useState(false);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (priorityOnly && o.priority !== "rush") return false;
      if (search) {
        const s = search.toLowerCase();
        if (!`${o.orderNumber} ${o.dealerName} ${o.dealerCity} ${o.dealerState}`.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, search, priorityOnly]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Dealer Orders</h2>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              Module 2 · B2B Ordering
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Every order placed by a Master Spas dealer. From submission to delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.creditHoldCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {stats.creditHoldCount} credit hold{stats.creditHoldCount !== 1 ? "s" : ""}
            </div>
          )}
          {stats.rushOrderCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
              {stats.rushOrderCount} rush in flight
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Backlog Value"
          value={fmtCompact(stats.backlogValue)}
          sublabel={`${stats.unitsInPipeline} units in the pipeline`}
          trend="up"
          trendValue="+12%"
          accentColor={MS_BRAND.colors.primary}
          size="lg"
        />
        <KpiCard
          label="Orders — Last 24h"
          value={stats.last24hCount}
          sublabel={fmtCurrency(stats.last24hValue)}
          trend="up"
          trendValue="live"
          accentColor={MS_BRAND.colors.accent}
          size="lg"
        />
        <KpiCard
          label="In Production"
          value={stats.inProductionCount}
          sublabel={`${stats.inProductionUnits} units on the line`}
          accentColor={MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Awaiting Approval"
          value={stats.awaitingApprovalCount}
          sublabel="Credit check + approval queue"
          accentColor={MS_BRAND.colors.success}
          size="lg"
          href="/manufacturer/dealer-orders?filter=submitted"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((s) => {
          const label = s === "all" ? "All Orders" : DEALER_ORDER_STATUS_LABELS[s];
          const count = s === "all" ? stats.totalOrders : countsByStatus[s];
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
          placeholder="Search order #, dealer, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={priorityOnly}
            onChange={(e) => setPriorityOnly(e.target.checked)}
            className="rounded"
          />
          Rush orders only
        </label>
        <span className="text-xs text-slate-500 ml-auto">
          Showing {Math.min(filtered.length, 150)} of {filtered.length} matching orders
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Order #</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Dealer</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Lines</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Units</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Total</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Terms</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 150).map((o) => {
              const statusColor = DEALER_ORDER_STATUS_COLORS[o.status];
              const topLine = o.lines[0];
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/manufacturer/dealer-orders/${o.id}`}
                      className="font-semibold text-slate-900 hover:text-cyan-700 font-mono text-xs"
                    >
                      {o.orderNumber}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {o.priority === "rush" && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800">
                          Rush
                        </span>
                      )}
                      {o.creditHold && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-red-100 text-red-800">
                          Credit Hold
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/manufacturer/dealers/${o.dealerId}`} className="font-semibold text-sm text-slate-900 hover:text-cyan-700">
                      {o.dealerName}
                    </Link>
                    <p className="text-[10px] text-slate-500">
                      {o.dealerCity}, {o.dealerState} · {o.dealerTier}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                    >
                      {DEALER_ORDER_STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-slate-800">
                      {topLine.modelLine}
                      {o.lines.length > 1 && (
                        <span className="text-xs text-slate-500"> +{o.lines.length - 1} more</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500">{topLine.model}</p>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">{o.unitCount}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">{fmtCurrency(o.total)}</td>
                  <td className="px-5 py-3 text-xs text-slate-600 capitalize">{o.paymentTerms.replace("_", " ")}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {o.placedMinutesAgo < 60
                      ? `${o.placedMinutesAgo}m ago`
                      : o.placedMinutesAgo < 60 * 24
                      ? `${Math.floor(o.placedMinutesAgo / 60)}h ago`
                      : `${Math.floor(o.placedMinutesAgo / 60 / 24)}d ago`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 150 && (
          <div className="px-5 py-3 text-center text-xs text-slate-500 bg-slate-50">
            Showing 150 of {filtered.length} matching orders.
          </div>
        )}
      </div>
    </div>
  );
}
