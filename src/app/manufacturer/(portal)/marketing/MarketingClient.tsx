"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type Campaign,
  type CampaignChannel,
  type CampaignStatus,
  type RoutedLead,
  type Review,
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_CHANNEL_COLORS,
  ROUTED_LEAD_STATUS_LABELS,
  ROUTED_LEAD_STATUS_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export interface MarketingStats {
  campaignsActive: number;
  campaignsCompleted: number;
  campaignsPlanned: number;
  totalSpendYtd: number;
  totalLeadsYtd: number;
  leadsLast30d: number;
  totalRevenueAttributed: number;
  networkRoi: number;
  avgTimeToContactMin: number;
  contactedRate: number;
  routedConversionRate: number;
  avgRating: number;
  totalReviews: number;
  reviewsLast30d: number;
  negativeRecentCount: number;
  routedLeadsTotal: number;
  routedLeadsConverted: number;
}

export interface ChannelRow {
  channel: CampaignChannel;
  campaigns: number;
  spend: number;
  leads: number;
  converted: number;
  revenue: number;
  cpl: number;
  cpa: number;
  roi: number;
}

export interface DealerLeadRow {
  dealer: { id: string; name: string; city: string; state: string; tier: string };
  routed: number;
  contacted: number;
  converted: number;
  avgTimeToContact: number;
  conversionRate: number;
}

const STATUS_TABS: (CampaignStatus | "all")[] = [
  "all",
  "active",
  "completed",
  "planned",
  "paused",
];

