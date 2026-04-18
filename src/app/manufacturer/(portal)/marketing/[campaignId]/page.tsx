import Link from "next/link";
import { notFound } from "next/navigation";
import {
  campaignById,
  ROUTED_LEADS,
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_CHANNEL_COLORS,
  ROUTED_LEAD_STATUS_LABELS,
  ROUTED_LEAD_STATUS_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const c = campaignById(campaignId);
  if (!c) notFound();

  const channelColor = CAMPAIGN_CHANNEL_COLORS[c.channel];
  const statusColor =
    c.status === "active" ? "#059669" :
    c.status === "completed" ? "#0891B2" :
    c.status === "planned" ? "#94A3B8" : "#D97706";

  const campaignLeads = ROUTED_LEADS.filter((l) => l.campaignId === c.id);
  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
  const leadRate = c.clicks > 0 ? (c.leads / c.clicks) * 100 : 0;
  const qualRate = c.leads > 0 ? (c.qualifiedLeads / c.leads) * 100 : 0;
  const convRate = c.qualifiedLeads > 0 ? (c.convertedToSale / c.qualifiedLeads) * 100 : 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/marketing" className="hover:text-cyan-700">Marketing</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">{c.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{c.name}</h2>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider capitalize"
              style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
            >
              {c.status}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ color: channelColor, backgroundColor: `${channelColor}18` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: channelColor }} />
              {CAMPAIGN_CHANNEL_LABELS[c.channel]}
            </span>
          </div>
          <p className="text-slate-600 mt-1">
            {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Targeting: {c.regionsTargeted.join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Campaign ROI</p>
          <p
            className="text-4xl font-black mt-1 tabular-nums"
            style={{
              color: c.roi >= 4 ? MS_BRAND.colors.success : c.roi >= 2 ? MS_BRAND.colors.warning : MS_BRAND.colors.primary,
            }}
          >
            {c.roi > 0 ? `${c.roi.toFixed(1)}x` : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {fmtCurrency(c.attributableRevenue)} / {fmtCurrency(c.totalSpend)}
          </p>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-900 mb-4">Conversion Funnel</h3>
        <div className="grid grid-cols-5 gap-2">
          <FunnelStep label="Impressions" value={c.impressions.toLocaleString()} subLabel="exposure" color="#CBD5E1" />
          <FunnelStep label="Clicks" value={c.clicks.toLocaleString()} subLabel={`${ctr.toFixed(1)}% CTR`} color="#0891B2" />
          <FunnelStep label="Leads" value={c.leads.toLocaleString()} subLabel={`${leadRate.toFixed(1)}% of clicks`} color="#7C3AED" />
          <FunnelStep label="Qualified" value={c.qualifiedLeads.toLocaleString()} subLabel={`${qualRate.toFixed(1)}% of leads`} color="#D97706" />
          <FunnelStep label="Converted" value={c.convertedToSale.toLocaleString()} subLabel={`${convRate.toFixed(1)}% of qual.`} color="#059669" />
        </div>
      </div>

      {/* Spend + outcome */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Spend Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">National (corporate)</span>
              <span className="font-semibold tabular-nums">{fmtCurrency(c.nationalSpend)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Co-op (dealer match)</span>
              <span className="font-semibold tabular-nums">{fmtCurrency(c.coopSpend)}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between">
              <span className="text-slate-900 font-bold">Total</span>
              <span className="font-black tabular-nums">{fmtCurrency(c.totalSpend)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Acquisition Economics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Cost per lead</span>
              <span className="font-semibold tabular-nums">
                {c.costPerLead > 0 ? fmtCurrency(c.costPerLead) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Cost per acquisition</span>
              <span className="font-semibold tabular-nums">
                {c.costPerAcquisition > 0 ? fmtCurrency(c.costPerAcquisition) : "—"}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between">
              <span className="text-slate-600">Avg ticket</span>
              <span className="font-semibold tabular-nums">
                {c.convertedToSale > 0 ? fmtCurrency(c.attributableRevenue / c.convertedToSale) : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Outcome</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Attributable revenue</span>
              <span className="font-semibold tabular-nums">
                {c.attributableRevenue > 0 ? fmtCurrency(c.attributableRevenue) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Margin (est 28%)</span>
              <span className="font-semibold tabular-nums">
                {c.attributableRevenue > 0 ? fmtCurrency(c.attributableRevenue * 0.28) : "—"}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between">
              <span className="text-slate-900 font-bold">Net ROI</span>
              <span className="font-black tabular-nums">
                {c.roi > 0 ? `${c.roi.toFixed(1)}x` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Leads from this campaign */}
      {campaignLeads.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Leads Attributed to This Campaign</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {campaignLeads.length} lead{campaignLeads.length !== 1 ? "s" : ""} routed from this campaign
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Lead #</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Customer</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Routed To</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Interest</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaignLeads.slice(0, 50).map((l) => {
                const statusColor = ROUTED_LEAD_STATUS_COLORS[l.status];
                const responseColor =
                  l.timeToContactMinutes === undefined ? "#CBD5E1"
                  : l.timeToContactMinutes <= 60 ? "#059669"
                  : l.timeToContactMinutes <= 240 ? "#D97706"
                  : "#DC2626";
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2 text-xs font-mono text-slate-700">{l.leadNumber}</td>
                    <td className="px-5 py-2">
                      <p className="text-sm font-semibold text-slate-800">{l.customerName}</p>
                      <p className="text-[10px] text-slate-500">
                        ZIP {l.customerZip} · {l.customerState}
                      </p>
                    </td>
                    <td className="px-5 py-2">
                      <Link href={`/manufacturer/dealers/${l.dealerId}`} className="text-sm text-slate-700 hover:text-cyan-700">
                        {l.dealerName}
                      </Link>
                    </td>
                    <td className="px-5 py-2 text-xs text-slate-700">{l.interest}</td>
                    <td className="px-5 py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                      >
                        {ROUTED_LEAD_STATUS_LABELS[l.status]}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right text-xs tabular-nums" style={{ color: responseColor }}>
                      {l.timeToContactMinutes !== undefined ? `${l.timeToContactMinutes}m` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FunnelStep({
  label,
  value,
  subLabel,
  color,
}: {
  label: string;
  value: string;
  subLabel: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg border p-4 text-center"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
        {label}
      </p>
      <p className="text-2xl font-black mt-1 tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-slate-500 mt-1">{subLabel}</p>
    </div>
  );
}
