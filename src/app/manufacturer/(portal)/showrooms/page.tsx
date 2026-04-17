"use client";

import Link from "next/link";
import {
  NETWORK_STATS,
  showroomCountDistribution,
  topDealersByShowrooms,
  showroomExpansionCandidates,
  showroomsByRegion,
  topShowrooms,
  DEALERS,
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
  PieChart,
  Pie,
  Legend,
} from "recharts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export default function ShowroomsPage() {
  const distribution = showroomCountDistribution();
  const topByCount = topDealersByShowrooms(10);
  const expansionCandidates = showroomExpansionCandidates(10);
  const byRegion = showroomsByRegion();
  const regionData = Object.entries(byRegion).map(([region, stats]) => ({ region, ...stats }));
  const topRooms = topShowrooms(10);

  const showroomVsShow = [
    { name: "Showroom", value: NETWORK_STATS.showroomRevenueYtd, color: MS_BRAND.colors.primary },
    { name: "Show / Event", value: NETWORK_STATS.showRevenueYtd, color: MS_BRAND.colors.accent },
  ];

  const total = NETWORK_STATS.showroomRevenueYtd + NETWORK_STATS.showRevenueYtd;
  const showroomPct = (NETWORK_STATS.showroomRevenueYtd / total) * 100;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Showroom Network</h2>
        <p className="text-sm text-slate-500">
          Brick-and-mortar retail footprint across the Master Spas dealer network — the growth engine.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Total Showrooms"
          value={NETWORK_STATS.totalShowrooms}
          sublabel={`Avg ${NETWORK_STATS.avgShowroomsPerDealer} per dealer`}
          trend="up"
          trendValue="14 YTD"
          accentColor={MS_BRAND.colors.primary}
          size="lg"
        />
        <KpiCard
          label="Showroom Revenue YTD"
          value={fmtCompact(NETWORK_STATS.showroomRevenueYtd)}
          sublabel={`${showroomPct.toFixed(0)}% of network revenue`}
          trend="up"
          trendValue="+9%"
          accentColor={MS_BRAND.colors.accent}
          size="lg"
        />
        <KpiCard
          label="Multi-Location Dealers"
          value={NETWORK_STATS.dealersWithMultipleShowrooms}
          sublabel={`${((NETWORK_STATS.dealersWithMultipleShowrooms / NETWORK_STATS.totalDealers) * 100).toFixed(0)}% of network`}
          trend="up"
          trendValue="+6"
          accentColor={MS_BRAND.colors.success}
          size="lg"
        />
        <KpiCard
          label="Expansion Candidates"
          value={expansionCandidates.length}
          sublabel="Top-tier dealers with 1 location"
          accentColor={MS_BRAND.colors.warning}
          size="lg"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <SectionCard
          title="Revenue Mix: Showroom vs Show"
          subtitle="Where network revenue actually comes from"
        >
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={showroomVsShow}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={50}
                  paddingAngle={3}
                >
                  {showroomVsShow.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => fmtCurrency(Number(v))}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 text-center mt-2">
            Showrooms are {(NETWORK_STATS.showroomRevenueYtd / NETWORK_STATS.showRevenueYtd).toFixed(2)}x the revenue of shows
          </p>
        </SectionCard>

        <SectionCard
          title="Showroom Count Distribution"
          subtitle="How many dealers run each footprint size"
          className="col-span-2"
        >
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="count"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  label={{ value: "# Showrooms per Dealer", position: "insideBottom", offset: -5, style: { fontSize: 11, fill: "#64748B" } }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="dealers" radius={[6, 6, 0, 0]}>
                  {distribution.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i === 0 ? "#CBD5E1" : i === 1 ? "#0891B2" : i === 2 ? "#059669" : MS_BRAND.colors.primary
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard
          title="Top Dealers by Showroom Count"
          subtitle="The brick-and-mortar leaders"
        >
          <div className="divide-y divide-slate-100">
            {topByCount.map((d, i) => (
              <Link
                key={d.id}
                href={`/manufacturer/dealers/${d.id}`}
                className="py-2.5 flex items-center gap-4 hover:bg-slate-50 rounded px-2 -mx-2 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{
                    backgroundColor: i === 0 ? "#EAB308" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7F32" : MS_BRAND.colors.accent,
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.city}, {d.state} · {d.tier}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-sm">
                    <span className="text-2xl" style={{ color: MS_BRAND.colors.primary }}>
                      {d.showroomCount}
                    </span>{" "}
                    locations
                  </p>
                  <p className="text-xs text-slate-500">{fmtCurrency(d.showroomRevenueYtd)} YTD</p>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Expansion Growth Opportunities"
          subtitle="Platinum/Gold dealers with only 1 location — prime expansion candidates"
        >
          <div className="divide-y divide-slate-100">
            {expansionCandidates.map((d) => (
              <Link
                key={d.id}
                href={`/manufacturer/dealers/${d.id}`}
                className="py-2.5 flex items-center gap-4 hover:bg-slate-50 rounded px-2 -mx-2 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                  style={{ backgroundColor: MS_BRAND.colors.warning }}
                >
                  +1
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.city}, {d.state} · {d.tier} · {d.yearsWithMS} years
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-sm">{fmtCurrency(d.ytdRevenue)}</p>
                  <p className="text-xs text-slate-500">YTD · 1 location</p>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Showroom Density by Region"
        subtitle="Where the brick-and-mortar footprint is concentrated"
      >
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={regionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="region" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="showrooms" name="Showrooms" fill={MS_BRAND.colors.primary} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avgPerDealer" name="Avg per Dealer" fill={MS_BRAND.colors.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="Top Performing Showrooms Network-Wide"
        subtitle="Individual locations by YTD revenue"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rank</th>
              <th className="py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Showroom</th>
              <th className="py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dealer</th>
              <th className="py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sq Ft</th>
              <th className="py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Staff</th>
              <th className="py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Units</th>
              <th className="py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">YTD Rev</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topRooms.map((r, i) => {
              const dealer = DEALERS.find((d) => d.id === r.dealerId);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-2.5 font-bold text-slate-500">{i + 1}</td>
                  <td className="py-2.5">
                    <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      {r.city}, {r.state} · {r.isFlagship ? "Flagship" : "Branch"}
                    </p>
                  </td>
                  <td className="py-2.5">
                    {dealer && (
                      <Link href={`/manufacturer/dealers/${dealer.id}`} className="text-sm text-cyan-700 hover:underline">
                        {dealer.name}
                      </Link>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-slate-700 tabular-nums text-xs">
                    {r.sqft.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-slate-700 tabular-nums text-xs">{r.staffCount}</td>
                  <td className="py-2.5 text-right text-slate-700 tabular-nums">{r.ytdUnits}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                    {fmtCurrency(r.ytdRevenue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
