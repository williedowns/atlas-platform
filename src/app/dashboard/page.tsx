export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Bookkeeper gets their own specialized dashboard
  if (profile?.role === "bookkeeper") redirect("/bookkeeper");

  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const today = new Date().toISOString().split("T")[0];

  // ── Today's stats: confirmed (non-contingent) contracts with deposits ──────
  const { data: todayStats } = await supabase
    .from("contracts")
    .select("total, deposit_paid, status, is_contingent")
    .gte("created_at", `${today}T00:00:00`)
    .not("status", "in", '("quote","draft","cancelled")')
    .eq("is_contingent", false)
    .gt("deposit_paid", 0);

  const todayRevenue = todayStats?.reduce((s, c) => s + (c.total ?? 0), 0) ?? 0;
  const todayDeposits = todayStats?.reduce((s, c) => s + (c.deposit_paid ?? 0), 0) ?? 0;
  const todayCount = todayStats?.length ?? 0;

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

  const [
    { data: confirmedContractsRaw },
    { data: contingentContractsRaw },
    { data: recentQuotesRaw },
  ] = await Promise.all([confirmedQuery, contingentQuery, quotesQuery]);

  const confirmedContracts = (confirmedContractsRaw ?? []) as any[];
  const contingentContracts = (contingentContractsRaw ?? []) as any[];
  const recentQuotes = (recentQuotesRaw ?? []) as any[];

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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#010F21] text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div>
          <img src="/logo.png" alt="Atlas Spas & Swim Spas" className="h-8 w-auto bg-white rounded px-2 py-0.5" />
          <p className="text-white/60 text-xs mt-0.5">
            {profile?.full_name} · {profile?.role?.replace("_", " ")}
          </p>
        </div>
        <Link href="/contracts/new">
          <Button variant="accent" size="lg" className="font-bold">
            + New Contract
          </Button>
        </Link>
      </header>

      <main className="px-5 py-6 space-y-3 max-w-2xl mx-auto pb-24">

        {/* ── Today's Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Today&apos;s Revenue</p>
              <p className="text-2xl font-bold text-[#00929C] mt-1">{formatCurrency(todayRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Deposits Collected</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(todayDeposits)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Contracts Today</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{todayCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Contingent Today</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {contingentContracts?.filter(c => c.created_at?.startsWith(today)).length ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

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

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex safe-bottom">
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-[#00929C]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs mt-1 font-medium">Home</span>
        </Link>
        <Link href="/contracts" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs mt-1">Contracts</span>
        </Link>
        <Link href="/shows" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs mt-1">Shows</span>
        </Link>
        {isAdmin && (
          <Link href="/bookkeeper" className="flex-1 flex flex-col items-center py-3 text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-xs mt-1">Books</span>
          </Link>
        )}
        <Link href="/profile" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
