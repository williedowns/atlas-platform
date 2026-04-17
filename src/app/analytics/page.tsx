export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";

// ── Period helpers ────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "year" | "all";

function getPeriodRange(period: Period): { gte?: string; lte?: string } {
  const now = new Date();

  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  if (period === "week") {
    const day = now.getDay(); // 0=Sun
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 7 * 86400000);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  return {}; // all
}

function getPriorPeriodRange(period: Period): { gte?: string; lte?: string } {
  const now = new Date();

  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  if (period === "week") {
    const day = now.getDay();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - day);
    thisWeekStart.setHours(0, 0, 0, 0);
    const start = new Date(thisWeekStart.getTime() - 7 * 86400000);
    return { gte: start.toISOString(), lte: thisWeekStart.toISOString() };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  if (period === "year") {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear(), 0, 1);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  return {};
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year (YTD)",
  all: "All Time",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const period: Period = (["today", "week", "month", "year", "all"].includes(params.period)
    ? params.period
    : "month") as Period;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const { hasPermission } = await import("@/lib/permissions");
  const orgPerms = (profile?.organization as any)?.role_permissions;
  if (!hasPermission(orgPerms, profile?.role, "analytics")) redirect("/dashboard");

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const range = getPeriodRange(period);
  const priorRange = getPriorPeriodRange(period);

  let query = supabase
    .from("contracts")
    .select(`
      id, contract_number, total, deposit_paid, balance_due, status, is_contingent, created_at,
      customer:customers(first_name, last_name),
      show:shows(id, name, start_date, end_date),
      location:locations(id, name, type),
      sales_rep:profiles(id, full_name),
      line_items
    `)
    .not("status", "in", '("cancelled","quote","draft")');

  if (range.gte) query = query.gte("created_at", range.gte);
  if (range.lte) query = query.lt("created_at", range.lte);

  let priorQuery = supabase
    .from("contracts")
    .select("total, deposit_paid, is_contingent")
    .not("status", "in", '("cancelled","quote","draft")');

  if (priorRange.gte) priorQuery = priorQuery.gte("created_at", priorRange.gte);
  if (priorRange.lte) priorQuery = priorQuery.lt("created_at", priorRange.lte);

  // Outstanding contracts (all time, non-cancelled, balance_due > 0)
  const outstandingQuery = supabase
    .from("contracts")
    .select(`
      id, contract_number, total, deposit_paid, balance_due, status, created_at,
      customer:customers(first_name, last_name)
    `)
    .not("status", "eq", "cancelled")
    .gt("balance_due", 0)
    .order("created_at", { ascending: true });

  // Closing ratio: ALL non-draft contracts in period (quotes + active + cancelled)
  // A quote that converts just changes status — no double counting possible.
  let closingRatioQuery = supabase
    .from("contracts")
    .select(`id, status, show:shows(id), location:locations(id)`)
    .not("status", "eq", "draft");
  if (range.gte) closingRatioQuery = closingRatioQuery.gte("created_at", range.gte);
  if (range.lte) closingRatioQuery = closingRatioQuery.lt("created_at", range.lte);

  // Goals for all reps this month (for leaderboard enrichment)
  const goalsQuery = supabase
    .from("sales_goals")
    .select("rep_id, target_revenue")
    .eq("period_start", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));

  const commissionQuery = supabase.from("commission_rates").select("rep_id, rate_pct");

  const [{ data: contracts }, { data: priorContracts }, { data: outstanding }, { data: allOpps }, { data: goalRows }, { data: commissionRows }] =
    await Promise.all([query, priorQuery, outstandingQuery, closingRatioQuery, goalsQuery, commissionQuery]);

  const rows = contracts ?? [];
  const priorRows = priorContracts ?? [];
  const outstandingRows = outstanding ?? [];

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const confirmedRows = rows.filter((c) => !(c as any).is_contingent);
  const contingentRows = rows.filter((c) => (c as any).is_contingent);

  const confirmedRevenue = confirmedRows.reduce((s, c) => s + (c.total ?? 0), 0);
  const contingentRevenue = contingentRows.reduce((s, c) => s + (c.total ?? 0), 0);
  const totalRevenue = confirmedRevenue + contingentRevenue;
  const totalDeposits = rows.reduce((s, c) => s + (c.deposit_paid ?? 0), 0);
  const contractCount = confirmedRows.length;
  const contingentCount = contingentRows.length;
  const avgDeal = contractCount > 0 ? confirmedRevenue / contractCount : 0;

  const priorRevenue = priorRows.reduce((s, c) => s + (c.total ?? 0), 0);
  const priorDeposits = priorRows.reduce((s, c) => s + (c.deposit_paid ?? 0), 0);
  const priorCount = priorRows.filter((c) => !(c as any).is_contingent).length;

  const revDelta = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : null;
  const depDelta = priorDeposits > 0 ? ((totalDeposits - priorDeposits) / priorDeposits) * 100 : null;
  const cntDelta = priorCount > 0 ? ((contractCount - priorCount) / priorCount) * 100 : null;

  // ── Sales rep leaderboard ───────────────────────────────────────────────────
  const goalMap = new Map((goalRows ?? []).map((g) => [g.rep_id, g.target_revenue]));
  const commissionMap = new Map((commissionRows ?? []).map((r: any) => [r.rep_id, Number(r.rate_pct)]));
  const hasCommissions = (commissionRows ?? []).length > 0;
  const repMap = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const c of rows) {
    const repId = (c.sales_rep as { id?: string } | null)?.id ?? "unknown";
    const repName = (c.sales_rep as { full_name?: string } | null)?.full_name ?? "Unknown";
    const existing = repMap.get(repId) ?? { id: repId, name: repName, count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += c.total ?? 0;
    repMap.set(repId, existing);
  }
  const reps = Array.from(repMap.values()).sort((a, b) => b.revenue - a.revenue);

  // ── Shows breakdown ─────────────────────────────────────────────────────────
  const showMap = new Map<
    string,
    { id: string; name: string; start_date?: string; count: number; revenue: number; deposits: number }
  >();
  for (const c of rows) {
    const showId = (c.show as { id?: string } | null)?.id ?? "unknown";
    const showName = (c.show as { name?: string } | null)?.name ?? "Unknown";
    const showStart = (c.show as { start_date?: string } | null)?.start_date;
    const existing = showMap.get(showId) ?? {
      id: showId,
      name: showName,
      start_date: showStart,
      count: 0,
      revenue: 0,
      deposits: 0,
    };
    existing.count += 1;
    existing.revenue += c.total ?? 0;
    existing.deposits += c.deposit_paid ?? 0;
    showMap.set(showId, existing);
  }
  const shows = Array.from(showMap.values()).sort((a, b) => b.revenue - a.revenue);

  // ── Locations breakdown ──────────────────────────────────────────────────────
  const locMap = new Map<string, { id: string; name: string; type: string; count: number; revenue: number }>();
  for (const c of rows) {
    // Show sales are attributed to the show, not any store location —
    // a contract can have both show_id and location_id set, but the show wins.
    const showRef = c.show as { id?: string; name?: string } | null;
    const locRef = c.location as { id?: string; name?: string; type?: string } | null;
    const locId = showRef?.id ? `show-${showRef.id}` : (locRef?.id ?? "none");
    const locName = showRef?.name ?? locRef?.name ?? "Unknown";
    const locType = showRef?.id ? "show" : (locRef?.type ?? "store");
    const existing = locMap.get(locId) ?? { id: locId, name: locName, type: locType, count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += c.total ?? 0;
    locMap.set(locId, existing);
  }
  const locations = Array.from(locMap.values()).sort((a, b) => b.revenue - a.revenue);

  // ── Closing ratio maps ───────────────────────────────────────────────────────
  // allOpps = every non-draft contract in period (quotes + active + cancelled)
  // A converted quote just changes status — no double counting.
  const showClosingMap = new Map<string, { opps: number; closed: number }>();
  const locClosingMap = new Map<string, { opps: number; closed: number }>();
  for (const c of (allOpps ?? [])) {
    const showId = (c.show as { id?: string } | null)?.id;
    const rawLocId = (c.location as { id?: string } | null)?.id;
    // Mirror locMap: show wins over location when both are set
    const derivedLocId = showId ? `show-${showId}` : (rawLocId ?? null);
    const isClosed = !["quote", "cancelled"].includes(c.status);

    if (showId) {
      const e = showClosingMap.get(showId) ?? { opps: 0, closed: 0 };
      e.opps += 1;
      if (isClosed) e.closed += 1;
      showClosingMap.set(showId, e);
    }
    if (derivedLocId) {
      const e = locClosingMap.get(derivedLocId) ?? { opps: 0, closed: 0 };
      e.opps += 1;
      if (isClosed) e.closed += 1;
      locClosingMap.set(derivedLocId, e);
    }
  }

  function closingRatioPct(opps: number, closed: number): string {
    if (opps === 0) return "—";
    return `${Math.round((closed / opps) * 100)}%`;
  }
  function closingRatioColor(opps: number, closed: number): string {
    if (opps === 0) return "text-slate-400";
    const pct = (closed / opps) * 100;
    if (pct >= 50) return "font-semibold text-emerald-600";
    if (pct >= 30) return "font-semibold text-amber-600";
    return "font-semibold text-red-600";
  }

  // ── Top products (from line_items JSONB) ────────────────────────────────────
  type LineItem = { product_name?: string; quantity?: number; sell_price?: number };
  const productMap = new Map<string, { units: number; revenue: number }>();
  for (const c of rows) {
    const items: LineItem[] = Array.isArray(c.line_items) ? c.line_items : [];
    for (const item of items) {
      const name = item.product_name ?? "Unknown";
      if (!name || name === "Unknown") continue;
      const existing = productMap.get(name) ?? { units: 0, revenue: 0 };
      const qty = item.quantity ?? 1;
      const price = item.sell_price ?? 0;
      existing.units += qty;
      existing.revenue += price * qty;
      productMap.set(name, existing);
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ── Outstanding items ───────────────────────────────────────────────────────
  const signedNoDeposit = outstandingRows.filter(
    (c) => c.status === "signed" || c.status === "deposit_collected"
  ).filter((c) => (c.deposit_paid ?? 0) === 0);

  const pendingSig = outstandingRows.filter((c) => c.status === "pending_signature");
  const totalBalanceDue = outstandingRows.reduce((s, c) => s + (c.balance_due ?? 0), 0);

  function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppShell role={profile?.role} userName={(profile as any)?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Analytics"
        subtitle={PERIOD_LABELS[period]}
        backHref="/dashboard"
      />

      <main className="px-5 py-6 space-y-5 max-w-4xl mx-auto pb-24">

        {/* ── Period selector + Export ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-1">
            {(["today", "week", "month", "year", "all"] as Period[]).map((p) => (
              <Link
                key={p}
                href={`/analytics?period=${p}`}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  period === p
                    ? "bg-[#00929C] text-white shadow-md"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-[#00929C]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </div>
          <a
            href={`/api/analytics/export?period=${period}`}
            download
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </a>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Gross Revenue"
            value={formatCurrency(totalRevenue)}
            delta={revDelta}
            accent="teal"
          />
          <KpiCard
            label="Total Deposits"
            value={formatCurrency(totalDeposits)}
            delta={depDelta}
            accent="green"
          />
          <KpiCard
            label="Contracts"
            value={contractCount.toString()}
            delta={cntDelta}
            accent="slate"
          />
          <KpiCard
            label="Avg Deal Size"
            value={formatCurrency(avgDeal)}
            accent="amber"
          />
        </div>

        {/* ── Revenue Breakdown ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-600">Confirmed Contracts ({contractCount})</span>
              <span className="font-semibold text-[#00929C]">{formatCurrency(confirmedRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-amber-600">Contingent Contracts ({contingentCount})</span>
              <span className="font-semibold text-amber-600">{formatCurrency(contingentRevenue)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 font-bold">
              <span className="text-slate-900">Total Gross Revenue</span>
              <span className="text-slate-900">{formatCurrency(totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Sales Rep Leaderboard ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sales Rep Leaderboard</CardTitle>
          </CardHeader>
          {reps.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-400 text-center py-4">No data for this period.</p>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-500">#</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Rep</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Deals</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Avg</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Goal</th>
                      {hasCommissions && <th className="text-right py-3 px-4 font-medium text-slate-500">Commission</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((rep, i) => {
                      const targetRev = goalMap.get(rep.id);
                      const goalPct = targetRev && period === "month"
                        ? Math.min(999, Math.round((rep.revenue / targetRev) * 100))
                        : null;
                      const ratePct = commissionMap.get(rep.id) ?? 0;
                      const commissionEarned = ratePct > 0 ? (ratePct / 100) * rep.revenue : null;
                      return (
                      <tr
                        key={rep.name}
                        className={`border-b border-slate-100 ${i === 0 ? "bg-amber-50" : ""}`}
                      >
                        <td className="py-3 px-4 text-slate-500">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{rep.name}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{rep.count}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#00929C]">
                          {formatCurrency(rep.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {formatCurrency(rep.count > 0 ? rep.revenue / rep.count : 0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {goalPct !== null ? (
                            <span className={`font-bold text-sm ${goalPct >= 100 ? "text-emerald-600" : goalPct >= 70 ? "text-[#00929C]" : "text-slate-500"}`}>
                              {goalPct}%
                            </span>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>
                        {hasCommissions && (
                          <td className="py-3 px-4 text-right">
                            {commissionEarned !== null ? (
                              <span className="font-semibold text-emerald-600">{formatCurrency(commissionEarned)}</span>
                            ) : (
                              <span className="text-slate-300 text-sm">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Shows Breakdown ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Shows</CardTitle>
          </CardHeader>
          {shows.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-400 text-center py-4">No shows for this period.</p>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Show</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Contracts</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Deposits</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Close %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shows.map((show) => {
                      const cr = showClosingMap.get(show.id);
                      return (
                      <tr key={show.name} className="border-b border-slate-100">
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{show.name}</p>
                          {show.start_date && (
                            <p className="text-xs text-slate-400">
                              {new Date(show.start_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">{show.count}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#00929C]">
                          {formatCurrency(show.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {formatCurrency(show.deposits)}
                        </td>
                        <td className={`py-3 px-4 text-right ${cr ? closingRatioColor(cr.opps, cr.closed) : "text-slate-400"}`}>
                          {cr ? closingRatioPct(cr.opps, cr.closed) : "—"}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Locations Breakdown ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Locations</CardTitle>
          </CardHeader>
          {locations.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-400 text-center py-4">No location data for this period.</p>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Location</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Contracts</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Close %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => {
                      const cr = locClosingMap.get(loc.id);
                      return (
                      <tr key={loc.name} className="border-b border-slate-100">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{loc.name}</span>
                            <Badge variant={loc.type === "store" ? "default" : "warning"} className="text-xs">
                              {loc.type}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">{loc.count}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#00929C]">
                          {formatCurrency(loc.revenue)}
                        </td>
                        <td className={`py-3 px-4 text-right ${cr ? closingRatioColor(cr.opps, cr.closed) : "text-slate-400"}`}>
                          {cr ? closingRatioPct(cr.opps, cr.closed) : "—"}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Top Products ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Top Products</CardTitle>
          </CardHeader>
          {topProducts.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-400 text-center py-4">No product data for this period.</p>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Product</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Units</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.name} className="border-b border-slate-100">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs w-4">{i + 1}</span>
                            <span className="font-medium text-slate-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">{p.units}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#00929C]">
                          {formatCurrency(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Outstanding / Actionable Items ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Outstanding Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-2xl font-bold text-amber-700">{signedNoDeposit.length}</p>
                <p className="text-xs text-amber-600 mt-0.5">Signed, No Deposit</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-2xl font-bold text-red-700">{pendingSig.length}</p>
                <p className="text-xs text-red-600 mt-0.5">Pending Signature</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-lg font-bold text-slate-800">{formatCurrency(totalBalanceDue)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total Balance Due</p>
              </div>
            </div>

            {/* Signed, no deposit list */}
            {signedNoDeposit.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                  Signed — No Deposit Collected
                </p>
                <div className="space-y-2">
                  {signedNoDeposit.map((c) => (
                    <Link
                      key={c.id}
                      href={`/contracts/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl hover:border-amber-300 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">
                          {(c.customer as { first_name?: string; last_name?: string } | null)?.first_name}{" "}
                          {(c.customer as { first_name?: string; last_name?: string } | null)?.last_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.contract_number} · {daysSince(c.created_at)}d ago
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-700">{formatCurrency(c.total ?? 0)}</p>
                        <p className="text-xs text-slate-400">due</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Pending signature list */}
            {pendingSig.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                  Awaiting Signature
                </p>
                <div className="space-y-2">
                  {pendingSig.map((c) => (
                    <Link
                      key={c.id}
                      href={`/contracts/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-100 rounded-xl hover:border-red-300 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">
                          {(c.customer as { first_name?: string; last_name?: string } | null)?.first_name}{" "}
                          {(c.customer as { first_name?: string; last_name?: string } | null)?.last_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.contract_number} · {daysSince(c.created_at)}d ago
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-700">{formatCurrency(c.total ?? 0)}</p>
                        <Badge variant="warning" className="text-xs">Unsigned</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {signedNoDeposit.length === 0 && pendingSig.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-2">
                All contracts are up to date.
              </p>
            )}
          </CardContent>
        </Card>

      </main>
    </AppShell>
  );
}

// ── KPI Card sub-component ────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta?: number | null;
  accent: "teal" | "green" | "amber" | "slate";
}) {
  const accentColor = {
    teal: "text-[#00929C]",
    green: "text-emerald-600",
    amber: "text-amber-600",
    slate: "text-slate-900",
  }[accent];

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${accentColor}`}>{value}</p>
        {delta != null && (
          <p className={`text-xs mt-1 font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs prior period
          </p>
        )}
      </CardContent>
    </Card>
  );
}
