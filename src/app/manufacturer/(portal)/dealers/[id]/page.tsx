import Link from "next/link";
import { notFound } from "next/navigation";
import {
  dealerById,
  contractsForDealer,
  showroomsForDealer,
  ATLAS_DEALER_ID,
  type Dealer,
  type Showroom,
  type Contract,
} from "@/lib/manufacturer/mock-data";
import { getAtlasLiveBundle } from "@/lib/manufacturer/atlas-live";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default async function DealerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baseDealer = dealerById(id);
  if (!baseDealer) notFound();

  let dealer: Dealer = baseDealer;
  let showrooms: Showroom[] = showroomsForDealer(id);
  let contracts: Contract[] = contractsForDealer(id, 25);
  let isLive = false;
  let liveHealth: { contractsCount: number; showsCount: number; locationsCount: number } | null = null;

  if (id === ATLAS_DEALER_ID) {
    const live = await getAtlasLiveBundle(baseDealer);
    if (live) {
      dealer = live.dealer;
      if (live.showrooms.length > 0) showrooms = live.showrooms;
      if (live.recentContracts.length > 0) contracts = live.recentContracts.slice(0, 25);
      isLive = true;
      liveHealth = {
        contractsCount: live.dataHealth.contractsCount,
        showsCount: live.dataHealth.showsCount,
        locationsCount: live.dataHealth.locationsCount,
      };
    }
  }

  const healthColor =
    dealer.healthScore >= 80 ? "#059669" : dealer.healthScore >= 60 ? "#D97706" : "#DC2626";

  const factors = [
    { label: "Revenue trend", score: dealer.healthTrend === "up" ? 90 : dealer.healthTrend === "flat" ? 60 : 35 },
    { label: "Conversion rate", score: Math.min(100, dealer.conversionRate * 3) },
    { label: "Inventory turn", score: Math.max(10, 100 - dealer.avgInventoryAge) },
    { label: "Customer CSAT", score: (dealer.csatScore / 5) * 100 },
    { label: "Warranty claims", score: Math.max(20, 100 - dealer.warrantyClaimsYtd * 8) },
  ];

  const showroomRevenueTotal = showrooms.reduce((s, r) => s + r.ytdRevenue, 0);
  const showroomUnitsTotal = showrooms.reduce((s, r) => s + r.ytdUnits, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/dealers" className="hover:text-cyan-700">Dealers</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">{dealer.name}</span>
        {isLive && (
          <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            LIVE DATA
          </span>
        )}
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900">{dealer.name}</h2>
          <p className="text-slate-600 mt-1">
            {dealer.city}, {dealer.state} · {dealer.region} · {dealer.yearsWithMS} years with Master Spas
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold"
              style={{
                color: MS_BRAND.colors.primary,
                backgroundColor: `${MS_BRAND.colors.primary}15`,
              }}
            >
              {dealer.tier} Tier Dealer
            </span>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold"
              style={{
                color: MS_BRAND.colors.accent,
                backgroundColor: `${MS_BRAND.colors.accent}15`,
              }}
            >
              {dealer.showroomCount} Showroom{dealer.showroomCount !== 1 ? "s" : ""}
            </span>
            {isLive && liveHealth && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                Source: Atlas platform · {liveHealth.contractsCount} YTD contracts · {liveHealth.locationsCount} stores · {liveHealth.showsCount} shows
              </span>
            )}
          </div>
        </div>

        <div
          className="text-center rounded-2xl px-8 py-6 text-white"
          style={{ backgroundColor: healthColor }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">Health Score</p>
          <p className="text-6xl font-black mt-1 leading-none">{dealer.healthScore}</p>
          <p className="text-xs mt-1 opacity-90">
            {dealer.healthTrend === "up" ? "▲ Trending up" : dealer.healthTrend === "down" ? "▼ Declining" : "→ Flat"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="YTD Revenue" value={fmtCurrency(dealer.ytdRevenue)} />
        <Stat label="YTD Units" value={dealer.ytdUnits.toString()} />
        <Stat label="Avg Ticket" value={fmtCurrency(dealer.avgTicket)} />
        <Stat label="Conversion" value={`${dealer.conversionRate.toFixed(1)}%`} />
        <Stat label="Showrooms" value={dealer.showroomCount.toString()} />
        <Stat label="Showroom Rev" value={fmtCurrency(dealer.showroomRevenueYtd)} />
        <Stat label="Show Rev" value={fmtCurrency(dealer.showRevenueYtd)} />
        <Stat label="Inv Age" value={`${dealer.avgInventoryAge}d`} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Retail Showroom Locations</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {showrooms.length} location{showrooms.length !== 1 ? "s" : ""} · {fmtCurrency(showroomRevenueTotal)} combined YTD · {showroomUnitsTotal} units
              {isLive && " · live from Atlas"}
            </p>
          </div>
          {dealer.showroomCount === 1 && (dealer.tier === "Platinum" || dealer.tier === "Gold") && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              Expansion candidate
            </span>
          )}
        </div>

        {showrooms.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No showroom data available for this dealer.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Showroom</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Opened</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Sq Ft</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Staff</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Units YTD</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Conv %</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Revenue YTD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {showrooms.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                        style={{
                          backgroundColor: r.isFlagship ? MS_BRAND.colors.primary : MS_BRAND.colors.accent,
                        }}
                      >
                        {r.isFlagship ? "★" : "●"}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{r.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {r.address} · {r.city}, {r.state}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs tabular-nums">{r.openedDate}</td>
                  <td className="px-5 py-3 text-right text-slate-700 tabular-nums text-xs">
                    {r.sqft.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700 tabular-nums text-xs">{r.staffCount}</td>
                  <td className="px-5 py-3 text-right text-slate-700 tabular-nums">{r.ytdUnits}</td>
                  <td className="px-5 py-3 text-right text-slate-700 tabular-nums text-xs">
                    {r.conversionRate.toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {fmtCurrency(r.ytdRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4">Health Score Factors</h3>
          <div className="space-y-3">
            {factors.map((f) => {
              const c = f.score >= 80 ? "#059669" : f.score >= 60 ? "#D97706" : "#DC2626";
              return (
                <div key={f.label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-700 font-medium">{f.label}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: c }}>
                      {Math.round(f.score)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${f.score}%`, backgroundColor: c }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900">Recent Contracts</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {contracts.length} shown{isLive && " · live from Atlas"}
              </p>
            </div>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-auto">
            {contracts.map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm truncate">{c.customerName}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {c.modelLine}
                    {c.venueName && ` · ${c.venueName}`}
                    {c.venueType && (
                      <span
                        className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor:
                            c.venueType === "showroom" ? `${MS_BRAND.colors.primary}15` : `${MS_BRAND.colors.accent}15`,
                          color:
                            c.venueType === "showroom" ? MS_BRAND.colors.primary : MS_BRAND.colors.accent,
                        }}
                      >
                        {c.venueType}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <p className="font-bold text-slate-900 text-sm tabular-nums">{fmtCurrency(c.actualPrice)}</p>
                  <p className="text-xs text-slate-500">
                    {c.minutesAgo < 60
                      ? `${c.minutesAgo}m ago`
                      : c.minutesAgo < 60 * 24
                      ? `${Math.floor(c.minutesAgo / 60)}h ago`
                      : `${Math.floor(c.minutesAgo / 60 / 24)}d ago`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dealer.healthScore < 60 && (
        <div
          className="rounded-xl p-5 border-l-4"
          style={{
            borderColor: MS_BRAND.colors.warning,
            backgroundColor: `${MS_BRAND.colors.warning}12`,
          }}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h4 className="font-bold text-slate-900">Intervention recommended</h4>
              <p className="text-sm text-slate-700 mt-1">
                This dealer's health score is in the at-risk zone. Regional manager should schedule a business review within 14 days.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-xl font-black mt-1 text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
