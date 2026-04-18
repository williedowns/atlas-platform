"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

interface AgeBucket {
  label: string;
  balance: number;
  count: number;
  color: string;
}

interface OutstandingByAgeChartProps {
  data: AgeBucket[];
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

export function OutstandingByAgeChart({ data }: OutstandingByAgeChartProps) {
  const total = data.reduce((s, b) => s + b.balance, 0);

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
        No outstanding balances. All deals settled.
      </div>
    );
  }

  return (
    <div>
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
              cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
              formatter={(v, _name, props) => {
                const count = (props?.payload as AgeBucket | undefined)?.count ?? 0;
                return [
                  `${fmtCurrencyFull(Number(v))} · ${count} contract${count === 1 ? "" : "s"}`,
                  "Outstanding",
                ];
              }}
            />
            <Bar dataKey="balance" radius={[6, 6, 0, 0]} maxBarSize={80}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
        <span className="uppercase tracking-widest font-semibold">Total outstanding</span>
        <span className="text-base font-black text-slate-900 tabular-nums">{fmtCurrencyFull(total)}</span>
      </div>
    </div>
  );
}
