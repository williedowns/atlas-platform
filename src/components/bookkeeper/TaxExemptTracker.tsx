"use client";

import { useState } from "react";
import { formatDate, formatCurrency } from "@/lib/utils";

type ContractRow = Record<string, any>;

type CertColor = "red" | "amber" | "teal" | "green" | "grey";

interface CertStatus {
  label: string;
  color: CertColor;
  daysLeft: number | null;
  overdueDays: number | null;
  refundNeeded: boolean;
}

function getCertStatus(c: ContractRow): CertStatus {
  const certReceived = !!c.tax_exempt_cert_received;
  const taxAmount = c.tax_amount ?? 0;
  const refundIssued = !!(c.tax_refund_issued_at);

  // Cert received
  if (certReceived) {
    // Refund needed: cert received, has tax, refund not yet issued
    if (taxAmount > 0 && !refundIssued) {
      return { label: "Refund Needed", color: "teal", daysLeft: null, overdueDays: null, refundNeeded: true };
    }
    // Refund already issued (or no tax to refund)
    return { label: "Received", color: "green", daysLeft: null, overdueDays: null, refundNeeded: false };
  }

  // Cert not received — check deadline
  const created = new Date(c.created_at);
  const deadline = new Date(created);
  deadline.setDate(deadline.getDate() + 30);
  const now = new Date();
  const msDiff = deadline.getTime() - now.getTime();
  const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return { label: `${Math.abs(daysDiff)}d overdue`, color: "red", daysLeft: null, overdueDays: Math.abs(daysDiff), refundNeeded: false };
  }
  if (daysDiff <= 7) {
    return { label: `${daysDiff}d left`, color: "amber", daysLeft: daysDiff, overdueDays: null, refundNeeded: false };
  }
  return { label: `${daysDiff}d left`, color: "grey", daysLeft: daysDiff, overdueDays: null, refundNeeded: false };
}

const STATUS_CHIP: Record<CertColor, string> = {
  red:   "bg-red-100 text-red-700 border border-red-200",
  amber: "bg-amber-100 text-amber-700 border border-amber-200",
  teal:  "bg-[#00929C]/10 text-[#00929C] border border-[#00929C]/30 font-bold",
  green: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  grey:  "bg-slate-100 text-slate-500 border border-slate-200",
};

