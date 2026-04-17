"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface TrendPoint {
  date: string;        // ISO YYYY-MM-DD
  label: string;       // Formatted for x-axis (e.g. "Apr 10")
  revenue: number;
  contracts: number;
}

interface RevenueTrendChartProps {
  data: TrendPoint[];
  accentColor?: string;
}

const DEFAULT_ACCENT = "#00929C";

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

export function RevenueTrendChart({ data, accentColor = DEFAULT_ACCENT }: RevenueTrendChartProps) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.4} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
            </linearGradient>
          </defs>
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
              if (name === "revenue") return [fmtCurrencyFull(Number(v)), "Revenue"];
              return [Number(v), "Contracts"];
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={accentColor}
            strokeWidth={2.5}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
