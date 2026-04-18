import Link from "next/link";
import { notFound } from "next/navigation";
import {
  warrantyClaimById,
  WARRANTY_STATUS_LABELS,
  WARRANTY_STATUS_COLORS,
  DEFECT_CATEGORY_LABELS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDT = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function WarrantyClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claim = warrantyClaimById(id);
  if (!claim) notFound();

  const statusColor = WARRANTY_STATUS_COLORS[claim.status];
  const sevColor =
    claim.severity === "major" ? "#DC2626" : claim.severity === "moderate" ? "#D97706" : "#F59E0B";

  const partsTotal = claim.parts.reduce((s, p) => s + p.unitCost * p.qty, 0);
  const laborCost = Math.max(0, claim.totalCost - partsTotal);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/warranty" className="hover:text-cyan-700">Warranty</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold font-mono">{claim.claimNumber}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 font-mono">{claim.claimNumber}</h2>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
            >
              {WARRANTY_STATUS_LABELS[claim.status]}
            </span>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ color: sevColor, backgroundColor: `${sevColor}18` }}
            >
              {claim.severity}
            </span>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                color: MS_BRAND.modelLineColors[claim.modelLine],
                backgroundColor: `${MS_BRAND.modelLineColors[claim.modelLine]}15`,
              }}
            >
              {DEFECT_CATEGORY_LABELS[claim.category]}
            </span>
          </div>
          <p className="text-slate-600 mt-1">
            {claim.modelLine} · {claim.model} ·{" "}
            <span className="font-mono text-xs">{claim.serialNumber}</span>
          </p>
          <p className="text-slate-600 mt-0.5">
            Filed by{" "}
            <Link href={`/manufacturer/dealers/${claim.dealerId}`} className="font-semibold hover:text-cyan-700">
              {claim.dealerName}
            </Link>
            {" · for customer "}
            <span className="font-semibold">{claim.customerName}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Claim Cost</p>
          <p
            className="text-4xl font-black mt-1 tabular-nums"
            style={{ color: claim.totalCost > 0 ? MS_BRAND.colors.primary : "#94A3B8" }}
          >
            {claim.totalCost > 0 ? fmtCurrency(claim.totalCost) : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1 capitalize">
            {claim.resolutionType.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Description banner */}
      <div
        className="rounded-xl p-5 border-l-4"
        style={{ borderColor: sevColor, backgroundColor: `${sevColor}10` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sevColor }}>
          Defect Report
        </p>
        <p className="text-base text-slate-900 mt-1">{claim.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Claim Timeline</h3>
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-slate-200" />
            {claim.events.slice().reverse().map((e, i) => (
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
                    <p className="text-[10px] text-slate-500 mt-0.5">{e.actor}</p>
                  </div>
                  <p className="text-xs text-slate-500 tabular-nums whitespace-nowrap ml-4">
                    {fmtDT(e.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Unit Info
            </h4>
            <div className="space-y-1.5 text-sm">
              <Row label="Serial" value={claim.serialNumber} mono />
              <Row label="Model" value={`${claim.modelLine} ${claim.model}`} />
              <Row label="Produced" value={fmtDate(claim.productionDate)} />
              <Row label="Delivered" value={fmtDate(claim.deliveredDate)} />
              <Row label="In service" value={`${claim.warrantyAgeMonths.toFixed(0)} months`} />
            </div>
          </div>

          {claim.techAssigned && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Service Dispatch
              </h4>
              <div className="space-y-1.5 text-sm">
                <Row label="Tech" value={claim.techAssigned} />
                {claim.scheduledServiceDate && (
                  <Row label="Scheduled" value={fmtDate(claim.scheduledServiceDate)} />
                )}
                {claim.resolvedAt && (
                  <Row
                    label="Resolved"
                    value={`${fmtDate(claim.resolvedAt)} (${claim.resolutionDays ?? 0}d total)`}
                    highlight
                  />
                )}
              </div>
            </div>
          )}

          {claim.customerSatisfaction !== undefined && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Customer Rating
              </h4>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span
                    key={s}
                    className={`text-2xl ${s <= claim.customerSatisfaction! ? "text-amber-400" : "text-slate-200"}`}
                  >
                    ★
                  </span>
                ))}
                <span className="text-xl font-bold text-slate-700 ml-2">
                  {claim.customerSatisfaction} / 5
                </span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Cost Breakdown
            </h4>
            <div className="space-y-1.5 text-sm">
              <Row label="Parts" value={fmtCurrency(partsTotal)} />
              {laborCost > 0 && <Row label="Labor & freight" value={fmtCurrency(laborCost)} />}
              <div className="pt-2 mt-2 border-t border-slate-100">
                <Row label="Total" value={fmtCurrency(claim.totalCost)} bold />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parts list */}
      {claim.parts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Parts Dispatched</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {claim.parts.length} part{claim.parts.length !== 1 ? "s" : ""} · shipped to {claim.dealerName}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  Part
                </th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  Part #
                </th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  Qty
                </th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  Unit Cost
                </th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  Extended
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claim.parts.map((p, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 font-semibold text-slate-800">{p.name}</td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-mono">{p.partNumber}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{p.qty}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtCurrency(p.unitCost)}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {fmtCurrency(p.unitCost * p.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-600">{label}</span>
      <span
        className={`text-slate-900 ${mono ? "font-mono text-xs" : ""} ${bold ? "font-bold" : ""} ${
          highlight ? "text-emerald-600 font-semibold" : ""
        } text-right`}
      >
        {value}
      </span>
    </div>
  );
}
