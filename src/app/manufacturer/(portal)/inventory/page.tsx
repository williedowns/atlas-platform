"use client";

import {
  DEALERS,
  NETWORK_STATS,
  inventoryByAge,
  regionalBreakdown,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function InventoryPage() {
  const ageBuckets = inventoryByAge();
  const ageData = Object.entries(ageBuckets).map(([bucket, units]) => ({
    bucket: `${bucket} days`,
    units,
  }));

  const regional = regionalBreakdown();
  const regionalData = Object.entries(regional).map(([region, stats]) => ({
    region,
    dealers: stats.dealers,
    avgInventoryPerDealer: Math.round(stats.units / Math.max(1, stats.dealers)),
    totalUnits: stats.units,
  }));

  const topInventoryDealers = [...DEALERS]
    .sort((a, b) => b.inventoryUnits - a.inventoryUnits)
    .slice(0, 10);

  const agingOutliers = [...DEALERS].sort((a, b) => b.avgInventoryAge - a.avgInventoryAge).slice(0, 8);

  const totalUnits = NETWORK_STATS.totalInventoryUnits;
  const agedUnits = ageBuckets["60-90"] + ageBuckets["90+"];
  const agedPct = ((agedUnits / totalUnits) * 100).toFixed(1);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Network Inventory</h2>
        <p className="text-sm text-slate-500">
          Serial-number-level visibility across all Master Spas dealers.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Network Units</p>
          <p className="text-3xl font-black mt-2" style={{ color: MS_BRAND.colors.primary }}>
            {totalUnits.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Across {DEALERS.length} dealers</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Aged Stock (60d+)</p>
          <p className="text-3xl font-black mt-2" style={{ color: MS_BRAND.colors.warning }}>
            {agedUnits}
          </p>
          <p className="text-xs text-slate-500 mt-1">{agedPct}% of network</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Avg Inv Age</p>
          <p className="text-3xl font-black mt-2 text-slate-900">
            {Math.round(DEALERS.reduce((s, d) => s + d.avgInventoryAge, 0) / DEALERS.length)}d
          </p>
          <p className="text-xs text-slate-500 mt-1">Network-wide average</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Working Cap Locked</p>
          <p className="text-3xl font-black mt-2 text-slate-900">{fmtCurrency(totalUnits * 8500)}</p>
          <p className="text-xs text-slate-500 mt-1">At ~$8.5k wholesale/unit</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Inventory Aging</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="units" radius={[6, 6, 0, 0]}>
                  {ageData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i === 0
                          ? "#059669"
                          : i === 1
                          ? "#0891B2"
                          : i === 2
                          ? "#D97706"
                          : "#DC2626"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Average Inventory per Dealer by Region</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={regionalData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis type="category" dataKey="region" tick={{ fontSize: 11, fill: "#64748B" }} width={100} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="avgInventoryPerDealer" fill={MS_BRAND.colors.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Highest Inventory Dealers</h3>
          <div className="divide-y divide-slate-100">
            {topInventoryDealers.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.city}, {d.state}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-slate-900 tabular-nums">{d.inventoryUnits}</p>
                  <p className="text-xs text-slate-500">{d.avgInventoryAge}d avg</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-1">Aging Outliers</h3>
          <p className="text-xs text-slate-500 mb-4">Units sitting longest — priority intervention</p>
          <div className="divide-y divide-slate-100">
            {agingOutliers.map((d) => {
              const color = d.avgInventoryAge > 90 ? "#DC2626" : d.avgInventoryAge > 70 ? "#D97706" : "#F59E0B";
              return (
                <div key={d.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {d.inventoryUnits} units · {d.tier}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="px-2 py-1 rounded-full text-xs font-bold"
                      style={{ color, backgroundColor: `${color}15` }}
                    >
                      {d.avgInventoryAge} days
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
