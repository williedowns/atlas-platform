export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import LeadsPipeline from "@/components/dashboard/LeadsPipeline";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { KpiCard } from "@/components/ui/KpiCard";

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

  // Role-based routing
  if (profile?.role === "bookkeeper") redirect("/bookkeeper");
  if (profile?.role === "field_crew") redirect("/field");

  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  // ── Today's stats ─────────────────────────────────────────────────────────
  // Admin/manager: company-wide. Sales reps: their own contracts only.
  const todayStatsQuery = supabase
    .from("contracts")
    .select("total, deposit_paid, status, is_contingent, sales_rep_id")
    .gte("created_at", `${today}T00:00:00`)
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false)
    .gt("deposit_paid", 0);

  if (!isAdmin) todayStatsQuery.eq("sales_rep_id", user.id);

  // Yesterday's stats for trend comparison
  const yesterdayStatsQuery = supabase
    .from("contracts")
    .select("total, deposit_paid")
    .gte("created_at", `${yesterday}T00:00:00`)
    .lt("created_at", `${today}T00:00:00`)
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false)
    .gt("deposit_paid", 0);
  if (!isAdmin) yesterdayStatsQuery.eq("sales_rep_id", user.id);

  const [{ data: todayStats }, { data: yesterdayStats }] = await Promise.all([
    todayStatsQuery,
    yesterdayStatsQuery,
  ]);

  const todayRevenue = todayStats?.reduce((s, c) => s + (c.total ?? 0), 0) ?? 0;
  const todayDeposits = todayStats?.reduce((s, c) => s + (c.deposit_paid ?? 0), 0) ?? 0;
  const todayCount = todayStats?.length ?? 0;

  const yRevenue = yesterdayStats?.reduce((s, c) => s + (c.total ?? 0), 0) ?? 0;
  const yDeposits = yesterdayStats?.reduce((s, c) => s + (c.deposit_paid ?? 0), 0) ?? 0;
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
  const confirmedQuery = supabase
    .from("contracts")
    .select("id, contract_number, status, total, deposit_paid, is_contingent, created_at, customer:customers(first_name, last_name), show:shows(name)")
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!isAdmin) confirmedQuery.eq("sales_rep_id", user.id);

  // ── Recent contingent contracts ───────────────────────────────────────────
  const contingentQuery = supabase
    .from("contracts")
    .select("id, contract_number, status, total, deposit_paid, is_contingent, created_at, customer:customers(first_name, last_name), show:shows(name)")
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", true)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!isAdmin) contingentQuery.eq("sales_rep_id", user.id);

  // ── Recent quotes ─────────────────────────────────────────────────────────
  const quotesQuery = supabase
    .from("contracts")
    .select("id, contract_number, status, total, created_at, customer:customers(first_name, last_name), show:shows(name)")
    .eq("status", "quote")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!isAdmin) quotesQuery.eq("sales_rep_id", user.id);

  // ── Leads pipeline ────────────────────────────────────────────────────────
  const leadsQuery = supabase
    .from("leads")
    .select("id, first_name, last_name, phone, interest, status, created_at, show:shows(name)")
    .not("status", "in", '("converted","lost")')
    .order("created_at", { ascending: false })
    .limit(30);

  if (!isAdmin) leadsQuery.eq("assigned_to", user.id);

  // ── Monthly stats for goal progress ──────────────────────────────────────
  const monthStatsQuery = supabase
    .from("contracts")
    .select("total, deposit_paid")
    .gte("created_at", `${monthStart}T00:00:00`)
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false)
    .gt("deposit_paid", 0);
  if (!isAdmin) monthStatsQuery.eq("sales_rep_id", user.id);

  // ── Goal for current user this month ──────────────────────────────────────
  const goalQuery = supabase
    .from("sales_goals")
    .select("target_revenue, target_contracts")
    .eq("rep_id", user.id)
    .eq("period_start", monthStart)
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
  const recentQuotes = (recentQuotesRaw ?? []) as any[];
  const leads = (leadsRaw ?? []) as any[];

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
            <Badge variant={statusColors[contract.status] ?? "secondary"}>
              {statusLabels[contract.status] ?? contract.status}
            </Badge>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title={profile?.full_name ?? "Dashboard"}
        subtitle={profile?.role?.replace("_", " ")}
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
            sublabel={yDeposits > 0 ? `${formatCurrency(yDeposits)} yesterday` : undefined}
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
            value={contingentContracts?.filter(c => c.created_at?.startsWith(today)).length ?? 0}
            sublabel="Pending conditions"
            accentColor="#d97706"
          />
        </div>

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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Contracts</CardTitle>
              <Link href="/contracts?filter=contracts" className="text-sm text-[#00929C] font-medium">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!confirmedContracts?.length ? (
              <div className="px-5 pb-6 pt-2 text-center text-slate-500">
                <p className="text-sm">No confirmed contracts yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {confirmedContracts.map((c) => (
                  <ContractRow key={c.id} contract={c} href={`/contracts/${c.id}`} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Section 2: Contingent Contracts ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Recent Contingent Contracts</CardTitle>
                <Badge variant="warning" className="text-xs">Pending Conditions</Badge>
              </div>
              <Link href="/contracts?filter=contingent" className="text-sm text-[#00929C] font-medium">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!contingentContracts?.length ? (
              <div className="px-5 pb-6 pt-2 text-center text-slate-500">
                <p className="text-sm">No contingent contracts.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {contingentContracts.map((c) => (
                  <ContractRow key={c.id} contract={c} href={`/contracts/${c.id}`} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Recent Quotes ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Quotes</CardTitle>
              <Link href="/contracts?filter=quote" className="text-sm text-[#00929C] font-medium">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!recentQuotes?.length ? (
              <div className="px-5 pb-6 pt-2 text-center text-slate-500">
                <p className="text-sm">No quotes yet.</p>
              </div>
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
          </CardContent>
        </Card>

      </main>
    </AppShell>
  );
}
