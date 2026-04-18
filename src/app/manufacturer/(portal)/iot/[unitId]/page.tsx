import Link from "next/link";
import { notFound } from "next/navigation";
import {
  connectedUnitById,
  alertsForUnit,
  CONNECTED_STATUS_LABELS,
  CONNECTED_STATUS_COLORS,
  ALERT_SEVERITY_COLORS,
  DEFECT_CATEGORY_LABELS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtDT = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function ConnectedUnitDetailPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const unit = connectedUnitById(unitId);
  if (!unit) notFound();

  const alerts = alertsForUnit(unit.id);
  const statusColor = CONNECTED_STATUS_COLORS[unit.status];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/iot" className="hover:text-cyan-700">Connected Fleet</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold font-mono">{unit.serialNumber}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-slate-900 font-mono">{unit.serialNumber}</h2>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
            >
              {CONNECTED_STATUS_LABELS[unit.status]}
            </span>
            {unit.heavyUse && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                Heavy Use
              </span>
            )}
            {unit.consumerAppInstalled && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                App Paired
              </span>
            )}
          </div>
          <p className="text-slate-600 mt-1">
            <span
              className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold mr-2"
              style={{
                color: MS_BRAND.modelLineColors[unit.modelLine],
                backgroundColor: `${MS_BRAND.modelLineColors[unit.modelLine]}15`,
              }}
            >
              {unit.modelLine}
            </span>
            {unit.model}
          </p>
          <p className="text-slate-600 mt-0.5">
            Customer{" "}
            <span className="font-semibold">{unit.customerName}</span>
            {" · "}
            <Link href={`/manufacturer/dealers/${unit.dealerId}`} className="font-semibold hover:text-cyan-700">
              {unit.dealerName}
            </Link>
            {" · installed "}
            {fmtDate(unit.installedAt)} ({unit.monthsInService.toFixed(1)}mo in service)
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">30d Uptime</p>
          <p
            className="text-4xl font-black mt-1 tabular-nums"
            style={{
              color: unit.uptimePct30d >= 95 ? MS_BRAND.colors.success
                : unit.uptimePct30d >= 80 ? MS_BRAND.colors.warning
                : MS_BRAND.colors.danger,
            }}
          >
            {unit.uptimePct30d.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Firmware{" "}
            <span
              className="font-mono font-semibold"
              style={{ color: unit.firmwareCompliant ? MS_BRAND.colors.success : MS_BRAND.colors.warning }}
            >
              {unit.firmwareVersion}
            </span>
          </p>
        </div>
      </div>

      {/* Telemetry grid */}
      <SectionGrid title="Live Telemetry" subtitle={`Last reading ${fmtDT(unit.telemetry.lastReadingAt)}`}>
        {unit.status === "never_connected" ? (
          <div className="col-span-6 py-10 text-center text-sm text-slate-500">
            This unit has never connected. Dealer may not have paired the gateway at install.
          </div>
        ) : (
          <>
            <TelemetryTile
              label="Water Temp"
              value={`${unit.telemetry.waterTempF}°F`}
              sub={`Setpoint ${unit.telemetry.setpointF}°F`}
              color={Math.abs(unit.telemetry.waterTempF - unit.telemetry.setpointF) <= 2 ? "#059669" : "#D97706"}
            />
            <TelemetryTile
              label="pH"
              value={unit.telemetry.pH.toFixed(2)}
              sub="Target 7.2–7.8"
              color={unit.telemetry.pH >= 7.2 && unit.telemetry.pH <= 7.8 ? "#059669" : "#D97706"}
            />
            <TelemetryTile
              label="Sanitizer"
              value={`${unit.telemetry.sanitizerPpm} ppm`}
              sub="Target 2–4 ppm"
              color={unit.telemetry.sanitizerPpm >= 2 && unit.telemetry.sanitizerPpm <= 4 ? "#059669" : "#D97706"}
            />
            <TelemetryTile
              label="Flow"
              value={`${unit.telemetry.flowRatePsi} psi`}
              sub="Target 1.5+ psi"
              color={unit.telemetry.flowRatePsi >= 1.5 ? "#059669" : "#DC2626"}
            />
            <TelemetryTile
              label="Pump Hours MTD"
              value={unit.telemetry.pumpHoursMTD.toString()}
              sub={unit.heavyUse ? "Heavy use detected" : "Normal"}
              color={unit.heavyUse ? "#D97706" : "#0891B2"}
            />
            <TelemetryTile
              label="Lifetime Hours"
              value={unit.lifetimeUsageHours.toLocaleString()}
              sub={`${unit.telemetry.heaterHoursMTD}h heater MTD`}
              color="#7C3AED"
            />
          </>
        )}
      </SectionGrid>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Predictive Alerts</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {alerts.length} open alert{alerts.length !== 1 ? "s" : ""} on this unit
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.map((a) => {
              const sevColor = ALERT_SEVERITY_COLORS[a.severity];
              return (
                <div key={a.id} className="px-6 py-4 flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[9px] font-bold uppercase tracking-widest flex-shrink-0"
                    style={{ backgroundColor: sevColor }}
                  >
                    {a.severity === "critical" ? "CRIT" : a.severity === "warning" ? "WARN" : "ADV"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{a.prediction}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="font-semibold">Recommended:</span> {a.recommendedAction}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {DEFECT_CATEGORY_LABELS[a.component]} · {a.confidence}% confidence · detected{" "}
                      {a.minutesAgo < 60 ? `${a.minutesAgo}m ago` : a.minutesAgo < 60 * 24 ? `${Math.floor(a.minutesAgo / 60)}h ago` : `${Math.floor(a.minutesAgo / 60 / 24)}d ago`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sidebar info cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Unit Identity
          </h4>
          <div className="space-y-1.5 text-sm">
            <Row label="Serial" value={unit.serialNumber} mono />
            <Row label="Model" value={unit.model} />
            <Row label="Model Line" value={unit.modelLine} />
            <Row label="Installed" value={fmtDate(unit.installedAt)} />
            <Row label="Age" value={`${unit.monthsInService.toFixed(1)} months`} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Connectivity
          </h4>
          <div className="space-y-1.5 text-sm">
            <Row label="Status" value={CONNECTED_STATUS_LABELS[unit.status]} />
            <Row label="Last seen" value={fmtDT(unit.lastSeenAt)} />
            <Row label="30d uptime" value={`${unit.uptimePct30d.toFixed(1)}%`} />
            <Row label="Firmware" value={unit.firmwareVersion} mono />
            <Row
              label="Compliant"
              value={unit.firmwareCompliant ? "Yes" : "No — upgrade queued"}
              highlight={unit.firmwareCompliant ? "success" : "warn"}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Consumer App
          </h4>
          <div className="space-y-1.5 text-sm">
            <Row
              label="Status"
              value={unit.consumerAppInstalled ? "Paired" : "Not paired"}
              highlight={unit.consumerAppInstalled ? "success" : "warn"}
            />
            {unit.consumerAppInstalled && (
              <>
                <Row label="Sessions last 30d" value={unit.appSessionsLast30d.toString()} />
                <Row
                  label="Engagement"
                  value={
                    unit.appSessionsLast30d > 20 ? "High"
                    : unit.appSessionsLast30d > 5 ? "Moderate"
                    : "Low"
                  }
                />
              </>
            )}
            {!unit.consumerAppInstalled && (
              <p className="text-xs text-slate-500 mt-2">
                Remind dealer to pair at install — drives NPS + upsell signals.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionGrid({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {children}
      </div>
    </div>
  );
}

function TelemetryTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
        {label}
      </p>
      <p className="text-2xl font-black mt-1 tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "success" | "warn";
}) {
  const color = highlight === "success" ? "#059669" : highlight === "warn" ? "#D97706" : undefined;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-600">{label}</span>
      <span
        className={`${mono ? "font-mono text-xs" : ""} text-right`}
        style={{ color: color ?? "#0F172A", fontWeight: highlight ? 600 : 500 }}
      >
        {value}
      </span>
    </div>
  );
}
