"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ConnectedUnit,
  type ConnectedUnitStatus,
  type PredictiveAlert,
  type FirmwareVersion,
  type ModelLine,
  CONNECTED_STATUS_LABELS,
  CONNECTED_STATUS_COLORS,
  ALERT_SEVERITY_COLORS,
  DEFECT_CATEGORY_LABELS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtRelative = (minutesAgo: number) =>
  minutesAgo < 60 ? `${minutesAgo}m ago`
  : minutesAgo < 60 * 24 ? `${Math.floor(minutesAgo / 60)}h ago`
  : `${Math.floor(minutesAgo / 60 / 24)}d ago`;

export interface IoTStats {
  total: number;
  online: number;
  offline: number;
  degraded: number;
  neverConnected: number;
  connectedRate: number;
  avgUptime: number;
  firmwareComplianceRate: number;
  firmwareCompliant: number;
  openAlertsTotal: number;
  criticalAlerts: number;
  warningAlerts: number;
  advisoryAlerts: number;
  consumerAppInstalled: number;
  consumerAppRate: number;
  totalAppSessions: number;
  heavyUseCount: number;
}

const STATUS_TABS: (ConnectedUnitStatus | "all")[] = [
  "all", "online", "degraded", "offline", "maintenance", "never_connected",
];

