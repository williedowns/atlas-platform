"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface CcPayment {
  card_brand: string;
  card_last4: string;
}

interface Props {
  contractId: string;
  taxAmount: number;
  ccPayment?: CcPayment | null;
  existingRefund?: {
    amount: number;
    issued_at: string;
    notes: string | null;
  } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function CardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

export function TaxRefundButton({ contractId, taxAmount, ccPayment, existingRefund }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(taxAmount > 0 ? taxAmount.toFixed(2) : "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState(existingRefund ?? null);

  const hasCard = !!ccPayment?.card_last4;
  const cardLabel = hasCard
    ? `${ccPayment!.card_brand} ····${ccPayment!.card_last4}`
    : null;

  // Already issued — show read-only state
  if (issued) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Tax Refund Issued</p>
            <p className="text-emerald-700 text-sm font-bold mt-0.5">{formatCurrency(issued.amount)}</p>
            <p className="text-xs text-emerald-600 mt-0.5">{formatDate(issued.issued_at)}</p>
            {issued.notes && (
              <p className="text-xs text-slate-500 mt-1 italic">"{issued.notes}"</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/tax-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to issue refund."); return; }
      setIssued({ amount: parsedAmount, issued_at: data.issued_at, notes: (data.notes ?? notes) || null });
      setOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-semibold text-sm hover:bg-amber-100 transition-colors"
        >
          <CardIcon />
          {hasCard
            ? `Refund ${formatCurrency(taxAmount)} to ${cardLabel}`
            : "Record Tax Refund"}
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold text-amber-900 text-sm">
              {hasCard ? "Refund Tax to Card" : "Record Tax Refund"}
            </p>
            {taxAmount > 0 && (
              <p className="text-xs text-slate-500">
                Tax: <span className="font-semibold">{formatCurrency(taxAmount)}</span>
              </p>
            )}
          </div>

          {/* Card info banner */}
          {hasCard && (
            <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                <CardIcon />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">{cardLabel}</p>
                <p className="text-xs text-slate-500">Refund will be processed to this card via Intuit Payments</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Refund Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={hasCard ? "e.g. TX exemption cert received 4/8/2026" : "e.g. Credit memo in QuickBooks, ACH refund…"}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {loading
                ? (hasCard ? "Processing…" : "Saving…")
                : (hasCard ? `Refund ${formatCurrency(parseFloat(amount) || 0)} to Card` : "Confirm Refund")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
