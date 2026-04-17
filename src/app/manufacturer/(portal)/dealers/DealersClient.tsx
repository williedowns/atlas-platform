"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Dealer } from "@/lib/manufacturer/mock-data";
import { ATLAS_DEALER_ID } from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type SortKey = "name" | "healthScore" | "ytdRevenue" | "ytdUnits" | "avgInventoryAge" | "conversionRate";

export default function DealersClient({
  dealers,
  atlasIsLive,
}: {
  dealers: Dealer[];
  atlasIsLive: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("ytdRevenue");
  const [tier, setTier] = useState<string>("All");
  const [riskFilter, setRiskFilter] = useState(false);

  const filtered = useMemo(() => {
    const sorted = dealers
      .filter((d) => {
        if (tier !== "All" && d.tier !== tier) return false;
        if (riskFilter && d.healthScore >= 60) return false;
        if (search && !`${d.name} ${d.city} ${d.state}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        return (b[sort] as number) - (a[sort] as number);
      });

    // When Atlas is live, surface the design-partner row at the top of the list
    // so pitch viewers see it without scrolling / searching.
    if (atlasIsLive && !search && !riskFilter && tier === "All") {
      const atlasIdx = sorted.findIndex((d) => d.id === ATLAS_DEALER_ID);
      if (atlasIdx > 0) {
        const [atlas] = sorted.splice(atlasIdx, 1);
        sorted.unshift(atlas);
      }
    }
    return sorted;
  }, [dealers, search, sort, tier, riskFilter, atlasIsLive]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, { count: number; rev: number }> = {
      Platinum: { count: 0, rev: 0 },
      Gold: { count: 0, rev: 0 },
      Silver: { count: 0, rev: 0 },
      Bronze: { count: 0, rev: 0 },
    };
    for (const d of dealers) {
      if (counts[d.tier]) {
        counts[d.tier].count++;
        counts[d.tier].rev += d.ytdRevenue;
      }
    }
    return counts;
  }, [dealers]);

  const regionCount = useMemo(() => new Set(dealers.map((d) => d.region)).size, [dealers]);

  const healthBucket = (s: number) =>
    s >= 80 ? { color: "#059669", label: "Healthy" } : s >= 60 ? { color: "#D97706", label: "Watch" } : { color: "#DC2626", label: "At Risk" };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dealer Network</h2>
        <p className="text-sm text-slate-500">
          {dealers.length} dealers across {regionCount} regions.
          {atlasIsLive && (
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest align-middle">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Atlas live
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(["Platinum", "Gold", "Silver", "Bronze"] as const).map((t) => (
          <div key={t} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{t} Tier</p>
            <p className="text-3xl font-black mt-2 text-slate-900">{tierCounts[t].count}</p>
            <p className="text-xs text-slate-500 mt-1">{fmtCurrency(tierCounts[t].rev)} YTD</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search dealer, city, or state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option>All</option>
          <option>Platinum</option>
          <option>Gold</option>
          <option>Silver</option>
          <option>Bronze</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="ytdRevenue">Sort: YTD Revenue</option>
          <option value="ytdUnits">Sort: YTD Units</option>
          <option value="healthScore">Sort: Health Score</option>
          <option value="conversionRate">Sort: Conversion</option>
          <option value="avgInventoryAge">Sort: Inventory Age</option>
          <option value="name">Sort: Name A-Z</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={riskFilter}
            onChange={(e) => setRiskFilter(e.target.checked)}
            className="rounded"
          />
          At-risk only
        </label>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Health</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Dealer</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Location</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Tier</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">YTD Rev</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Units</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Conv%</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Inv Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 100).map((d) => {
              const isAtlasLive = atlasIsLive && d.id === ATLAS_DEALER_ID;
              const h = isAtlasLive ? null : healthBucket(d.healthScore);
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    {isAtlasLive ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest"
                        style={{ backgroundColor: "#ECFDF5", color: "#047857" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-xs"
                          style={{ backgroundColor: h!.color }}
                        >
                          {d.healthScore}
                        </div>
                        <span className="text-[10px]" style={{ color: h!.color }}>
                          {d.healthTrend === "up" ? "▲" : d.healthTrend === "down" ? "▼" : "→"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/manufacturer/dealers/${d.id}`}
                      className="font-semibold text-slate-900 hover:text-cyan-700"
                    >
                      {d.name}
                    </Link>
                    <p className="text-[10px] text-slate-500">
                      {isAtlasLive
                        ? "Live from Atlas platform"
                        : `${d.yearsWithMS} years with MS`}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs">
                    {d.city}, {d.state}
                    <p className="text-[10px] text-slate-400">{d.region}</p>
                  </td>
                  <td className="px-5 py-3">
                    {isAtlasLive ? (
                      <span className="text-slate-400 text-xs">—</span>
                    ) : (
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          color: MS_BRAND.colors.primary,
                          backgroundColor: `${MS_BRAND.colors.primary}15`,
                        }}
                      >
                        {d.tier}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {fmtCurrency(d.ytdRevenue)}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700 tabular-nums">{d.ytdUnits}</td>
                  <td className="px-5 py-3 text-right text-slate-700 tabular-nums text-xs">
                    {isAtlasLive && d.conversionRate === 0
                      ? <span className="text-slate-400">—</span>
                      : `${d.conversionRate.toFixed(1)}%`}
                  </td>
                  <td className="px-5 py-3 text-right text-xs tabular-nums">
                    {isAtlasLive && d.avgInventoryAge === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={
                          d.avgInventoryAge <= 45
                            ? "text-emerald-600 font-semibold"
                            : d.avgInventoryAge <= 70
                            ? "text-amber-600 font-semibold"
                            : "text-red-600 font-semibold"
                        }
                      >
                        {d.avgInventoryAge}d
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div className="px-5 py-3 text-center text-xs text-slate-500 bg-slate-50">
            Showing 100 of {filtered.length} matching dealers.
          </div>
        )}
      </div>
    </div>
  );
}
