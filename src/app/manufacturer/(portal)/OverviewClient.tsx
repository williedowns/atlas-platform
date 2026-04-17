"use client";

import Link from "next/link";
import type { Dealer, Show } from "@/lib/manufacturer/mock-data";
import { ATLAS_DEALER_ID } from "@/lib/manufacturer/mock-data";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export interface NetworkSummary {
  totalDealers: number;
  totalShowrooms: number;
  dealersWithMultipleShowrooms: number;
  atRiskDealers: number;
  avgHealthScore: number;
  ytdUnits: number;
  ytdRevenue: number;
  showroomRevenueYtd: number;
  showRevenueYtd: number;
  revenueToday: number;
  unitsToday: number;
  activeShows: number;
}

export default function OverviewClient({
  summary,
  trend,
  top,
  bottom,
  liveShows,
  atlasIsLive,
}: {
  summary: NetworkSummary;
  trend: { day: string; date: string; units: number; revenue: number }[];
  top: Dealer[];
  bottom: Dealer[];
  liveShows: Show[];
  atlasIsLive: boolean;
}) {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Network Overview</h2>
        <p className="text-sm text-slate-500">
          Everything happening across the Master Spas dealer network, right now.
          {atlasIsLive && (
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest align-middle">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Atlas live
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Revenue Today"
          value={fmtCurrency(summary.revenueToday)}
          sublabel={`${summary.unitsToday} units sold`}
          trend="up"
          trendValue="12%"
          accentColor={MS_BRAND.colors.primary}
          size="lg"
        />
        <KpiCard
          label="Showrooms"
          value={summary.totalShowrooms}
          sublabel={`${summary.dealersWithMultipleShowrooms} multi-location dealers`}
          trend="up"
          trendValue="+14 YTD"
          accentColor={MS_BRAND.colors.accent}
          size="lg"
          href="/manufacturer/showrooms"
        />
        <KpiCard
          label="YTD Units"
          value={fmtCompact(summary.ytdUnits)}
          sublabel={fmtCurrency(summary.ytdRevenue)}
          trend="up"
          trendValue="8%"
          accentColor={MS_BRAND.colors.success}
          size="lg"
        />
        <KpiCard
          label="Dealers At Risk"
          value={summary.atRiskDealers}
          sublabel={`Avg health: ${summary.avgHealthScore}/100`}
          trend="down"
          trendValue="3"
          accentColor={MS_BRAND.colors.warning}
          size="lg"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-900">Showroom vs Show Revenue Mix</h3>
            <p className="text-xs text-slate-500">
              YTD network revenue · showrooms are{" "}
              {summary.showRevenueYtd > 0
                ? (summary.showroomRevenueYtd / summary.showRevenueYtd).toFixed(2)
                : "∞"}
              x shows
            </p>
          </div>
          <Link href="/manufacturer/showrooms" className="text-xs font-semibold text-cyan-700 hover:underline">
            Showroom detail →
          </Link>
        </div>
        <div className="flex h-10 rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-start pl-4 text-white text-sm font-bold"
            style={{
              width: `${(summary.showroomRevenueYtd / Math.max(1, summary.showroomRevenueYtd + summary.showRevenueYtd)) * 100}%`,
              backgroundColor: MS_BRAND.colors.primary,
            }}
          >
            Showrooms · {fmtCurrency(summary.showroomRevenueYtd)}
          </div>
          <div
            className="flex items-center justify-end pr-4 text-white text-sm font-bold"
            style={{
              width: `${(summary.showRevenueYtd / Math.max(1, summary.showroomRevenueYtd + summary.showRevenueYtd)) * 100}%`,
              backgroundColor: MS_BRAND.colors.accent,
            }}
          >
            Shows · {fmtCurrency(summary.showRevenueYtd)}
          </div>
        </div>
      </div>

      <Link
        href="/manufacturer/command-center"
        className="block rounded-xl p-6 text-white relative overflow-hidden group transition-transform hover:scale-[1.01]"
        style={{
          background: `linear-gradient(135deg, ${MS_BRAND.colors.sidebarBg} 0%, ${MS_BRAND.colors.primary} 120%)`,
        }}
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60 mb-1">Big-screen mode</div>
            <div className="text-2xl font-black">Open Command Center →</div>
            <div className="text-sm text-white/70 mt-1">
              Live network pulse, built for the HQ lobby display and dealer meeting stage.
            </div>
          </div>
          <div className="text-7xl font-black text-white/10">LIVE</div>
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-6">
        <SectionCard
          title="Network Revenue — Last 30 Days"
          subtitle="Units sold per day across all dealers"
          className="col-span-2"
        >
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MS_BRAND.colors.primary} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={MS_BRAND.colors.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  formatter={(v) => [Number(v), "Units"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="units"
                  stroke={MS_BRAND.colors.primary}
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Live Shows Right Now"
          subtitle={`${liveShows.length} in progress`}
          viewAllHref="/manufacturer/shows"
        >
          <div className="space-y-3">
            {liveShows.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between pb-3 border-b border-slate-100 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-sm font-semibold text-slate-900 truncate">{s.dealerName}</p>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {s.city}, {s.state}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-sm font-bold text-slate-900">{s.contractsSigned}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">contracts</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard title="Top Performers — YTD" subtitle="Revenue leaders" viewAllHref="/manufacturer/leaderboard">
          <div className="space-y-3">
            {top.map((d, i) => {
              const isAtlasLive = atlasIsLive && d.id === ATLAS_DEALER_ID;
              return (
                <Link
                  key={d.id}
                  href={`/manufacturer/dealers/${d.id}`}
                  className="flex items-center gap-4 py-2 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                    style={{
                      backgroundColor:
                        i === 0 ? "#EAB308" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7F32" : MS_BRAND.colors.accent,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {d.city}, {d.state}
                      {isAtlasLive ? " · LIVE" : ` · ${d.tier}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 text-sm">{fmtCurrency(d.ytdRevenue)}</p>
                    <p className="text-xs text-slate-500">{d.ytdUnits} units</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="At-Risk Dealers" subtitle="Lowest health scores — action needed" viewAllHref="/manufacturer/dealers">
          <div className="space-y-3">
            {bottom.map((d) => (
              <Link
                key={d.id}
                href={`/manufacturer/dealers/${d.id}`}
                className="flex items-center gap-4 py-2 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                  style={{
                    backgroundColor: d.healthScore < 40 ? "#DC2626" : d.healthScore < 55 ? "#D97706" : "#F59E0B",
                  }}
                >
                  {d.healthScore}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.city}, {d.state} · {d.tier}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-red-600">
                    {d.healthTrend === "down" ? "▼ Declining" : d.healthTrend === "flat" ? "→ Flat" : "▲ Recovering"}
                  </p>
                  <p className="text-xs text-slate-500">{d.warrantyClaimsYtd} claims</p>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
