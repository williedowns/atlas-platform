export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LenderMixChart } from "@/components/financing/LenderMixChart";
import InhouseTrackerSection, { type InhouseRow } from "@/components/financing/InhouseTrackerSection";
import { Badge } from "@/components/ui/badge";

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
      created_at, customer_id,
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

  // Pull DL + proof-of-homeownership files so we can detect Foundation contracts missing stipulations
  const customerIds = Array.from(new Set((contractsRaw ?? []).map((c: any) => c.customer_id).filter(Boolean)));
  const { data: stipFiles } = customerIds.length
    ? await supabase
        .from("customer_files")
        .select("customer_id, category")
        .in("category", ["drivers_license", "proof_of_homeownership"])
        .in("customer_id", customerIds)
    : { data: [] };
  const customersWithDL = new Set((stipFiles ?? []).filter((f: any) => f.category === "drivers_license").map((f: any) => f.customer_id));
  const customersWithProof = new Set((stipFiles ?? []).filter((f: any) => f.category === "proof_of_homeownership").map((f: any) => f.customer_id));

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
  const totalFunded = rows.reduce((s, r) => s + (((r.financing as any).funded_amount as number) ?? 0), 0);
  const totalOutstanding = Math.max(0, totalFinanced - totalFunded);

  // ── Needs-Attention queue (Robert Kennedy's view) ───────────────────────
  type AttentionReason =
    | "foundation_missing_dl"
    | "foundation_missing_proof"
    | "foundation_missing_ach"
    | "foundation_secondary_buyer_no_email"
    | "lyon_stage_pending"
    | "funded_short"
    | "balance_unfunded";

  const REASON_LABEL: Record<AttentionReason, string> = {
    foundation_missing_dl: "Foundation — driver's license not uploaded",
    foundation_missing_proof: "Foundation — proof of homeownership not uploaded",
    foundation_missing_ach: "Foundation — ACH not provided & not waived",
    foundation_secondary_buyer_no_email: "Foundation — co-buyer email missing",
    lyon_stage_pending: "Lyon — stage awaiting funding",
    funded_short: "Balance to run via lender portal before delivery",
    balance_unfunded: "Outstanding balance with no funding source",
  };

  const attention: Array<{ contract: any; financing: any; reasons: AttentionReason[] }> = [];
  for (const { contract: c, financing: f } of rows) {
    const reasons: AttentionReason[] = [];
    const isFoundation = (f.financer_name ?? "").toLowerCase().includes("foundation");
    const isLyon = (f.financer_name ?? "").toLowerCase().includes("lyon");

    if (isFoundation) {
      if (c.customer_id && !customersWithDL.has(c.customer_id)) reasons.push("foundation_missing_dl");
      if (c.customer_id && !customersWithProof.has(c.customer_id)) reasons.push("foundation_missing_proof");
      if (!f.foundation_ach_waived && !(f.foundation_ach_routing && f.foundation_ach_account)) {
        reasons.push("foundation_missing_ach");
      }
      if ((f.secondary_buyer_first_name || f.secondary_buyer_last_name) && !f.secondary_buyer_email) {
        reasons.push("foundation_secondary_buyer_no_email");
      }
    }
    if (isLyon && Array.isArray(f.lyon_stages)) {
      const anyPending = f.lyon_stages.some((s: any) => s.status !== "funded" && s.status !== "skipped");
      if (anyPending) reasons.push("lyon_stage_pending");
    }
    // Balance-to-run check: GreenSky / WF entries (deduct_from_balance:true,
    // non-Lyon non-Foundation) with funded < financed. The customer's GreenSky/WF
    // balance is drawn via the lender's portal as ACH; flag any leftover so
    // Robert remembers to run it before delivery.
    const fundedAmt = (f as any).funded_amount ?? 0;
    const status = (f as any).funding_status ?? null;
    const isInstantDeduct = !isLyon && !isFoundation;
    if (isInstantDeduct && status !== "failed" && fundedAmt < (f.financed_amount ?? 0) - 0.01) {
      reasons.push("funded_short");
    }
    if (reasons.length > 0) attention.push({ contract: c, financing: f, reasons });
  }

  // Group attention queue by financier
  const attentionByFinancier: Record<string, typeof attention> = {};
  for (const item of attention) {
    const key = item.financing.financer_name ?? "Unknown";
    (attentionByFinancier[key] ??= []).push(item);
  }
  const attentionTotal = attention.length;

  // ── Salta In-House Financing tracker rows ────────────────────────────────
  const inhouseRows: InhouseRow[] = [];
  for (const c of contracts) {
    const farr = Array.isArray(c.financing) ? c.financing : [];
    farr.forEach((f: any, fundingIdx: number) => {
      if (f?.type !== "in_house") return;
      const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
      const show = Array.isArray(c.show) ? c.show[0] : c.show;
      const location = Array.isArray(c.location) ? c.location[0] : c.location;
      const rep = Array.isArray(c.sales_rep) ? c.sales_rep[0] : c.sales_rep;
      const dlOk = c.customer_id ? customersWithDL.has(c.customer_id) : false;
      inhouseRows.push({
        contractId: c.id,
        contractNumber: c.contract_number,
        customerName: `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "—",
        customerEmail: customer?.email ?? null,
        showName: show?.name ?? location?.name ?? "—",
        rep: rep?.full_name ?? "—",
        signedAt: c.created_at ?? null,
        financedAmount: Number(f.financed_amount ?? 0),
        contractTotal: Number(c.total ?? 0),
        balanceDue: Number(c.balance_due ?? 0),
        fundingIdx,
        status: (f.inhouse_app_status ?? "application_sent") as InhouseRow["status"],
        appSentAt: f.inhouse_app_sent_at ?? c.created_at ?? null,
        achOnFile: !!(f.inhouse_ach_routing && f.inhouse_ach_account),
        achWaived: !!f.inhouse_ach_waived,
        dlUploaded: dlOk,
        notes: f.inhouse_app_notes ?? null,
      });
    });
  }

  return (
    <AppShell role={profile?.role} userName={profile?.full_name}>
      <AppHeader
        title="Financing"
        subtitle={`${rows.length} financed contract${rows.length === 1 ? "" : "s"}`}
        backHref="/dashboard"
      />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Quick links */}
        <div className="flex justify-end">
          <Link
            href="/financing/reconciliation"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Post-Show Reconciliation →
          </Link>
        </div>

        {/* ── Salta In-House Financing tracker ─────────────────────────────── */}
        <SectionCard
          title="Salta In-House Financing"
          subtitle={inhouseRows.length === 0 ? "No applications yet" : `${inhouseRows.length} application${inhouseRows.length === 1 ? "" : "s"}`}
        >
          <InhouseTrackerSection rows={inhouseRows} />
        </SectionCard>

        {/* ── Robert's Queue: contracts that need someone to act ──────────── */}
        {attentionTotal > 0 && (
          <SectionCard
            title="Needs Attention"
            subtitle={`${attentionTotal} contract${attentionTotal === 1 ? "" : "s"} blocked or stale`}
          >
            <div className="space-y-4">
              {Object.entries(attentionByFinancier)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([financerName, items]) => (
                  <div key={financerName}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                        {financerName}
                      </p>
                      <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300">
                        {items.length}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                      {items.map(({ contract: c, financing: f, reasons }, i) => {
                        const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
                        return (
                          <Link key={`${c.id}-${i}`} href={`/contracts/${c.id}`} className="block">
                            <div className="px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-900 text-sm">{c.contract_number}</span>
                                    <span className="text-xs text-slate-500">
                                      {customer?.first_name} {customer?.last_name}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {reasons.map((r) => (
                                      <span
                                        key={r}
                                        className="text-xs font-semibold rounded px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200"
                                      >
                                        {REASON_LABEL[r]}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-bold text-blue-700">{formatCurrency(f.financed_amount)}</p>
                                  <p className="text-xs text-slate-400">{formatDate(c.created_at)}</p>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </SectionCard>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Total Financed"
            value={formatCurrency(totalFinanced)}
            sublabel={`${rows.length} deal${rows.length === 1 ? "" : "s"}`}
            accentColor="#0f172a"
          />
          <KpiCard
            label="Funded to Atlas"
            value={formatCurrency(totalFunded)}
            sublabel={`${totalFinanced > 0 ? ((totalFunded / totalFinanced) * 100).toFixed(0) : 0}% of financed`}
            accentColor="#059669"
          />
          <KpiCard
            label="Outstanding"
            value={formatCurrency(totalOutstanding)}
            sublabel={attentionTotal > 0 ? `${attentionTotal} need attention` : "All clear"}
            accentColor={totalOutstanding > 0 ? "#D97706" : "#059669"}
          />
          {Object.entries(byLender)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 1)
            .map(([name, stats]) => (
              <KpiCard
                key={name}
                label={`Top: ${name}`}
                value={formatCurrency(stats.total)}
                sublabel={`${stats.count} deal${stats.count !== 1 ? "s" : ""}`}
                accentColor="#1d4ed8"
              />
            ))}
        </div>

        {/* Lender mix donut + bars */}
        {(() => {
          const LENDER_PALETTE = ["#1d4ed8", "#0891B2", "#00929C", "#7C3AED", "#DB2777", "#059669", "#D97706", "#0EA5E9"];
          const lenderData = Object.entries(byLender)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([name, stats], i) => ({
              name,
              value: stats.total,
              count: stats.count,
              color: LENDER_PALETTE[i % LENDER_PALETTE.length],
            }));
          return (
            <SectionCard title="Lender Mix" subtitle="Share of financed volume by partner">
              <LenderMixChart data={lenderData} total={totalFinanced} />
            </SectionCard>
          );
        })()}

        {/* Financed contracts list */}
        <SectionCard
          title="Financed Contracts"
          subtitle={rows.length ? `${rows.length} showing` : undefined}
          bodyClassName="p-0"
        >
        {rows.length === 0 ? (
          <EmptyState
            title="No financed contracts"
            description="Financing entries will appear here once a contract with a lender plan is signed."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(({ contract: c, financing: f }, i) => {
              const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
              const show = Array.isArray(c.show) ? c.show[0] : c.show;
              const location = Array.isArray(c.location) ? c.location[0] : c.location;
              const rep = Array.isArray(c.sales_rep) ? c.sales_rep[0] : c.sales_rep;
              const venue = show?.name ?? location?.name ?? "—";
              return (
                <Link key={`${c.id}-${i}`} href={`/contracts/${c.id}`} className="block">
                  <div className="px-5 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors">
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
                        {(() => {
                          const fa = (f as any).funded_amount ?? 0;
                          const fs = (f as any).funding_status ?? null;
                          if (fa >= f.financed_amount - 0.01 && fa > 0) {
                            return <span className="inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300">Fully funded</span>;
                          }
                          if (fa > 0) {
                            return <span className="inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-300">{formatCurrency(fa)} funded</span>;
                          }
                          if (fs === "failed") {
                            return <span className="inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-800 border border-red-300">Failed</span>;
                          }
                          return <span className="inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300">Pending</span>;
                        })()}
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
        </SectionCard>
      </main>
    </AppShell>
  );
}
