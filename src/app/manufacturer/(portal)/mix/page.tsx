"use client";

import {
  MODEL_LINES,
  modelMix,
  regionalBreakdown,
  colorMix,
  DEALERS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function MixPage() {
  const mix = modelMix();
  const modelData = MODEL_LINES.map((m) => ({
    name: m,
    shortName: m.replace("Michael Phelps", "MP").replace(" Swim Spa", ""),
    units: mix[m].units,
    revenue: mix[m].revenue,
    color: MS_BRAND.modelLineColors[m],
  }));
  const totalUnits = modelData.reduce((s, m) => s + m.units, 0);

  const colors = colorMix();
  const colorData = Object.entries(colors).map(([name, v]) => ({ name, units: v }));

  const regional = regionalBreakdown();
  const regionalModelMix = Object.entries(regional).map(([region, stats]) => {
    const dealersInRegion = DEALERS.filter((d) => d.region === region);
    const dealerCount = dealersInRegion.length;
    return {
      region,
      avgUnitsPerDealer: Math.round(stats.units / Math.max(1, dealerCount)),
      avgRevenuePerDealer: Math.round(stats.revenue / Math.max(1, dealerCount)),
      dealers: dealerCount,
    };
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Model & Color Mix</h2>
        <p className="text-sm text-slate-500">
          What's selling, where, and in what configurations — across the network.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {modelData.map((m) => {
          const pct = ((m.units / totalUnits) * 100).toFixed(1);
          return (
            <div
              key={m.name}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4"
              style={{ borderLeftColor: m.color }}
            >
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {m.shortName}
              </p>
              <p className="text-2xl font-black mt-2 text-slate-900 tabular-nums">{m.units}</p>
              <p className="text-xs text-slate-500 mt-1">
                {pct}% · {fmtCurrency(m.revenue)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Network Mix by Model Line</h3>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={modelData}
                  dataKey="units"
                  nameKey="shortName"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={60}
                  paddingAngle={2}
                >
                  {modelData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                  formatter={(v) => [`${Number(v)} units`, ""]}
                />
                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Color Preference Network-Wide</h3>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={colorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="units" radius={[6, 6, 0, 0]}>
                  {colorData.map((_, i) => (
                    <Cell key={i} fill={MS_BRAND.chartColors[i % MS_BRAND.chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-900 mb-4">Regional Performance — Units & Revenue per Dealer</h3>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={regionalModelMix}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="region" tick={{ fontSize: 10, fill: "#64748B" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="avgUnitsPerDealer" name="Avg Units/Dealer" fill={MS_BRAND.colors.primary} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="dealers" name="Dealer Count" fill={MS_BRAND.colors.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
