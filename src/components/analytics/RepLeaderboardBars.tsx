"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

interface RepDatum {
  name: string;
  revenue: number;
  count: number;
}

interface RepLeaderboardBarsProps {
  data: RepDatum[];
}

function fmtCurrencyCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function fmtCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const RANK_COLORS = [
  "#F59E0B", // gold
  "#94A3B8", // silver
  "#D97706", // bronze
  "#00929C", // teal for the rest
];

function colorFor(i: number): string {
  return i < 3 ? RANK_COLORS[i] : RANK_COLORS[3];
}

export function RepLeaderboardBars({ data }: RepLeaderboardBarsProps) {
  if (data.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">
        No sales in this period.
      </div>
    );
  }

  // Keep top 8 for readable bars
  const top = data.slice(0, 8);
  const chartHeight = Math.max(200, top.length * 42);

  return (
    <div style={{ width: "100%", height: chartHeight }}>
      <ResponsiveContainer>
        <BarChart
          data={top}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtCurrencyCompact}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#0F172A", fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
            cursor={{ fill: "rgba(0, 146, 156, 0.05)" }}
            formatter={(v) => [fmtCurrencyFull(Number(v)), "Revenue"]}
          />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
            {top.map((_, i) => (
              <Cell key={i} fill={colorFor(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
