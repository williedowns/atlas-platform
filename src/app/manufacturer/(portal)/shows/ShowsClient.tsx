"use client";

import type { Show } from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function ShowsClient({ shows: SHOWS }: { shows: Show[] }) {
  const live = SHOWS.filter((s) => s.status === "live");
  const setup = SHOWS.filter((s) => s.status === "setup");
  const closing = SHOWS.filter((s) => s.status === "closing");

  const totalRevenue = SHOWS.reduce((s, x) => s + x.revenue, 0);
  const totalUnits = SHOWS.reduce((s, x) => s + x.unitsSold, 0);
  const totalContracts = SHOWS.reduce((s, x) => s + x.contractsSigned, 0);
  const totalAttendance = SHOWS.reduce((s, x) => s + x.attendance, 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Active Shows</h2>
        <p className="text-sm text-slate-500">
          {SHOWS.length} shows live across the network right now.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Live Now</p>
          <p className="text-3xl font-black mt-2" style={{ color: MS_BRAND.colors.success }}>
            {live.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">{setup.length} setup · {closing.length} closing</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Total Attendance</p>
          <p className="text-3xl font-black mt-2 text-slate-900">{totalAttendance.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Across all live shows</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Contracts Today</p>
          <p className="text-3xl font-black mt-2" style={{ color: MS_BRAND.colors.primary }}>
            {totalContracts}
          </p>
          <p className="text-xs text-slate-500 mt-1">{totalUnits} units sold</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Show Revenue</p>
          <p className="text-3xl font-black mt-2" style={{ color: MS_BRAND.colors.accent }}>
            {fmtCurrency(totalRevenue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Today only</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[...SHOWS]
          .sort((a, b) => b.revenue - a.revenue)
          .map((s) => {
            const statusColor =
              s.status === "live" ? "#059669" : s.status === "closing" ? "#D97706" : "#0891B2";
            return (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: statusColor,
                          animation: s.status === "live" ? "pulse 2s infinite" : "none",
                        }}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: statusColor }}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 mt-1 truncate">{s.name}</p>
                    <p className="text-xs text-slate-500 truncate">{s.dealerName}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-xs text-slate-500">Started</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {s.startedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attendance</p>
                    <p className="text-lg font-black text-slate-900 tabular-nums">{s.attendance}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contracts</p>
                    <p className="text-lg font-black tabular-nums" style={{ color: MS_BRAND.colors.primary }}>
                      {s.contractsSigned}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Revenue</p>
                    <p className="text-lg font-black text-slate-900 tabular-nums">
                      {fmtCurrency(s.revenue)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    <span className="font-semibold">{s.conversionRate.toFixed(1)}%</span> conv · {s.leadsCaptured} leads
                  </span>
                  <span className="text-slate-500">{s.city}, {s.state}</span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
