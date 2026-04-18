import Link from "next/link";
import { notFound } from "next/navigation";
import {
  dealerById,
  invoicesForDealer,
  coopForDealer,
  coopClaimsForDealer,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function DealerStatementPage({
  params,
}: {
  params: Promise<{ dealerId: string }>;
}) {
  const { dealerId } = await params;
  const dealer = dealerById(dealerId);
  if (!dealer) notFound();

  const invoices = invoicesForDealer(dealerId);
  const coop = coopForDealer(dealerId);
  const claims = coopClaimsForDealer(dealerId);

  const openInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "written_off");
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalBalance = openInvoices.reduce((s, i) => s + i.balance, 0);
  const ytdBilled = invoices.reduce((s, i) => s + i.total, 0);
  const ytdPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/finance" className="hover:text-cyan-700">Finance</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">{dealer.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900">{dealer.name}</h2>
          <p className="text-slate-600 mt-1">
            {dealer.city}, {dealer.state} · {dealer.region} · {dealer.tier} Tier
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Open Balance</p>
          <p
            className="text-4xl font-black mt-1 tabular-nums"
            style={{ color: totalBalance > 0 ? MS_BRAND.colors.primary : "#059669" }}
          >
            {fmtCurrency(totalBalance)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {openInvoices.length} open invoice{openInvoices.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="YTD Billed" value={fmtCurrency(ytdBilled)} />
        <Stat label="YTD Collected" value={fmtCurrency(ytdPaid)} />
        <Stat label="Paid Invoices" value={paidInvoices.length.toString()} />
        <Stat
          label="Overdue"
          value={invoices.filter((i) => i.status === "overdue").length.toString()}
          accent={invoices.some((i) => i.status === "overdue") ? "#DC2626" : undefined}
        />
      </div>

      {coop && (
        <div
          className="rounded-xl p-5 border-l-4"
          style={{ borderColor: MS_BRAND.colors.warning, backgroundColor: `${MS_BRAND.colors.warning}10` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MS_BRAND.colors.warning }}>
                Co-op Fund Position
              </p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {fmtCurrency(coop.available)} available to claim
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {fmtCurrency(coop.ytdAccrued)} accrued YTD at {(coop.accrualRate * 100).toFixed(1)}% of sales
                · {fmtCurrency(coop.ytdClaimed)} already claimed
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">Usage</p>
              <p className="text-2xl font-black" style={{ color: MS_BRAND.colors.warning }}>
                {coop.ytdAccrued > 0 ? ((coop.ytdClaimed / coop.ytdAccrued) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Open invoices */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Open Invoices</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {openInvoices.length} invoice{openInvoices.length !== 1 ? "s" : ""} · {fmtCurrency(totalBalance)} outstanding
            </p>
          </div>
        </div>
        {openInvoices.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">Account in good standing — no open invoices.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Invoice</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Order</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Issued / Due</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Total</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Paid</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {openInvoices.map((inv) => {
                const statusColor = INVOICE_STATUS_COLORS[inv.status];
                return (
                  <tr key={inv.id}>
                    <td className="px-5 py-3 font-mono text-xs font-semibold">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3">
                      <Link href={`/manufacturer/dealer-orders/${inv.orderId}`} className="text-xs font-mono hover:text-cyan-700">
                        {inv.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                      >
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      <p>{fmtDate(inv.issuedAt)}</p>
                      <p className={inv.daysOverdue > 0 ? "text-red-600 font-semibold" : "text-slate-500"}>
                        {inv.daysOverdue > 0 ? `${inv.daysOverdue}d overdue` : `Due ${fmtDate(inv.dueAt)}`}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">{fmtCurrency(inv.total)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-600">
                      {inv.paidAmount > 0 ? fmtCurrency(inv.paidAmount) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-900">
                      {fmtCurrency(inv.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Payment History</h3>
          <p className="text-xs text-slate-500 mt-0.5">Last 15 payments applied</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Date</th>
              <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Invoice</th>
              <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Method</th>
              <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Ref</th>
              <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices
              .flatMap((inv) => inv.payments.map((p) => ({ ...p, invoiceNumber: inv.invoiceNumber })))
              .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
              .slice(0, 15)
              .map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2 text-xs text-slate-700 tabular-nums">{fmtDate(p.receivedAt)}</td>
                  <td className="px-5 py-2 text-xs font-mono">{p.invoiceNumber}</td>
                  <td className="px-5 py-2 text-xs text-slate-700 capitalize">{p.method.replace("_", " ")}</td>
                  <td className="px-5 py-2 text-xs text-slate-500 font-mono">{p.ref}</td>
                  <td className="px-5 py-2 text-right font-bold text-emerald-600 tabular-nums">
                    +{fmtCurrency(p.amount)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Co-op claims */}
      {claims.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Co-op Claim History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {claims.length} claim{claims.length !== 1 ? "s" : ""} submitted
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Campaign</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Submitted</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((c) => {
                const statusColor =
                  c.status === "reimbursed" ? "#059669" :
                  c.status === "approved" ? "#0891B2" :
                  c.status === "denied" ? "#DC2626" : "#D97706";
                return (
                  <tr key={c.id}>
                    <td className="px-5 py-2 text-slate-800 text-xs">{c.campaign}</td>
                    <td className="px-5 py-2 text-xs text-slate-600 tabular-nums">{fmtDate(c.submittedAt)}</td>
                    <td className="px-5 py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider capitalize"
                        style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right font-bold text-slate-900 tabular-nums">
                      {fmtCurrency(c.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <p
        className="text-xl font-black mt-1 tabular-nums"
        style={{ color: accent ?? "#0F172A" }}
      >
        {value}
      </p>
    </div>
  );
}
