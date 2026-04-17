"use client";

import { useEffect, useState } from "react";
import {
  MODEL_LINES,
  type ModelLine,
  type Contract,
  type Show,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export interface CommandCenterData {
  totalDealers: number;
  revenueToday: number;
  unitsToday: number;
  revenueLastHour: number;
  unitsLastHour: number;
  totalInventoryUnits: number;
  mix: Record<ModelLine, { units: number; revenue: number; discount: number }>;
  trend14d: { day: string; date: string; units: number; revenue: number }[];
  lastHourContracts: Contract[];
  liveShows: Show[];
}

export default function CommandCenterClient({ data }: { data: CommandCenterData }) {
  const [tickerIdx, setTickerIdx] = useState(0);
  const [livePulse, setLivePulse] = useState(data.revenueToday);

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIdx((i) => (i + 1) % Math.max(1, data.lastHourContracts.length));
      setLivePulse((p) => p + Math.random() * 4500);
    }, 2200);
    return () => clearInterval(interval);
  }, [data.lastHourContracts.length]);

  const modelData = MODEL_LINES.map((m) => ({
    name: m.replace("Michael Phelps", "MP").replace(" Swim Spa", ""),
    units: data.mix[m]?.units ?? 0,
    revenue: data.mix[m]?.revenue ?? 0,
  }));

  const trend = data.trend14d;
  const topShows = [...data.liveShows].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const currentTicker = data.lastHourContracts.slice(tickerIdx, tickerIdx + 6);

  return (
    <div
      className="min-h-full p-6"
      style={{
        background: `linear-gradient(135deg, ${MS_BRAND.colors.sidebarBg} 0%, #0B1929 100%)`,
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-white text-3xl font-black tracking-tight">
              MASTER SPAS COMMAND CENTER
            </h1>
          </div>
          <p className="text-white/60 text-sm mt-1" suppressHydrationWarning>
            Live network operations · {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-xs uppercase tracking-widest">Total Dealers Live</p>
          <p className="text-white text-5xl font-black tabular-nums">{data.totalDealers}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <LiveStat
          label="Revenue Today"
          value={fmtCurrency(livePulse)}
          sub={`${data.unitsToday} units · updating live`}
          accent={MS_BRAND.colors.primary}
        />
        <LiveStat
          label="Last 60 Minutes"
          value={`${data.unitsLastHour} units`}
          sub={fmtCurrency(data.revenueLastHour)}
          accent={MS_BRAND.colors.accent}
        />
        <LiveStat
          label="Active Shows"
          value={`${data.liveShows.length}`}
          sub={`${data.liveShows.reduce((s, x) => s + x.contractsSigned, 0)} contracts at shows`}
          accent={MS_BRAND.colors.success}
        />
        <LiveStat
          label="Network Inventory"
          value={data.totalInventoryUnits.toLocaleString()}
          sub="Units at dealers network-wide"
          accent={MS_BRAND.colors.warning}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-bold">Sell-Through · Last 14 Days</h3>
              <p className="text-xs text-white/50">Units per day across the network</p>
            </div>
            <div className="text-right">
              <p className="text-white text-2xl font-black">{trend.reduce((s, t) => s + t.units, 0)}</p>
              <p className="text-xs text-white/50 uppercase tracking-widest">2-week total</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <Tooltip
                  contentStyle={{
                    background: "#0F172A",
                    border: "1px solid #1E293B",
                    borderRadius: 8,
                    color: "#FFFFFF",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="units"
                  stroke={MS_BRAND.colors.primary}
                  strokeWidth={3}
                  dot={{ fill: MS_BRAND.colors.primary, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5">
          <h3 className="text-white font-bold">Hot Tubs Moving Now</h3>
          <p className="text-xs text-white/50 mb-3">Units by model line (YTD)</p>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={modelData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 10, fill: "#CBD5E1" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0F172A",
                    border: "1px solid #1E293B",
                    borderRadius: 8,
                    color: "#FFFFFF",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="units" radius={[0, 4, 4, 0]}>
                  {modelData.map((_, i) => (
                    <Cell key={i} fill={MS_BRAND.chartColors[i % MS_BRAND.chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-bold">Live Contract Feed</h3>
              <p className="text-xs text-white/50">Every contract in the last hour, network-wide</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </div>
          </div>
          <div className="space-y-2">
            {currentTicker.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/5"
                style={{
                  opacity: 1 - i * 0.08,
                  borderLeft: `3px solid ${MS_BRAND.modelLineColors[c.modelLine] ?? MS_BRAND.colors.primary}`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{c.dealerName}</p>
                  <p className="text-xs text-white/60">
                    {c.modelLine} · {c.model} · {c.state}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-white font-bold text-sm">{fmtCurrency(c.actualPrice)}</p>
                  <p className="text-[10px] text-white/50">{c.minutesAgo}m ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-bold">Active Shows — Top Performers</h3>
              <p className="text-xs text-white/50">Events running right now</p>
            </div>
            <p className="text-white text-xl font-black">{data.liveShows.length}</p>
          </div>
          <div className="space-y-2">
            {topShows.map((s) => (
              <div key={s.id} className="py-2.5 px-3 rounded-lg bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-white font-semibold text-sm truncate">{s.name}</p>
                    </div>
                    <p className="text-xs text-white/60 mt-0.5 truncate">
                      {s.dealerName} · {s.attendance} attendees
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-white font-bold text-sm">{s.contractsSigned}</p>
                    <p className="text-[10px] text-white/50">{fmtCurrency(s.revenue)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-[10px] text-white/30 uppercase tracking-widest">
        <span>Master Spas Dealer Network · Live Data</span>
        <span>{MS_BRAND.poweredBy}</span>
      </div>
    </div>
  );
}

function LiveStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div
      className="relative rounded-xl p-5 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">{label}</p>
      <p className="text-white text-3xl font-black mt-2 tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-white/50 mt-1">{sub}</p>
    </div>
  );
}
