export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { AnalyticsTrendChart } from "@/components/analytics/AnalyticsTrendChart";
import { RevenueBreakdownDonut } from "@/components/analytics/RevenueBreakdownDonut";
import { RepLeaderboardBars } from "@/components/analytics/RepLeaderboardBars";
import { ShowsBarChart } from "@/components/analytics/ShowsBarChart";
import { isMainProduct } from "@/lib/inventory-constants";
import { lowDepositInfo } from "@/lib/low-deposit";
import { effectiveDeposit } from "@/lib/effective-deposit";
import {
  fetchBuildingSalesForPeriod,
  summarizeBuildingSales,
  EMPTY_BUILDING_SUMMARY,
  type BuildingSummary,
} from "@/lib/building-sales";

type Division = "all" | "spas" | "buildings";

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

// Returns the same period one year ago — year-over-year comparison.
// Atlas's show business is highly seasonal so MoM/WoW deltas are misleading;
// "this May vs last May" reflects the real signal.
function getPriorPeriodRange(period: Period): { gte?: string; lte?: string } {
  const now = new Date();

  if (period === "today") {
    const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  if (period === "week") {
    const day = now.getDay();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - day);
    thisWeekStart.setHours(0, 0, 0, 0);
    const start = new Date(thisWeekStart);
    start.setFullYear(start.getFullYear() - 1);
    const end = new Date(start.getTime() + 7 * 86400000);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const end = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  if (period === "year") {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear(), 0, 1);
    return { gte: start.toISOString(), lte: end.toISOString() };
  }

  return {};
}

