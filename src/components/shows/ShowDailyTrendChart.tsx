"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

interface DayPoint {
  date: string;
  label: string;
  isToday: boolean;
  revenue: number;
  contracts: number;
}

interface ShowDailyTrendChartProps {
  data: DayPoint[];
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

export function ShowDailyTrendChart({ data }: ShowDailyTrendChartProps) {
  const hasData = data.some((d) => d.revenue > 0);

  if (!hasData) {
    return (
      <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
        No sales logged yet for this show.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtCurrencyCompact}
            width={55}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, padding: "8px 12px" }}
            labelStyle={{ fontWeight: 600, color: "#0F172A" }}
            cursor={{ fill: "rgba(0, 146, 156, 0.05)" }}
            formatter={(v) => [fmtCurrencyFull(Number(v)), "Revenue"]}
          />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isToday ? "#00929C" : "#94A3B8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
