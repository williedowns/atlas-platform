"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type WorkOrder,
  type WorkOrderStatus,
  type ProductionStation,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_COLORS,
  STATION_LABELS,
  STATION_FLOW,
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

export interface FactoryStats {
  total: number;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  completedTodayCount: number;
  completedThisWeekCount: number;
  qcHoldCount: number;
  firstPassYield: number;
  rushActiveCount: number;
  avgCycleHours: number;
  targetCycleHours: number;
  cycleDeltaPct: number;
}

export interface StationWIPRow {
  station: ProductionStation;
  count: number;
  rush: number;
  hold: number;
}

export interface ThroughputRow {
  day: string;
  completed: number;
}

export interface QCFailuresRow {
  station: ProductionStation;
  passes: number;
  fails: number;
  fix_in_place: number;
}

const STATUS_TABS: (WorkOrderStatus | "all")[] = [
  "all",
  "queued",
  "in_progress",
  "qc_hold",
  "complete",
];

export default function FactoryClient({
  workOrders,
  stats,
  stationWIP,
  throughput,
  qcByStation,
  statusCounts,
}: {
  workOrders: WorkOrder[];
  stats: FactoryStats;
  stationWIP: StationWIPRow[];
  throughput: ThroughputRow[];
  qcByStation: QCFailuresRow[];
  statusCounts: Record<WorkOrderStatus, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [rushOnly, setRushOnly] = useState(false);

  const filtered = useMemo(() => {
    return workOrders.filter((wo) => {
      if (statusFilter !== "all" && wo.status !== statusFilter) return false;
      if (rushOnly && wo.priority !== "rush") return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !`${wo.workOrderNumber} ${wo.serialNumber} ${wo.orderNumber} ${wo.dealerName} ${wo.model}`
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      return true;
    });
  }, [workOrders, statusFilter, search, rushOnly]);

  // Find the bottleneck station (highest WIP)
  const bottleneck = stationWIP.reduce(
    (max, s) => (s.count > max.count ? s : max),
    stationWIP[0]
  );

  const qcChartData = qcByStation
    .filter((s) => s.passes + s.fails + s.fix_in_place > 0)
    .map((s) => ({
      station: STATION_LABELS[s.station],
      passes: s.passes,
      fails: s.fails,
      fix_in_place: s.fix_in_place,
      yield: +(
        (s.passes / Math.max(1, s.passes + s.fails + s.fix_in_place)) *
        100
      ).toFixed(1),
    }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Factory OS</h2>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              Module 1 · Production Floor
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Every spa in production, tracked station-by-station from framing to staging.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.qcHoldCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {stats.qcHoldCount} on QC hold
            </div>
          )}
          {stats.rushActiveCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
              {stats.rushActiveCount} rush in production
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="In Production"
          value={stats.activeCount}
          sublabel={`${stats.queuedCount} queued behind`}
          trend="up"
          trendValue="live"
          accentColor={MS_BRAND.colors.accent}
          size="lg"
        />
        <KpiCard
          label="Completed This Week"
          value={stats.completedThisWeekCount}
          sublabel={`${stats.completedTodayCount} today`}
          trend="up"
          trendValue="+8"
          accentColor={MS_BRAND.colors.success}
          size="lg"
        />
        <KpiCard
          label="First-Pass Yield"
          value={`${stats.firstPassYield}%`}
          sublabel="Units with zero QC rework"
          trend={stats.firstPassYield >= 85 ? "up" : "down"}
          trendValue={stats.firstPassYield >= 85 ? "good" : "watch"}
          accentColor={stats.firstPassYield >= 85 ? MS_BRAND.colors.success : MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Avg Cycle Time"
          value={`${stats.avgCycleHours}h`}
          sublabel={`Target ${stats.targetCycleHours}h · ${stats.cycleDeltaPct >= 0 ? "+" : ""}${stats.cycleDeltaPct}%`}
          trend={stats.cycleDeltaPct <= 0 ? "up" : "down"}
          trendValue={stats.cycleDeltaPct <= 0 ? "ahead" : "slipping"}
          accentColor={stats.cycleDeltaPct <= 0 ? MS_BRAND.colors.success : MS_BRAND.colors.warning}
          size="lg"
        />
      </div>

      {/* Bottleneck banner */}
      {bottleneck.count > 0 && (
        <div
          className="rounded-xl p-5 border-l-4 flex items-center justify-between"
          style={{
            borderColor: MS_BRAND.colors.warning,
            backgroundColor: `${MS_BRAND.colors.warning}10`,
          }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MS_BRAND.colors.warning }}>
              Current Bottleneck
            </p>
            <p className="text-lg font-bold text-slate-900 mt-1">
              {STATION_LABELS[bottleneck.station]} · {bottleneck.count} units WIP
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              {bottleneck.hold > 0 && `${bottleneck.hold} on QC hold · `}
              Consider reassigning labor from downstream stations.
            </p>
          </div>
        </div>
      )}

      {/* Station Kanban */}
      <SectionCard
        title="Production Floor — Live WIP by Station"
        subtitle="Every unit in production, shown at its current station"
      >
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
          {STATION_FLOW.map((st) => {
            const row = stationWIP.find((w) => w.station === st) ?? {
              station: st,
              count: 0,
              rush: 0,
              hold: 0,
            };
            const isBottleneck = bottleneck && st === bottleneck.station && row.count > 0;
            return (
              <div
                key={st}
                className="rounded-lg border p-3"
                style={{
                  borderColor: isBottleneck ? MS_BRAND.colors.warning : "#E2E8F0",
                  backgroundColor: isBottleneck ? `${MS_BRAND.colors.warning}08` : "#F8FAFC",
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 truncate">
                  {STATION_LABELS[st]}
                </p>
                <p
                  className="text-3xl font-black mt-1 tabular-nums"
                  style={{
                    color: row.count === 0
                      ? "#CBD5E1"
                      : isBottleneck
                      ? MS_BRAND.colors.warning
                      : MS_BRAND.colors.primary,
                  }}
                >
                  {row.count}
                </p>
                <div className="flex items-center gap-1 mt-1 text-[9px] uppercase tracking-wider">
                  {row.rush > 0 && (
                    <span className="text-amber-700 font-bold">{row.rush} rush</span>
                  )}
                  {row.hold > 0 && (
                    <span className="text-red-700 font-bold">
                      {row.rush > 0 ? " · " : ""}
                      {row.hold} hold
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard
          title="Throughput — Last 7 Days"
          subtitle="Units completed per day"
        >
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={throughput}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Bar dataKey="completed" radius={[6, 6, 0, 0]} fill={MS_BRAND.colors.accent}>
                  {throughput.map((_, i) => (
                    <Cell key={i} fill={i === throughput.length - 1 ? MS_BRAND.colors.primary : MS_BRAND.colors.accent} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="QC Yield by Station"
          subtitle="Where defects are caught before they ship"
        >
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={qcChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <YAxis type="category" dataKey="station" width={90} tick={{ fontSize: 10, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "First-pass yield"]}
                />
                <Bar dataKey="yield" radius={[0, 4, 4, 0]}>
                  {qcChartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.yield >= 92 ? "#059669" : d.yield >= 85 ? "#D97706" : "#DC2626"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Status tabs + table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((s) => {
          const label = s === "all" ? "All Work Orders" : WORK_ORDER_STATUS_LABELS[s];
          const count = s === "all" ? stats.total : statusCounts[s];
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
          placeholder="Search WO #, serial, order #, dealer, model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[260px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={rushOnly}
            onChange={(e) => setRushOnly(e.target.checked)}
            className="rounded"
          />
          Rush only
        </label>
        <span className="text-xs text-slate-500 ml-auto">
          Showing {Math.min(filtered.length, 150)} of {filtered.length}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">WO # / Serial</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Model</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Dealer</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Station</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Target</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Started</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Batch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 150).map((wo) => {
              const statusColor = WORK_ORDER_STATUS_COLORS[wo.status];
              return (
                <tr key={wo.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/manufacturer/factory/${wo.id}`}
                      className="font-semibold font-mono text-xs text-slate-900 hover:text-cyan-700"
                    >
                      {wo.workOrderNumber}
                    </Link>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">SN: {wo.serialNumber}</p>
                    {wo.priority === "rush" && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800">
                        Rush
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        color: MS_BRAND.modelLineColors[wo.modelLine],
                        backgroundColor: `${MS_BRAND.modelLineColors[wo.modelLine]}15`,
                      }}
                    >
                      {wo.modelLine}
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">{wo.model}</p>
                    <p className="text-[10px] text-slate-500">{wo.color} · {wo.cabinet}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/manufacturer/dealers/${wo.dealerId}`} className="text-sm text-slate-800 hover:text-cyan-700">
                      {wo.dealerName}
                    </Link>
                    <p className="text-[10px] text-slate-500 font-mono">{wo.orderNumber}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                    >
                      {WORK_ORDER_STATUS_LABELS[wo.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-700">
                    {wo.currentStation ? STATION_LABELS[wo.currentStation] : wo.status === "complete" ? "—" : "not started"}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600 tabular-nums">
                    {wo.targetCompletionAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {wo.startedAt
                      ? wo.startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-[10px] text-slate-500 font-mono">{wo.batchId}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
