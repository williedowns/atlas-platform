export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import LeadsPipeline from "@/components/dashboard/LeadsPipeline";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { getViewAsContext } from "@/lib/view-as";
import { shouldShowPicker } from "@/lib/active-show";
import { getDisplayStatus } from "@/lib/contract-status";
import { todayStartUTC, daysAgoStartUTC, monthStartUTC, todayDateStringInTZ } from "@/lib/dates";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const orgPerms = (profile?.organization as any)?.role_permissions ?? null;

  // View-as override — admins can preview the dashboard as another role/user.
  // For non-admins this is a no-op (helper enforces admin gate internally).
  const viewAs = await getViewAsContext();
  const effectiveRole = viewAs.effectiveRole ?? profile?.role;
  const effectiveUserId = viewAs.effectiveUserId ?? user.id;

  // Role-based routing — respect the impersonated role so View-As actually switches landing pages.
  if (effectiveRole === "bookkeeper") redirect("/bookkeeper");
  if (effectiveRole === "field_crew") redirect("/field");

  // Sales reps get the active-workspace picker on first login of the day if
  // they haven't set one. Admins/managers/etc. skip — they're in the office.
  if (!viewAs.isImpersonatingRole && await shouldShowPicker(effectiveRole)) {
    redirect("/select-active-show");
  }

  const isAdmin = !viewAs.isImpersonatingUser && (effectiveRole === "admin" || effectiveRole === "manager");

  // Show managers see metrics for the shows they manage (every rep's deals), not
  // just their own sales. Resolve their managed show_ids and scope each
  // contracts/leads query by show_id. Done in app code so it's correct both on a
  // real show_manager login (redundant with RLS 108) AND in an admin's
  // "View As → user" preview (where RLS runs as the admin, not the manager).
  const isShowManager = effectiveRole === "show_manager";
  let managedShowIds: string[] = [];
  if (isShowManager) {
    const { data: managedRows } = await supabase
      .from("show_managers")
      .select("show_id")
      .eq("user_id", effectiveUserId);
    managedShowIds = (managedRows ?? []).map((r) => r.show_id as string);
  }
  // Sentinel matching nothing — a manager assigned to no shows sees zero rows.
  const NO_MATCH = "00000000-0000-0000-0000-000000000000";
  // Apply the right viewer scope to a contracts query builder (mutates + returns).
  const scopeContracts = (q: any) => {
    if (isAdmin) return q;
    if (isShowManager) return q.in("show_id", managedShowIds.length > 0 ? managedShowIds : [NO_MATCH]);
    return q.eq("sales_rep_id", effectiveUserId);
  };

  // All day boundaries computed in Atlas's local tz (America/Chicago) and
  // expressed as UTC instants. UTC-day math previously kept late-evening
  // Central contracts in "today's revenue" until UTC rolled over the next
  // morning Central — Willie reported the same contract showing for days.
  const todayStart = todayStartUTC().toISOString();
  const yesterdayStart = daysAgoStartUTC(1).toISOString();
  const monthStart = monthStartUTC().toISOString();
  // YYYY-MM-DD date strings in Central Time, used for date-typed columns
  // (shows.start_date, sales_goals.period_start) where a UTC ISO would
  // shift the matching window by 5–6 hours.
  const today = todayDateStringInTZ();
  const monthStartDate = today.slice(0, 7) + "-01";

  // ── Today's stats ─────────────────────────────────────────────────────────
  // Admin/manager: company-wide. Sales reps: their own contracts only.
  // Don't filter by deposit_paid — Wells Fargo financed-in-full sales have
  // deposit_paid = 0 but ARE real closed revenue. Status filter alone gates
  // out quote/draft/cancelled; is_contingent gates out conditional deals.
  // Per William Downs Sr. clarification 2026-05-21, the financed amount run
  // at POS counts as a deposit, so we include the `financing` JSONB and
  // compute effective deposit via the helper.
  const todayStatsQuery = supabase
    .from("contracts")
    .select("total, deposit_paid, financing, status, is_contingent, sales_rep_id")
    .gte("created_at", todayStart)
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false);

  scopeContracts(todayStatsQuery);

  // Yesterday's stats for trend comparison
  const yesterdayStatsQuery = supabase
    .from("contracts")
    .select("total, deposit_paid, financing")
    .gte("created_at", yesterdayStart)
    .lt("created_at", todayStart)
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false);
  scopeContracts(yesterdayStatsQuery);

  const [{ data: todayStats }, { data: yesterdayStats }] = await Promise.all([
    todayStatsQuery,
    yesterdayStatsQuery,
  ]);

  const { effectiveDeposit } = await import("@/lib/effective-deposit");
  const todayRevenue = todayStats?.reduce((s, c) => s + (c.total ?? 0), 0) ?? 0;
  const todayDepositSplit = todayStats?.reduce(
    (acc, c) => {
      const e = effectiveDeposit(c);
      acc.cash += e.cash;
      acc.financed += e.financed;
      return acc;
    },
    { cash: 0, financed: 0 },
  ) ?? { cash: 0, financed: 0 };
  const todayDeposits = todayDepositSplit.cash + todayDepositSplit.financed;
  const todayFinanceDeposits = todayDepositSplit.financed;
  const todayCount = todayStats?.length ?? 0;

  const yRevenue = yesterdayStats?.reduce((s, c) => s + (c.total ?? 0), 0) ?? 0;
  const yDeposits = yesterdayStats?.reduce((s, c) => s + effectiveDeposit(c).total, 0) ?? 0;
  const yCount = yesterdayStats?.length ?? 0;

  function pctDelta(current: number, prior: number): { trend: "up" | "down" | "flat"; label: string } | null {
    if (prior === 0 && current === 0) return null;
    if (prior === 0) return { trend: "up", label: "new" };
    const pct = Math.round(((current - prior) / prior) * 100);
    if (pct === 0) return { trend: "flat", label: "0%" };
    return { trend: pct > 0 ? "up" : "down", label: `${Math.abs(pct)}%` };
  }

  const revDelta = pctDelta(todayRevenue, yRevenue);
  const depDelta = pctDelta(todayDeposits, yDeposits);
  const cntDelta = pctDelta(todayCount, yCount);

  // ── 30-day revenue trend for chart ──────────────────────────────────────────
  const thirtyDaysAgoStart = daysAgoStartUTC(30).toISOString();
  const trendStatsQuery = supabase
    .from("contracts")
    .select("total, created_at")
    .gte("created_at", thirtyDaysAgoStart)
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false);
  scopeContracts(trendStatsQuery);
  const { data: trendRows } = await trendStatsQuery;

  // Bucket by day (inclusive of today). Days are computed in Central Time so
  // a contract signed at 9 PM CDT lands on its local-day bucket, not the next
  // UTC day.
  const trendMap = new Map<string, { revenue: number; contracts: number }>();
  for (let i = 30; i >= 0; i--) {
    const start = daysAgoStartUTC(i);
    const localDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(start);
    trendMap.set(localDay, { revenue: 0, contracts: 0 });
  }
  for (const row of trendRows ?? []) {
    if (!row.created_at) continue;
    const localDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(row.created_at));
    if (!trendMap.has(localDay)) continue;
    const bucket = trendMap.get(localDay)!;
    bucket.revenue += row.total ?? 0;
    bucket.contracts += 1;
  }
  const trendData = Array.from(trendMap.entries()).map(([date, vals]) => ({
    date,
    label: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: vals.revenue,
    contracts: vals.contracts,
  }));
  const trendTotal = trendData.reduce((s, d) => s + d.revenue, 0);
  const trendHasData = trendTotal > 0;

  // Active show today for "Today at the Show" context chip
  const { data: activeShowToday } = await supabase
    .from("shows")
    .select("id, name, start_date, end_date")
    .lte("start_date", today)
    .gte("end_date", today)
    .eq("active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let activeShowChip: { label: string; pulsing: boolean } | undefined;
  if (activeShowToday) {
    const start = new Date(activeShowToday.start_date);
    const end = new Date(activeShowToday.end_date);
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const todayDate = new Date(today);
    const dayNum = Math.min(totalDays, Math.max(1, Math.round((todayDate.getTime() - start.getTime()) / 86400000) + 1));
    activeShowChip = {
      label: totalDays > 1
        ? `${activeShowToday.name} · Day ${dayNum} of ${totalDays}`
        : activeShowToday.name,
      pulsing: true,
    };
  }

  // ── Recent confirmed contracts (non-contingent, any status except quote/draft/cancelled) ──
  // Exclude historical backfill rows (BF- prefix from scripts/backfill_historical_shows.py)
  // so the dashboard widget only surfaces contracts actually run through this system.
  const confirmedQuery = supabase
    .from("contracts")
    .select("id, contract_number, status, total, deposit_paid, financing, is_contingent, created_at, customer:customers(first_name, last_name), show:shows(name)")
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false)
    .not("contract_number", "like", "BF-%")
    .order("created_at", { ascending: false })
    .limit(10);

  scopeContracts(confirmedQuery);

  // ── Recent contingent contracts ───────────────────────────────────────────
  // Same BF- exclusion as confirmedQuery — only surface contracts run through this system.
  const contingentQuery = supabase
    .from("contracts")
    .select("id, contract_number, status, total, deposit_paid, financing, is_contingent, created_at, customer:customers(first_name, last_name), show:shows(name)")
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", true)
    .not("contract_number", "like", "BF-%")
    .order("created_at", { ascending: false })
    .limit(5);

  scopeContracts(contingentQuery);

  // ── Recent quotes ─────────────────────────────────────────────────────────
  // Over-fetch (20) so the converted-quote filter below has headroom before
  // slicing to 5 for display. customer_id is selected so we can match it
  // against the customers who already have a non-quote contract.
  const quotesQuery = supabase
    .from("contracts")
    .select("id, contract_number, status, total, created_at, customer_id, customer:customers(first_name, last_name), show:shows(name)")
    .eq("status", "quote")
    .order("created_at", { ascending: false })
    .limit(20);

  scopeContracts(quotesQuery);

  // ── Leads pipeline ────────────────────────────────────────────────────────
  const leadsQuery = supabase
    .from("leads")
    .select("id, first_name, last_name, phone, interest, status, created_at, show:shows(name)")
    .not("status", "in", '("converted","lost")')
    .order("created_at", { ascending: false })
    .limit(30);

  if (isShowManager) {
    leadsQuery.in("show_id", managedShowIds.length > 0 ? managedShowIds : [NO_MATCH]);
  } else if (!isAdmin) {
    leadsQuery.eq("assigned_to", effectiveUserId);
  }

  // ── Monthly stats for goal progress ──────────────────────────────────────
  const monthStatsQuery = supabase
    .from("contracts")
    .select("total, deposit_paid")
    .gte("created_at", monthStart)
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false);
  scopeContracts(monthStatsQuery);

  // ── Goal for current user this month ──────────────────────────────────────
  // sales_goals.period_start is a date column — pass the local-tz "first
  // of the month" string so a goal entered on the 1st of the month is found
  // even when UTC has already rolled past midnight Central.
  const goalQuery = supabase
    .from("sales_goals")
    .select("target_revenue, target_contracts")
    .eq("rep_id", effectiveUserId)
    .eq("period_start", monthStartDate)
    .maybeSingle();

  // ── Reorder alerts (admin/manager only) ──────────────────────────────────
  const reorderProductsQuery = isAdmin
    ? supabase.from("products").select("id, name, min_stock_qty").gt("min_stock_qty", 0)
    : Promise.resolve({ data: null as null });

  const reorderUnitsQuery = isAdmin
    ? supabase.from("inventory_units").select("product_id").not("status", "in", '("sold","delivered")')
    : Promise.resolve({ data: null as null });

  const [
    { data: confirmedContractsRaw },
    { data: contingentContractsRaw },
    { data: recentQuotesRaw },
    { data: leadsRaw },
    { data: monthStatsRaw },
    { data: goal },
    { data: reorderProductsRaw },
    { data: reorderUnitsRaw },
  ] = await Promise.all([confirmedQuery, contingentQuery, quotesQuery, leadsQuery, monthStatsQuery, goalQuery, reorderProductsQuery, reorderUnitsQuery]);

  const reorderUnitMap = new Map<string, number>();
  for (const u of (reorderUnitsRaw ?? []) as { product_id: string }[]) {
    reorderUnitMap.set(u.product_id, (reorderUnitMap.get(u.product_id) ?? 0) + 1);
  }
  const reorderAlerts = ((reorderProductsRaw ?? []) as { id: string; name: string; min_stock_qty: number }[]).filter(
    (p) => (reorderUnitMap.get(p.id) ?? 0) <= p.min_stock_qty
  );

  const confirmedContracts = (confirmedContractsRaw ?? []) as any[];
  const contingentContracts = (contingentContractsRaw ?? []) as any[];
  const recentQuotesAll = (recentQuotesRaw ?? []) as any[];
  const leads = (leadsRaw ?? []) as any[];

  // Hide quotes that have already been converted into a contract for the same
  // customer. Mirrors shows/[id]/floor/page.tsx: convert-via-/contracts/new
  // keeps customer_id, but rebuild-from-scratch creates a new customer row
  // with the same name — so match on both customer_id AND lowercased name.
  const quoteCustomerKey = (c: { customer?: unknown }): string => {
    const cust = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const first = ((cust as { first_name?: string } | null)?.first_name ?? "").trim().toLowerCase();
    const last = ((cust as { last_name?: string } | null)?.last_name ?? "").trim().toLowerCase();
    return `${first}|${last}`;
  };

  const quoteCustomerIds = Array.from(
    new Set(recentQuotesAll.map((q) => q.customer_id).filter((id): id is string => Boolean(id)))
  );

  let convertedCustomerIds = new Set<string>();
  let convertedNameKeys = new Set<string>();
  if (quoteCustomerIds.length) {
    const convertedQuery = supabase
      .from("contracts")
      .select("customer_id, customer:customers(first_name, last_name)")
      .in("customer_id", quoteCustomerIds)
      .not("status", "in", '("quote","draft","cancelled")');
    scopeContracts(convertedQuery);
    const { data: convertedRows } = await convertedQuery;
    for (const row of (convertedRows ?? []) as { customer_id: string | null; customer?: unknown }[]) {
      if (row.customer_id) convertedCustomerIds.add(row.customer_id);
      const key = quoteCustomerKey(row);
      if (key !== "|") convertedNameKeys.add(key);
    }
  }

  const recentQuotes = recentQuotesAll
    .filter((q) => {
      if (q.customer_id && convertedCustomerIds.has(q.customer_id)) return false;
      const key = quoteCustomerKey(q);
      if (key !== "|" && convertedNameKeys.has(key)) return false;
      return true;
    })
    .slice(0, 5);

  // Pending site visits — parent contracts flagged for a concrete estimate
  // at Step 5. Same role/scope rules as the contracts list: admins/managers/
  // bookkeepers see company-wide, reps see their own. Sorted oldest-first so
  // the most urgent surfaces first in the mini-list.
  const siteVisitsQuery = supabase
    .from("contracts")
    .select("id, created_at, customer:customers(first_name, last_name)")
    .eq("concrete_estimate_pending", true)
    .is("parent_contract_id", null)
    .order("created_at", { ascending: true })
    .limit(50);
  scopeContracts(siteVisitsQuery);
  const { data: siteVisitsRaw } = await siteVisitsQuery;
  const siteVisits = (siteVisitsRaw ?? []) as any[];

  // Overdue balances — delivered or ready_for_delivery with unpaid balance
  let overdueContracts: any[] = [];
  if (isAdmin) {
    const { data: overdueData } = await supabase
      .from("contracts")
      .select("id, contract_number, status, balance_due, total, created_at, customer:customers(first_name, last_name)")
      .in("status", ["delivered", "ready_for_delivery"])
      .gt("balance_due", 0)
      .order("balance_due", { ascending: false })
      .limit(20);
    overdueContracts = overdueData ?? [];
  }
  const totalOverdue = overdueContracts.reduce((s, c) => s + (c.balance_due ?? 0), 0);

  // Goal progress calculations
  const monthRevenue = (monthStatsRaw ?? []).reduce((s: number, c: any) => s + (c.total ?? 0), 0);
  const monthCount = (monthStatsRaw ?? []).length;
  const goalRevPct = goal?.target_revenue ? Math.min(100, Math.round((monthRevenue / goal.target_revenue) * 100)) : null;
  const goalCntPct = goal?.target_contracts ? Math.min(100, Math.round((monthCount / goal.target_contracts) * 100)) : null;

  const statusLabels: Record<string, string> = {
    pending_signature: "Pending Sig.",
    signed: "Signed",
    deposit_collected: "Deposit Paid",
    in_production: "In Production",
    ready_for_delivery: "Ready",
    delivered: "Delivered",
  };

  const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
    pending_signature: "warning",
    signed: "default",
    deposit_collected: "success",
    in_production: "default",
    ready_for_delivery: "warning",
    delivered: "success",
  };

  function ContractRow({ contract, href }: { contract: any; href: string }) {
    return (
      <li>
        <Link
          href={href}
          className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 truncate">
              {contract.customer?.first_name} {contract.customer?.last_name}
            </p>
            <p className="text-sm text-slate-500 truncate">
              {contract.contract_number}
              {contract.show?.name ? ` · ${contract.show.name}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 ml-3">
            <p className="font-semibold text-slate-900">{formatCurrency(contract.total)}</p>
            {(() => {
              const display = getDisplayStatus(contract);
              return (
                <Badge variant={statusColors[display] ?? "secondary"}>
                  {statusLabels[display] ?? display}
                </Badge>
              );
            })()}
          </div>
        </Link>
      </li>
    );
  }

  return (
    <AppShell
      role={effectiveRole}
      userName={profile?.full_name}
      orgPerms={orgPerms}
      realRole={profile?.role}
      viewAsUser={viewAs.viewAsUser}
      isImpersonatingRole={viewAs.isImpersonatingRole}
      isImpersonatingUser={viewAs.isImpersonatingUser}
    >
      <AppHeader
        title={viewAs.viewAsUser?.full_name ?? profile?.full_name ?? "Dashboard"}
        subtitle={effectiveRole?.replace("_", " ")}
        status={activeShowChip}
        actions={
          <Link href="/contracts/new">
            <Button variant="accent" size="lg" className="font-bold">
              + New Contract
            </Button>
          </Link>
        }
      />

      <main className="px-5 py-6 space-y-3 max-w-4xl mx-auto pb-24">

        {/* ── Reorder Alerts ── */}
        {isAdmin && reorderAlerts.length > 0 && (
          <Link href="/admin/inventory" className="block">
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3 hover:bg-amber-100 transition-colors">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold text-amber-800 text-sm">
                  {reorderAlerts.length} product{reorderAlerts.length !== 1 ? "s" : ""} at or below reorder threshold
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {reorderAlerts.slice(0, 3).map((p: any) => p.name).join(", ")}
                  {reorderAlerts.length > 3 ? ` +${reorderAlerts.length - 3} more` : ""}
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* ── Pending site visits ── */}
        {siteVisits.length > 0 && (
          <Link href="/site-visits" className="block">
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5" aria-hidden="true">🚧</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-800 text-sm">
                    {siteVisits.length} pending site visit{siteVisits.length !== 1 ? "s" : ""}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {siteVisits.slice(0, 5).map((sv) => {
                      const days = sv.created_at
                        ? Math.max(0, Math.floor((Date.now() - new Date(sv.created_at).getTime()) / 86400000))
                        : 0;
                      const stale = days > 14;
                      const name = [sv.customer?.first_name, sv.customer?.last_name]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || "Customer";
                      return (
                        <li key={sv.id} className="text-xs text-amber-800 flex items-center justify-between gap-2">
                          <span className="truncate">{name}</span>
                          <span className={`font-bold tabular-nums flex-shrink-0 ${stale ? "text-red-600" : "text-amber-700"}`}>
                            {days}d
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {siteVisits.length > 5 && (
                    <p className="text-[11px] text-amber-700 mt-1.5">
                      +{siteVisits.length - 5} more →
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* ── Primary CTA banner ── */}
        <Link
          href="/contracts/new"
          className="block rounded-xl p-5 text-white relative overflow-hidden group transition-transform hover:scale-[1.005] shadow-md"
          style={{
            background: "linear-gradient(135deg, #010F21 0%, #00929C 140%)",
          }}
        >
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1">
                {activeShowChip ? "Active show" : "Ready when you are"}
              </div>
              <div className="text-xl md:text-2xl font-black leading-tight">
                Start a New Contract →
              </div>
              <div className="text-sm text-white/80 mt-1 truncate">
                {activeShowChip?.label ?? "From quote to signed in eight steps."}
              </div>
            </div>
            <div className="text-5xl md:text-6xl font-black text-white/10 select-none">
              NEW
            </div>
          </div>
        </Link>

        {/* ── Today's Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label={isAdmin ? "Today's Revenue" : "My Revenue Today"}
            value={formatCurrency(todayRevenue)}
            sublabel={yRevenue > 0 ? `${formatCurrency(yRevenue)} yesterday` : undefined}
            trend={revDelta?.trend}
            trendValue={revDelta?.label}
            accentColor="#00929C"
          />
          <KpiCard
            label={isAdmin ? "Deposits Collected" : "My Deposits Today"}
            value={formatCurrency(todayDeposits)}
            sublabel={
              todayFinanceDeposits > 0
                ? `incl. ${formatCurrency(todayFinanceDeposits)} financed`
                : yDeposits > 0 ? `${formatCurrency(yDeposits)} yesterday` : undefined
            }
            trend={depDelta?.trend}
            trendValue={depDelta?.label}
            accentColor="#10b981"
          />
          <KpiCard
            label={isAdmin ? "Contracts Today" : "My Contracts Today"}
            value={todayCount}
            sublabel={yCount > 0 ? `${yCount} yesterday` : undefined}
            trend={cntDelta?.trend}
            trendValue={cntDelta?.label}
            accentColor="#0f172a"
          />
          <KpiCard
            label={isAdmin ? "Contingent Today" : "My Contingent"}
            value={contingentContracts?.filter((c) => {
              if (!c.created_at) return false;
              const localDay = new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/Chicago",
                year: "numeric", month: "2-digit", day: "2-digit",
              }).format(new Date(c.created_at));
              return localDay === today;
            }).length ?? 0}
            sublabel="Pending conditions"
            accentColor="#d97706"
          />
        </div>

        {/* ── 30-Day Revenue Trend ── */}
        {trendHasData && (
          <SectionCard
            title={isAdmin ? "Revenue — Last 30 Days" : "My Revenue — Last 30 Days"}
            subtitle={`${formatCurrency(trendTotal)} total`}
            viewAllHref={isAdmin ? "/analytics?period=month" : undefined}
            viewAllLabel="Full analytics →"
          >
            <RevenueTrendChart data={trendData} />
          </SectionCard>
        )}

        {/* ── Monthly Goal Progress ── */}
        {goal && (goalRevPct !== null || goalCntPct !== null) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Monthly Goal Progress
                </p>
                <span className="text-xs text-slate-400">
                  {new Date().toLocaleDateString("en-US", { month: "long" })}
                </span>
              </div>
              {goalRevPct !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">Revenue</span>
                    <span className={`font-bold ${goalRevPct >= 100 ? "text-emerald-600" : goalRevPct >= 70 ? "text-[#00929C]" : "text-slate-700"}`}>
                      {goalRevPct}% · {formatCurrency(monthRevenue)} / {formatCurrency(goal.target_revenue)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${goalRevPct}%`,
                        background: goalRevPct >= 100 ? "#10b981" : goalRevPct >= 70 ? "#00929C" : "#010F21",
                      }}
                    />
                  </div>
                </div>
              )}
              {goalCntPct !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">Contracts</span>
                    <span className={`font-bold ${goalCntPct >= 100 ? "text-emerald-600" : "text-slate-700"}`}>
                      {goalCntPct}% · {monthCount} / {goal.target_contracts}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${goalCntPct}%`,
                        background: goalCntPct >= 100 ? "#10b981" : "#00929C",
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Analytics shortcut — admin/manager only ── */}
        {isAdmin && (
          <Link href="/analytics" className="block">
            <Card className="hover:bg-slate-50 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Analytics Dashboard</p>
                  <p className="text-sm text-slate-500">Revenue · Leaderboard · Insights</p>
                </div>
                <svg className="w-6 h-6 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* ── Leads Pipeline ── */}
        <LeadsPipeline leads={leads} />

        {/* ── Overdue Balances ── */}
        {isAdmin && overdueContracts.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Overdue Balances</h2>
                <p className="text-xs text-slate-500">{overdueContracts.length} contract{overdueContracts.length !== 1 ? "s" : ""} · {formatCurrency(totalOverdue)} outstanding</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">{formatCurrency(totalOverdue)}</span>
            </div>
            <div className="space-y-2">
              {overdueContracts.map((c) => {
                const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
                return (
                  <Link key={c.id} href={`/contracts/${c.id}`} className="block">
                    <div className="bg-white border border-red-100 rounded-xl px-4 py-3 hover:bg-red-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{c.contract_number}</p>
                          <p className="text-xs text-slate-500">{customer?.first_name} {customer?.last_name} · {c.status.replace(/_/g, " ")}</p>
                        </div>
                        <p className="text-base font-bold text-red-600">{formatCurrency(c.balance_due)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Section 1: Recent Contracts ── */}
        <SectionCard
          title="Recent Contracts"
          subtitle={confirmedContracts?.length ? `${confirmedContracts.length} most recent` : undefined}
          viewAllHref="/contracts?filter=contracts"
          bodyClassName="p-0"
        >
          {!confirmedContracts?.length ? (
            <EmptyState
              compact
              title="No confirmed contracts yet"
              description="When a rep collects a deposit, the contract lands here."
              action={{ label: "+ New Contract", href: "/contracts/new" }}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {confirmedContracts.map((c) => (
                <ContractRow key={c.id} contract={c} href={`/contracts/${c.id}`} />
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ── Section 2: Contingent Contracts ── */}
        <SectionCard
          title="Recent Contingent Contracts"
          viewAllHref="/contracts?filter=contingent"
          bodyClassName="p-0"
          headerAccessory={<Badge variant="warning" className="text-xs">Pending Conditions</Badge>}
        >
          {!contingentContracts?.length ? (
            <EmptyState
              compact
              title="No contingent contracts"
              description="Deals waiting on a co-signer, financing, or trade-in will appear here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {contingentContracts.map((c) => (
                <ContractRow key={c.id} contract={c} href={`/contracts/${c.id}`} />
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ── Section 3: Recent Quotes ── */}
        <SectionCard
          title="Recent Quotes"
          viewAllHref="/contracts?filter=quote"
          bodyClassName="p-0"
        >
          {!recentQuotes?.length ? (
            <EmptyState
              compact
              title="No quotes yet"
              description="Start a new contract and save at Step 5 to generate a quote without collecting a deposit."
              action={{ label: "+ New Quote", href: "/contracts/new" }}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentQuotes.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/quotes/${c.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {c.customer?.first_name} {c.customer?.last_name}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        {c.contract_number}
                        {c.show?.name ? ` · ${c.show.name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3">
                      <p className="font-semibold text-slate-900">{formatCurrency(c.total)}</p>
                      <Badge variant="secondary">Quote</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

      </main>
    </AppShell>
  );
}