export default function TaxExemptTracker({ contracts }: { contracts: ContractRow[] }) {
  const [certState, setCertState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState("");

  // Merge local toggle state with server data
  const getReceived = (c: ContractRow) =>
    certState[c.id] !== undefined ? certState[c.id] : !!c.tax_exempt_cert_received;

  async function toggleCert(contractId: string, received: boolean) {
    setLoading((prev) => ({ ...prev, [contractId]: true }));
    try {
      const res = await fetch(`/api/contracts/${contractId}/tax-exempt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received }),
      });
      if (res.ok) {
        setCertState((prev) => ({ ...prev, [contractId]: received }));
      }
    } finally {
      setLoading((prev) => ({ ...prev, [contractId]: false }));
    }
  }

  // Sort priority: refund_needed → overdue (red) → due soon (amber) → upcoming (grey) → received (green)
  const colorOrder: Record<CertColor, number> = { teal: 0, red: 1, amber: 2, grey: 3, green: 4 };

  const sorted = [...contracts].sort((a, b) => {
    const sa = getCertStatus({ ...a, tax_exempt_cert_received: getReceived(a) });
    const sb = getCertStatus({ ...b, tax_exempt_cert_received: getReceived(b) });
    if (colorOrder[sa.color] !== colorOrder[sb.color]) return colorOrder[sa.color] - colorOrder[sb.color];
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const filtered = search.trim()
    ? sorted.filter((c) => {
        const q = search.toLowerCase().trim();
        const name = `${c.customer?.first_name ?? ""} ${c.customer?.last_name ?? ""}`.toLowerCase();
        const phone = (c.customer?.phone ?? "").toLowerCase().replace(/\D/g, "");
        const email = (c.customer?.email ?? "").toLowerCase();
        const contractNum = (c.contract_number ?? "").toLowerCase();
        const amount = String(c.total ?? "");
        return (
          name.includes(q) ||
          phone.includes(q.replace(/\D/g, "")) ||
          email.includes(q) ||
          contractNum.includes(q) ||
          amount.includes(q)
        );
      })
    : sorted;

  const refundNeededCount = sorted.filter((c) =>
    getCertStatus({ ...c, tax_exempt_cert_received: getReceived(c) }).refundNeeded
  ).length;
  const overdueCount = sorted.filter((c) =>
    getCertStatus({ ...c, tax_exempt_cert_received: getReceived(c) }).color === "red"
  ).length;
  const dueSoonCount = sorted.filter((c) =>
    getCertStatus({ ...c, tax_exempt_cert_received: getReceived(c) }).color === "amber"
  ).length;
  const receivedCount = sorted.filter((c) => getReceived(c)).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <svg className="w-5 h-5 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-semibold text-slate-900">TX Tax Exemption Certs</span>
          {refundNeededCount > 0 && (
            <span className="bg-[#00929C]/10 text-[#00929C] border border-[#00929C]/30 text-xs font-bold px-2 py-0.5 rounded-full">
              {refundNeededCount} refund{refundNeededCount !== 1 ? "s" : ""} needed
            </span>
          )}
          {overdueCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {overdueCount} overdue
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {dueSoonCount} due soon
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{receivedCount}/{sorted.length} received</span>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <>
          {/* Search */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, contract #, phone, email, or amount…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/40 placeholder:text-slate-400"
            />
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-slate-50 border-t border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <div className="col-span-3">Customer</div>
            <div className="col-span-3">Contract</div>
            <div className="col-span-2">Purchased</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2"></div>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">
                {search ? "No customers match your search." : "No contracts to track."}
              </p>
            ) : (
              filtered.map((c) => {
                const received = getReceived(c);
                const status = getCertStatus({ ...c, tax_exempt_cert_received: received });
                const isLoading = !!loading[c.id];
                const deadline = new Date(c.created_at);
                deadline.setDate(deadline.getDate() + 30);
                const certUrl = c.tax_exempt_cert_url ?? null;
                const taxAmount = c.tax_amount ?? 0;

                return (
                  <div key={c.id} className={`px-4 py-3 ${received && !status.refundNeeded ? "opacity-60" : ""}`}>
                    <div className="grid grid-cols-12 gap-1 items-center">
                      {/* Customer */}
                      <div className="col-span-3 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {c.customer?.first_name} {c.customer?.last_name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{c.customer?.phone ?? ""}</p>
                      </div>

                      {/* Contract # */}
                      <div className="col-span-3 min-w-0">
                        <p className="text-xs font-mono text-slate-600 truncate">{c.contract_number}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {status.refundNeeded
                            ? `Tax: ${formatCurrency(taxAmount)}`
                            : `Due ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          }
                        </p>
                      </div>

                      {/* Purchase date */}
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">{formatDate(c.created_at)}</p>
                      </div>

                      {/* Status chip */}
                      <div className="col-span-2">
                        <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-lg ${STATUS_CHIP[status.color]}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        {/* View cert link */}
                        {certUrl && (
                          <a
                            href={certUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View uploaded certificate"
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-[#00929C]/10 hover:text-[#00929C] transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </a>
                        )}

                        {/* Toggle cert received */}
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => toggleCert(c.id, !received)}
                          title={received ? "Mark as not received" : "Mark as received"}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors touch-manipulation ${
                            received
                              ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-400 hover:bg-[#00929C]/10 hover:text-[#00929C]"
                          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {isLoading ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : received ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Refund needed callout row */}
                    {status.refundNeeded && (
                      <div className="mt-2 flex items-center gap-2 bg-[#00929C]/5 border border-[#00929C]/20 rounded-lg px-3 py-2">
                        <svg className="w-4 h-4 text-[#00929C] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-xs text-[#00929C] font-semibold">
                          Tax refund of {formatCurrency(taxAmount)} due — issue credit/refund in QuickBooks and record via contract detail.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
