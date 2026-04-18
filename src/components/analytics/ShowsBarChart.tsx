"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

interface ShowDatum {
  name: string;
  revenue: number;
  count: number;
}

interface ShowsBarChartProps {
  data: ShowDatum[];
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

const SHADES = ["#00929C", "#0891B2", "#0EA5E9", "#38BDF8", "#7DD3FC", "#BAE6FD", "#CBD5E1"];

export function ShowsBarChart({ data }: ShowsBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
        No show sales in this period.
      </div>
    );
  }

  const top = data.slice(0, 6);
  const chartHeight = Math.max(180, top.length * 44);

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
            tick={{ fontSize: 11, fill: "#0F172A" }}
            tickLine={false}
            axisLine={false}
            width={140}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
            cursor={{ fill: "rgba(0, 146, 156, 0.05)" }}
            formatter={(v) => [fmtCurrencyFull(Number(v)), "Revenue"]}
          />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
            {top.map((_, i) => (
              <Cell key={i} fill={SHADES[Math.min(i, SHADES.length - 1)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
