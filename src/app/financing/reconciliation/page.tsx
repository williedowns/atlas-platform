export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReconciliationCsvExport } from "@/components/financing/ReconciliationCsvExport";

interface PageProps {
  searchParams: Promise<{ show?: string; financier?: string; from?: string; to?: string }>;
}

export default async function ReconciliationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) redirect("/dashboard");

  // Pull all signed contracts with financing — server-side filter scope
  let q = supabase
    .from("contracts")
    .select(`
      id, contract_number, status, financing, total, deposit_paid, balance_due,
      created_at, customer_id, line_items,
      needs_permit, permit_status, needs_hoa, hoa_status,
      customer:customers(first_name, last_name),
      show:shows(id, name, start_date, end_date),
      location:locations(id, name),
      sales_rep:profiles(full_name)
    `)
    .not("status", "in", '("quote","draft","cancelled")')
    .not("financing", "eq", "[]")
    .not("financing", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (params.show && params.show !== "all") q = q.eq("show_id", params.show);
  if (params.from) q = q.gte("created_at", params.from);
  if (params.to) q = q.lte("created_at", params.to);

  const { data: contractsRaw } = await q;
  const contracts = (contractsRaw ?? []) as any[];

  // Pull DL files so we can mark stipulations done
  const customerIds = Array.from(new Set(contracts.map((c) => c.customer_id).filter(Boolean)));
  const { data: dlFiles } = customerIds.length
    ? await supabase
        .from("customer_files")
        .select("customer_id, category")
        .in("customer_id", customerIds)
    : { data: [] };
  const filesByCustomer = new Map<string, Set<string>>();
  for (const f of dlFiles ?? []) {
    const set = filesByCustomer.get((f as any).customer_id) ?? new Set<string>();
    set.add((f as any).category);
    filesByCustomer.set((f as any).customer_id, set);
  }

  // List of distinct shows for the filter pills
  const { data: showsRaw } = await supabase
    .from("shows")
    .select("id, name, start_date")
    .order("start_date", { ascending: false })
    .limit(50);
  const shows = (showsRaw ?? []) as any[];

  // Flatten one row per (contract × financing entry)
  const rows = contracts.flatMap((c) => {
    const entries = Array.isArray(c.financing) ? c.financing : [c.financing].filter(Boolean);
    return entries
      .filter((f: any) => f?.financed_amount > 0)
      .filter((f: any) => !params.financier || params.financier === "all" || (f.financer_name ?? "") === params.financier)
      .map((f: any) => {
        const customerFiles = filesByCustomer.get(c.customer_id) ?? new Set<string>();
        const isFoundation = (f.financer_name ?? "").toLowerCase().includes("foundation");
        const isLyon = (f.financer_name ?? "").toLowerCase().includes("lyon");

        // Stipulation summary
        const dlOk = customerFiles.has("drivers_license");
        const proofOk = !isFoundation || customerFiles.has("proof_of_homeownership");
        const achOk = !isFoundation || f.foundation_ach_waived || (f.foundation_ach_routing && f.foundation_ach_account);
        const stipsOk = dlOk && proofOk && achOk;

        // Lyon stage status
        let lyonStageSummary = "";
        if (isLyon && Array.isArray(f.lyon_stages)) {
          const total = f.lyon_stages.length;
          const fundedCount = f.lyon_stages.filter((s: any) => s.status === "funded").length;
          lyonStageSummary = `${fundedCount}/${total} stages`;
        }

        const productSummary = (Array.isArray(c.line_items) ? c.line_items : [])
          .map((li: any) => li.product_name)
          .filter(Boolean)
          .slice(0, 2)
          .join(", ");

        return {
          contractId: c.id,
          contract_number: c.contract_number,
          customerName: `${(Array.isArray(c.customer) ? c.customer[0] : c.customer)?.first_name ?? ""} ${(Array.isArray(c.customer) ? c.customer[0] : c.customer)?.last_name ?? ""}`.trim(),
          showName: (Array.isArray(c.show) ? c.show[0] : c.show)?.name ?? (Array.isArray(c.location) ? c.location[0] : c.location)?.name ?? "—",
          showId: (Array.isArray(c.show) ? c.show[0] : c.show)?.id ?? null,
          rep: (Array.isArray(c.sales_rep) ? c.sales_rep[0] : c.sales_rep)?.full_name ?? "—",
          product: productSummary,
          total: c.total,
          deposit_paid: c.deposit_paid,
          balance_due: c.balance_due,
          financer: f.financer_name ?? "—",
          financed_amount: f.financed_amount,
          stipsOk,
          dlOk,
          proofOk,
          achOk,
          lyonStageSummary,
          permitOk: !c.needs_permit || c.permit_status === "approved",
          hoaOk: !c.needs_hoa || c.hoa_status === "approved",
          createdAt: c.created_at,
          status: c.status,
        };
      });
  });

  // Distinct financiers for filter
  const financiers = Array.from(new Set(rows.map((r) => r.financer))).sort();

  // Group by show for visual scan
  const byShow = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.showName;
    if (!byShow.has(key)) byShow.set(key, []);
    byShow.get(key)!.push(r);
  }

  // Aggregate totals
  const totalFinanced = rows.reduce((s, r) => s + r.financed_amount, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.balance_due, 0);
  const stipsMissingCount = rows.filter((r) => !r.stipsOk).length;

  return (
    <AppShell role={profile?.role} userName={profile?.full_name}>
      <AppHeader
        title="Post-Show Reconciliation"
        subtitle={`${rows.length} financed entries · ${byShow.size} shows`}
        backHref="/financing"
      />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <SectionCard title="Filters">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Show</p>
              <div className="flex flex-wrap gap-2">
                <FilterPill label="All shows" href="/financing/reconciliation" active={!params.show || params.show === "all"} />
                {shows.map((s) => (
                  <FilterPill
                    key={s.id}
                    label={s.name}
                    href={`/financing/reconciliation?show=${s.id}`}
                    active={params.show === s.id}
                  />
                ))}
              </div>
            </div>
            {financiers.length > 1 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Financier</p>
                <div className="flex flex-wrap gap-2">
                  <FilterPill
                    label="All financiers"
                    href={params.show ? `/financing/reconciliation?show=${params.show}` : "/financing/reconciliation"}
                    active={!params.financier || params.financier === "all"}
                  />
                  {financiers.map((f) => (
                    <FilterPill
                      key={f}
                      label={f}
                      href={`/financing/reconciliation?${params.show ? `show=${params.show}&` : ""}financier=${encodeURIComponent(f)}`}
                      active={params.financier === f}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Aggregate */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total financed" value={formatCurrency(totalFinanced)} />
          <Stat label="Outstanding balance" value={formatCurrency(totalOutstanding)} />
          <Stat label="Stipulations missing" value={`${stipsMissingCount}`} />
        </div>

        {/* Export */}
        <ReconciliationCsvExport rows={rows} />

        {/* Table grouped by show */}
        {rows.length === 0 ? (
          <EmptyState title="No financed contracts in this filter" description="Try a different show or financier." />
        ) : (
          [...byShow.entries()].map(([showName, showRows]) => (
            <SectionCard key={showName} title={showName} subtitle={`${showRows.length} entries`} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Contract</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Financier</th>
                      <th className="px-3 py-2 text-right">Financed</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2 text-left">Stipulations</th>
                      <th className="px-3 py-2 text-left">Permit/HOA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {showRows.map((r, i) => (
                      <tr key={`${r.contractId}-${i}`}>
                        <td className="px-3 py-2 align-top">
                          <Link href={`/contracts/${r.contractId}`} className="font-semibold text-slate-900 hover:underline">
                            {r.contract_number}
                          </Link>
                          <p className="text-xs text-slate-400">{formatDate(r.createdAt)} · {r.rep}</p>
                          {r.product && <p className="text-xs text-slate-500 truncate max-w-[200px]">{r.product}</p>}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">{r.customerName}</td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {r.financer}
                          {r.lyonStageSummary && <p className="text-xs text-slate-400">{r.lyonStageSummary}</p>}
                        </td>
                        <td className="px-3 py-2 align-top text-right font-semibold">{formatCurrency(r.financed_amount)}</td>
                        <td className={`px-3 py-2 align-top text-right font-semibold ${r.balance_due > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                          {formatCurrency(r.balance_due)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {r.stipsOk ? (
                            <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300">OK</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {!r.dlOk && <span className="text-xs rounded px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200">DL</span>}
                              {!r.proofOk && <span className="text-xs rounded px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200">Proof</span>}
                              {!r.achOk && <span className="text-xs rounded px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200">ACH</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {r.permitOk && r.hoaOk ? (
                            <span className="text-xs text-emerald-700">Clear</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {!r.permitOk && <span className="text-xs rounded px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200">Permit</span>}
                              {!r.hoaOk && <span className="text-xs rounded px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200">HOA</span>}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ))
        )}
      </main>
    </AppShell>
  );
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active ? "bg-[#00929C] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black mt-1 text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
    </div>
  );
}
