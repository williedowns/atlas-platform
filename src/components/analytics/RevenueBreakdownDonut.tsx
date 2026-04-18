"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface BreakdownDatum {
  name: string;
  value: number;
  color: string;
  count: number;
}

interface RevenueBreakdownDonutProps {
  data: BreakdownDatum[];
  total: number;
}

function fmtCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function RevenueBreakdownDonut({ data, total }: RevenueBreakdownDonutProps) {
  const hasData = total > 0;
  const displayTotal = hasData ? fmtCurrencyFull(total) : "$0";

  return (
    <div className="flex items-center gap-6 flex-col sm:flex-row">
      <div className="relative w-44 h-44 flex-shrink-0">
        {hasData ? (
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                formatter={(v, name) => [fmtCurrencyFull(Number(v)), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-44 h-44 rounded-full border-8 border-slate-100" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total</p>
          <p className="text-lg font-black text-slate-900 tabular-nums">{displayTotal}</p>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 min-w-0">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div key={d.name} className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{d.name}</span>
                  <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: d.color }}>
                    {fmtCurrencyFull(d.value)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {d.count} contract{d.count === 1 ? "" : "s"} · {pct}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
