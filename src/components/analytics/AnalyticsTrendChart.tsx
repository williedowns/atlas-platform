"use client";

import { ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface Point {
  date: string;
  label: string;
  revenue: number;
  deposits: number;
  contracts: number;
}

interface AnalyticsTrendChartProps {
  data: Point[];
  period: string;
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

export function AnalyticsTrendChart({ data, period }: AnalyticsTrendChartProps) {
  const isEmpty = data.every((d) => d.revenue === 0 && d.deposits === 0);

  if (isEmpty) {
    return (
      <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
        No revenue in this {period === "today" ? "day" : period}.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="analyticsRevenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00929C" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#00929C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtCurrencyCompact}
            width={60}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              fontSize: 12,
              padding: "8px 12px",
            }}
            labelStyle={{ fontWeight: 600, color: "#0F172A" }}
            formatter={(v, name) => {
              if (name === "Revenue" || name === "Deposits") {
                return [fmtCurrencyFull(Number(v)), name];
              }
              return [Number(v), name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#00929C"
            strokeWidth={2.5}
            fill="url(#analyticsRevenueGradient)"
          />
          <Bar
            dataKey="deposits"
            name="Deposits"
            fill="#10b981"
            opacity={0.7}
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
