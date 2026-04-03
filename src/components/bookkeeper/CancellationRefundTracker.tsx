"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CancelledContract = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEffectiveDeposit(c: Record<string, any>): number {
  // Prefer the contract-level deposit_paid field when it's populated.
  // Fall back to summing non-failed payment records — this catches contracts
  // where deposit_paid wasn't updated due to a payment stuck in "processing".
  if ((c.deposit_paid ?? 0) > 0) return c.deposit_paid as number;
  const payments: { amount: number; status: string }[] = Array.isArray(c.payments) ? c.payments : [];
  const collected = payments
    .filter((p) => p.status !== "failed")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  return collected;
}

function parseRefundAmount(notes: string | null, effectiveDeposit: number): number {
  if (!notes) return effectiveDeposit;
  const match = notes.match(/Refund of \$([0-9,]+\.?[0-9]*)/);
  if (!match) return effectiveDeposit;
  return parseFloat(match[1].replace(/,/g, "")) || effectiveDeposit;
}

function parseCancelledDate(notes: string | null, createdAt: string): string {
  // The cancel route stamps the cancellation into notes but not a separate date field.
  // Fall back to created_at for the display date. A future migration could add cancelled_at.
  return new Date(createdAt).toLocaleDateString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric",
  });
}

function isProcessed(notes: string | null): boolean {
  return !!notes?.includes("REFUND PROCESSED IN QB");
}

export default function CancellationRefundTracker({
  contracts,
}: {
  contracts: CancelledContract[];
}) {
  const [localState, setLocalState] = useState<Record<string, boolean>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Only show contracts where money was actually collected (deposit_paid OR payments)
  // and where the refund hasn't been processed yet.
  const withDeposits = contracts.filter((c) => getEffectiveDeposit(c) > 0);
  const pending = withDeposits.filter(
    (c) => !isProcessed(c.notes) && !localState[c.id]
  );
  const done = withDeposits.length - pending.length;

  const handleMarkRefunded = async (contractId: string) => {
    setLoadingId(contractId);
    try {
      const res = await fetch(`/api/contracts/${contractId}/mark-refunded`, {
        method: "POST",
      });
      if (res.ok) {
        setLocalState((prev) => ({ ...prev, [contractId]: true }));
      }
    } finally {
      setLoadingId(null);
    }
  };

  // ── Nothing to show ──
  if (withDeposits.length === 0) return null;

  if (pending.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-emerald-800 text-sm">All cancellation refunds processed</p>
          <p className="text-xs text-emerald-600 mt-0.5">{withDeposits.length} refund{withDeposits.length !== 1 ? "s" : ""} marked as issued in QuickBooks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-red-200 overflow-hidden">

      {/* ── Collapsible header ── */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-red-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm">Pending Refunds</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                {pending.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Cancelled contracts with deposits to refund in QuickBooks</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-red-100">
          <ul className="divide-y divide-slate-50">
            {pending.map((c) => {
              const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
              const show = Array.isArray(c.show) ? c.show[0] : c.show;
              const location = Array.isArray(c.location) ? c.location[0] : c.location;
              const salesLocation = show?.name ?? location?.name ?? "—";
              const lineItems = Array.isArray(c.line_items) ? c.line_items : [];
              const productSummary = lineItems
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((li: any) =>
                  li.quantity && li.quantity > 1 ? `${li.product_name} (x${li.quantity})` : li.product_name
                )
                .join(", ") || "—";
              const effectiveDeposit = getEffectiveDeposit(c);
              const refundAmount = parseRefundAmount(c.notes, effectiveDeposit);
              const cancelDate = parseCancelledDate(c.notes, c.created_at);

              // Extract the cancellation reason from notes
              const reasonMatch = c.notes?.match(/CANCELLED: (.+?)(?:\n|$)/);
              const cancelReason = reasonMatch?.[1]?.replace(/\. Refund.*$/, "") ?? null;

              const isLoading = loadingId === c.id;

              return (
                <li key={c.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="font-semibold text-slate-900 hover:text-[#00929C] transition-colors"
                        >
                          {customer ? `${customer.first_name} ${customer.last_name}` : "—"}
                        </Link>
                        <span className="text-xs text-slate-400">{c.contract_number}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{productSummary}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{salesLocation} · Cancelled {cancelDate}</p>
                      {cancelReason && (
                        <p className="text-xs text-slate-500 mt-1 italic">"{cancelReason}"</p>
                      )}
                    </div>

                    {/* Amounts + action */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Deposit paid</p>
                        <p className="font-bold text-slate-900">{formatCurrency(effectiveDeposit)}</p>
                        {refundAmount !== effectiveDeposit && (
                          <p className="text-xs text-amber-600 font-medium">
                            Refund: {formatCurrency(refundAmount)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMarkRefunded(c.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {isLoading ? "Saving…" : "✓ Mark Refunded in QB"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {done > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-400">{done} refund{done !== 1 ? "s" : ""} already marked as processed</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
