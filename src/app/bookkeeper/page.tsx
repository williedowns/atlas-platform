export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import TaxExemptTracker from "@/components/bookkeeper/TaxExemptTracker";
import ReconciliationView from "@/components/bookkeeper/ReconciliationView";
import SalesByEventList from "@/components/bookkeeper/SalesByEventList";

export default async function BookkeeperPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["admin", "manager", "bookkeeper"];
  if (!allowedRoles.includes(profile?.role ?? "")) redirect("/dashboard");

  // ── Fetch all active contracts with full financial + customer + line item data ──
  const { data: contractsRaw, error } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, status, is_contingent,
      total, subtotal, discount_total, tax_amount,
      deposit_paid, balance_due, payment_method,
      line_items, notes, created_at,
      tax_exempt_cert_received, tax_exempt_cert_received_at,
      customer:customers(id, first_name, last_name, phone, email),
      show:shows(id, name, start_date, end_date),
      location:locations(id, name),
      sales_rep:profiles(full_name)
    `)
    .not("status", "in", '("quote","draft","cancelled")')
    .order("created_at", { ascending: false })
    .limit(500);

  const contracts = (contractsRaw ?? []) as any[];

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

  const hasCertAlert = overdueCerts.length > 0 || dueSoonCerts.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <img src="/logo.png" alt="Atlas Spas & Swim Spas" className="h-8 w-auto bg-white rounded px-2 py-0.5" />
            <p className="text-white/60 text-xs mt-0.5">
              {profile?.full_name} · Bookkeeper
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
            </p>
            <p className="text-xs text-white/30 mt-0.5">{contracts.length} active contracts</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-3xl mx-auto pb-28">

        {/* ── Urgent: Tax cert alert ── */}
        {hasMigration && hasCertAlert && (
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
                Customers have 30 days from purchase date to submit Form 01-339 (TX Sales & Use Tax Exemption). See tracker below.
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

        {/* ── Tax Exemption Cert Tracker ── */}
        {hasMigration ? (
          <TaxExemptTracker contracts={taxTracked} />
        ) : null}

        {/* ── Deposit Reconciliation ── */}
        <ReconciliationView contracts={contracts} />

        {/* ── Sales by Location / Event ── */}
        <SalesByEventList contracts={contracts} />

      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex safe-bottom">
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs mt-1">Home</span>
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
        <Link href="/bookkeeper" className="flex-1 flex flex-col items-center py-3 text-[#00929C]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-xs mt-1 font-medium">Books</span>
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
