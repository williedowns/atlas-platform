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

  // Today's contracts for this rep (or all if admin/manager)
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const contractsQuery = supabase
    .from("contracts")
    .select(`
      *,
      customer:customers(first_name, last_name),
      show:shows(name)
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!isAdmin) {
    contractsQuery.eq("sales_rep_id", user.id);
  }

  const { data: contracts } = await contractsQuery;

  // Today's stats
  const today = new Date().toISOString().split("T")[0];
  const { data: todayContracts } = await supabase
    .from("contracts")
    .select("total, deposit_paid, status")
    .gte("created_at", `${today}T00:00:00`)
    .not("status", "eq", "cancelled");

  const todayRevenue = todayContracts?.reduce((sum, c) => sum + (c.total || 0), 0) ?? 0;
  const todayDeposits = todayContracts?.reduce((sum, c) => sum + (c.deposit_paid || 0), 0) ?? 0;

  const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
    draft: "secondary",
    pending_signature: "warning",
    signed: "accent" as "default",
    deposit_collected: "success",
    in_production: "default",
    ready_for_delivery: "warning",
    delivered: "success",
    cancelled: "destructive",
  };

  const statusLabels: Record<string, string> = {
    draft: "Draft",
    pending_signature: "Pending Signature",
    signed: "Signed",
    deposit_collected: "Deposit Collected",
    in_production: "In Production",
    ready_for_delivery: "Ready for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

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

      <main className="px-5 py-6 space-y-4 max-w-2xl mx-auto pb-24">
        {/* Today's Stats */}
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
              <p className="text-2xl font-bold text-slate-900 mt-1">{todayContracts?.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Pending Signatures</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {todayContracts?.filter(c => c.status === "pending_signature").length ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Contracts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Contracts</CardTitle>
              <Link href="/contracts" className="text-sm text-[#00929C] font-medium">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!contracts?.length ? (
              <div className="px-6 pb-6 text-center text-slate-500 py-8">
                <p className="text-lg">No contracts yet today.</p>
                <p className="text-sm mt-1">Tap &ldquo;New Contract&rdquo; to get started.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {contracts.map((contract) => (
                  <li key={contract.id}>
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors"
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
