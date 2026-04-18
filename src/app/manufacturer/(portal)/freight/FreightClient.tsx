"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type Shipment,
  type ShipmentStatus,
  type DamageClaim,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export interface FreightStats {
  total: number;
  active: number;
  inTransit: number;
  deliveredThisMonth: number;
  deliveredToday: number;
  onTimePct: number;
  delayedCount: number;
  openClaimsCount: number;
  resolvedClaimsCount: number;
  totalFreightSpend: number;
  avgFreightPerShipment: number;
  totalUnitsInTransit: number;
  avgTransitDays: number;
  totalClaimsCost: number;
}

export interface CarrierRow {
  carrier: string;
  shipments: number;
  onTimePct: number;
  avgTransit: number;
  totalSpend: number;
  claimsRate: number;
  claims: number;
}

export interface OpenClaimRow {
  shipment: Shipment;
  claim: DamageClaim;
}

const STATUS_TABS: (ShipmentStatus | "all")[] = [
  "all",
  "scheduled",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delayed",
  "exception",
  "delivered",
];

export default function FreightClient({
  shipments,
  stats,
  carriers,
  claims,
  statusCounts,
}: {
  shipments: Shipment[];
  stats: FreightStats;
  carriers: CarrierRow[];
  claims: OpenClaimRow[];
  statusCounts: Record<ShipmentStatus, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("All");

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (carrierFilter !== "All" && s.carrier !== carrierFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !`${s.shipmentNumber} ${s.trackingNumber} ${s.dealerName} ${s.destCity} ${s.destState} ${s.carrier}`
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      return true;
    });
  }, [shipments, statusFilter, search, carrierFilter]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Freight & Logistics</h2>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              Module 3 · Shipping
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Every outbound shipment from Fort Wayne to dealer — carrier performance, in-transit visibility, damage claims.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.delayedCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
              {stats.delayedCount} delayed / exception
            </div>
          )}
          {stats.openClaimsCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {stats.openClaimsCount} open claim{stats.openClaimsCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="In Transit"
          value={stats.inTransit}
          sublabel={`${stats.totalUnitsInTransit} units on trucks right now`}
          trend="up"
          trendValue="live"
          accentColor={MS_BRAND.colors.accent}
          size="lg"
        />
        <KpiCard
          label="On-Time Delivery"
          value={`${stats.onTimePct.toFixed(0)}%`}
          sublabel={`${stats.deliveredThisMonth} delivered in last 30d`}
          trend={stats.onTimePct >= 90 ? "up" : "down"}
          trendValue={stats.onTimePct >= 90 ? "good" : "watch"}
          accentColor={stats.onTimePct >= 90 ? MS_BRAND.colors.success : MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Avg Transit"
          value={`${stats.avgTransitDays}d`}
          sublabel="Fort Wayne → dealer door"
          accentColor={MS_BRAND.colors.primary}
          size="lg"
        />
        <KpiCard
          label="Freight Spend YTD"
          value={fmtCompact(stats.totalFreightSpend)}
          sublabel={`${fmtCurrency(stats.avgFreightPerShipment)} per shipment`}
          accentColor={MS_BRAND.colors.warning}
          size="lg"
        />
      </div>

      {/* Open claims strip */}
      {claims.length > 0 && (
        <SectionCard
          title="Open Damage Claims"
          subtitle={`${claims.length} claim${claims.length !== 1 ? "s" : ""} awaiting resolution · ${fmtCurrency(stats.totalClaimsCost)} paid YTD`}
          viewAllHref="/manufacturer/freight?filter=claims"
        >
          <div className="divide-y divide-slate-100">
            {claims.slice(0, 5).map((c) => {
              const severityColor =
                c.claim.severity === "major" ? "#DC2626" : c.claim.severity === "moderate" ? "#D97706" : "#F59E0B";
              return (
                <Link
                  key={c.claim.id}
                  href={`/manufacturer/freight/${c.shipment.id}`}
                  className="py-3 flex items-center gap-4 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-widest flex-shrink-0"
                    style={{ backgroundColor: severityColor }}
                  >
                    {c.claim.severity.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 font-mono">
                        {c.shipment.shipmentNumber}
                      </span>
                      <span className="text-xs text-slate-500">· {c.shipment.dealerName}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{c.claim.description}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        color:
                          c.claim.status === "approved"
                            ? "#059669"
                            : c.claim.status === "under_review"
                            ? "#D97706"
                            : "#0891B2",
                        backgroundColor:
                          c.claim.status === "approved"
                            ? "#05966918"
                            : c.claim.status === "under_review"
                            ? "#D9770618"
                            : "#0891B218",
                      }}
                    >
                      {c.claim.status.replace("_", " ")}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {Math.floor((Date.now() - c.claim.filedAt.getTime()) / (24 * 60 * 60 * 1000))}d ago
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Carrier Performance"
        subtitle="On-time, transit days, claims rate across your freight network"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Carrier</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Shipments</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">On-Time</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Avg Transit</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Claims Rate</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Total Spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carriers.map((c) => {
              const otColor = c.onTimePct >= 92 ? "#059669" : c.onTimePct >= 85 ? "#D97706" : "#DC2626";
              const claimColor = c.claimsRate <= 2 ? "#059669" : c.claimsRate <= 4 ? "#D97706" : "#DC2626";
              return (
                <tr key={c.carrier} className="hover:bg-slate-50">
                  <td className="py-3 font-semibold text-slate-900">{c.carrier}</td>
                  <td className="py-3 text-right tabular-nums">{c.shipments}</td>
                  <td className="py-3 text-right tabular-nums font-semibold" style={{ color: otColor }}>
                    {c.onTimePct.toFixed(0)}%
                  </td>
                  <td className="py-3 text-right tabular-nums">{c.avgTransit}d</td>
                  <td className="py-3 text-right tabular-nums font-semibold" style={{ color: claimColor }}>
                    {c.claimsRate.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right tabular-nums font-bold text-slate-900">
                    {fmtCurrency(c.totalSpend)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((s) => {
          const label = s === "all" ? "All Shipments" : SHIPMENT_STATUS_LABELS[s];
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
          placeholder="Search shipment #, tracking, dealer, city, carrier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[260px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <select
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option>All</option>
          {carriers.map((c) => (
            <option key={c.carrier}>{c.carrier}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500 ml-auto">
          Showing {Math.min(filtered.length, 150)} of {filtered.length}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Shipment #</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Route</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Carrier</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Units</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Miles</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Freight</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">ETA / Delivered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 150).map((s) => {
              const statusColor = SHIPMENT_STATUS_COLORS[s.status];
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/manufacturer/freight/${s.id}`}
                      className="font-semibold font-mono text-xs text-slate-900 hover:text-cyan-700"
                    >
                      {s.shipmentNumber}
                    </Link>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {s.orderNumber} · {s.serviceLevel}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                    >
                      {SHIPMENT_STATUS_LABELS[s.status]}
                    </span>
                    {s.claim && (
                      <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-red-100 text-red-800">
                        Claim
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-slate-800">
                      <span className="text-slate-500 text-xs">{s.originCity}, {s.originState}</span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className="font-semibold">{s.destCity}, {s.destState}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">{s.dealerName}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-700">{s.carrier}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.unitCount}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600 tabular-nums">
                    {s.milesDistance.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {fmtCurrency(s.freightCost)}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {s.actualDelivery ? (
                      <>
                        <span className="text-emerald-600 font-semibold">
                          Delivered
                        </span>{" "}
                        {s.actualDelivery.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {s.onTime === false && <span className="text-red-600 ml-1">late</span>}
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500">ETA</span>{" "}
                        {s.estimatedDelivery.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </>
                    )}
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