function getPriorPeriodLabel(period: Period): string | undefined {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    return `vs ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (period === "week") return `vs same week ${now.getFullYear() - 1}`;
  if (period === "month") {
    const d = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    return `vs ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  }
  if (period === "year") return `vs ${now.getFullYear() - 1}`;
  return undefined;
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
  const division: Division = (["all", "spas", "buildings"].includes(params.division)
    ? params.division
    : "all") as Division;

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

  // Fetch every non-draft/quote/cancelled contract — INCLUDES contingent and
  // low-deposit. The Revenue Breakdown section (Confirmed vs Contingent donut)
  // needs to see both. Everywhere else uses `okRows` (filtered subset below).
  // Historical/imported contracts are included (no idempotency_key filter).
  let query = supabase
    .from("contracts")
    .select(`
      id, contract_number, total, cost, deposit_paid, balance_due, status, is_contingent, created_at,
      signature_metadata, financing,
      customer:customers(first_name, last_name),
      show:shows(id, name, venue_name, city, state, start_date, end_date),
      location:locations(id, name, type),
      sales_rep:profiles!contracts_sales_rep_id_fkey(id, full_name),
      line_items
    `)
    .not("status", "in", '("cancelled","quote","draft")');

  if (range.gte) query = query.gte("created_at", range.gte);
  if (range.lte) query = query.lt("created_at", range.lte);

  let priorQuery = supabase
    .from("contracts")
    .select("total, cost, deposit_paid, is_contingent, status, financing")
    .not("status", "in", '("cancelled","quote","draft")');

  if (priorRange.gte) priorQuery = priorQuery.gte("created_at", priorRange.gte);
  if (priorRange.lte) priorQuery = priorQuery.lt("created_at", priorRange.lte);

  // Outstanding contracts — Salta-created only (idempotency_key NOT NULL excludes
  // the Method CRM legacy imports that polluted this list with 500-day-old rows).
  const outstandingQuery = supabase
    .from("contracts")
    .select(`
      id, contract_number, total, deposit_paid, balance_due, status, created_at,
      customer:customers(first_name, last_name)
    `)
    .not("status", "eq", "cancelled")
    .not("idempotency_key", "is", null)
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

  // Shows with costs — overlap with the selected period.
  // A show overlaps the period if its start_date <= period_end AND end_date >= period_start.
  // For "all" period we omit both bounds and fetch every show.
  let showsCostQuery = supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date, total_cost")
    .limit(500);
  if (range.gte) showsCostQuery = showsCostQuery.gte("end_date", range.gte.split("T")[0]);
  if (range.lte) showsCostQuery = showsCostQuery.lt("start_date", range.lte.split("T")[0]);

  // Cancellations in the period — filtered by created_at since the schema has
  // no cancelled_at column. A contract created in March and cancelled in April
  // will appear under March's stats (same convention as revenue attribution).
  let cancelledQuery = supabase
    .from("contracts")
    .select("id, total, created_at")
    .eq("status", "cancelled");
  if (range.gte) cancelledQuery = cancelledQuery.gte("created_at", range.gte);
  if (range.lte) cancelledQuery = cancelledQuery.lt("created_at", range.lte);

  const [{ data: contracts }, { data: priorContracts }, { data: outstanding }, { data: allOpps }, { data: goalRows }, { data: commissionRows }, { data: showsInPeriod }, { data: cancelledRows }] =
    await Promise.all([query, priorQuery, outstandingQuery, closingRatioQuery, goalsQuery, commissionQuery, showsCostQuery, cancelledQuery]);

  const rows = contracts ?? [];
  const priorRows = priorContracts ?? [];
  const outstandingRows = outstanding ?? [];

  // Revenue Breakdown split — uses the FULL rows (the exception that shows
  // contingent for transparency).
  const confirmedRows = rows.filter((c) => !(c as any).is_contingent);
  const contingentRows = rows.filter((c) => (c as any).is_contingent);
  const confirmedRevenue = confirmedRows.reduce((s, c) => s + (c.total ?? 0), 0);
  const contingentRevenue = contingentRows.reduce((s, c) => s + (c.total ?? 0), 0);
  const grossRevenueAll = confirmedRevenue + contingentRevenue;
  const contingentCount = contingentRows.length;

  // OK-only subset — drives every KPI, table, and the Net Profit calc.
  // "OK" = not contingent AND not low-deposit. Finance Pending isn't derivable
  // from raw contracts (workbook-override only), accepted limitation.
  const okRows = confirmedRows.filter((c) => !lowDepositInfo(c).isLow);
  const okPriorRows = priorRows
    .filter((c) => !(c as any).is_contingent)
    .filter((c) => !lowDepositInfo(c).isLow);

  // ── KPIs (OK-only) ──────────────────────────────────────────────────────────
  // Total Deposits per William Downs Sr. clarification 2026-05-21: includes
  // financed amounts run at point of sale (Wells Fargo etc.), not just cash.
  const totalRevenue = okRows.reduce((s, c) => s + (c.total ?? 0), 0);
  const depositSplit = okRows.reduce(
    (acc, c) => {
      const e = effectiveDeposit(c);
      acc.cash += e.cash;
      acc.financed += e.financed;
      return acc;
    },
    { cash: 0, financed: 0 },
  );
  const totalDeposits = depositSplit.cash + depositSplit.financed;
  const cashDeposits = depositSplit.cash;
  const financeDeposits = depositSplit.financed;
  const contractCount = okRows.length;
  const avgDeal = contractCount > 0 ? totalRevenue / contractCount : 0;

  const priorRevenue = okPriorRows.reduce((s, c) => s + (c.total ?? 0), 0);
  const priorDeposits = okPriorRows.reduce((s, c) => s + effectiveDeposit(c).total, 0);
  const priorCount = okPriorRows.length;

  const revDelta = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : null;
  const depDelta = priorDeposits > 0 ? ((totalDeposits - priorDeposits) / priorDeposits) * 100 : null;
  const cntDelta = priorCount > 0 ? ((contractCount - priorCount) / priorCount) * 100 : null;
  const priorPeriodLabel = getPriorPeriodLabel(period);

  // ── Net Profit (period-wide) ─────────────────────────────────────────────
  // Two cost categories now that we have real per-deal data:
  //   1. totalContractCost — Atlas's per-deal COGS (spa wholesale + freight +
  //      delivery + options) from contracts.cost. Imported from Lori XLSX.
  //   2. totalShowCost — per-show booth/staffing overhead from shows.total_cost.
  // Both are real out-of-pocket costs. True net profit subtracts both.
  const totalContractCost = okRows.reduce((s, c) => {
    const n = Number((c as { cost?: number | string | null }).cost ?? 0);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  const totalShowCost = (showsInPeriod ?? []).reduce((s, sh) => {
    const raw = (sh as { total_cost?: number | string | null }).total_cost;
    const n = raw == null ? 0 : Number(raw);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  const netProfit = totalRevenue - totalContractCost - totalShowCost;
  // Coverage: how many okRows have real cost data vs missing
  const okContractsWithCost = okRows.filter((c) => {
    const n = Number((c as { cost?: number | string | null }).cost ?? 0);
    return Number.isFinite(n) && n > 0;
  }).length;

  // ── Cancellations in period ─────────────────────────────────────────────────
  const cancelled = cancelledRows ?? [];
  const cancelCount = cancelled.length;
  const cancelTotal = cancelled.reduce((s, c) => s + (c.total ?? 0), 0);
  const bookingsCount = contractCount;
  const cancelDenom = cancelCount + bookingsCount;
  const cancelRate = cancelDenom > 0 ? (cancelCount / cancelDenom) * 100 : null;

  // ── Sales velocity (days from created → signed) ─────────────────────────────
  // signature_metadata.consented_at is the legal signing timestamp captured at
  // canvas signature. Anything past pending_signature should have it set; we
  // skip rows that don't to avoid false zeroes.
  const velocityDays: number[] = [];
  for (const c of okRows) {
    const sig = (c as any).signature_metadata as { consented_at?: string } | null;
    const consentedAt = sig?.consented_at;
    if (!consentedAt) continue;
    const days =
      (new Date(consentedAt).getTime() - new Date(c.created_at).getTime()) / 86400000;
    if (Number.isFinite(days) && days >= 0) velocityDays.push(days);
  }
  const velocityCount = velocityDays.length;
  const velocityAvg =
    velocityCount > 0 ? velocityDays.reduce((s, d) => s + d, 0) / velocityCount : null;
  const velocityMedian = (() => {
    if (velocityCount === 0) return null;
    const sorted = [...velocityDays].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  })();

  // ── Sales rep leaderboard ───────────────────────────────────────────────────
  const commissionMap = new Map((commissionRows ?? []).map((r: any) => [r.rep_id, Number(r.rate_pct)]));
  const hasCommissions = (commissionRows ?? []).length > 0;
  const repMap = new Map<string, { id: string; name: string; count: number; revenue: number; cost: number; shows: Set<string> }>();
  for (const c of okRows) {
    const repId = (c.sales_rep as { id?: string } | null)?.id ?? "unknown";
    const repName = (c.sales_rep as { full_name?: string } | null)?.full_name ?? "Unknown";
    const existing = repMap.get(repId) ?? { id: repId, name: repName, count: 0, revenue: 0, cost: 0, shows: new Set<string>() };
    existing.count += 1;
    existing.revenue += c.total ?? 0;
    const cn = Number((c as { cost?: number | string | null }).cost ?? 0);
    if (Number.isFinite(cn)) existing.cost += cn;
    const showId = (c.show as { id?: string } | null)?.id;
    if (showId) existing.shows.add(showId);
    repMap.set(repId, existing);
  }

  // Real per-rep net profit using actual per-deal COGS imported from XLSX.
  // No longer allocates show booth cost — that lives at the show level.
  // Contracts missing cost (~6% of dataset) contribute revenue but no cost,
  // which inflates their margin until backfill is complete.
  const repNetProfit = new Map<string, number>();
  for (const r of repMap.values()) {
    repNetProfit.set(r.id, r.revenue - r.cost);
  }

  // Per-show contract cost — sum of contract.cost grouped by show. Used by
  // Top Products allocation and the Shows breakdown below.
  const _contractCostByShowId = new Map<string, number>();
  for (const c of okRows) {
    const sid = (c.show as { id?: string } | null)?.id;
    if (!sid) continue;
    const cn = Number((c as { cost?: number | string | null }).cost ?? 0);
    if (!Number.isFinite(cn)) continue;
    _contractCostByShowId.set(sid, (_contractCostByShowId.get(sid) ?? 0) + cn);
  }

  const reps = Array.from(repMap.values()).sort((a, b) => b.revenue - a.revenue);

  // ── Shows breakdown ─────────────────────────────────────────────────────────
  // Two sources feed showMap:
  //   1. Contracts that attribute to a show (revenue side)
  //   2. Shows that overlap the period and have a total_cost set (cost side)
  // Merging both means a show with $5k cost and $0 sales still surfaces — that's
  // the worst-case ROI scenario we never want to hide.
  const showMap = new Map<
    string,
    {
      id: string;
      name: string;
      venue_name: string | null;
      city: string | null;
      state: string | null;
      start_date?: string;
      count: number;
      revenue: number;
      deposits: number;
      cost: number | null;
      profit: number | null;
    }
  >();
  type ShowRef = {
    id?: string;
    name?: string;
    venue_name?: string | null;
    city?: string | null;
    state?: string | null;
    start_date?: string;
  };
  for (const c of okRows) {
    const showRef = (c.show as ShowRef | null) ?? null;
    // Skip showroom / store sales (no show_id). They appear under Locations
    // — Shows Performance is only for actual show events.
    if (!showRef?.id) continue;
    const showId = showRef.id;
    const existing = showMap.get(showId) ?? {
      id: showId,
      name: showRef.name ?? "Unknown",
      venue_name: showRef.venue_name ?? null,
      city: showRef.city ?? null,
      state: showRef.state ?? null,
      start_date: showRef.start_date,
      count: 0,
      revenue: 0,
      deposits: 0,
      cost: null,
      profit: null,
    };
    existing.count += 1;
    existing.revenue += c.total ?? 0;
    existing.deposits += c.deposit_paid ?? 0;
    showMap.set(showId, existing);
  }
  // Merge cost data — also adds shows that have cost but no contracts.
  for (const s of (showsInPeriod ?? []) as Array<{
    id: string;
    name: string;
    venue_name: string | null;
    city: string | null;
    state: string | null;
    start_date: string;
    total_cost: number | string | null;
  }>) {
    const rawCost = s.total_cost;
    const cost = rawCost == null ? null : Number(rawCost);
    const existing = showMap.get(s.id) ?? {
      id: s.id,
      name: s.name,
      venue_name: s.venue_name ?? null,
      city: s.city ?? null,
      state: s.state ?? null,
      start_date: s.start_date,
      count: 0,
      revenue: 0,
      deposits: 0,
      cost: null,
      profit: null,
    };
    // Fill venue/city/state from shows table if the contract-joined ref didn't have them.
    if (!existing.venue_name && s.venue_name) existing.venue_name = s.venue_name;
    if (!existing.city && s.city) existing.city = s.city;
    if (!existing.state && s.state) existing.state = s.state;
    existing.cost = cost != null && !Number.isNaN(cost) ? cost : null;
    showMap.set(s.id, existing);
  }
  // Compute profit per show. show.cost (booth/staffing) covers the show's
  // overhead. Add the sum of per-contract COGS for deals AT this show to get
  // the full cost. Profit = revenue - per-deal COGS - booth.
  // Null booth cost → null profit (unknown, not zero) so unranked rows sort
  // to bottom.
  for (const entry of showMap.values()) {
    const contractCost = _contractCostByShowId.get(entry.id) ?? 0;
    if (entry.cost != null) {
      entry.profit = entry.revenue - contractCost - entry.cost;
    } else if (contractCost > 0) {
      // No booth cost recorded but we know contract COGS — still informative.
      entry.profit = entry.revenue - contractCost;
    } else {
      entry.profit = null;
    }
  }
  const shows = Array.from(showMap.values()).sort((a, b) => {
    // Known profit first (desc), then unknown-profit rows by revenue desc.
    if (a.profit != null && b.profit != null) return b.profit - a.profit;
    if (a.profit != null) return -1;
    if (b.profit != null) return 1;
    return b.revenue - a.revenue;
  });

  // ── Venue rollup ─────────────────────────────────────────────────────────────
  // Multiple shows at the same venue collapse to a single row. Robert wants to
  // compare venues by AVG profit per show, since visit counts vary across
  // venues and total profit favors the most-visited venues. Closing ratios are
  // aggregated below once showClosingMap is built.
  type VenueEntry = {
    venue: string;
    showCount: number;
    showsWithCost: number;
    contractCount: number;
    revenue: number;
    revenueWithCost: number;
    cost: number;
    profit: number | null;
    avgProfitPerShow: number | null;
    showIds: string[];
    opps: number;
    closed: number;
  };
  const venueMap = new Map<string, VenueEntry>();
  for (const sh of showMap.values()) {
    const key = sh.venue_name ?? sh.name;
    const existing = venueMap.get(key) ?? {
      venue: key,
      showCount: 0,
      showsWithCost: 0,
      contractCount: 0,
      revenue: 0,
      revenueWithCost: 0,
      cost: 0,
      profit: null,
      avgProfitPerShow: null,
      showIds: [],
      opps: 0,
      closed: 0,
    };
    existing.showCount += 1;
    existing.contractCount += sh.count;
    existing.revenue += sh.revenue;
    existing.showIds.push(sh.id);
    if (sh.cost != null) {
      existing.cost += sh.cost;
      existing.revenueWithCost += sh.revenue;
      existing.showsWithCost += 1;
    }
    venueMap.set(key, existing);
  }

  // ── Locations breakdown ──────────────────────────────────────────────────────
  const locMap = new Map<string, { id: string; name: string; type: string; count: number; revenue: number }>();
  for (const c of okRows) {
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

  // Finalize venueMap now that showClosingMap exists — aggregate closing
  // metrics across all shows in each venue, then derive profit and avg-per-show.
  for (const v of venueMap.values()) {
    for (const sid of v.showIds) {
      const c = showClosingMap.get(sid);
      if (c) {
        v.opps += c.opps;
        v.closed += c.closed;
      }
    }
    v.profit = v.showsWithCost > 0 ? v.revenueWithCost - v.cost : null;
    v.avgProfitPerShow = v.profit != null ? v.profit / v.showsWithCost : null;
  }
  const venues = Array.from(venueMap.values()).sort((a, b) => {
    if (a.avgProfitPerShow != null && b.avgProfitPerShow != null) {
      return b.avgProfitPerShow - a.avgProfitPerShow;
    }
    if (a.avgProfitPerShow != null) return -1;
    if (b.avgProfitPerShow != null) return 1;
    return b.revenue - a.revenue;
  });

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
  function roiPct(revenue: number, cost: number | null): string {
    if (cost == null || cost <= 0) return "—";
    return `${(((revenue - cost) / cost) * 100).toFixed(1)}%`;
  }
  function roiColor(revenue: number, cost: number | null): string {
    if (cost == null || cost <= 0) return "text-slate-400";
    const pct = ((revenue - cost) / cost) * 100;
    if (pct > 0) return "font-semibold text-emerald-600";
    return "font-semibold text-red-600";
  }

  // ── Top products (from line_items JSONB) ────────────────────────────────────
  // Robert Downs 04-29: only rank MAIN products (hot tubs / swim spas / cold tubs /
  // saunas / pools). Exclude options, accessories, fees, upgrades. We look up the
  // category via product_id since it isn't stored on the line_item itself.
  // Historical contracts backfilled from Lori's XLSX use {name, unit_price}
  // while new Salta-created contracts use {product_name, sell_price}. Accept
  // BOTH shapes so historical line items don't read as "Unknown / $0".
  type LineItem = {
    product_id?: string;
    product_name?: string;
    name?: string;
    quantity?: number;
    sell_price?: number;
    unit_price?: number;
  };
  const productIdsOnContracts = Array.from(new Set(
    okRows.flatMap((c) => (Array.isArray(c.line_items) ? c.line_items : []).map((i: LineItem) => i.product_id).filter(Boolean) as string[])
  ));
  const { data: productCategoryRows } = productIdsOnContracts.length
    ? await supabase.from("products").select("id, category").in("id", productIdsOnContracts)
    : { data: [] };
  const categoryByProductId = new Map<string, string>();
  for (const r of (productCategoryRows ?? []) as Array<{ id: string; category: string | null }>) {
    if (r.category) categoryByProductId.set(r.id, r.category);
  }

  const productMap = new Map<string, { units: number; revenue: number; allocatedCost: number }>();
  for (const c of okRows) {
    const items: LineItem[] = Array.isArray(c.line_items) ? c.line_items : [];
    // Allocate the contract's REAL per-deal COGS (from contracts.cost,
    // imported from Lori XLSX) proportionally across the main line items.
    // Per-line cost share = (line_total / contract.total) * contract.cost
    const contractCost = Number((c as { cost?: number | string | null }).cost ?? 0);
    const contractTotal = c.total ?? 0;
    for (const item of items) {
      const name = item.product_name ?? item.name ?? "Unknown";
      if (!name || name === "Unknown") continue;
      const cat = item.product_id ? categoryByProductId.get(item.product_id) : null;
      if (!isMainProduct(cat)) continue; // filter out add-ons / accessories / fees
      const existing = productMap.get(name) ?? { units: 0, revenue: 0, allocatedCost: 0 };
      const qty = item.quantity ?? 1;
      const price = item.sell_price ?? item.unit_price ?? 0;
      const lineTotal = price * qty;
      const lineCostShare = contractTotal > 0 && Number.isFinite(contractCost)
        ? (lineTotal / contractTotal) * contractCost
        : 0;
      existing.units += qty;
      existing.revenue += lineTotal;
      existing.allocatedCost += lineCostShare;
      productMap.set(name, existing);
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([name, v]) => ({
      name,
      ...v,
      netProfit: v.revenue - v.allocatedCost,
      marginPct: v.revenue > 0 ? ((v.revenue - v.allocatedCost) / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ── Attach rate (accessories per main unit) ─────────────────────────────────
  // "Main" = hot tub / swim spa / cold tub / sauna / pool (the unit of sale).
  // "Accessory" = line items with a product_id that maps to a non-main category
  // (chemicals, covers, steps, options, upgrades — anything in the products
  // catalog that isn't a main unit). Excludes inline fees (no product_id).
  let mainUnits = 0;
  let mainRevenue = 0;
  let accessoryRevenue = 0;
  for (const c of okRows) {
    const items: LineItem[] = Array.isArray(c.line_items) ? c.line_items : [];
    for (const item of items) {
      const cat = item.product_id ? categoryByProductId.get(item.product_id) : null;
      const qty = item.quantity ?? 1;
      const price = item.sell_price ?? item.unit_price ?? 0;
      const lineTotal = price * qty;
      if (isMainProduct(cat)) {
        mainUnits += qty;
        mainRevenue += lineTotal;
      } else if (item.product_id && cat) {
        accessoryRevenue += lineTotal;
      }
    }
  }
  const accessoryPerUnit = mainUnits > 0 ? accessoryRevenue / mainUnits : null;
  const attachPctOfMain = mainRevenue > 0 ? (accessoryRevenue / mainRevenue) * 100 : null;

  // ── Outstanding items ───────────────────────────────────────────────────────
  const signedNoDeposit = outstandingRows.filter(
    (c) => c.status === "signed" || c.status === "deposit_collected"
  ).filter((c) => (c.deposit_paid ?? 0) === 0);

  const pendingSig = outstandingRows.filter((c) => c.status === "pending_signature");
  const totalBalanceDue = outstandingRows.reduce((s, c) => s + (c.balance_due ?? 0), 0);

  function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  // Trend data: bucket rows by day for the selected period
  const trendBucketSize = period === "year" || period === "all" ? "month" : "day";
  const trendMap = new Map<string, { revenue: number; deposits: number; contracts: number }>();

  const trendStart = (() => {
    if (range.gte) return new Date(range.gte);
    // For "all" period, use earliest row date or 6 months ago as fallback
    const earliest = okRows.reduce<Date | null>((min, r) => {
      const d = new Date(r.created_at);
      return !min || d < min ? d : min;
    }, null);
    return earliest ?? new Date(Date.now() - 180 * 86400000);
  })();
  const trendEnd = range.lte ? new Date(range.lte) : new Date();

  // Seed empty buckets
  const cursor = new Date(trendStart);
  if (trendBucketSize === "day") {
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= trendEnd) {
      const key = cursor.toISOString().split("T")[0];
      trendMap.set(key, { revenue: 0, deposits: 0, contracts: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= trendEnd) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      trendMap.set(key, { revenue: 0, deposits: 0, contracts: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  for (const r of okRows) {
    const d = new Date(r.created_at);
    const key = trendBucketSize === "day"
      ? d.toISOString().split("T")[0]
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!trendMap.has(key)) continue;
    const b = trendMap.get(key)!;
    b.revenue += r.total ?? 0;
    b.deposits += r.deposit_paid ?? 0;
    b.contracts += 1;
  }

  const trendData = Array.from(trendMap.entries()).map(([key, vals]) => {
    const label = trendBucketSize === "day"
      ? new Date(key + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : new Date(key + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return { date: key, label, ...vals };
  });

  // Revenue Breakdown donut — exception: shows Confirmed + Contingent for transparency.
  // Center total = confirmed + contingent (the full booking picture), not OK-only.
  const breakdownData = [
    { name: "Confirmed", value: confirmedRevenue, color: "#00929C", count: confirmedRows.length },
    { name: "Contingent", value: contingentRevenue, color: "#f59e0b", count: contingentCount },
  ].filter((d) => d.value > 0);

  // Rep leaderboard chart data
  const repChartData = reps.slice(0, 8).map((r) => ({
    name: r.name,
    revenue: r.revenue,
    count: r.count,
  }));

  // Shows chart data — top venues by avg profit per show (mirrors the table
  // ordering). Bars plot revenue so users can see the dollar weight behind
  // each top-ranked venue at a glance.
  const showsChartData = venues.slice(0, 6).map((v) => ({
    name: v.venue,
    revenue: v.revenue,
    count: v.contractCount,
  }));

  // ── Atlas Building Systems (separate division) ──────────────────────────────
  // Fetch and summarize only when the active view actually needs it.
  let buildingSummary: BuildingSummary = EMPTY_BUILDING_SUMMARY;
  if (division === "all" || division === "buildings") {
    const buildingRows = await fetchBuildingSalesForPeriod(supabase, range);
    buildingSummary = summarizeBuildingSales(buildingRows);
  }
  const companyRevenue = totalRevenue + buildingSummary.totalRevenue;
  const companyTxns = contractCount + buildingSummary.transactionCount;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppShell role={profile?.role} userName={(profile as any)?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Analytics"
        subtitle={PERIOD_LABELS[period]}
        backHref="/dashboard"
      />

      <main className="px-5 py-6 space-y-5 max-w-4xl mx-auto pb-24">

        {/* ── Division toggle (All / Spas / Buildings) ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <span className="flex-shrink-0 text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Division:</span>
          {([
            { value: "all", label: "All Divisions" },
            { value: "spas", label: "Atlas Spas" },
            { value: "buildings", label: "Atlas Buildings" },
          ] as const).map((d) => (
            <Link
              key={d.value}
              href={`/analytics?period=${period}&division=${d.value}`}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                division === d.value
                  ? "bg-[#010F21] text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-[#010F21]"
              }`}
            >
              {d.label}
            </Link>
          ))}
        </div>

        {/* ── Company Overview (only in "all" mode) ── */}
        {division === "all" && (
          <Card className="border-[#010F21]/15 bg-gradient-to-br from-slate-50 to-white">
            <CardHeader className="pb-2">
              <div className="flex items-baseline justify-between gap-3">
                <CardTitle className="text-base">Company Overview</CardTitle>
                <p className="text-xs text-slate-500">{PERIOD_LABELS[period]} · Spas + Buildings combined</p>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Company Revenue"
                value={formatCurrency(companyRevenue)}
                sublabel={`${formatCurrency(totalRevenue)} spa + ${formatCurrency(buildingSummary.totalRevenue)} build`}
                accentColor="#010F21"
              />
              <KpiCard
                label="Total Transactions"
                value={companyTxns.toString()}
                sublabel={`${contractCount} spa + ${buildingSummary.transactionCount} build`}
                accentColor="#00929C"
              />
              <KpiCard
                label="Spas Share"
                value={companyRevenue > 0 ? `${((totalRevenue / companyRevenue) * 100).toFixed(0)}%` : "—"}
                sublabel="of company revenue"
                accentColor="#0f172a"
              />
              <KpiCard
                label="Buildings Share"
                value={companyRevenue > 0 ? `${((buildingSummary.totalRevenue / companyRevenue) * 100).toFixed(0)}%` : "—"}
                sublabel="of company revenue"
                accentColor="#d97706"
              />
            </CardContent>
          </Card>
        )}

        {/* ── Period selector + Export ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-1">
            {(["today", "week", "month", "year", "all"] as Period[]).map((p) => (
              <Link
                key={p}
                href={`/analytics?period=${p}&division=${division}`}
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
          <div className="flex-shrink-0 flex items-center gap-2">
            <a
              href={`/api/analytics/export?period=${period}`}
              download
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </a>
            <a
              href={`/api/analytics/pdf?period=${period}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00929C] text-white text-sm font-semibold shadow-sm hover:bg-[#007a82] transition-colors"
              title="Owner's report — KPIs, tables, and AI insights as a PDF"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF Report
            </a>
          </div>
        </div>

        {/* All spa-specific sections only render outside the "buildings" view. */}
        {division !== "buildings" && (
        <div className="space-y-5">
        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Gross Revenue"
            value={formatCurrency(totalRevenue)}
            trend={revDelta == null ? undefined : revDelta >= 0 ? "up" : "down"}
            trendValue={revDelta == null ? undefined : `${Math.abs(revDelta).toFixed(1)}%`}
            sublabel={revDelta == null ? undefined : priorPeriodLabel}
            accentColor="#00929C"
          />
          <KpiCard
            label="Total Deposits"
            value={formatCurrency(totalDeposits)}
            trend={depDelta == null ? undefined : depDelta >= 0 ? "up" : "down"}
            trendValue={depDelta == null ? undefined : `${Math.abs(depDelta).toFixed(1)}%`}
            sublabel={
              financeDeposits > 0
                ? `${formatCurrency(cashDeposits)} cash + ${formatCurrency(financeDeposits)} financed`
                : depDelta == null ? undefined : priorPeriodLabel
            }
            accentColor="#10b981"
          />
          <KpiCard
            label="Contracts"
            value={contractCount.toString()}
            trend={cntDelta == null ? undefined : cntDelta >= 0 ? "up" : "down"}
            trendValue={cntDelta == null ? undefined : `${Math.abs(cntDelta).toFixed(1)}%`}
            sublabel={cntDelta == null ? undefined : priorPeriodLabel}
            accentColor="#0f172a"
          />
          <KpiCard
            label="Avg Deal Size"
            value={formatCurrency(avgDeal)}
            accentColor="#d97706"
          />
          <KpiCard
            label="Net Profit"
            value={formatCurrency(netProfit)}
            sublabel={
              totalContractCost > 0 || totalShowCost > 0
                ? `${formatCurrency(totalContractCost)} COGS + ${formatCurrency(totalShowCost)} booth`
                : undefined
            }
            accentColor={netProfit >= 0 ? "#059669" : "#dc2626"}
          />
        </div>

        {/* Revenue Trend Chart */}
        <Card id="trend" className="scroll-mt-32">
          <CardHeader className="pb-2">
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-base">Revenue Trend</CardTitle>
              <p className="text-xs text-slate-500">
                {trendBucketSize === "day" ? "Daily" : "Monthly"} · {PERIOD_LABELS[period]}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <AnalyticsTrendChart data={trendData} period={period} />
          </CardContent>
        </Card>

        {/* Section jump nav — scrolls to anchors */}
        <nav className="sticky top-16 z-[5] -mx-5 px-5 py-3 bg-slate-50/90 backdrop-blur border-b border-slate-200">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide text-xs">
            {[
              { href: "#trend", label: "Trend" },
              { href: "#breakdown", label: "Revenue" },
              { href: "#cancellations", label: "Cancellations" },
              { href: "#velocity", label: "Velocity" },
              { href: "#attach", label: "Attach" },
              { href: "#leaderboard", label: "Leaderboard" },
              { href: "#shows", label: "Shows" },
              { href: "#locations", label: "Locations" },
              { href: "#products", label: "Top Products" },
              { href: "#outstanding", label: "Outstanding" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-slate-600 hover:bg-white hover:text-slate-900 font-semibold transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* ── Revenue Breakdown ── */}
        <Card id="breakdown" className="scroll-mt-32">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RevenueBreakdownDonut data={breakdownData} total={grossRevenueAll} />
            <div className="pt-4 border-t border-slate-100 space-y-2 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-600">Confirmed Contracts ({confirmedRows.length})</span>
              <span className="font-semibold text-[#00929C]">{formatCurrency(confirmedRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-amber-600">Contingent Contracts ({contingentCount})</span>
              <span className="font-semibold text-amber-600">{formatCurrency(contingentRevenue)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 font-bold">
              <span className="text-slate-900">Total Gross Revenue</span>
              <span className="text-slate-900">{formatCurrency(grossRevenueAll)}</span>
            </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Cancellations ── */}
        <Card id="cancellations" className="scroll-mt-32">
          <CardHeader className="pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-base">Cancellations</CardTitle>
              <p className="text-xs text-slate-500">{PERIOD_LABELS[period]}</p>
            </div>
          </CardHeader>
          <CardContent>
            {cancelCount === 0 ? (
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 px-4 py-3 text-center">
                ✓ No cancellations this period.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-2xl font-bold text-red-700">{cancelCount}</p>
                  <p className="text-xs text-red-600 mt-0.5">Cancelled</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-lg font-bold text-red-700">{formatCurrency(cancelTotal)}</p>
                  <p className="text-xs text-red-600 mt-0.5">Revenue Lost</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-2xl font-bold text-slate-800">
                    {cancelRate != null ? `${cancelRate.toFixed(1)}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Cancel Rate</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Sales Velocity (days from created → signed) ── */}
        <Card id="velocity" className="scroll-mt-32">
          <CardHeader className="pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-base">Sales Velocity</CardTitle>
              <p className="text-xs text-slate-500">Created → Signed · {PERIOD_LABELS[period]}</p>
            </div>
          </CardHeader>
          <CardContent>
            {velocityCount === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-center">
                No signed deals with signing timestamps in this period.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-[#00929C]/10 rounded-xl border border-[#00929C]/20">
                    <p className="text-2xl font-bold text-[#00929C]">
                      {velocityAvg != null ? velocityAvg.toFixed(1) : "—"}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">Avg Days</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-2xl font-bold text-slate-800">
                      {velocityMedian != null ? velocityMedian.toFixed(1) : "—"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Median Days</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-2xl font-bold text-slate-800">{velocityCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Signed Deals</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 text-center">
                  Show sales typically close same-day (0 days). Store deals stretch longer — high median may signal slow follow-up.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Attach Rate (accessories per main unit) ── */}
        <Card id="attach" className="scroll-mt-32">
          <CardHeader className="pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-base">Attach Rate</CardTitle>
              <p className="text-xs text-slate-500">Accessories per main unit · {PERIOD_LABELS[period]}</p>
            </div>
          </CardHeader>
          <CardContent>
            {mainUnits === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-center">
                No main units sold in this period.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-[#00929C]/10 rounded-xl border border-[#00929C]/20">
                    <p className="text-lg font-bold text-[#00929C]">
                      {accessoryPerUnit != null ? formatCurrency(accessoryPerUnit) : "—"}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">$ Accessories / Unit</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(accessoryRevenue)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Accessory Revenue</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-2xl font-bold text-slate-800">
                      {attachPctOfMain != null ? `${attachPctOfMain.toFixed(1)}%` : "—"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">% of Main Revenue</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 text-center">
                  Across {mainUnits} unit{mainUnits === 1 ? "" : "s"}. Excludes fees and inline charges — counts only catalog accessories.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Sales Rep Leaderboard ── */}
        <Card id="leaderboard" className="scroll-mt-32">
          <CardHeader className="pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-lg">Sales Rep Leaderboard</CardTitle>
              {reps.length > 0 && (
                <p className="text-xs text-slate-500">Top {Math.min(8, reps.length)} by revenue</p>
              )}
            </div>
          </CardHeader>
          {reps.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-400 text-center py-4">No data for this period.</p>
            </CardContent>
          ) : (
            <>
              <CardContent className="pt-0 pb-4">
                <RepLeaderboardBars data={repChartData} />
              </CardContent>
              <CardContent className="p-0 border-t border-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-500">#</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Rep</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Deals</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Avg</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Net Profit</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Net/Show</th>
                      {hasCommissions && <th className="text-right py-3 px-4 font-medium text-slate-500">Commission</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((rep, i) => {
                      const ratePct = commissionMap.get(rep.id) ?? 0;
                      const commissionEarned = ratePct > 0 ? (ratePct / 100) * rep.revenue : null;
                      const netProfit = repNetProfit.get(rep.id) ?? rep.revenue;
                      const netPerShow = rep.shows.size > 0 ? netProfit / rep.shows.size : null;
                      return (
                      <tr
                        key={rep.name}
                        className={`border-b border-slate-100 ${i === 0 ? "bg-amber-50" : ""}`}
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              i === 0
                                ? "bg-amber-400 text-amber-900"
                                : i === 1
                                ? "bg-slate-300 text-slate-800"
                                : i === 2
                                ? "bg-orange-300 text-orange-900"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{rep.name}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{rep.count}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#00929C]">
                          {formatCurrency(rep.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {formatCurrency(rep.count > 0 ? rep.revenue / rep.count : 0)}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatCurrency(netProfit)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {netPerShow !== null ? (
                            <span className={`font-bold ${netPerShow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {formatCurrency(netPerShow)}
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
            </>
          )}
        </Card>

        {/* ── Shows Breakdown ── */}
        <Card id="shows" className="scroll-mt-32">
          <CardHeader className="pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-lg">Shows</CardTitle>
              {venues.length > 0 && (
                <p className="text-xs text-slate-500">{venues.length} venue{venues.length === 1 ? "" : "s"} · ranked by avg profit per show</p>
              )}
            </div>
          </CardHeader>
          {venues.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-400 text-center py-4">No shows for this period.</p>
            </CardContent>
          ) : (
            <>
              <CardContent className="pt-0 pb-4">
                <ShowsBarChart data={showsChartData} />
              </CardContent>
              <CardContent className="p-0 border-t border-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Venue</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Shows</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Contracts</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Cost</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Total Profit</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Avg/Show</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">ROI %</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Close %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venues.map((venue) => {
                      const costForRoi = venue.showsWithCost > 0 ? venue.cost : null;
                      return (
                      <tr key={venue.venue} className="border-b border-slate-100">
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{venue.venue}</p>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">{venue.showCount}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{venue.contractCount}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#00929C]">
                          {formatCurrency(venue.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {venue.showsWithCost > 0 ? formatCurrency(venue.cost) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`py-3 px-4 text-right ${venue.profit == null ? "text-slate-300" : venue.profit >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}`}>
                          {venue.profit != null ? formatCurrency(venue.profit) : "—"}
                        </td>
                        <td className={`py-3 px-4 text-right ${venue.avgProfitPerShow == null ? "text-slate-300" : venue.avgProfitPerShow >= 0 ? "font-bold text-emerald-600" : "font-bold text-red-600"}`}>
                          {venue.avgProfitPerShow != null ? formatCurrency(venue.avgProfitPerShow) : "—"}
                        </td>
                        <td className={`py-3 px-4 text-right ${roiColor(venue.revenueWithCost, costForRoi)}`}>
                          {roiPct(venue.revenueWithCost, costForRoi)}
                        </td>
                        <td className={`py-3 px-4 text-right ${venue.opps > 0 ? closingRatioColor(venue.opps, venue.closed) : "text-slate-400"}`}>
                          {venue.opps > 0 ? closingRatioPct(venue.opps, venue.closed) : "—"}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
            </>
          )}
        </Card>

        {/* ── Locations Breakdown ── */}
        <Card id="locations" className="scroll-mt-32">
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
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Net Profit</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Close %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => {
                      const cr = locClosingMap.get(loc.id);
                      // Net profit: for show-type rows, cross-reference the show by stripping
                      // the "show-" prefix and looking up the show's profit. Store rows have
                      // no cost data → render "—".
                      const matchedShow = loc.id.startsWith("show-")
                        ? shows.find((s) => `show-${s.id}` === loc.id)
                        : undefined;
                      const profit = matchedShow?.profit ?? null;
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
                        <td className={`py-3 px-4 text-right ${profit == null ? "text-slate-300" : profit >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}`}>
                          {profit != null ? formatCurrency(profit) : "—"}
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
        <Card id="products" className="scroll-mt-32">
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
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Net Profit</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Margin</th>
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
                        <td className={`py-3 px-4 text-right font-semibold ${p.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatCurrency(p.netProfit)}
                        </td>
                        <td className={`py-3 px-4 text-right ${p.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {p.marginPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 italic px-4 py-3">
                Profit = revenue minus per-deal COGS (spa wholesale + freight + delivery, imported from Lori&apos;s XLSX). {okContractsWithCost}/{contractCount} contracts in this period have real cost data.
              </p>
            </CardContent>
          )}
        </Card>

        {/* ── Outstanding / Actionable Items ── */}
        <Card id="outstanding" className="scroll-mt-32">
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
        </div>
        )}

        {/* ── Atlas Building Systems section (visible in 'all' and 'buildings' views) ── */}
        {division !== "spas" && (
          <Card id="buildings" className="scroll-mt-32 border-amber-200/60">
            <CardHeader className="pb-3">
              <div className="flex items-baseline justify-between gap-3">
                <CardTitle className="text-lg">Atlas Building Systems</CardTitle>
                <p className="text-xs text-slate-500">
                  {PERIOD_LABELS[period]} · {buildingSummary.transactionCount} transaction{buildingSummary.transactionCount === 1 ? "" : "s"}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Buildings KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  label="Buildings Revenue"
                  value={formatCurrency(buildingSummary.totalRevenue)}
                  accentColor="#d97706"
                />
                <KpiCard
                  label="Transactions"
                  value={buildingSummary.transactionCount.toString()}
                  accentColor="#0f172a"
                />
                <KpiCard
                  label="Avg Sale"
                  value={formatCurrency(buildingSummary.avgSale)}
                  accentColor="#00929C"
                />
                <KpiCard
                  label="Retail / Wholesale"
                  value={`${formatCurrency(buildingSummary.retailRevenue).replace("$", "")} / ${formatCurrency(buildingSummary.wholesaleRevenue).replace("$", "")}`}
                  sublabel={`${buildingSummary.retailCount} / ${buildingSummary.wholesaleCount} txns`}
                  accentColor="#059669"
                />
              </div>

              {/* Top Product Categories */}
              {buildingSummary.topCategories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Top Product Categories</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left py-2 px-3 font-medium text-slate-500">#</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-500">Category</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-500">Units</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-500">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buildingSummary.topCategories.map((c, i) => (
                          <tr key={c.name} className="border-b border-slate-100">
                            <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                            <td className="py-2 px-3 font-medium text-slate-900">{c.name}</td>
                            <td className="py-2 px-3 text-right text-slate-700">{c.units}</td>
                            <td className="py-2 px-3 text-right font-semibold text-[#00929C]">{formatCurrency(c.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Lots / Locations */}
              {buildingSummary.topLocations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Top Lots</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left py-2 px-3 font-medium text-slate-500">Location</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-500">Transactions</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-500">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buildingSummary.topLocations.map((l) => (
                          <tr key={l.name} className="border-b border-slate-100">
                            <td className="py-2 px-3 font-medium text-slate-900">{l.name}</td>
                            <td className="py-2 px-3 text-right text-slate-700">{l.count}</td>
                            <td className="py-2 px-3 text-right font-semibold text-[#00929C]">{formatCurrency(l.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Stock Status breakdown */}
              {buildingSummary.byStockStatus.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Stock Status</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {buildingSummary.byStockStatus.map((s) => (
                      <div key={s.status} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.status}</p>
                        <p className="font-semibold text-slate-900">{s.count}</p>
                        <p className="text-xs text-slate-600">{formatCurrency(s.revenue)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {buildingSummary.transactionCount === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No building sales in this period.</p>
              )}

              <p className="text-xs text-slate-400 italic">
                Cost / profit columns will populate once William Downs Sr. provides cost data.
              </p>
            </CardContent>
          </Card>
        )}

      </main>
    </AppShell>
  );
}

