export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  draft: "secondary", pending_signature: "warning", signed: "default",
  deposit_collected: "success", in_production: "default",
  ready_for_delivery: "warning", delivered: "success", cancelled: "destructive",
};

export default async function FinancingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) redirect("/dashboard");

  // Fetch all contracts that have at least one financing entry
  const { data: contractsRaw } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, status, financing, total, deposit_paid, balance_due,
      created_at,
      customer:customers(first_name, last_name),
      show:shows(name),
      location:locations(name),
      sales_rep:profiles(full_name)
    `)
    .not("status", "in", '("quote","draft","cancelled")')
    .not("financing", "eq", "[]")
    .not("financing", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const contracts = (contractsRaw ?? []) as any[];

  // Flatten into individual financing rows for easier display
  const rows = contracts.flatMap((c) => {
    const entries = Array.isArray(c.financing) ? c.financing : [c.financing].filter(Boolean);
    return entries
      .filter((f: any) => f?.financed_amount > 0)
      .map((f: any) => ({ contract: c, financing: f }));
  });

  // Summary stats per lender
  const byLender: Record<string, { count: number; total: number }> = {};
  for (const { financing: f } of rows) {
    const key = f.financer_name ?? "Unknown";
    if (!byLender[key]) byLender[key] = { count: 0, total: 0 };
    byLender[key].count++;
    byLender[key].total += f.financed_amount ?? 0;
  }
  const totalFinanced = rows.reduce((s, r) => s + (r.financing.financed_amount ?? 0), 0);

  return (
    <AppShell role={profile?.role} userName={profile?.full_name}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-lg font-bold">Financing</h1>
            <p className="text-white/60 text-xs">{rows.length} financed contract{rows.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalFinanced)}</p>
              <p className="text-xs text-slate-500 mt-1">Total Financed</p>
            </CardContent>
          </Card>
          {Object.entries(byLender).sort((a, b) => b[1].total - a[1].total).map(([name, stats]) => (
            <Card key={name}>
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-blue-700">{formatCurrency(stats.total)}</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{name}</p>
                <p className="text-xs text-slate-400">{stats.count} deal{stats.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Financed contracts list */}
        {rows.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg font-semibold">No financed contracts</p>
            <p className="text-sm mt-1">Financing entries will appear here once contracts with financing are signed.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(({ contract: c, financing: f }, i) => {
              const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
              const show = Array.isArray(c.show) ? c.show[0] : c.show;
              const location = Array.isArray(c.location) ? c.location[0] : c.location;
              const rep = Array.isArray(c.sales_rep) ? c.sales_rep[0] : c.sales_rep;
              const venue = show?.name ?? location?.name ?? "—";
              return (
                <Link key={`${c.id}-${i}`} href={`/contracts/${c.id}`} className="block">
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{c.contract_number}</span>
                          <Badge variant={STATUS_COLORS[c.status] ?? "secondary"} className="text-xs capitalize">
                            {c.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 mt-0.5">
                          {customer?.first_name} {customer?.last_name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{venue} · {rep?.full_name ?? "—"} · {formatDate(c.created_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-bold text-blue-700">{formatCurrency(f.financed_amount)}</p>
                        <p className="text-xs font-semibold text-slate-600">{f.financer_name ?? "Unknown"}</p>
                        {f.plan_number && (
                          <p className="text-xs text-slate-400">Plan {f.plan_number}</p>
                        )}
                      </div>
                    </div>
                    {f.plan_description && (
                      <p className="text-xs text-slate-400 mt-1.5 truncate">{f.plan_description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span>Contract total: <span className="font-medium text-slate-700">{formatCurrency(c.total)}</span></span>
                      <span>Deposit paid: <span className="font-medium text-slate-700">{formatCurrency(c.deposit_paid)}</span></span>
                      <span>Balance due: <span className="font-medium text-amber-700">{formatCurrency(c.balance_due)}</span></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
