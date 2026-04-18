"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface LenderDatum {
  name: string;
  value: number;
  count: number;
  color: string;
}

interface LenderMixChartProps {
  data: LenderDatum[];
  total: number;
}

function fmtCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function LenderMixChart({ data, total }: LenderMixChartProps) {
  if (data.length === 0 || total === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
        No financing activity yet.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 flex-col lg:flex-row">
      <div className="relative w-52 h-52 flex-shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={96}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total</p>
          <p className="text-lg font-black text-slate-900 tabular-nums">{fmtCurrencyFull(total)}</p>
          <p className="text-[10px] text-slate-500">
            across {data.length} lender{data.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-2 min-w-0 w-full">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div key={d.name} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">{d.name}</span>
                  <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: d.color }}>
                    {fmtCurrencyFull(d.value)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1.5 rounded-full bg-slate-100 flex-1 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: d.color }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold tabular-nums w-10 text-right">
                    {pct}%
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums w-12 text-right">
                    {d.count} deal{d.count === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
