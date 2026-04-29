export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import TaxExemptTracker from "@/components/bookkeeper/TaxExemptTracker";
import ReconciliationView from "@/components/bookkeeper/ReconciliationView";
import SalesByEventList from "@/components/bookkeeper/SalesByEventList";
import CancellationRefundTracker from "@/components/bookkeeper/CancellationRefundTracker";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { OutstandingByAgeChart } from "@/components/bookkeeper/OutstandingByAgeChart";

export default async function BookkeeperPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const { hasPermission } = await import("@/lib/permissions");
  const orgPerms = (profile?.organization as any)?.role_permissions;
  if (!hasPermission(orgPerms, profile?.role, "bookkeeper")) redirect("/dashboard");

  // ── Fetch all active contracts with full financial + customer + line item data ──
  const { data: contractsRaw, error } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, status, is_contingent,
      total, subtotal, discount_total, tax_amount,
      deposit_paid, balance_due, payment_method,
      line_items, notes, created_at, customer_id,
      financing,
      needs_permit, permit_status, needs_hoa, hoa_status,
      tax_exempt_cert_received, tax_exempt_cert_received_at, tax_exempt_cert_url,
      tax_refund_amount, tax_refund_issued_at,
      customer:customers(id, first_name, last_name, phone, email),
      show:shows(id, name, start_date, end_date),
      location:locations(id, name),
      sales_rep:profiles(full_name)
    `)
    .not("status", "in", '("quote","draft","cancelled")')
    .order("created_at", { ascending: false })
    .limit(500);

  const contracts = (contractsRaw ?? []) as any[];

  // ── Cancelled contracts with deposits pending refund ──
  // Two-step query: fetch cancelled contracts first, then their payments separately.
  // Avoids FK join ambiguity and RLS issues that can silently return empty arrays.
  const { data: cancelledRaw } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, notes, deposit_paid, created_at, line_items,
      customer:customers(first_name, last_name),
      show:shows(name),
      location:locations(name)
    `)
    .eq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);

  const cancelledContracts = (cancelledRaw ?? []) as any[];

  // Fetch payments for all cancelled contracts in one query
  const cancelledIds = cancelledContracts.map((c) => c.id);
  let cancelledPayments: any[] = [];
  if (cancelledIds.length > 0) {
    const { data: cancelledPaymentsRaw } = await supabase
      .from("payments")
      .select("id, contract_id, amount, status, method")
      .in("contract_id", cancelledIds)
      .neq("status", "failed");
    cancelledPayments = (cancelledPaymentsRaw ?? []) as any[];
  }
  const cancelledWithDeposits = cancelledContracts.map((c) => ({
    ...c,
    payments: cancelledPayments.filter((p) => p.contract_id === c.id),
  }));

  // ── Check if migration 010 has been run (column existence probe) ──
  // Query a single row from contracts regardless of status to detect the column.
  // If the column doesn't exist, Supabase returns a 400/42703 error.
  const { error: colProbeError } = await supabase
    .from("contracts")
    .select("tax_exempt_cert_received")
    .limit(1);
  const hasMigration = !colProbeError;

  // ── Summary stats ──
  const totalRevenue = contracts.reduce((s, c) => s + (c.total ?? 0), 0);
  const totalDeposits = contracts.reduce((s, c) => s + (c.deposit_paid ?? 0), 0);
  const totalBalance = contracts.reduce((s, c) => s + (c.balance_due ?? 0), 0);
  const deliveredCount = contracts.filter((c) => c.status === "delivered").length;
  const pendingCount = contracts.filter((c) =>
    ["deposit_collected", "in_production", "ready_for_delivery", "signed", "pending_signature"].includes(c.status)
  ).length;

  // ── Outstanding by age (AR aging) ──
  const ageNow = new Date();
  const ageBuckets: { label: string; balance: number; count: number; color: string; max: number }[] = [
    { label: "0–30 days", balance: 0, count: 0, color: "#10b981", max: 30 },
    { label: "31–60",     balance: 0, count: 0, color: "#f59e0b", max: 60 },
    { label: "61–90",     balance: 0, count: 0, color: "#f97316", max: 90 },
    { label: "90+",       balance: 0, count: 0, color: "#dc2626", max: Infinity },
  ];
  for (const c of contracts) {
    if (!c.balance_due || c.balance_due <= 0) continue;
    const days = Math.floor((ageNow.getTime() - new Date(c.created_at).getTime()) / 86400000);
    const bucket = ageBuckets.find((b) => days <= b.max)!;
    bucket.balance += c.balance_due;
    bucket.count += 1;
  }
  const agingData = ageBuckets.map(({ label, balance, count, color }) => ({ label, balance, count, color }));

  // ── Tax cert alert counts ──
  const now = new Date();
  const taxTracked = contracts.filter((c) => {
    // Only track contracts where cert could be relevant (non-delivered active contracts + recently delivered)
    return c.status !== "cancelled";
  });

  const overdueCerts = taxTracked.filter((c) => {
    if (c.tax_exempt_cert_received) return false;
    const deadline = new Date(c.created_at);
    deadline.setDate(deadline.getDate() + 30);
    return deadline < now;
  });

  const dueSoonCerts = taxTracked.filter((c) => {
    if (c.tax_exempt_cert_received) return false;
    const deadline = new Date(c.created_at);
    deadline.setDate(deadline.getDate() + 30);
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= 7;
  });

  // Contracts where cert was received but tax refund hasn't been issued yet
  const refundNeededCerts = taxTracked.filter((c) =>
    c.tax_exempt_cert_received &&
    (c.tax_amount ?? 0) > 0 &&
    !c.tax_refund_issued_at
  );

  const hasCertAlert = overdueCerts.length > 0 || dueSoonCerts.length > 0 || refundNeededCerts.length > 0;

  // ── Pre-Delivery Readiness (Lori's view) ────────────────────────────────
  // Show every signed-but-not-delivered contract with their readiness flags.
  const undeliveredContracts = contracts.filter((c) =>
    c.status !== "delivered" && c.status !== "cancelled"
  );
  const undeliveredCustomerIds = Array.from(
    new Set(undeliveredContracts.map((c) => c.customer_id).filter(Boolean))
  );
  const { data: dlForUndelivered } = undeliveredCustomerIds.length
    ? await supabase
        .from("customer_files")
        .select("customer_id")
        .eq("category", "drivers_license")
        .in("customer_id", undeliveredCustomerIds)
    : { data: [] };
  const customersWithDl = new Set((dlForUndelivered ?? []).map((f: any) => f.customer_id));

  type ReadinessRow = {
    contract: any;
    balanceCleared: boolean;
    dlOk: boolean;
    permitOk: boolean;
    hoaOk: boolean;
    blockers: string[];
  };

  const readinessRows: ReadinessRow[] = undeliveredContracts.map((c) => {
    const financing = Array.isArray(c.financing) ? c.financing : (c.financing ? [c.financing] : []);
    const hasFinancing = financing.length > 0;
    const balanceCleared = (c.balance_due ?? 0) <= 0.01;
    const dlOk = !hasFinancing || customersWithDl.has(c.customer_id);
    const permitOk = !c.needs_permit || c.permit_status === "approved";
    const hoaOk = !c.needs_hoa || c.hoa_status === "approved";

    const blockers: string[] = [];
    if (!balanceCleared) blockers.push(`Balance ${formatCurrency(c.balance_due ?? 0)}`);
    if (!dlOk) blockers.push("DL missing");
    if (!permitOk) blockers.push(c.permit_status === "denied" ? "Permit DENIED" : "Permit pending");
    if (!hoaOk) blockers.push(c.hoa_status === "denied" ? "HOA DENIED" : "HOA pending");

    return { contract: c, balanceCleared, dlOk, permitOk, hoaOk, blockers };
  });

  const blocked = readinessRows.filter((r) => r.blockers.length > 0);
  const ready = readinessRows.filter((r) => r.blockers.length === 0);

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Bookkeeper"
        subtitle={`${contracts.length} active contracts`}
      />

      <main className="px-4 py-5 space-y-6 max-w-4xl mx-auto pb-28">

        {/* ─────────────────────────────────────────────────────────────────
            1. OVERVIEW — at-a-glance numbers
        ───────────────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Total Revenue</p>
              <p className="text-2xl font-bold text-[#00929C] mt-1">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-slate-400 mt-1">{contracts.length} contracts</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Deposits Collected</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalDeposits)}</p>
              <p className="text-xs text-slate-400 mt-1">{formatCurrency(totalRevenue - totalDeposits)} remaining</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Balance Outstanding</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalBalance)}</p>
              <p className="text-xs text-slate-400 mt-1">across {pendingCount} contracts</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Delivery Progress</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{deliveredCount} <span className="text-lg font-normal text-slate-400">/ {deliveredCount + pendingCount}</span></p>
              <p className="text-xs text-slate-400 mt-1">delivered</p>
            </div>
          </div>

          {/* ── AR Aging chart ── */}
          <SectionCard title="Outstanding Balances by Age" subtitle="Accounts receivable aging buckets">
            <OutstandingByAgeChart data={agingData} />
          </SectionCard>
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            2. ACTION ITEMS — what needs Lori's attention right now
        ───────────────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHeader title="Action Items" subtitle="Urgent: refunds to issue, certs expiring, deliveries blocked" />

        {/* ── Pre-Delivery Readiness (Lori's view) ── */}
        <SectionCard
          title="Pre-Delivery Readiness"
          subtitle={`${blocked.length} blocked · ${ready.length} ready · ${readinessRows.length} active`}
        >
          {readinessRows.length === 0 ? (
            <p className="text-sm text-slate-400 px-1">No undelivered contracts.</p>
          ) : (
            <div className="space-y-3">
              {blocked.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                    Delivery blocked ({blocked.length})
                  </p>
                  <div className="divide-y divide-slate-100 rounded-lg border border-amber-200 bg-amber-50/40">
                    {blocked.map(({ contract: c, blockers }) => {
                      const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
                      const location = Array.isArray(c.location) ? c.location[0] : c.location;
                      return (
                        <Link key={c.id} href={`/contracts/${c.id}`} className="block">
                          <div className="px-3 py-2 hover:bg-amber-50 active:bg-amber-100 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-slate-900 text-sm">{c.contract_number}</span>
                                  <span className="text-xs text-slate-500 capitalize">{c.status?.replace(/_/g, " ")}</span>
                                </div>
                                <p className="text-xs text-slate-700 mt-0.5">
                                  {customer?.first_name} {customer?.last_name} · {location?.name ?? "—"}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {blockers.map((b) => (
                                    <span key={b} className="text-xs font-semibold rounded px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <p className="text-sm font-bold text-amber-700 whitespace-nowrap">{formatCurrency(c.balance_due ?? 0)}</p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              {ready.length > 0 && (
                <details>
                  <summary className="text-xs font-bold uppercase tracking-wide text-emerald-700 cursor-pointer">
                    Ready to deliver ({ready.length}) — show
                  </summary>
                  <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-emerald-200 bg-emerald-50/40">
                    {ready.map(({ contract: c }) => {
                      const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
                      const location = Array.isArray(c.location) ? c.location[0] : c.location;
                      return (
                        <Link key={c.id} href={`/contracts/${c.id}`} className="block">
                          <div className="px-3 py-2 hover:bg-emerald-50 active:bg-emerald-100 transition-colors flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-slate-900 text-sm">{c.contract_number}</span>
                              <span className="text-xs text-slate-500 ml-2">
                                {customer?.first_name} {customer?.last_name} · {location?.name ?? "—"}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-emerald-700">All clear</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── Urgent: Tax refund needed (cert received, refund not yet issued) ── */}
        {hasMigration && refundNeededCerts.length > 0 && (
          <div className="rounded-xl p-4 flex items-start gap-3 bg-[#00929C]/8 border border-[#00929C]/30">
            <div className="w-9 h-9 rounded-full bg-[#00929C]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#00929C] text-sm">
                {refundNeededCerts.length} Tax Refund{refundNeededCerts.length !== 1 ? "s" : ""} Needed
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {refundNeededCerts.length === 1
                  ? "A customer has uploaded their TX exemption certificate. Issue the tax refund in QuickBooks and record it on the contract."
                  : `${refundNeededCerts.length} customers have uploaded TX exemption certificates. Issue refunds in QuickBooks and record them on each contract.`
                }
              </p>
            </div>
          </div>
        )}

        {/* ── Tax cert deadline alerts (overdue / due soon) ── */}
        {hasMigration && (overdueCerts.length > 0 || dueSoonCerts.length > 0) && (
          <div className={`rounded-xl p-4 flex items-start gap-3 ${
            overdueCerts.length > 0
              ? "bg-red-50 border border-red-200"
              : "bg-amber-50 border border-amber-200"
          }`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              overdueCerts.length > 0 ? "bg-red-100" : "bg-amber-100"
            }`}>
              <svg className={`w-5 h-5 ${overdueCerts.length > 0 ? "text-red-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-1">
                {overdueCerts.length > 0 && (
                  <span className="font-semibold text-red-800 text-sm">
                    {overdueCerts.length} TX Tax Exemption Cert{overdueCerts.length !== 1 ? "s" : ""} Overdue
                  </span>
                )}
                {dueSoonCerts.length > 0 && (
                  <span className="font-semibold text-amber-800 text-sm">
                    {dueSoonCerts.length} Due Within 7 Days
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Customers have 30 days from purchase date to submit Form 01-339 (TX Sales &amp; Use Tax Exemption). See tracker below.
              </p>
            </div>
          </div>
        )}

        {/* Migration notice if cert columns don't exist yet */}
        {!hasMigration && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-800">
              <strong>Action needed:</strong> Run migration <code className="bg-blue-100 px-1 rounded">010_tax_exempt_cert.sql</code> in Supabase SQL editor to enable tax cert tracking.
            </p>
          </div>
        )}
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            3. TRACKERS — ongoing workflows
        ───────────────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHeader title="Trackers" subtitle="Ongoing workflows for tax exemptions and cancellations" />

          {/* ── Tax Exemption Cert Tracker ── */}
          {hasMigration ? (
            <TaxExemptTracker contracts={taxTracked} />
          ) : null}

          {/* ── Cancellation Refund Tracker ── */}
          <CancellationRefundTracker contracts={cancelledWithDeposits} />
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            4. RECONCILIATION & REPORTS — drill-down detail
        ───────────────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHeader title="Reconciliation & Reports" subtitle="Drill-down detail for monthly close and reporting" />

          {/* ── Deposit Reconciliation (Summary + Transaction Detail) ── */}
          <ReconciliationView contracts={contracts} />

          {/* ── Sales by Location / Event ── */}
          <SalesByEventList contracts={contracts} />
        </section>

      </main>

    </AppShell>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
