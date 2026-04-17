"use client";

import { useState } from "react";
import type { Dealer } from "@/lib/manufacturer/mock-data";
import { ATLAS_DEALER_ID } from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type Metric = "ytdRevenue" | "ytdUnits" | "conversionRate" | "healthScore";

const METRIC_OPTIONS: { key: Metric; label: string; unit: string }[] = [
  { key: "ytdRevenue", label: "YTD Revenue", unit: "dollars" },
  { key: "ytdUnits", label: "YTD Units", unit: "units" },
  { key: "conversionRate", label: "Conversion Rate", unit: "%" },
  { key: "healthScore", label: "Health Score", unit: "/100" },
];

export default function LeaderboardClient({
  dealers,
  atlasIsLive,
}: {
  dealers: Dealer[];
  atlasIsLive: boolean;
}) {
  const [metric, setMetric] = useState<Metric>("ytdRevenue");
  const [stageMode, setStageMode] = useState(false);

  const sorted = [...dealers].sort((a, b) => (b[metric] as number) - (a[metric] as number));
  const top10 = sorted.slice(0, 10);
  const podium = top10.slice(0, 3);
  const rest = top10.slice(3);

  const formatValue = (v: number) => {
    if (metric === "ytdRevenue") return fmtCurrency(v);
    if (metric === "ytdUnits") return v.toString();
    if (metric === "conversionRate") return `${v.toFixed(1)}%`;
    return `${v.toFixed(0)}/100`;
  };

  if (stageMode) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-auto p-12"
        style={{
          background: `radial-gradient(ellipse at center top, ${MS_BRAND.colors.sidebarBg} 0%, #0B0F1A 80%)`,
        }}
      >
        <button
          onClick={() => setStageMode(false)}
          className="absolute top-6 right-6 text-white/40 hover:text-white/80 text-sm"
        >
          Exit stage mode ×
        </button>

        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-xs uppercase tracking-[0.3em] mb-4">
            Master Spas · 2026 Dealer Meeting
          </div>
          <h1 className="text-white text-6xl font-black tracking-tight mb-2">
            TOP DEALERS
          </h1>
          <p className="text-white/60 text-xl">
            {METRIC_OPTIONS.find((o) => o.key === metric)?.label} · Live across the network
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-12 max-w-6xl mx-auto">
          {[podium[1], podium[0], podium[2]].map((d, displayIdx) => {
            const actualRank = displayIdx === 1 ? 1 : displayIdx === 0 ? 2 : 3;
            const heights = { 1: "320px", 2: "240px", 3: "200px" };
            const colors = { 1: "#EAB308", 2: "#94A3B8", 3: "#CD7F32" };
            return (
              <div key={d.id} className="flex flex-col items-center">
                <div className="text-white text-center mb-4">
                  <p className="font-bold text-2xl">{d.name}</p>
                  <p className="text-white/60 text-sm">
                    {d.city}, {d.state} · {d.tier}
                  </p>
                  <p
                    className="font-black text-4xl mt-2 tracking-tight"
                    style={{ color: colors[actualRank as 1 | 2 | 3] }}
                  >
                    {formatValue(d[metric] as number)}
                  </p>
                </div>
                <div
                  className="w-full rounded-t-2xl flex items-start justify-center pt-4 font-black text-white"
                  style={{
                    height: heights[actualRank as 1 | 2 | 3],
                    background: `linear-gradient(180deg, ${colors[actualRank as 1 | 2 | 3]} 0%, ${colors[actualRank as 1 | 2 | 3]}00 180%)`,
                    fontSize: actualRank === 1 ? "84px" : "64px",
                  }}
                >
                  {actualRank}
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-5xl mx-auto space-y-2">
          {rest.map((d, i) => (
            <div
              key={d.id}
              className="flex items-center gap-6 px-6 py-4 bg-white/5 backdrop-blur rounded-xl"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white font-black text-xl">
                {i + 4}
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-lg">{d.name}</p>
                <p className="text-white/60 text-sm">
                  {d.city}, {d.state} · {d.tier}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-black text-2xl tabular-nums">
                  {formatValue(d[metric] as number)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-white/30 text-xs uppercase tracking-[0.3em]">
          Master Spas Dealer Network · {MS_BRAND.poweredBy}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dealer Leaderboard</h2>
          <p className="text-sm text-slate-500">
            Rankings across the Master Spas dealer network.
          </p>
        </div>
        <button
          onClick={() => setStageMode(true)}
          className="px-4 py-2 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-transform hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${MS_BRAND.colors.primary} 0%, ${MS_BRAND.colors.primaryHover} 100%)`,
          }}
        >
          Launch Stage Mode →
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 inline-flex gap-1">
        {METRIC_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setMetric(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              metric === opt.key
                ? "text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            style={metric === opt.key ? { backgroundColor: MS_BRAND.colors.primary } : {}}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Dealer</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Location</th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Tier</th>
              <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                {METRIC_OPTIONS.find((o) => o.key === metric)?.label}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.slice(0, 30).map((d, i) => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{
                      backgroundColor:
                        i === 0 ? "#EAB308" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7F32" : "#CBD5E1",
                      color: i > 2 ? "#1E293B" : "#FFFFFF",
                    }}
                  >
                    {i + 1}
                  </div>
                </td>
                <td className="px-6 py-4 font-semibold text-slate-900">{d.name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{d.city}, {d.state}</td>
                <td className="px-6 py-4">
                  <span
                    className="inline-block px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: `${MS_BRAND.colors.primary}15`,
                      color: MS_BRAND.colors.primary,
                    }}
                  >
                    {d.tier}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">
                  {formatValue(d[metric] as number)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
