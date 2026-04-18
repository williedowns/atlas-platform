"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type WarrantyClaim,
  type WarrantyClaimStatus,
  type DefectCategory,
  type ModelLine,
  WARRANTY_STATUS_LABELS,
  WARRANTY_STATUS_COLORS,
  DEFECT_CATEGORY_LABELS,
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
  Cell,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export interface WarrantyStats {
  total: number;
  openCount: number;
  thisMonthCount: number;
  resolvedThisMonthCount: number;
  avgResolutionDays: number;
  ytdCost: number;
  costThisMonth: number;
  deliveredUnits: number;
  claimRate: number;
  avgCsat: number;
  majorOpenCount: number;
  awaitingReview: number;
}

const STATUS_TABS: (WarrantyClaimStatus | "all")[] = [
  "all",
  "submitted",
  "under_review",
  "approved",
  "parts_shipped",
  "scheduled",
  "in_service",
  "resolved",
  "denied",
];

export default function WarrantyClient({
  claims,
  stats,
  defectByModel,
  defectByCategory,
  monthlyTrend,
  statusCounts,
}: {
  claims: WarrantyClaim[];
  stats: WarrantyStats;
  defectByModel: Record<ModelLine, { claims: number; units: number; rate: number; cost: number }>;
  defectByCategory: Record<DefectCategory, { count: number; cost: number; avgCost: number }>;
  monthlyTrend: { month: string; claims: number; cost: number }[];
  statusCounts: Record<WarrantyClaimStatus, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<WarrantyClaimStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(false);

  const filtered = useMemo(() => {
    return claims.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (openOnly && ["resolved", "denied"].includes(c.status)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !`${c.claimNumber} ${c.serialNumber} ${c.dealerName} ${c.customerName} ${c.category} ${c.model}`
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      return true;
    });
  }, [claims, statusFilter, search, openOnly]);

  const modelChartData = Object.entries(defectByModel)
    .filter(([, v]) => v.units > 0)
    .map(([name, v]) => ({
      name: name.replace("Michael Phelps ", "MP ").replace(" Swim Spa", ""),
      rate: v.rate,
      claims: v.claims,
      cost: v.cost,
      color: MS_BRAND.modelLineColors[name as ModelLine],
    }));

  const categoryChartData = Object.entries(defectByCategory)
    .map(([cat, v]) => ({
      category: DEFECT_CATEGORY_LABELS[cat as DefectCategory],
      count: v.count,
      cost: v.cost,
      avgCost: v.avgCost,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Warranty & Service</h2>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              Module 4 · Post-Sale Network
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Every warranty claim, parts dispatch, and service call across the dealer network — defect analytics feed back into production QC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.majorOpenCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {stats.majorOpenCount} major open
            </div>
          )}
          {stats.awaitingReview > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
              {stats.awaitingReview} awaiting review
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Open Claims"
          value={stats.openCount}
          sublabel={`${stats.thisMonthCount} filed this month`}
          trend={stats.openCount > 40 ? "up" : "down"}
          trendValue={stats.openCount > 40 ? "watch" : "good"}
          accentColor={MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Warranty Cost YTD"
          value={fmtCompact(stats.ytdCost)}
          sublabel={`${fmtCurrency(stats.costThisMonth)} this month`}
          accentColor={MS_BRAND.colors.primary}
          size="lg"
        />
        <KpiCard
          label="Avg Resolution"
          value={`${stats.avgResolutionDays}d`}
          sublabel={`${stats.resolvedThisMonthCount} resolved in last 30d`}
          accentColor={MS_BRAND.colors.accent}
          size="lg"
        />
        <KpiCard
          label="Claim Rate"
          value={`${stats.claimRate}%`}
          sublabel={`${stats.total} claims \u00b7 ${stats.deliveredUnits.toLocaleString()} delivered units`}
          accentColor={stats.claimRate < 8 ? MS_BRAND.colors.success : MS_BRAND.colors.warning}
          size="lg"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <SectionCard
          title="Defect Rate by Model Line"
          subtitle="% of delivered units with a warranty claim"
          className="col-span-2"
        >
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={modelChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                  formatter={(v: number, name: string) => {
                    if (name === "rate") return [`${v.toFixed(2)}%`, "Claim rate"];
                    return [v, name];
                  }}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                  {modelChartData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Customer Satisfaction"
          subtitle="Post-resolution NPS across claims"
        >
          <div className="flex flex-col items-center justify-center h-[240px]">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Avg CSAT</p>
            <p className="text-6xl font-black tabular-nums" style={{ color: stats.avgCsat >= 4 ? MS_BRAND.colors.success : MS_BRAND.colors.warning }}>
              {stats.avgCsat.toFixed(1)}
            </p>
            <p className="text-slate-500 text-sm">/ 5.0</p>
            <div className="flex gap-0.5 mt-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={`text-2xl ${s <= Math.round(stats.avgCsat) ? "text-amber-400" : "text-slate-200"}`}>
                  ★
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {stats.resolvedThisMonthCount} resolutions in last 30d
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard
          title="Defect Category Breakdown"
          subtitle="Volume + cost by failing component — feeds Factory QC checkpoints"
        >
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={categoryChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 10, fill: "#64748B" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categoryChartData.map((_, i) => (
                    <Cell key={i} fill={MS_BRAND.chartColors[i % MS_BRAND.chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Claims & Cost — Last 6 Months"
          subtitle="Monthly warranty spend trend"
        >
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                  formatter={(v: number, name: string) =>
                    name === "cost" ? [fmtCurrency(v), "Cost"] : [v, "Claims"]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="claims" stroke={MS_BRAND.colors.accent} strokeWidth={2.5} />
                <Line yAxisId="right" type="monotone" dataKey="cost" stroke={MS_BRAND.colors.primary} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((s) => {
          const label = s === "all" ? "All Claims" : WARRANTY_STATUS_LABELS[s];
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
          placeholder="Search claim #, serial, dealer, customer, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[260px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="rounded"
          />
          Open only
        </label>
        <span className="text-xs text-slate-500 ml-auto">
          Showing {Math.min(filtered.length, 150)} of {filtered.length}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Claim #</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Unit / Dealer</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Category</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Severity</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Cost</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Age</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Filed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 150).map((c) => {
              const statusColor = WARRANTY_STATUS_COLORS[c.status];
              const sevColor = c.severity === "major" ? "#DC2626" : c.severity === "moderate" ? "#D97706" : "#F59E0B";
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/manufacturer/warranty/${c.id}`}
                      className="font-semibold font-mono text-xs text-slate-900 hover:text-cyan-700"
                    >
                      {c.claimNumber}
                    </Link>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">SN: {c.serialNumber}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-slate-800">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold mr-1"
                        style={{
                          color: MS_BRAND.modelLineColors[c.modelLine],
                          backgroundColor: `${MS_BRAND.modelLineColors[c.modelLine]}15`,
                        }}
                      >
                        {c.modelLine}
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      <Link href={`/manufacturer/dealers/${c.dealerId}`} className="hover:text-cyan-700">
                        {c.dealerName}
                      </Link>{" "}
                      · {c.customerName}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-slate-700">{DEFECT_CATEGORY_LABELS[c.category]}</span>
                    <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs truncate">{c.description}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                    >
                      {WARRANTY_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: sevColor, backgroundColor: `${sevColor}18` }}
                    >
                      {c.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {c.totalCost > 0 ? fmtCurrency(c.totalCost) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600 tabular-nums">
                    {c.warrantyAgeMonths.toFixed(0)}mo
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {c.filedMinutesAgo < 60
                      ? `${c.filedMinutesAgo}m ago`
                      : c.filedMinutesAgo < 60 * 24
                      ? `${Math.floor(c.filedMinutesAgo / 60)}h ago`
                      : `${Math.floor(c.filedMinutesAgo / 60 / 24)}d ago`}
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