export default function IoTClient({
  units,
  stats,
  topAlerts,
  firmwareVersions,
  fleetByModel,
  statusCounts,
}: {
  units: ConnectedUnit[];
  stats: IoTStats;
  topAlerts: PredictiveAlert[];
  firmwareVersions: FirmwareVersion[];
  fleetByModel: Record<ModelLine, { total: number; online: number; offline: number; withAlerts: number }>;
  statusCounts: Record<ConnectedUnitStatus, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<ConnectedUnitStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [alertsOnly, setAlertsOnly] = useState(false);

  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (alertsOnly && u.openAlerts === 0) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !`${u.serialNumber} ${u.dealerName} ${u.customerName} ${u.model}`.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [units, statusFilter, search, alertsOnly]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Connected Fleet (IoT)</h2>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              Module 8 · Telemetry & Predictive
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Every connected spa in the field — live telemetry, predictive failure alerts, firmware compliance, consumer app engagement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.criticalAlerts > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {stats.criticalAlerts} critical alerts
            </div>
          )}
          {stats.offline > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
              {stats.offline} units offline
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Units Online"
          value={stats.online.toLocaleString()}
          sublabel={`${stats.avgUptime.toFixed(1)}% avg 30d uptime`}
          trend="up"
          trendValue="live"
          accentColor={MS_BRAND.colors.success}
          size="lg"
        />
        <KpiCard
          label="Predictive Alerts Open"
          value={stats.openAlertsTotal.toLocaleString()}
          sublabel={`${stats.criticalAlerts} critical · ${stats.warningAlerts} warning`}
          trend={stats.criticalAlerts > 0 ? "down" : "up"}
          trendValue={stats.criticalAlerts > 0 ? "watch" : "healthy"}
          accentColor={stats.criticalAlerts > 0 ? MS_BRAND.colors.danger : MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Firmware Compliance"
          value={`${stats.firmwareComplianceRate.toFixed(0)}%`}
          sublabel={`${stats.firmwareCompliant.toLocaleString()} of ${stats.total.toLocaleString()} on current release`}
          trend={stats.firmwareComplianceRate >= 75 ? "up" : "down"}
          trendValue={stats.firmwareComplianceRate >= 75 ? "healthy" : "watch"}
          accentColor={stats.firmwareComplianceRate >= 75 ? MS_BRAND.colors.accent : MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Consumer App Adoption"
          value={`${stats.consumerAppRate.toFixed(0)}%`}
          sublabel={`${stats.consumerAppInstalled.toLocaleString()} paired · ${stats.totalAppSessions.toLocaleString()} sessions 30d`}
          accentColor={MS_BRAND.colors.primary}
          size="lg"
        />
      </div>

      {/* Connection status breakdown */}
      <SectionCard
        title="Fleet Connection Status"
        subtitle={`${stats.connectedRate.toFixed(1)}% of delivered units ever connected · ${stats.total.toLocaleString()} total units`}
      >
        <div className="grid grid-cols-5 gap-3">
          {([
            { status: "online" as ConnectedUnitStatus, count: stats.online, color: "#059669" },
            { status: "degraded" as ConnectedUnitStatus, count: stats.degraded, color: "#D97706" },
            { status: "offline" as ConnectedUnitStatus, count: stats.offline, color: "#DC2626" },
            { status: "maintenance" as ConnectedUnitStatus, count: statusCounts.maintenance, color: "#0891B2" },
            { status: "never_connected" as ConnectedUnitStatus, count: stats.neverConnected, color: "#94A3B8" },
          ]).map((b) => {
            const pct = stats.total > 0 ? (b.count / stats.total) * 100 : 0;
            return (
              <div
                key={b.status}
                className="rounded-lg border p-4 text-center"
                style={{ borderColor: `${b.color}40`, backgroundColor: `${b.color}08` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: b.color }}>
                  {CONNECTED_STATUS_LABELS[b.status]}
                </p>
                <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: b.color }}>
                  {b.count.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">{pct.toFixed(1)}% of fleet</p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-3 gap-6">
        {/* Predictive alerts */}
        <div className="col-span-2">
          <SectionCard
            title="Top Predictive Alerts"
            subtitle="Early failure detection — fix it before the customer calls"
          >
            <div className="divide-y divide-slate-100">
              {topAlerts.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">No active alerts — fleet is healthy.</div>
              ) : (
                topAlerts.map((a) => {
                  const unit = units.find((u) => u.id === a.unitId);
                  const sevColor = ALERT_SEVERITY_COLORS[a.severity];
                  return (
                    <Link
                      key={a.id}
                      href={unit ? `/manufacturer/iot/${unit.id}` : "#"}
                      className="py-3 flex items-start gap-3 hover:bg-slate-50 rounded px-2 -mx-2 transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[9px] font-bold uppercase tracking-widest flex-shrink-0"
                        style={{ backgroundColor: sevColor }}
                      >
                        {a.severity === "critical" ? "CRIT" : a.severity === "warning" ? "WARN" : "ADV"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{a.prediction}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {DEFECT_CATEGORY_LABELS[a.component]} · {a.confidence}% confidence
                          {unit && <> · {unit.customerName} · {unit.dealerName}</>}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          <span className="font-semibold">Action:</span> {a.recommendedAction}
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-500 whitespace-nowrap ml-3">
                        {fmtRelative(a.minutesAgo)}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>
          </SectionCard>
        </div>

        {/* Firmware distribution */}
        <SectionCard
          title="Firmware Distribution"
          subtitle="Which version each unit runs"
        >
          <div className="space-y-2">
            {firmwareVersions.map((fv) => (
              <div key={fv.version} className="p-2 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold font-mono text-slate-900">
                      {fv.version}
                      {fv.isCurrent && (
                        <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{fv.description}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Released {fmtDate(fv.releasedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-slate-900">{fv.pctOfFleet}%</p>
                    <p className="text-[10px] text-slate-500">{fv.deployedUnits.toLocaleString()} units</p>
                  </div>
                </div>
                <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${fv.pctOfFleet}%`,
                      backgroundColor: fv.isCurrent ? MS_BRAND.colors.success : "#94A3B8",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Fleet health by model line */}
      <SectionCard
        title="Fleet Health by Model Line"
        subtitle="Online % and open-alert incidence per product family"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Model Line</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Total</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Online</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Online %</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Offline</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">With Alerts</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Alert Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(Object.entries(fleetByModel) as [ModelLine, typeof fleetByModel[ModelLine]][]).map(([model, m]) => {
              if (m.total === 0) return null;
              const onlinePct = (m.online / m.total) * 100;
              const alertRate = (m.withAlerts / m.total) * 100;
              const color = MS_BRAND.modelLineColors[model];
              const alertColor = alertRate < 5 ? "#059669" : alertRate < 15 ? "#D97706" : "#DC2626";
              return (
                <tr key={model} className="hover:bg-slate-50">
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-slate-900">{model}</span>
                    </span>
                  </td>
                  <td className="py-3 text-right tabular-nums">{m.total}</td>
                  <td className="py-3 text-right tabular-nums">{m.online}</td>
                  <td className="py-3 text-right font-semibold tabular-nums text-emerald-600">
                    {onlinePct.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right tabular-nums">{m.offline}</td>
                  <td className="py-3 text-right tabular-nums">{m.withAlerts}</td>
                  <td className="py-3 text-right font-semibold tabular-nums" style={{ color: alertColor }}>
                    {alertRate.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      {/* Unit table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((s) => {
          const label = s === "all" ? "All Units" : CONNECTED_STATUS_LABELS[s];
          const count = s === "all" ? stats.total : statusCounts[s];
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active ? "text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              style={active ? { backgroundColor: MS_BRAND.colors.primary } : {}}
            >
              {label} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search serial, dealer, customer, model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[260px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={alertsOnly}
            onChange={(e) => setAlertsOnly(e.target.checked)}
            className="rounded"
          />
          Alerts only
        </label>
        <span className="text-xs text-slate-500 ml-auto">
          Showing {Math.min(filtered.length, 150)} of {filtered.length}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Serial / Customer</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Model</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Uptime</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Firmware</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Alerts</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Water Temp</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 150).map((u) => {
              const statusColor = CONNECTED_STATUS_COLORS[u.status];
              const minutesAgo = Math.floor((Date.now() - u.lastSeenAt.getTime()) / 60000);
              return (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/manufacturer/iot/${u.id}`}
                      className="font-semibold font-mono text-xs text-slate-900 hover:text-cyan-700"
                    >
                      {u.serialNumber}
                    </Link>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {u.customerName} · {u.customerCity}, {u.customerState}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        color: MS_BRAND.modelLineColors[u.modelLine],
                        backgroundColor: `${MS_BRAND.modelLineColors[u.modelLine]}15`,
                      }}
                    >
                      {u.modelLine}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">{u.model}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                    >
                      {CONNECTED_STATUS_LABELS[u.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <span
                      className="font-semibold"
                      style={{
                        color: u.uptimePct30d >= 95 ? "#059669" : u.uptimePct30d >= 80 ? "#D97706" : "#DC2626",
                      }}
                    >
                      {u.uptimePct30d.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs">
                    <span style={{ color: u.firmwareCompliant ? "#059669" : "#D97706" }}>
                      {u.firmwareVersion}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.openAlerts > 0 ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "#DC2626", backgroundColor: "#DC262618" }}
                      >
                        {u.openAlerts} open
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-xs">
                    {u.status === "never_connected" ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className="text-slate-700">{u.telemetry.waterTempF}°F</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {u.status === "never_connected" ? "—" : fmtRelative(minutesAgo)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
