"use client";

import Link from "next/link";
import {
  priceRealizationStats,
  dealerDiscountOutliers,
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

export default function PriceRealizationPage() {
  const stats = priceRealizationStats();
  const outliers = dealerDiscountOutliers(10);

  const bucketData = Object.entries(stats.buckets).map(([bucket, count]) => ({
    bucket,
    count,
  }));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Price Realization</h2>
        <p className="text-sm text-slate-500">
          List price vs actual price across the network. Margin leakage visibility.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Realization</p>
          <p
            className="text-3xl font-black mt-2 tabular-nums"
            style={{
              color:
                stats.realizationPct >= 97
                  ? MS_BRAND.colors.success
                  : stats.realizationPct >= 94
                  ? MS_BRAND.colors.warning
                  : MS_BRAND.colors.primary,
            }}
          >
            {stats.realizationPct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">List to actual capture</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Avg Discount</p>
          <p className="text-3xl font-black mt-2 text-slate-900 tabular-nums">
            {stats.avgDiscountPct.toFixed(2)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Weighted by price</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Revenue Captured</p>
          <p className="text-3xl font-black mt-2 text-slate-900">{fmtCurrency(stats.totalActual)}</p>
          <p className="text-xs text-slate-500 mt-1">Out of {fmtCurrency(stats.totalList)} list</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Margin Leak</p>
          <p className="text-3xl font-black mt-2" style={{ color: MS_BRAND.colors.primary }}>
            {fmtCurrency(stats.totalDiscount)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Total discount given</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-1">Discount Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">
            Contracts grouped by discount percentage
          </p>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={bucketData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {bucketData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i === 0 ? "#059669" : i === 1 ? "#0891B2" : i === 2 ? "#F59E0B" : i === 3 ? "#D97706" : "#DC2626"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-1">Dealer Discount Outliers</h3>
          <p className="text-xs text-slate-500 mb-4">
            Dealers discounting most aggressively — margin conversation priority
          </p>
          <div className="divide-y divide-slate-100">
            {outliers.map((o, i) => {
              const color = o.avgDiscountPct > 9 ? "#DC2626" : o.avgDiscountPct > 6 ? "#D97706" : "#F59E0B";
              return (
                <Link
                  key={o.dealer.id}
                  href={`/manufacturer/dealers/${o.dealer.id}`}
                  className="py-2.5 flex items-center gap-3 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{o.dealer.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {o.dealer.city}, {o.dealer.state} · {o.contracts} contracts
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm tabular-nums" style={{ color }}>
                      -{o.avgDiscountPct.toFixed(1)}%
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="rounded-xl p-6 border-l-4 flex items-start gap-4"
        style={{
          borderColor: MS_BRAND.colors.primary,
          backgroundColor: `${MS_BRAND.colors.primary}08`,
        }}
      >
        <div className="text-3xl">💰</div>
        <div>
          <h4 className="font-bold text-slate-900">Margin Opportunity</h4>
          <p className="text-sm text-slate-700 mt-1 max-w-3xl">
            At the current network realization rate of{" "}
            <span className="font-bold">{stats.realizationPct.toFixed(1)}%</span>, every 0.5 percentage
            point of recovered realization is worth approximately{" "}
            <span className="font-bold text-slate-900">{fmtCurrency(stats.totalList * 0.005)}</span> in
            recaptured margin across this sample period. Focus interventions on the top 10 discount
            outliers above — they represent disproportionate leakage on fewer contracts.
          </p>
        </div>
      </div>
    </div>
  );
}
