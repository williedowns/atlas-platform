import Link from "next/link";
import { notFound } from "next/navigation";
import {
  shipmentById,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDT = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = shipmentById(id);
  if (!s) notFound();

  const statusColor = SHIPMENT_STATUS_COLORS[s.status];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/freight" className="hover:text-cyan-700">Freight</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold font-mono">{s.shipmentNumber}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 font-mono">{s.shipmentNumber}</h2>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
            >
              {SHIPMENT_STATUS_LABELS[s.status]}
            </span>
            {s.claim && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800">
                Claim Filed
              </span>
            )}
          </div>
          <p className="text-slate-600 mt-1">
            Order{" "}
            <Link href={`/manufacturer/dealer-orders/${s.orderId}`} className="font-semibold hover:text-cyan-700 font-mono">
              {s.orderNumber}
            </Link>
            {" · "}
            <Link href={`/manufacturer/dealers/${s.dealerId}`} className="font-semibold hover:text-cyan-700">
              {s.dealerName}
            </Link>
            {" · "}
            {s.dealerCity}, {s.dealerState}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Freight Cost</p>
          <p className="text-4xl font-black mt-1" style={{ color: MS_BRAND.colors.primary }}>
            {fmtCurrency(s.freightCost)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {s.unitCount} units · {s.weightLbs.toLocaleString()} lbs · {s.serviceLevel}
          </p>
        </div>
      </div>

      {/* Route / ETA banner */}
      <div
        className="rounded-xl p-6 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${MS_BRAND.colors.sidebarBg} 0%, ${statusColor} 140%)`,
        }}
      >
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/60">Origin</p>
            <p className="text-2xl font-black">{s.originCity}, {s.originState}</p>
            <p className="text-xs text-white/50 mt-1">Master Spas HQ</p>
          </div>
          <div className="text-center flex-1 mx-8">
            <div className="relative">
              <div className="h-0.5 bg-white/30 relative">
                <div className="absolute left-1/2 -top-1 -translate-x-1/2 w-3 h-3 rounded-full bg-white animate-pulse" />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 mt-3">{s.carrier}</p>
              <p className="text-sm font-semibold text-white/90">{s.milesDistance.toLocaleString()} miles</p>
              <p className="text-[10px] text-white/50">
                {s.transitDaysExpected} days expected
                {s.transitDaysActual !== undefined && ` · ${s.transitDaysActual} actual`}
                {s.onTime === true && " · on-time"}
                {s.onTime === false && " · late"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-white/60">Destination</p>
            <p className="text-2xl font-black">{s.destCity}, {s.destState}</p>
            <p className="text-xs text-white/50 mt-1">{s.dealerName}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Tracking timeline */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Tracking Events</h3>
            <span className="font-mono text-xs text-slate-500">Tracking: {s.trackingNumber}</span>
          </div>
          {s.events.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No tracking events yet.</p>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-slate-200" />
              {s.events.slice().reverse().map((e, i) => (
                <div key={i} className="relative mb-4 last:mb-0">
                  <div
                    className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white"
                    style={{
                      backgroundColor: i === 0 ? statusColor : "#CBD5E1",
                      boxShadow: i === 0 ? `0 0 0 3px ${statusColor}40` : "none",
                    }}
                  />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{e.status}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{e.description}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{e.location}</p>
                    </div>
                    <p className="text-xs text-slate-500 tabular-nums whitespace-nowrap ml-4">
                      {fmtDT(e.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: POD + claim + cost */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Schedule
            </h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Scheduled Pickup</span>
                <span className="font-semibold text-slate-900 tabular-nums text-xs">
                  {s.scheduledPickup.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              {s.actualPickup && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Actual Pickup</span>
                  <span className="font-semibold text-slate-900 tabular-nums text-xs">
                    {s.actualPickup.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">ETA</span>
                <span className="font-semibold text-slate-900 tabular-nums text-xs">
                  {s.estimatedDelivery.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              {s.actualDelivery && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Delivered</span>
                  <span className="font-semibold text-emerald-600 tabular-nums text-xs">
                    {s.actualDelivery.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {s.podSignature && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Proof of Delivery
              </h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Signed by</span>
                  <span className="font-semibold text-slate-900">{s.podSignature}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Role</span>
                  <span className="text-slate-700 text-xs">{s.podReceivedBy}</span>
                </div>
                <div className="mt-3 h-16 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400">
                    Signature captured on driver tablet
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Cost Breakdown
            </h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Quoted</span>
                <span className="text-slate-700 tabular-nums">{fmtCurrency(s.quotedFreight)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Actual</span>
                <span className="font-bold text-slate-900 tabular-nums">{fmtCurrency(s.freightCost)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-600 text-xs">Variance</span>
                <span
                  className={`font-semibold tabular-nums text-xs ${
                    s.freightCost > s.quotedFreight ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {s.freightCost > s.quotedFreight ? "+" : ""}
                  {fmtCurrency(s.freightCost - s.quotedFreight)}
                </span>
              </div>
              <div className="flex justify-between pt-2 mt-2 border-t border-slate-100">
                <span className="text-slate-500 text-xs">Per unit</span>
                <span className="text-slate-600 tabular-nums text-xs">
                  {fmtCurrency(s.freightCost / Math.max(1, s.unitCount))}
                </span>
              </div>
            </div>
          </div>

          {s.claim && (
            <div
              className="rounded-xl p-5 border-l-4"
              style={{
                borderColor:
                  s.claim.severity === "major"
                    ? "#DC2626"
                    : s.claim.severity === "moderate"
                    ? "#D97706"
                    : "#F59E0B",
                backgroundColor: "#FEF2F2",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-900">
                  Damage Claim
                </h4>
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-700">
                  {s.claim.severity}
                </span>
              </div>
              <p className="text-sm text-slate-800">{s.claim.description}</p>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Status</span>
                  <span className="font-semibold capitalize">{s.claim.status.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Filed</span>
                  <span className="tabular-nums">
                    {s.claim.filedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                {s.claim.resolutionAmount && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Resolution</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {fmtCurrency(s.claim.resolutionAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
