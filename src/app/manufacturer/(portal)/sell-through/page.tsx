"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TODAYS_CONTRACTS,
  MODEL_LINES,
  type ModelLine,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const REGIONS = ["All", "Northeast", "Mid-Atlantic", "Southeast", "Midwest", "South Central", "Mountain", "West", "International"];

export default function SellThroughPage() {
  const [region, setRegion] = useState<string>("All");
  const [line, setLine] = useState<ModelLine | "All">("All");

  const filtered = useMemo(() => {
    return TODAYS_CONTRACTS.filter((c) => {
      if (region !== "All" && c.region !== region) return false;
      if (line !== "All" && c.modelLine !== line) return false;
      return true;
    });
  }, [region, line]);

  const totalRevenue = filtered.reduce((s, c) => s + c.actualPrice, 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Live Sell-Through</h2>
        <p className="text-sm text-slate-500">
          Every contract signed across the Master Spas network in the last 24 hours.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Contracts 24h</p>
          <p className="text-3xl font-black mt-2" style={{ color: MS_BRAND.colors.primary }}>
            {filtered.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Revenue 24h</p>
          <p className="text-3xl font-black mt-2" style={{ color: MS_BRAND.colors.accent }}>
            {fmtCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Avg Ticket</p>
          <p className="text-3xl font-black mt-2 text-slate-900">
            {fmtCurrency(filtered.length ? totalRevenue / filtered.length : 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Unique Dealers</p>
          <p className="text-3xl font-black mt-2 text-slate-900">
            {new Set(filtered.map((c) => c.dealerId)).size}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Region
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Model Line
          </label>
          <select
            value={line}
            onChange={(e) => setLine(e.target.value as ModelLine | "All")}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option>All</option>
            {MODEL_LINES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-emerald-600 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          LIVE FEED · {filtered.length} shown
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Time</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Dealer</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Location</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Model</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Customer</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">List</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Sold</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Disc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 200).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500 text-xs">
                  {c.minutesAgo < 60
                    ? `${c.minutesAgo}m ago`
                    : `${Math.floor(c.minutesAgo / 60)}h ${c.minutesAgo % 60}m ago`}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/manufacturer/dealers/${c.dealerId}`}
                    className="font-semibold text-slate-900 hover:text-cyan-700"
                  >
                    {c.dealerName}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600 text-xs">{c.state}</td>
                <td className="px-5 py-3">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      color: MS_BRAND.modelLineColors[c.modelLine],
                      backgroundColor: `${MS_BRAND.modelLineColors[c.modelLine]}15`,
                    }}
                  >
                    {c.modelLine}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">{c.model}</span>
                </td>
                <td className="px-5 py-3 text-slate-600 text-xs">{c.customerName}</td>
                <td className="px-5 py-3 text-right text-slate-500 text-xs tabular-nums">
                  {fmtCurrency(c.listPrice)}
                </td>
                <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">
                  {fmtCurrency(c.actualPrice)}
                </td>
                <td className="px-5 py-3 text-right text-xs tabular-nums">
                  {c.discountPct < 0.03 ? (
                    <span className="text-emerald-600 font-semibold">
                      {(c.discountPct * 100).toFixed(1)}%
                    </span>
                  ) : c.discountPct < 0.06 ? (
                    <span className="text-amber-600 font-semibold">
                      {(c.discountPct * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-red-600 font-semibold">
                      {(c.discountPct * 100).toFixed(1)}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