export default function MarketingClient({
  campaigns,
  stats,
  channels,
  recentLeads,
  dealerPerformance,
  reviews,
  statusCounts,
}: {
  campaigns: Campaign[];
  stats: MarketingStats;
  channels: ChannelRow[];
  recentLeads: RoutedLead[];
  dealerPerformance: DealerLeadRow[];
  reviews: Review[];
  statusCounts: Record<CampaignStatus, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search && !`${c.name} ${c.channel}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [campaigns, statusFilter, search]);

  const channelChartData = channels.map((c) => ({
    name: CAMPAIGN_CHANNEL_LABELS[c.channel],
    spend: c.spend,
    revenue: c.revenue,
    roi: c.roi,
    leads: c.leads,
  }));

  const ratingDist = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
  }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Marketing Hub</h2>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              Module 7 · Lead Routing & Campaigns
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            National campaigns, ZIP-based lead routing to closest dealer, brand health across all showrooms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.negativeRecentCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {stats.negativeRecentCount} negative reviews this month
            </div>
          )}
          {stats.campaignsActive > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              {stats.campaignsActive} campaigns running
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Marketing ROI"
          value={`${stats.networkRoi.toFixed(1)}x`}
          sublabel={`${fmtCompact(stats.totalRevenueAttributed)} attributed / ${fmtCompact(stats.totalSpendYtd)} spent`}
          trend={stats.networkRoi >= 3 ? "up" : "down"}
          trendValue={stats.networkRoi >= 3 ? "strong" : "watch"}
          accentColor={stats.networkRoi >= 3 ? MS_BRAND.colors.success : MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="National Leads — Last 30d"
          value={stats.leadsLast30d}
          sublabel={`${stats.routedLeadsTotal} routed total · ${stats.routedLeadsConverted} converted`}
          trend="up"
          trendValue="live"
          accentColor={MS_BRAND.colors.accent}
          size="lg"
        />
        <KpiCard
          label="Time to First Contact"
          value={`${stats.avgTimeToContactMin}m`}
          sublabel={`${stats.contactedRate.toFixed(0)}% contacted within 60m`}
          trend={stats.contactedRate >= 70 ? "up" : "down"}
          trendValue={stats.contactedRate >= 70 ? "fast" : "slow"}
          accentColor={stats.contactedRate >= 70 ? MS_BRAND.colors.success : MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Brand Rating"
          value={stats.avgRating.toFixed(2)}
          sublabel={`${stats.totalReviews} reviews · ${stats.reviewsLast30d} this month`}
          trend={stats.avgRating >= 4.3 ? "up" : "down"}
          trendValue={stats.avgRating >= 4.3 ? "strong" : "watch"}
          accentColor={stats.avgRating >= 4.3 ? MS_BRAND.colors.success : MS_BRAND.colors.warning}
          size="lg"
        />
      </div>

      {/* Channel performance */}
      <SectionCard
        title="Channel Performance"
        subtitle="ROI by channel — which campaigns actually drive revenue"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Channel</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Campaigns</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Spend</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Leads</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">CPL</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Converted</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">CPA</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Revenue</th>
              <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {channels.map((c) => {
              const color = CAMPAIGN_CHANNEL_COLORS[c.channel];
              const roiColor = c.roi >= 4 ? "#059669" : c.roi >= 2 ? "#D97706" : "#DC2626";
              return (
                <tr key={c.channel} className="hover:bg-slate-50">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-slate-900">{CAMPAIGN_CHANNEL_LABELS[c.channel]}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right tabular-nums text-slate-700">{c.campaigns}</td>
                  <td className="py-3 text-right tabular-nums text-slate-700">{fmtCurrency(c.spend)}</td>
                  <td className="py-3 text-right tabular-nums">{c.leads.toLocaleString()}</td>
                  <td className="py-3 text-right tabular-nums text-xs text-slate-600">
                    {c.cpl > 0 ? fmtCurrency(c.cpl) : "—"}
                  </td>
                  <td className="py-3 text-right tabular-nums">{c.converted}</td>
                  <td className="py-3 text-right tabular-nums text-xs text-slate-600">
                    {c.cpa > 0 ? fmtCurrency(c.cpa) : "—"}
                  </td>
                  <td className="py-3 text-right tabular-nums text-slate-700">{fmtCurrency(c.revenue)}</td>
                  <td className="py-3 text-right font-bold tabular-nums" style={{ color: roiColor }}>
                    {c.roi.toFixed(1)}x
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard
          title="Channel ROI Comparison"
          subtitle="Revenue attributed vs spend"
        >
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={channelChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                  formatter={(v, name) =>
                    name === "roi" ? [`${Number(v).toFixed(1)}x`, "ROI"] : [Number(v), String(name)]
                  }
                />
                <Bar dataKey="roi" radius={[6, 6, 0, 0]}>
                  {channelChartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={channelChartData[i].roi >= 4 ? "#059669" : channelChartData[i].roi >= 2 ? "#D97706" : "#DC2626"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Review Rating Distribution"
          subtitle={`${stats.totalReviews} total reviews across dealer network`}
        >
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={ratingDist} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis
                  type="category"
                  dataKey="rating"
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  width={50}
                  tickFormatter={(v) => `${v}★`}
                />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {ratingDist.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.rating >= 4 ? "#059669" : d.rating === 3 ? "#D97706" : "#DC2626"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Top dealers by routed lead conversion */}
      <div className="grid grid-cols-2 gap-6">
        <SectionCard
          title="Top Dealers — Routed Lead Conversion"
          subtitle="Who converts national leads best"
        >
          <div className="divide-y divide-slate-100">
            {dealerPerformance.map((d, i) => {
              const responseColor =
                d.avgTimeToContact <= 60 ? "#059669" : d.avgTimeToContact <= 240 ? "#D97706" : "#DC2626";
              return (
                <Link
                  key={d.dealer.id}
                  href={`/manufacturer/dealers/${d.dealer.id}`}
                  className="py-3 flex items-center gap-4 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                    style={{ backgroundColor: i === 0 ? "#EAB308" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7F32" : MS_BRAND.colors.accent }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{d.dealer.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {d.dealer.city}, {d.dealer.state} · {d.routed} routed · {d.converted} converted
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 text-sm">{d.conversionRate.toFixed(1)}%</p>
                    <p className="text-[10px] tabular-nums" style={{ color: responseColor }}>
                      {d.avgTimeToContact}m avg response
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent Routed Leads"
          subtitle="National leads → closest dealer by ZIP"
        >
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-auto">
            {recentLeads.map((l) => {
              const statusColor = ROUTED_LEAD_STATUS_COLORS[l.status];
              return (
                <div key={l.id} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-slate-900">{l.customerName}</p>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                    >
                      {ROUTED_LEAD_STATUS_LABELS[l.status]}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {l.interest} · {l.customerState}{" "}
                    <span className="mx-1 text-slate-400">→</span>
                    {l.dealerName}
                    {l.campaignName && <> · {l.campaignName}</>}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Routed{" "}
                    {l.routedMinutesAgo < 60
                      ? `${l.routedMinutesAgo}m ago`
                      : l.routedMinutesAgo < 60 * 24
                      ? `${Math.floor(l.routedMinutesAgo / 60)}h ago`
                      : `${Math.floor(l.routedMinutesAgo / 60 / 24)}d ago`}
                    {l.timeToContactMinutes !== undefined && (
                      <>
                        {" · "}
                        <span className={l.timeToContactMinutes <= 60 ? "text-emerald-600 font-semibold" : "text-amber-600"}>
                          contacted in {l.timeToContactMinutes}m
                        </span>
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Recent reviews */}
      <SectionCard
        title="Recent Customer Reviews"
        subtitle={`${stats.reviewsLast30d} posted in the last 30 days across the network`}
      >
        <div className="grid grid-cols-2 gap-4">
          {reviews.slice(0, 6).map((r) => {
            const ratingColor = r.rating >= 4 ? "#059669" : r.rating === 3 ? "#D97706" : "#DC2626";
            return (
              <div key={r.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg" style={{ color: ratingColor }}>
                        {Array.from({ length: 5 }, (_, i) => (i < r.rating ? "★" : "☆")).join("")}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 capitalize">
                        {r.source.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 mt-1">{r.dealerName}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 tabular-nums">
                    {r.postedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <p className="text-sm text-slate-800 leading-snug">&ldquo;{r.excerpt}&rdquo;</p>
                <p className="text-[10px] text-slate-500 mt-2">
                  — {r.reviewer}
                  {r.responded && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">
                      Responded
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Campaign table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((s) => {
          const label = s === "all" ? "All Campaigns" : s.charAt(0).toUpperCase() + s.slice(1);
          const count = s === "all" ? campaigns.length : statusCounts[s];
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
          placeholder="Search campaign name or channel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[260px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} campaign{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Campaign</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Spend</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Leads</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Converted</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Revenue</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">ROI</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Dates</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 150).map((c) => {
              const channelColor = CAMPAIGN_CHANNEL_COLORS[c.channel];
              const statusColor =
                c.status === "active" ? "#059669" :
                c.status === "completed" ? "#0891B2" :
                c.status === "planned" ? "#94A3B8" : "#D97706";
              const roiColor = c.roi >= 4 ? "#059669" : c.roi >= 2 ? "#D97706" : "#DC2626";
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/manufacturer/marketing/${c.id}`}
                      className="font-semibold text-slate-900 hover:text-cyan-700"
                    >
                      {c.name}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: channelColor }}
                      />
                      <span className="text-[10px] text-slate-500">
                        {CAMPAIGN_CHANNEL_LABELS[c.channel]}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider capitalize"
                      style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtCurrency(c.totalSpend)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.leads.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.convertedToSale}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                    {c.attributableRevenue > 0 ? fmtCurrency(c.attributableRevenue) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums" style={{ color: roiColor }}>
                    {c.roi > 0 ? `${c.roi.toFixed(1)}x` : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 tabular-nums">
                    {c.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" – "}
                    {c.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
