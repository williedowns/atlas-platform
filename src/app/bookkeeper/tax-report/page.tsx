export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaxReportCsvExport } from "@/components/bookkeeper/TaxReportCsvExport";

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    show?: string;
    location?: string;
    tax_status?: string;
  }>;
}

// Tax statuses we surface in the table + filter pills.
//   charged       — tax_amount > 0, tax_exempt = false
//   exempt_pending — tax_exempt = true, no cert received yet (Rx outstanding, Comptroller deduction not yet earned)
//   exempt_cert    — tax_exempt = true, cert received but no refund issued yet
//   refunded       — tax_refund_issued_at is set
type TaxStatus = "charged" | "exempt_pending" | "exempt_cert" | "refunded";
function classifyTaxStatus(c: {
  tax_exempt?: boolean | null;
  tax_amount?: number | null;
  tax_exempt_cert_received?: boolean | null;
  tax_refund_issued_at?: string | null;
}): TaxStatus {
  if (c.tax_refund_issued_at) return "refunded";
  if (c.tax_exempt) return c.tax_exempt_cert_received ? "exempt_cert" : "exempt_pending";
  return "charged";
}

const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  charged: "Charged",
  exempt_pending: "Exempt — Rx pending",
  exempt_cert: "Exempt — Cert received",
  refunded: "Refunded",
};

const TAX_STATUS_TONES: Record<TaxStatus, string> = {
  charged: "bg-slate-100 text-slate-700 border-slate-200",
  exempt_pending: "bg-amber-100 text-amber-800 border-amber-300",
  exempt_cert: "bg-emerald-100 text-emerald-800 border-emerald-300",
  refunded: "bg-sky-100 text-sky-800 border-sky-300",
};

function defaultMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: first.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export default async function TaxReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  // Same gate the bookkeeper landing page uses — admin/manager/bookkeeper only
  const { hasPermission } = await import("@/lib/permissions");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgPerms = (profile?.organization as any)?.role_permissions ?? null;
  if (!hasPermission(orgPerms, profile?.role, "bookkeeper")) redirect("/dashboard");

  // Date range: searchParams override, else current month-to-date
  const defaults = defaultMonthRange();
  const from = params.from || defaults.from;
  const to = params.to || defaults.to;

  // Pull the contracts we need, with everything required to file Texas
  // Form 01-114 (sales tax) plus answer IRS gross-receipts questions.
  let q = supabase
    .from("contracts")
    .select(`
      id, contract_number, status, created_at,
      total, subtotal, discount_total,
      tax_rate, tax_amount, tax_exempt,
      doc_fee_amount, doc_fee_waived, doc_fee_tax_amount,
      tax_exempt_cert_received, tax_exempt_cert_received_at,
      tax_refund_amount, tax_refund_issued_at,
      customer:customers(first_name, last_name, state),
      show:shows(id, name),
      location:locations(id, name, state),
      sales_rep:profiles!contracts_sales_rep_id_fkey(full_name)
    `)
    .not("status", "in", '("quote","draft","cancelled")')
    .not("idempotency_key", "is", null)
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (params.location && params.location !== "all") q = q.eq("location_id", params.location);
  if (params.show && params.show !== "all") q = q.eq("show_id", params.show);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contractsRaw } = await q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allContracts = (contractsRaw ?? []) as any[];

  // Filter pills for location/show — pull all options visible in the date range
  const locationOptions = Array.from(
    new Map(
      allContracts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => (Array.isArray(c.location) ? c.location[0] : c.location))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((l: any): l is { id: string; name: string } => !!l?.id && !!l?.name)
        .map((l: { id: string; name: string }) => [l.id, l])
    ).values()
  );
  const showOptions = Array.from(
    new Map(
      allContracts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => (Array.isArray(c.show) ? c.show[0] : c.show))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((s: any): s is { id: string; name: string } => !!s?.id && !!s?.name)
        .map((s: { id: string; name: string }) => [s.id, s])
    ).values()
  );

  // Apply tax_status filter (client-side derived classification)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredContracts = allContracts.filter((c: any) => {
    if (!params.tax_status || params.tax_status === "all") return true;
    return classifyTaxStatus(c) === params.tax_status;
  });

  // ── Aggregates ───────────────────────────────────────────────────────────
  const totalItemsTax = filteredContracts.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, c: any) => s + Number(c.tax_amount ?? 0),
    0
  );
  const totalDocFeeTax = filteredContracts.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, c: any) => s + Number(c.doc_fee_tax_amount ?? 0),
    0
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exemptPendingRows = filteredContracts.filter((c: any) => classifyTaxStatus(c) === "exempt_pending");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exemptCertRows = filteredContracts.filter((c: any) => classifyTaxStatus(c) === "exempt_cert");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refundedRows = filteredContracts.filter((c: any) => classifyTaxStatus(c) === "refunded");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalRefunded = refundedRows.reduce((s: number, c: any) => s + Number(c.tax_refund_amount ?? 0), 0);
  // Estimated tax that would be due if every pending exemption falls through
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exemptPendingTaxAtRisk = exemptPendingRows.reduce((s: number, c: any) => {
    const itemsSubtotal = Math.max(
      0,
      Number(c.subtotal ?? 0) - (c.doc_fee_waived ? 0 : Number(c.doc_fee_amount ?? 0))
    );
    return s + (itemsSubtotal - Number(c.discount_total ?? 0)) * Number(c.tax_rate ?? 0);
  }, 0);

  // Group by location for the table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byLocation = new Map<string, any[]>();
  for (const c of filteredContracts) {
    const loc = Array.isArray(c.location) ? c.location[0] : c.location;
    const key = loc?.name ?? "—";
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key)!.push(c);
  }

  // Build the URL preserving other filters when toggling one
  function urlWith(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string | undefined> = {
      from, to,
      show: params.show,
      location: params.location,
      tax_status: params.tax_status,
      ...overrides,
    };
    const qs = Object.entries(merged)
      .filter(([, v]) => v !== undefined && v !== "" && v !== "all")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
      .join("&");
    return qs ? `/bookkeeper/tax-report?${qs}` : "/bookkeeper/tax-report";
  }

  // CSV row shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const csvRows = filteredContracts.map((c: any) => {
    const loc = Array.isArray(c.location) ? c.location[0] : c.location;
    const show = Array.isArray(c.show) ? c.show[0] : c.show;
    const cust = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const rep = Array.isArray(c.sales_rep) ? c.sales_rep[0] : c.sales_rep;
    const status = classifyTaxStatus(c);
    return {
      contract_number: c.contract_number ?? "",
      date: c.created_at ? c.created_at.slice(0, 10) : "",
      sales_rep: rep?.full_name ?? "",
      location_name: loc?.name ?? "",
      location_state: loc?.state ?? "",
      show_name: show?.name ?? "",
      customer_name: `${cust?.first_name ?? ""} ${cust?.last_name ?? ""}`.trim(),
      customer_state: cust?.state ?? "",
      sale_total: Number(c.total ?? 0),
      sale_subtotal: Number(c.subtotal ?? 0),
      discount_total: Number(c.discount_total ?? 0),
      tax_rate: Number(c.tax_rate ?? 0),
      items_tax: Number(c.tax_amount ?? 0),
      doc_fee_amount: c.doc_fee_waived ? 0 : Number(c.doc_fee_amount ?? 0),
      doc_fee_tax: Number(c.doc_fee_tax_amount ?? 0),
      total_tax_collected: Number(c.tax_amount ?? 0) + Number(c.doc_fee_tax_amount ?? 0),
      tax_status: TAX_STATUS_LABELS[status],
      cert_received: c.tax_exempt_cert_received ? "Y" : "N",
      cert_received_at: c.tax_exempt_cert_received_at
        ? c.tax_exempt_cert_received_at.slice(0, 10)
        : "",
      refund_amount: Number(c.tax_refund_amount ?? 0),
      refund_issued_at: c.tax_refund_issued_at ? c.tax_refund_issued_at.slice(0, 10) : "",
    };
  });

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Tax Report"
        subtitle={`${filteredContracts.length} contracts · ${from} → ${to}`}
        backHref="/bookkeeper"
      />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Filters ── */}
        <SectionCard title="Filters">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">From</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={from}
                  form="tax-report-filter-form"
                  className="mt-1 block w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">To</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={to}
                  form="tax-report-filter-form"
                  className="mt-1 block w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00929C]"
                />
              </label>
            </div>
            <form
              id="tax-report-filter-form"
              method="get"
              action="/bookkeeper/tax-report"
              className="flex items-center gap-2"
            >
              {params.show && <input type="hidden" name="show" value={params.show} />}
              {params.location && <input type="hidden" name="location" value={params.location} />}
              {params.tax_status && <input type="hidden" name="tax_status" value={params.tax_status} />}
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00929C] text-white hover:bg-[#007a82]"
              >
                Apply date range
              </button>
              <Link
                href="/bookkeeper/tax-report"
                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Reset to current month
              </Link>
            </form>

            {locationOptions.length > 1 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Location</p>
                <div className="flex flex-wrap gap-2">
                  <FilterPill
                    label="All locations"
                    href={urlWith({ location: undefined })}
                    active={!params.location || params.location === "all"}
                  />
                  {locationOptions.map((l) => (
                    <FilterPill
                      key={l.id}
                      label={l.name}
                      href={urlWith({ location: l.id })}
                      active={params.location === l.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {showOptions.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Show</p>
                <div className="flex flex-wrap gap-2">
                  <FilterPill
                    label="All shows"
                    href={urlWith({ show: undefined })}
                    active={!params.show || params.show === "all"}
                  />
                  {showOptions.map((s) => (
                    <FilterPill
                      key={s.id}
                      label={s.name}
                      href={urlWith({ show: s.id })}
                      active={params.show === s.id}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Tax status</p>
              <div className="flex flex-wrap gap-2">
                <FilterPill
                  label="All"
                  href={urlWith({ tax_status: undefined })}
                  active={!params.tax_status || params.tax_status === "all"}
                />
                {(Object.keys(TAX_STATUS_LABELS) as TaxStatus[]).map((k) => (
                  <FilterPill
                    key={k}
                    label={TAX_STATUS_LABELS[k]}
                    href={urlWith({ tax_status: k })}
                    active={params.tax_status === k}
                  />
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Aggregates ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat
            label="Items Tax (refundable)"
            value={formatCurrency(totalItemsTax)}
            sub={`${filteredContracts.length} contracts`}
          />
          <Stat
            label="Doc Fee Tax (non-refundable)"
            value={formatCurrency(totalDocFeeTax)}
            sub="Always remitted"
          />
          <Stat
            label="Exempt — Pending Rx"
            value={formatCurrency(exemptPendingTaxAtRisk)}
            sub={`${exemptPendingRows.length} contracts at risk`}
            tone="amber"
          />
          <Stat
            label="Exempt — Cert Received"
            value={`${exemptCertRows.length}`}
            sub="Awaiting refund issuance"
            tone="emerald"
          />
          <Stat
            label="Refunded YTD-range"
            value={formatCurrency(totalRefunded)}
            sub={`${refundedRows.length} refunds issued`}
            tone="sky"
          />
        </div>

        {/* ── Export ── */}
        <TaxReportCsvExport rows={csvRows} from={from} to={to} />

        {/* ── Per-contract table ── */}
        {filteredContracts.length === 0 ? (
          <EmptyState
            title="No contracts in this filter"
            description="Try widening the date range or clearing filters."
          />
        ) : (
          [...byLocation.entries()].map(([locationName, rows]) => {
            const itemsSum = rows.reduce((s, c) => s + Number(c.tax_amount ?? 0), 0);
            const docFeeSum = rows.reduce((s, c) => s + Number(c.doc_fee_tax_amount ?? 0), 0);
            return (
              <SectionCard
                key={locationName}
                title={locationName}
                subtitle={`${rows.length} contracts · ${formatCurrency(itemsSum + docFeeSum)} tax collected`}
                bodyClassName="p-0"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Contract</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2 text-right">Items Tax</th>
                        <th className="px-3 py-2 text-right">Doc Fee Tax</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Cert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => {
                        const cust = Array.isArray(c.customer) ? c.customer[0] : c.customer;
                        const status = classifyTaxStatus(c);
                        return (
                          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-xs">
                              <Link href={`/contracts/${c.id}`} className="text-[#00929C] hover:underline">
                                {c.contract_number}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(c.created_at)}</td>
                            <td className="px-3 py-2 text-slate-900">
                              {cust?.first_name} {cust?.last_name}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(Number(c.tax_amount ?? 0))}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(Number(c.doc_fee_tax_amount ?? 0))}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${TAX_STATUS_TONES[status]}`}>
                                {TAX_STATUS_LABELS[status]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 text-xs">
                              {c.tax_exempt_cert_received_at
                                ? formatDate(c.tax_exempt_cert_received_at)
                                : c.tax_exempt
                                  ? "—"
                                  : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          })
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

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "amber" | "emerald" | "sky";
}) {
  const accent =
    tone === "amber"
      ? "text-amber-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : tone === "sky"
          ? "text-sky-700"
          : "text-slate-900";
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 whitespace-nowrap overflow-hidden text-ellipsis ${accent}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
